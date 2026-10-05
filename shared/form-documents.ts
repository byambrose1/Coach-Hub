export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENT_QUESTIONS = 5;
export const MAX_ACCOUNT_DOCUMENT_BYTES = 50 * 1024 * 1024;
export const DOCUMENT_ACCEPT = ".pdf,.docx,.jpg,.jpeg,.png";
export const DOC_UPLOAD_HELP = "PDF, Word (.docx), JPEG or PNG. Maximum 5 MB per file; one file per question.";
export type UploadedFormDocument = {
  id: string;
  fileName: string;
  mediaType: string;
  byteSize: number;
};
