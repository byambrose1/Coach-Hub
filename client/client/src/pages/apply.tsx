import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";

// Public application page a coach links to from their own website
// ("Apply to train with me"). No login required - anyone with the link can
// submit. Submissions land in the coach's dashboard as a "lead", not a full
// client, until the coach reviews and converts them.
export default function Apply() {
  const [, params] = useRoute("/apply/:slug");
  const slug = params?.slug || "";
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot: hidden from real users via CSS, bots that fill every field
  // will trip it. Left empty by anyone using a real browser.
  const [website, setWebsite] = useState("");

  const { data: coach, isLoading: coachLoading, error: coachError } = useQuery<{ businessName: string }>({
    queryKey: [`/api/public/coach/${slug}`],
    enabled: !!slug,
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/apply/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message, website }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Something went wrong. Please try again.");
      }
      return res.json();
    },
    onSuccess: () => setSubmitted(true),
  });

  if (coachLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
  }

  if (coachError || !coach) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-5 text-center">
        <BrandMark className="h-10 w-10" />
        <h1 className="text-xl font-bold text-slate-950">This application link isn't active</h1>
        <p className="text-slate-500 max-w-sm">Double-check the link with the coach who shared it, it may have changed.</p>
        <Link href="/" className="text-violet-700 font-medium underline">Go to Practably</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-5 py-12 sm:py-20">
        <div className="flex items-center gap-2 justify-center mb-8">
          <BrandMark className="h-8 w-8" />
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
            <h1 className="text-xl font-bold text-slate-950">Application sent</h1>
            <p className="mt-2 text-slate-600">
              {coach.businessName} has received your application and will be in touch.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h1 className="text-xl font-bold text-slate-950 text-center">Apply to train with {coach.businessName}</h1>
            <p className="mt-1 text-sm text-slate-500 text-center">Fill in your details below to get started.</p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                submitMutation.mutate();
              }}
            >
              <div>
                <Label htmlFor="apply-name">Name</Label>
                <Input id="apply-name" required value={name} onChange={(e) => setName(e.target.value)} data-testid="input-apply-name" />
              </div>
              <div>
                <Label htmlFor="apply-email">Email</Label>
                <Input id="apply-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-apply-email" />
              </div>
              <div>
                <Label htmlFor="apply-phone">Phone</Label>
                <Input id="apply-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-apply-phone" />
              </div>
              <div>
                <Label htmlFor="apply-message">What are you looking for?</Label>
                <Textarea id="apply-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} data-testid="input-apply-message" />
              </div>

              {/* Honeypot field - hidden from sighted users, bots fill it in anyway */}
              <div className="absolute -left-[9999px]" aria-hidden="true">
                <Label htmlFor="apply-website">Leave this field blank</Label>
                <Input id="apply-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              {submitMutation.isError && (
                <p className="text-sm text-red-600">{(submitMutation.error as Error).message}</p>
              )}

              <Button type="submit" className="w-full" disabled={submitMutation.isPending} data-testid="button-submit-application">
                {submitMutation.isPending ? "Sending..." : "Send application"}
              </Button>
            </form>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Powered by <Link href="/" className="underline">Practably</Link>
        </p>
      </div>
    </div>
  );
}
