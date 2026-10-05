import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db as applicationDb } from "./db";
import { clients, formDocuments, formRequests } from "@shared/schema";
import { MAX_ACCOUNT_DOCUMENT_BYTES, type UploadedFormDocument } from "@shared/form-documents";
import { FormDocumentError, validateDocument } from "./form-document-validation";

export type DocumentSelector = { tokenHash: string } | { userId: string; id: string };
export type StoredDocument = typeof formDocuments.$inferSelect;
export interface FormDocumentStorage {
  save(selector: DocumentSelector, questionId: string, file: ReturnType<typeof validateDocument>): Promise<UploadedFormDocument>;
  remove(selector: DocumentSelector, documentId: string): Promise<boolean>;
  download(userId: string, documentId: string): Promise<StoredDocument | undefined>;
}
const selectorWhere = (selector: DocumentSelector) => "tokenHash" in selector ? eq(formRequests.tokenHash, selector.tokenHash) :
  and(eq(formRequests.id, selector.id), eq(formRequests.userId, selector.userId));
const descriptor = ({ id, fileName, mediaType, byteSize }: UploadedFormDocument): UploadedFormDocument => ({ id, fileName, mediaType, byteSize });
const unavailable = () => new FormDocumentError(404, "This form link is unavailable or has already been completed.");

export function createFormDocumentStorage(database = applicationDb, accountLimitBytes = MAX_ACCOUNT_DOCUMENT_BYTES): FormDocumentStorage {
const db = database;
return {
  async save(selector, questionId, file) {
    return db.transaction(async tx => {
      const request = (await tx.select().from(formRequests).where(selectorWhere(selector)).for("update"))[0];
      if (!request || request.status !== "pending" || Date.parse(request.expiresAt) <= Date.now()) throw unavailable();
      if (!request.questions.some(question => question.id === questionId && question.type === "file")) {
        throw new FormDocumentError(400, "This form does not have that document-upload question.");
      }
      const client = (await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, request.clientId), eq(clients.userId, request.userId))))[0];
      if (!client) throw unavailable();
      // Serialize per-account quota checks across different clients and links.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${request.userId}, 17))`);
      await tx.delete(formDocuments).where(and(eq(formDocuments.userId, request.userId),
        isNull(formDocuments.clientFormId), lt(formDocuments.expiresAt, new Date().toISOString())));
      await tx.delete(formDocuments).where(and(eq(formDocuments.requestId, request.id),
        eq(formDocuments.questionId, questionId), isNull(formDocuments.clientFormId)));
      const [usage] = await tx.select({ bytes: sql<string>`coalesce(sum(${formDocuments.byteSize}), 0)` })
        .from(formDocuments).where(eq(formDocuments.userId, request.userId));
      if (Number(usage.bytes) + file.byteSize > accountLimitBytes) {
        throw new FormDocumentError(409, "This coach's 50 MB document-storage allowance is full. Please ask your coach to remove old completed forms or client records before uploading.");
      }
      const [row] = await tx.insert(formDocuments).values({
        ...file, userId: request.userId, clientId: request.clientId, requestId: request.id,
        questionId, expiresAt: request.expiresAt,
      }).returning({ id: formDocuments.id, fileName: formDocuments.fileName, mediaType: formDocuments.mediaType, byteSize: formDocuments.byteSize });
      return descriptor(row);
    });
  },
  async remove(selector, documentId) {
    return db.transaction(async tx => {
      const [request] = await tx.select().from(formRequests).where(selectorWhere(selector)).for("update");
      if (!request || request.status !== "pending" || Date.parse(request.expiresAt) <= Date.now()) throw unavailable();
      const rows = await tx.delete(formDocuments).where(and(eq(formDocuments.id, documentId),
        eq(formDocuments.requestId, request.id), eq(formDocuments.userId, request.userId), isNull(formDocuments.clientFormId))).returning({ id: formDocuments.id });
      return rows.length > 0;
    });
  },
  async download(userId, documentId) {
    const [row] = await db.select({ document: formDocuments }).from(formDocuments)
      .innerJoin(clients, and(eq(clients.id, formDocuments.clientId), eq(clients.userId, userId)))
      .where(and(eq(formDocuments.id, documentId), eq(formDocuments.userId, userId)));
    const document = row?.document;
    if (document?.expiresAt && Date.parse(document.expiresAt) <= Date.now()) return undefined;
    return document;
  },
};
}

export const formDocumentStorage = createFormDocumentStorage();
