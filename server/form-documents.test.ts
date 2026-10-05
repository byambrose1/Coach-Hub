import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import express from "express";
import { randomUUID } from "node:crypto";
import { registerCustomFormRoutes, hashFormToken } from "./custom-form-routes";
import type { CustomFormStorage, RequestRow } from "./custom-form-storage";
import type { FormDocumentStorage, DocumentSelector } from "./form-document-storage";
import { validateDocument, validateDocumentAnswers, FormDocumentError } from "./form-document-validation";
import { templateInputSchema, validateFormAnswers } from "@shared/custom-forms";
import { MAX_DOCUMENT_BYTES } from "@shared/form-documents";

const pdf = Buffer.from("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=", "base64");
const question = { id: "evidence", label: "Upload your document", type: "file" as const, required: true };
const token = "a".repeat(64);
function docxFixture(names = ["[Content_Types].xml", "_rels/.rels", "word/document.xml"]) {
  const local: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const name of names) {
    const nameBytes = Buffer.from(name);
    const content = Buffer.from("<document/>");
    let crc = 0xffffffff;
    for (const byte of content) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(content.length, 18); header.writeUInt32LE(content.length, 22); header.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46); entry.writeUInt32LE(0x02014b50);
    entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(content.length, 20); entry.writeUInt32LE(content.length, 24); entry.writeUInt16LE(nameBytes.length, 28); entry.writeUInt32LE(offset, 42);
    local.push(header, nameBytes, content); central.push(entry, nameBytes);
    offset += header.length + nameBytes.length + content.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(names.length, 8); end.writeUInt16LE(names.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
const request: RequestRow = {
  id: "test-request", userId: "owner", clientId: "client-owner", templateId: null,
  title: "Document request", description: "", questions: [question], tokenHash: hashFormToken(token),
  status: "pending", expiresAt: new Date(Date.now() + 86400000).toISOString(), completedAt: null, clientFormId: null,
};
let saved = new Map<string, any>();
let saveCalls = 0;
const forms = {
  publicRequest: async (hash: string) => request.tokenHash === hash && request.status === "pending" && Date.parse(request.expiresAt) > Date.now() ? request : undefined,
  request: async (owner: string, id: string) => request.userId === owner && request.id === id ? request : undefined,
  createTemplate: async (owner: string, input: any) => ({ ...input, id: "basic", userId: owner, createdAt: "", updatedAt: "" }),
} as unknown as CustomFormStorage;
const resolve = (selector: DocumentSelector) => "tokenHash" in selector ? selector.tokenHash === request.tokenHash : selector.userId === request.userId && selector.id === request.id;
const documents: FormDocumentStorage = {
  save: async (selector, questionId, file) => {
    assert.ok(resolve(selector)); saveCalls++;
    const row = { ...file, id: randomUUID(), userId: request.userId, clientId: request.clientId,
      requestId: request.id, questionId, clientFormId: null, expiresAt: request.expiresAt, createdAt: "" };
    saved.set(row.id, row);
    return { id: row.id, fileName: row.fileName, mediaType: row.mediaType, byteSize: row.byteSize };
  },
  remove: async (selector, id) => resolve(selector) && saved.delete(id),
  download: async (owner, id) => saved.get(id)?.userId === owner ? saved.get(id) : undefined,
};
let server: ReturnType<typeof createServer>;
let origin: string;
before(async () => {
  const app = express(); app.use(express.json());
  registerCustomFormRoutes(app, { forms, documents, storage: { getClient: async () => undefined },
    getUserId: req => req.get("x-owner"),
    isAuthenticated: (req, res, next) => {
      if (!req.get("x-owner")) { res.sendStatus(401); return; }
      (req as any).session = req.get("x-impersonating") ? { impersonatedUserId: "owner" } : {};
      next();
    },
  });
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as any).port}`;
});
after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
function upload(path = "/api/public-forms/documents", headers: Record<string, string> = {}, bytes = pdf) {
  return fetch(origin + path, { method: "POST", body: bytes, headers: {
    "content-type": "application/octet-stream", "x-form-token": token,
    "x-question-id": question.id, "x-file-name": "evidence.pdf", ...headers,
  } });
}

test("basic templates remain available to Free coaches without a subscription dependency", async () => {
  const response = await fetch(origin + "/api/form-templates", { method: "POST", headers: {
    "content-type": "application/json", "x-owner": "owner",
  }, body: JSON.stringify({ title: "Basic intake", description: "", questions: [
    { id: "text", label: "Your goals", type: "text", required: true },
    { id: "yn", label: "Ready?", type: "yes_no", required: false },
  ] }) });
  assert.equal(response.status, 201);
});
test("private bearer link uploads return metadata only; download requires owning coach", async () => {
  const response = await upload();
  assert.equal(response.status, 201);
  const document = await response.json();
  assert.deepEqual(Object.keys(document).sort(), ["byteSize", "fileName", "id", "mediaType"]);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const url = origin + `/api/form-documents/${document.id}/download`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { "x-form-token": token } })).status, 401);
  assert.equal((await fetch(url, { headers: { "x-owner": "another-coach" } })).status, 404);
  assert.equal((await fetch(url, { headers: { "x-owner": "owner", "x-impersonating": "yes" } })).status, 403);
  const download = await fetch(url, { headers: { "x-owner": "owner" } });
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition")!, /^attachment;/);
  assert.equal(download.headers.get("content-type"), "application/octet-stream");
  assert.equal(download.headers.get("x-content-type-options"), "nosniff");
  assert.equal(download.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);
});
test("invalid, expired, revoked and completed links cannot upload", async () => {
  const before = saveCalls;
  assert.equal((await upload(undefined, { "x-form-token": "b".repeat(64) })).status, 404);
  const expiry = request.expiresAt;
  request.expiresAt = "2020-01-01";
  assert.equal((await upload()).status, 404);
  request.expiresAt = expiry;
  for (const status of ["completed", "revoked"]) {
    request.status = status; assert.equal((await upload()).status, 404);
  }
  request.status = "pending";
  assert.equal(saveCalls, before);
});
test("question spoofing, unsafe names, wrong MIME and oversized bodies are rejected before saving", async () => {
  const before = saveCalls;
  assert.equal((await upload(undefined, { "x-question-id": "another-question" })).status, 400);
  assert.equal((await upload(undefined, { "x-file-name": encodeURIComponent("../evidence.pdf") })).status, 400);
  assert.equal((await upload(undefined, { "content-type": "text/plain" })).status, 415);
  assert.equal((await upload(undefined, {}, Buffer.alloc(MAX_DOCUMENT_BYTES + 1))).status, 413);
  assert.equal((await upload(undefined, {}, Buffer.from("<script>bad()</script>"))).status, 400);
  assert.equal(saveCalls, before);
});
test("coach-entered uploads are authenticated, tenant scoped and removable", async () => {
  const path = `/api/form-requests/${request.id}/documents`;
  assert.equal((await upload(path)).status, 401);
  assert.equal((await upload(path, { "x-owner": "another" })).status, 404);
  assert.equal((await upload(path, { "x-owner": "owner", "x-impersonating": "yes" })).status, 403);
  const uploaded = await (await upload(path, { "x-owner": "owner" })).json();
  assert.equal((await fetch(origin + `${path}/${uploaded.id}`, { method: "DELETE", headers: { "x-owner": "another" } })).status, 404);
  assert.equal((await fetch(origin + `${path}/${uploaded.id}`, { method: "DELETE", headers: { "x-owner": "owner" } })).status, 204);
  assert.equal((await fetch(origin + `/api/form-documents/${uploaded.id}/download`, { headers: { "x-owner": "owner" } })).status, 404);
});
test("document signatures, size and names are checked independently of the client MIME", () => {
  assert.equal(validateDocument("valid.pdf", pdf).mediaType, "application/pdf");
  assert.equal(validateDocument("image.png", png).mediaType, "image/png");
  assert.equal(validateDocument("photo.jpg", Buffer.from([255,216,255,224,0,255,217])).mediaType, "image/jpeg");
  assert.equal(validateDocument("document.docx", docxFixture()).mediaType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.throws(() => validateDocument("macro.docx", docxFixture(["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/vbaProject.bin"])), FormDocumentError);
  assert.throws(() => validateDocument("traversal.docx", docxFixture(["[Content_Types].xml", "_rels/.rels", "word/document.xml", "../evil"])), FormDocumentError);
  for (const name of ["bad.svg", "bad.exe", "bad.html", "bad.doc", "bad.docm", "bad.docx", "bad.jpg", "bad.png", "bad\n.pdf", "bad\u202e.pdf"]) {
    assert.throws(() => validateDocument(name, pdf), FormDocumentError);
  }
  assert.throws(() => validateDocument("empty.pdf", Buffer.alloc(0)), FormDocumentError);
});
test("file answers require owned documents from the same request, client and question", () => {
  const document = { id: randomUUID(), userId: "owner", clientId: request.clientId, requestId: request.id,
    questionId: question.id, fileName: "evidence.pdf", mediaType: "application/pdf", byteSize: pdf.length };
  const answers = validateFormAnswers([question], { evidence: document.id });
  assert.equal(validateDocumentAnswers(request, answers, [document]).get(question.id)?.id, document.id);
  for (const patch of [{ userId: "other" }, { clientId: "other" }, { requestId: "other" }, { questionId: "other" }]) {
    assert.throws(() => validateDocumentAnswers(request, answers, [{ ...document, ...patch }]), FormDocumentError);
  }
  assert.throws(() => validateFormAnswers([question], { evidence: "https://unsafe.example/file" }));
  assert.throws(() => validateFormAnswers([question], {}));
  assert.equal(templateInputSchema.safeParse({ title: "Uploads", questions: Array.from({ length: 6 }, (_, i) => ({ ...question, id: `file${i}` })) }).success, false);
});
