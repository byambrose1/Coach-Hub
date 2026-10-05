import { extname } from "node:path";
import { MAX_DOCUMENT_BYTES, type UploadedFormDocument } from "@shared/form-documents";
import type { CustomQuestion, FormAnswers } from "@shared/custom-forms";

export class FormDocumentError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = "FormDocumentError"; }
}
const invalid = () => new FormDocumentError(400, "The file does not match a supported PDF, DOCX, JPEG or PNG document.");

// Inspect the ZIP directory without extracting or decompressing client data.
function isDocx(bytes: Buffer): boolean {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) return false;
  const count = bytes.readUInt16LE(end + 10);
  const directoryBytes = bytes.readUInt32LE(end + 12);
  let cursor = bytes.readUInt32LE(end + 16);
  if (!count || count > 500 || cursor + directoryBytes !== end || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length) return false;
  const names = new Set<string>();
  let uncompressed = 0;
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) return false;
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const compressed = bytes.readUInt32LE(cursor + 20);
    const size = bytes.readUInt32LE(cursor + 24);
    const length = bytes.readUInt16LE(cursor + 28);
    const extra = bytes.readUInt16LE(cursor + 30);
    const comment = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    if (flags & 1 || ![0, 8].includes(method) || cursor + 46 + length + extra + comment > end ||
      localOffset + 30 > cursor || bytes.readUInt32LE(localOffset) !== 0x04034b50) return false;
    const name = bytes.subarray(cursor + 46, cursor + 46 + length).toString("utf8");
    if (name.includes("\\") || name.startsWith("/") || name.split("/").includes("..") ||
      /vbaproject|\.docm$|\.exe$|\.js$|\.vbs$/i.test(name) || names.has(name)) return false;
    uncompressed += size;
    if (uncompressed > 25 * 1024 * 1024 || size > 10 * 1024 * 1024 ||
      (size > 1024 * 1024 && size > Math.max(1, compressed) * 100)) return false;
    names.add(name);
    cursor += 46 + length + extra + comment;
  }
  return cursor === end && ["[Content_Types].xml", "_rels/.rels", "word/document.xml"].every(name => names.has(name));
}

export function validateDocument(fileName: string, content: Buffer) {
  if (!Buffer.isBuffer(content) || content.length === 0) throw new FormDocumentError(400, "Choose a non-empty document.");
  if (content.length > MAX_DOCUMENT_BYTES) throw new FormDocumentError(413, "Documents must be 5 MB or smaller.");
  if (!fileName || fileName.length > 180 || /[/\\\x00-\x1f\x7f]/.test(fileName) || fileName.trim() !== fileName ||
    /[\u202a-\u202e\u2066-\u2069]/.test(fileName)) throw new FormDocumentError(400, "Use a simple file name without folders or control characters.");
  const extension = extname(fileName).toLowerCase();
  let mediaType: string;
  if (extension === ".pdf" && /^%PDF-[12]\.\d/.test(content.subarray(0, 8).toString("ascii")) && content.subarray(-1024).includes(Buffer.from("%%EOF"))) mediaType = "application/pdf";
  else if ([".jpg", ".jpeg"].includes(extension) && content.length >= 4 && content.subarray(0, 3).equals(Buffer.from([255, 216, 255])) &&
    content.subarray(-2).equals(Buffer.from([255, 217]))) mediaType = "image/jpeg";
  else if (extension === ".png" && content.length >= 45 && content.subarray(-8, -4).toString() === "IEND" &&
    content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    content.subarray(12, 16).toString() === "IHDR" && content.readUInt32BE(16) > 0 && content.readUInt32BE(20) > 0 &&
    content.readUInt32BE(16) <= 20000 && content.readUInt32BE(20) <= 20000) mediaType = "image/png";
  else if (extension === ".docx" && content.length >= 22 && isDocx(content)) mediaType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  else throw invalid();
  return { fileName, mediaType, byteSize: content.length, content };
}

export type DocumentReference = UploadedFormDocument & { userId: string; requestId: string; questionId: string; clientId: string };
export function validateDocumentAnswers(
  request: { id: string; userId: string; clientId: string; questions: CustomQuestion[] },
  answers: FormAnswers, documents: DocumentReference[],
) {
  const references = new Map<string, DocumentReference>();
  for (const question of request.questions.filter(question => question.type === "file")) {
    const id = answers[question.id];
    if (!id) continue;
    const document = documents.find(item => item.id === id && item.userId === request.userId &&
      item.requestId === request.id && item.questionId === question.id && item.clientId === request.clientId);
    if (!document) throw new FormDocumentError(400, "A document is missing or belongs to a different form. Please upload it again.");
    references.set(question.id, document);
  }
  return references;
}
