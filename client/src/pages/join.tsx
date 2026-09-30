import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";
import { apiRequest } from "@/lib/queryClient";
import { siteConfig } from "@/config/site";

function getNextParam(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("next") || "/api/login";
}

// Not linked from anywhere public. Beta testers get this URL directly (with
// or without ?code=... pre-filled) from the coach who invited them - it's
// the only way into Practably while the landing page is waitlist-only.
export default function JoinPage() {
  const [code, setCode] = useState(new URLSearchParams(window.location.search).get("code") || "");

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/beta-access", { code });
    },
    onSuccess: () => {
      window.location.href = getNextParam();
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2">
          <BrandMark className="h-8 w-8" />
          <span className="font-extrabold tracking-tight text-slate-950">{siteConfig.name}</span>
        </div>
        <h1 className="mt-6 text-xl font-bold text-slate-950">Enter your beta access code</h1>
        <p className="mt-2 text-sm text-slate-600">Practably is invite-only right now. If you've been invited, enter the code you were given below.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!code.trim()) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="access-code">Access code</Label>
            <Input id="access-code" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter your code" data-testid="input-access-code" />
          </div>
          {mutation.isError && <p className="text-sm text-red-600">That code isn't right. Double-check it and try again.</p>}
          <Button type="submit" className="w-full rounded-full bg-violet-600 font-bold hover:bg-violet-700" disabled={mutation.isPending} data-testid="button-access-code-submit">
            {mutation.isPending ? "Checking..." : "Continue"}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">
          Not invited yet? <a href="/" className="font-semibold text-violet-700 underline-offset-4 hover:underline">Join the waitlist instead</a>
        </p>
      </div>
    </div>
  );
}
