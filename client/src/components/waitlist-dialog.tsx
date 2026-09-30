import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { trackActivationEvent } from "@/lib/activation";
import { getAttribution } from "@/lib/attribution";

const HOW_HEARD_OPTIONS = [
  "Facebook group",
  "Reddit",
  "Google search",
  "A software comparison site",
  "Referral from a coach",
  "Blog post",
  "Other",
];

export function WaitlistDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [coachingFocus, setCoachingFocus] = useState("");
  const [howHeard, setHowHeard] = useState("");
  const [website, setWebsite] = useState(""); // honeypot - left blank by real people

  const mutation = useMutation({
    mutationFn: async () => {
      // A visitor who arrived via a tracked link (e.g. a paid ad with
      // ?utm_source=...) is attributed automatically; otherwise fall back to
      // what they picked in the dropdown below.
      const attribution = getAttribution();
      const res = await apiRequest("POST", "/api/waitlist", {
        email,
        name: name || undefined,
        coachingFocus: coachingFocus || undefined,
        howHeard: attribution || howHeard || undefined,
        website,
      });
      return res.json();
    },
    onSuccess: () => {
      trackActivationEvent("signup_started");
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTimeout(() => {
        mutation.reset();
        setEmail("");
        setName("");
        setCoachingFocus("");
        setHowHeard("");
      }, 200);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {mutation.isSuccess ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-bold text-slate-950">You're on the list</h3>
            <p className="mt-2 text-sm text-slate-600">We'll email you as soon as a beta spot opens up.</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Join the waitlist</DialogTitle>
              <DialogDescription>Practably is currently in beta. Pop your details in and we'll email you when a spot opens up.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!email.trim()) return;
                mutation.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="waitlist-email">Email</Label>
                <Input id="waitlist-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" data-testid="input-waitlist-email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="waitlist-name">Name (optional)</Label>
                <Input id="waitlist-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" data-testid="input-waitlist-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="waitlist-focus">What kind of coaching do you do? (optional)</Label>
                <Input id="waitlist-focus" value={coachingFocus} onChange={(e) => setCoachingFocus(e.target.value)} placeholder="e.g. personal training, running club" data-testid="input-waitlist-focus" />
              </div>
              {!getAttribution() && (
                <div className="space-y-1.5">
                  <Label htmlFor="waitlist-how-heard">How did you hear about us? (optional)</Label>
                  <Select value={howHeard} onValueChange={setHowHeard}>
                    <SelectTrigger id="waitlist-how-heard" data-testid="select-waitlist-how-heard">
                      <SelectValue placeholder="Select one" />
                    </SelectTrigger>
                    <SelectContent>
                      {HOW_HEARD_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="hidden" aria-hidden="true">
                <Label htmlFor="waitlist-website">Website</Label>
                <Input id="waitlist-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              {mutation.isError && <p className="text-sm text-red-600">Something went wrong. Please try again.</p>}
              <Button type="submit" className="w-full rounded-full bg-violet-600 font-bold hover:bg-violet-700" disabled={mutation.isPending} data-testid="button-waitlist-submit">
                {mutation.isPending ? "Joining..." : "Join the waitlist"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
