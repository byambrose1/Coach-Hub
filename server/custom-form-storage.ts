import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db as applicationDb } from "./db";
import { clients, clientForms, formTemplates, formRequests, formDocuments } from "@shared/schema";
import { validateFormAnswers, type TemplateInput, type FormAnswers } from "@shared/custom-forms";
import { validateDocumentAnswers } from "./form-document-validation";

export type TemplateRow = typeof formTemplates.$inferSelect;
export type RequestRow = typeof formRequests.$inferSelect;
export class InvalidFormAnswers extends Error {}
export interface CustomFormStorage {
  templates(userId: string): Promise<TemplateRow[]>;
  template(userId: string, id: string): Promise<TemplateRow | undefined>;
  createTemplate(userId: string, input: TemplateInput): Promise<TemplateRow>;
  updateTemplate(userId: string, id: string, input: TemplateInput): Promise<TemplateRow | undefined>;
  deleteTemplate(userId: string, id: string): Promise<boolean>;
  requests(userId: string, clientId: string): Promise<RequestRow[]>;
  request(userId: string, id: string): Promise<RequestRow | undefined>;
  createRequest(userId: string, template: TemplateRow, clientId: string, tokenHash: string, expiresAt: string): Promise<RequestRow>;
  publicRequest(tokenHash: string): Promise<RequestRow | undefined>;
  revoke(userId: string, id: string): Promise<RequestRow | undefined>;
  complete(selector: { userId: string; id: string } | { tokenHash: string }, answers: unknown): Promise<{ request: RequestRow; form: typeof clientForms.$inferSelect } | undefined>;
}

export function cleanAnswers(request: Pick<RequestRow, "questions">, value: unknown): FormAnswers {
  try { return validateFormAnswers(request.questions, value); }
  catch { throw new InvalidFormAnswers("Check the required answers and selected choices."); }
}

export function createCustomFormStorage(database = applicationDb): CustomFormStorage {
const db = database;
return {
  templates: userId => db.select().from(formTemplates).where(eq(formTemplates.userId, userId)).orderBy(desc(formTemplates.createdAt)),
  async template(userId, id) {
    return (await db.select().from(formTemplates).where(and(eq(formTemplates.userId, userId), eq(formTemplates.id, id))))[0];
  },
  async createTemplate(userId, input) {
    return (await db.insert(formTemplates).values({ ...input, userId }).returning())[0];
  },
  async updateTemplate(userId, id, input) {
    return (await db.update(formTemplates).set({ ...input, updatedAt: new Date().toISOString() })
      .where(and(eq(formTemplates.userId, userId), eq(formTemplates.id, id))).returning())[0];
  },
  async deleteTemplate(userId, id) {
    return (await db.delete(formTemplates).where(and(eq(formTemplates.userId, userId), eq(formTemplates.id, id))).returning()).length > 0;
  },
  requests: (userId, clientId) => db.select().from(formRequests)
    .where(and(eq(formRequests.userId, userId), eq(formRequests.clientId, clientId))).orderBy(desc(formRequests.expiresAt)),
  async request(userId, id) {
    return (await db.select().from(formRequests).where(and(eq(formRequests.userId, userId), eq(formRequests.id, id))))[0];
  },
  async createRequest(userId, template, clientId, tokenHash, expiresAt) {
    return (await db.insert(formRequests).values({
      userId, templateId: template.id, clientId, tokenHash, expiresAt,
      title: template.title, description: template.description, questions: template.questions,
    }).returning())[0];
  },
  async publicRequest(tokenHash) {
    const row = (await db.select().from(formRequests).where(eq(formRequests.tokenHash, tokenHash)))[0];
    return row?.status === "pending" && Date.parse(row.expiresAt) > Date.now() ? row : undefined;
  },
  async revoke(userId, id) {
    return db.transaction(async tx => {
      const [request] = await tx.update(formRequests).set({ status: "revoked" }).where(and(
        eq(formRequests.id, id), eq(formRequests.userId, userId), eq(formRequests.status, "pending"),
      )).returning();
      if (request) await tx.delete(formDocuments).where(and(eq(formDocuments.requestId, request.id), isNull(formDocuments.clientFormId)));
      return request;
    });
  },
  async complete(selector, value) {
    return db.transaction(async tx => {
      const isPublic = "tokenHash" in selector;
      const where = isPublic ? eq(formRequests.tokenHash, selector.tokenHash) :
        and(eq(formRequests.id, selector.id), eq(formRequests.userId, selector.userId));
      // Serializes client/coach completion and revoke. Only the first submission wins.
      const request = (await tx.select().from(formRequests).where(where).for("update"))[0];
      if (!request || request.status !== "pending" || (isPublic && Date.parse(request.expiresAt) <= Date.now())) return undefined;
      const client = (await tx.select().from(clients).where(and(
        eq(clients.id, request.clientId), eq(clients.userId, request.userId),
      )))[0];
      if (!client) return undefined;
      const answers = cleanAnswers(request, value);
      const documents = request.questions.some(question => question.type === "file") ? await tx.select({
        id: formDocuments.id, userId: formDocuments.userId, requestId: formDocuments.requestId,
        questionId: formDocuments.questionId, clientId: formDocuments.clientId, fileName: formDocuments.fileName,
        mediaType: formDocuments.mediaType, byteSize: formDocuments.byteSize,
      }).from(formDocuments).where(and(eq(formDocuments.requestId, request.id), eq(formDocuments.userId, request.userId),
        isNull(formDocuments.clientFormId), gt(formDocuments.expiresAt, new Date().toISOString()))) : [];
      const documentAnswers = validateDocumentAnswers(request, answers, documents);
      const now = new Date().toISOString();
      const form = (await tx.insert(clientForms).values({
        userId: request.userId, clientId: request.clientId, formType: "custom",
        title: request.title, status: "completed", date: now.slice(0, 10),
        responses: JSON.stringify(request.questions.map(question => documentAnswers.has(question.id) ? {
          question: question.label, answer: documentAnswers.get(question.id)!.fileName,
          documentId: documentAnswers.get(question.id)!.id,
        } : ({
          question: question.label,
          answer: Array.isArray(answers[question.id]) ? (answers[question.id] as string[]).join(", ") : answers[question.id] || "",
        }))),
      }).returning())[0];
      for (const document of Array.from(documentAnswers.values())) {
        await tx.update(formDocuments).set({ clientFormId: form.id, expiresAt: null }).where(eq(formDocuments.id, document.id));
      }
      // Unselected/replaced documents never become historical client records.
      await tx.delete(formDocuments).where(and(eq(formDocuments.requestId, request.id), isNull(formDocuments.clientFormId)));
      const updated = (await tx.update(formRequests).set({
        status: "completed", completedAt: now, clientFormId: form.id,
      }).where(eq(formRequests.id, request.id)).returning())[0];
      return { request: updated, form };
    });
  },
};
}

export const customFormStorage = createCustomFormStorage();