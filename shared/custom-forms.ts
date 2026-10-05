import { z } from "zod";
import { MAX_DOCUMENT_QUESTIONS } from "./form-documents";

export const questionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  label: z.string().trim().min(1).max(300),
  type: z.enum(["text", "textarea", "yes_no", "single_choice", "multiple_choice", "file"]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
}).strict().superRefine((question, context) => {
  if (["single_choice", "multiple_choice"].includes(question.type) &&
    (!question.options || question.options.length < 2 || new Set(question.options).size !== question.options.length)) {
    context.addIssue({ code: "custom", message: "Choice questions need at least two different options.", path: ["options"] });
  }
});
export const templateInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(""),
  questions: z.array(questionSchema).min(1).max(40),
}).strict().superRefine((form, context) => {
  if (new Set(form.questions.map(question => question.id)).size !== form.questions.length) {
    context.addIssue({ code: "custom", message: "Question IDs must be unique.", path: ["questions"] });
  }
  if (form.questions.filter(question => question.type === "file").length > MAX_DOCUMENT_QUESTIONS) {
    context.addIssue({ code: "custom", message: "A form can have up to five document-upload questions.", path: ["questions"] });
  }
});
export type CustomQuestion = z.infer<typeof questionSchema>;
export type TemplateInput = z.infer<typeof templateInputSchema>;
export type FormAnswers = Record<string, string | string[]>;
export type FormTemplate = TemplateInput & { id: string; createdAt: string; updatedAt: string };
export type FormRequest = TemplateInput & {
  id: string; templateId: string | null; clientId: string;
  status: "pending" | "completed" | "revoked";
  expiresAt: string; completedAt: string | null; clientFormId: string | null;
};
export type PublicForm = TemplateInput & { expiresAt: string };
export const answersInputSchema = z.record(z.union([
  z.string().max(4000), z.array(z.string().max(200)).max(20),
])).refine(value => Object.keys(value).length <= 40, "Too many answers.")
  .refine(value => new TextEncoder().encode(JSON.stringify(value)).byteLength <= 64000, "Answers are too long.");

export function validateFormAnswers(questions: CustomQuestion[], value: unknown): FormAnswers {
  const answers = answersInputSchema.parse(value);
  if (Object.keys(answers).some(id => !questions.some(question => question.id === id))) {
    throw new Error("Answers contain an unknown question.");
  }
  const clean: FormAnswers = {};
  for (const question of questions) {
    const answer = answers[question.id];
    const empty = answer === undefined || (typeof answer === "string" ? !answer.trim() : answer.length === 0);
    if (empty) {
      if (question.required) throw new Error(`Please answer: ${question.label}`);
      continue;
    }
    if (question.type === "multiple_choice") {
      if (!Array.isArray(answer) || new Set(answer).size !== answer.length ||
        answer.some(item => !question.options?.includes(item))) throw new Error("Please select valid choices.");
      clean[question.id] = answer;
    } else {
      if (question.type === "file" && (typeof answer !== "string" || !z.string().uuid().safeParse(answer).success)) {
        throw new Error("Please upload a valid document.");
      }
      if (typeof answer !== "string") throw new Error("Please enter a valid answer.");
      if (question.type === "yes_no" && !["Yes", "No"].includes(answer)) throw new Error("Please select Yes or No.");
      if (question.type === "single_choice" && !question.options?.includes(answer)) throw new Error("Please select a valid choice.");
      clean[question.id] = answer.trim();
    }
  }
  return clean;
}