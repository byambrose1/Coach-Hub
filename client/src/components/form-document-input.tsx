import { useEffect, useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { responseError } from "@/lib/api-error";
import { MAX_DOCUMENT_BYTES, DOCUMENT_ACCEPT, type UploadedFormDocument } from "@shared/form-documents";

const ACCEPTED_EXTENSIONS = new Set(["pdf", "docx", "jpg", "jpeg", "png"]);

export type FormDocumentContext = { token?: string; requestId?: string };
export type { UploadedFormDocument } from "@shared/form-documents";

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FormDocumentInput({
  questionId, value, context, onChange, onPendingChange,
}: {
  questionId: string;
  value: string;
  context?: FormDocumentContext;
  onChange: (documentId: string) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [document, setDocument] = useState<UploadedFormDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const busyRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (value && document?.id !== value) {
      setDocument({ id: value, fileName: "Uploaded document", mediaType: "", byteSize: 0 });
    } else if (!value && document) {
      setDocument(null);
    }
  }, [value, document]);

  const endpoint = context?.requestId
    ? `/api/form-requests/${encodeURIComponent(context.requestId)}/documents`
    : "/api/public-forms/documents";
  const headers = (fileName?: string, includeQuestion = true) => ({
    ...(context?.token ? { "x-form-token": context.token } : {}),
    ...(includeQuestion ? { "x-question-id": questionId } : {}),
    ...(fileName ? { "x-file-name": encodeURIComponent(fileName) } : {}),
  });
  const setPending = (pending: boolean) => {
    busyRef.current = pending;
    if (mounted.current) {
      setBusy(pending);
      onPendingChange?.(pending);
    }
  };

  const upload = async (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ACCEPTED_EXTENSIONS.has(extension)) {
      setError("Choose a PDF, DOCX, JPEG, or PNG file.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError("This file is larger than 5 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setError("");
    setPending(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { ...headers(file.name), "Content-Type": "application/octet-stream" },
        body: file,
      });
      if (!response.ok) throw await responseError(response);
      const saved = await response.json() as UploadedFormDocument;
      if (mounted.current) {
        setDocument(saved);
        onChange(saved.id);
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Upload failed. Please try again.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!document || busyRef.current) return;
    setError("");
    setPending(true);
    try {
      const removeUrl = context?.requestId
        ? `${endpoint}/${encodeURIComponent(document.id)}`
        : `/api/public-forms/documents/${encodeURIComponent(document.id)}`;
      const response = await fetch(removeUrl, {
        method: "DELETE",
        credentials: "include",
        headers: headers(undefined, false),
      });
      if (!response.ok) throw await responseError(response);
      if (mounted.current) {
        setDocument(null);
        onChange("");
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not remove this document.");
    } finally {
      setPending(false);
    }
  };

  return <div className="space-y-2">
    {!document && <div className="flex flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        id={`document-${questionId}`}
        type="file"
        accept={DOCUMENT_ACCEPT}
        disabled={busy}
        aria-describedby={`document-help-${questionId}${error ? ` document-error-${questionId}` : ""}`}
        className="sr-only"
        onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void upload(file); }}
      />
      <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {busy ? "Uploading…" : "Choose document"}
      </Button>
      <span id={`document-help-${questionId}`} className="text-xs text-muted-foreground">PDF, DOCX, JPEG, or PNG · up to 5 MB</span>
    </div>}
    {document && <div className="flex min-w-0 items-center gap-3 rounded-lg border bg-muted/30 p-3">
      {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      <div className="min-w-0 flex-1">
        <p className="break-all text-sm font-medium">{document.fileName}</p>
        <p className="text-xs text-muted-foreground">{document.byteSize > 0 ? `${formatBytes(document.byteSize)} · ` : ""}{busy ? "Removing…" : "Uploaded"}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={`Remove ${document.fileName}`} disabled={busy} onClick={() => void remove()}><X className="h-4 w-4" /></Button>
    </div>}
    {error && <p id={`document-error-${questionId}`} role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
