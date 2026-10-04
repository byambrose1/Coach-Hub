import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, FileText, Loader2, ShieldCheck } from "lucide-react";
import type { FormAnswers, PublicForm } from "@shared/custom-forms";
import { validateFormAnswers } from "@shared/custom-forms";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { FormAnswerFields } from "@/components/custom-forms-panel";

type FormStatus = "loading" | "ready" | "unavailable" | "success";

export default function PublicFormPage() {
  const [token, setToken] = useState(() => window.location.hash.slice(1));
  const [form, setForm] = useState<PublicForm | null>(null);
  const [answers, setAnswers] = useState<FormAnswers>({});
  const [status, setStatus] = useState<FormStatus>("loading");
  const [loadFailed, setLoadFailed] = useState(false);
  const [validationError, setValidationError] = useState("");
  const loadStarted = useRef(false);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.appendChild(meta);
    const noIndex = document.createElement("meta");
    noIndex.name = "robots";
    noIndex.content = "noindex, nofollow";
    document.head.appendChild(noIndex);
    // Fragment-only navigation does not remount Wouter routes. Opening another
    // private link in this tab must load that link, not retain the previous form.
    const handleLinkChange = () => {
      if (window.location.hash) window.location.reload();
    };
    window.addEventListener("hashchange", handleLinkChange);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if (!loadStarted.current) {
      loadStarted.current = true;
      if (!token) {
        setStatus("unavailable");
      } else {
        void apiRequest("POST", "/api/public-forms/load", { token })
          .then(response => response.json() as Promise<PublicForm>)
          .then(publicForm => { setForm(publicForm); setStatus("ready"); })
          .catch(() => { setLoadFailed(true); setStatus("unavailable"); });
      }
    }
    return () => {
      meta.remove();
      noIndex.remove();
      window.removeEventListener("hashchange", handleLinkChange);
    };
  }, []);

  const submitMutation = useMutation({
    mutationFn: async (cleanAnswers: FormAnswers) => {
      await apiRequest("POST", "/api/public-forms/submit", { token, answers: cleanAnswers });
    },
    onSuccess: () => {
      setStatus("success");
      setAnswers({});
      setToken("");
    },
    onError: (error: Error) => {
      if (/^404(?:\s|:)/.test(error.message)) {
        setStatus("unavailable");
        setForm(null);
        setToken("");
      }
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    try {
      const clean = validateFormAnswers(form.questions, answers);
      setValidationError("");
      submitMutation.mutate(clean);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check your answers.";
      const firstRequired = form.questions.find(question => question.required && (answers[question.id] === undefined || answers[question.id] === "" || (Array.isArray(answers[question.id]) && (answers[question.id] as string[]).length === 0)));
      if (firstRequired) document.getElementById(`public-question-${firstRequired.id}`)?.focus();
      setValidationError(message);
    }
  };

  return <main className="min-h-[100dvh] bg-[#f4f6f3] px-4 py-8 text-slate-900 sm:px-6 sm:py-14">
    <div className="mx-auto max-w-2xl">
      <header className="mb-7 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-900 text-white"><FileText className="h-5 w-5" /></div>
        <div><p className="font-semibold tracking-tight">Practably</p><p className="text-xs text-slate-500">A form from your coach</p></div>
      </header>
      {status === "loading" && <section aria-label="Loading form" className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-9"><div className="h-7 w-2/3 animate-pulse rounded bg-emerald-50" /><div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" /><div className="mt-9 space-y-7">{[1, 2, 3].map(item => <div key={item}><div className="mb-3 h-4 w-3/4 animate-pulse rounded bg-slate-100" /><div className="h-11 animate-pulse rounded-lg bg-slate-100" /></div>)}</div></section>}
      {status === "unavailable" && <section className="rounded-2xl border border-emerald-100 bg-white p-7 shadow-sm sm:p-10"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-800"><FileText className="h-6 w-6" /></div><h1 className="text-2xl font-semibold tracking-tight">This form isn’t available</h1><p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">The link may have expired, already been used, or been withdrawn. Please contact your coach if you need another link.</p>{loadFailed && <p className="mt-4 text-xs text-slate-400">No response information has been shared.</p>}</section>}
      {status === "ready" && form && <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
        <div className="border-b border-emerald-100 bg-[#eaf2eb] px-6 py-7 sm:px-9 sm:py-9">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-900/70">Client form</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-emerald-950">{form.title}</h1>
          {form.description && <p className="mt-3 max-w-xl text-sm leading-6 text-slate-700">{form.description}</p>}
          <p className="mt-4 text-xs text-slate-500">Please complete the questions below. Asterisk indicates a required answer.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-7 px-6 py-7 sm:px-9 sm:py-9">
          <div className="space-y-7" onChange={() => setValidationError("")}>
            {form.questions.map((question, index) => <div key={question.id} id={`public-question-${question.id}`} tabIndex={-1} className="rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/30">
              <FormAnswerFields questions={[question]} questionNumberOffset={index} answers={answers} onChange={(id, value) => setAnswers(current => ({ ...current, [id]: value }))} />
            </div>)}
          </div>
          {validationError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{validationError}</p>}
          {submitMutation.isError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">We couldn’t submit your answers. Please try again. Your responses remain here.</p>}
          <Button type="submit" disabled={submitMutation.isPending} className="w-full bg-emerald-900 text-white hover:bg-emerald-800 sm:w-auto sm:min-w-44">
            {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit form
          </Button>
        </form>
        <div className="flex items-start gap-2 border-t border-slate-100 px-6 py-4 text-xs leading-5 text-slate-500 sm:px-9"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-800" /><p>Anyone with this link can submit the form. Please complete it only if you received it directly from your coach.</p></div>
      </section>}
      {status === "success" && <section role="status" className="rounded-2xl border border-emerald-100 bg-white p-7 shadow-sm sm:p-10"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-900"><CheckCircle2 className="h-6 w-6" /></div><h1 className="text-2xl font-semibold tracking-tight">Form submitted</h1><p className="mt-3 text-sm leading-6 text-slate-600">Your answers have been sent to your coach. You can close this page.</p></section>}
      <footer className="mt-5 text-center text-xs text-slate-500">No account needed to complete this form.</footer>
    </div>
  </main>;
}