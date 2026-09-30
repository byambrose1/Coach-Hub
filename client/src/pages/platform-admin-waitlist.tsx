import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Users } from "lucide-react";
import { format } from "date-fns";

interface WaitlistSignup {
  id: string;
  email: string;
  name?: string | null;
  coachingFocus?: string | null;
  howHeard?: string | null;
  createdAt?: string;
  invited?: boolean;
}

function toCsv(rows: WaitlistSignup[]): string {
  const header = ["Email", "Name", "Coaching focus", "How heard", "Joined"];
  const lines = rows.map((r) => [
    r.email,
    r.name || "",
    r.coachingFocus || "",
    r.howHeard || "",
    r.createdAt ? new Date(r.createdAt).toISOString() : "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  return [header.join(","), ...lines].join("\n");
}

export default function PlatformAdminWaitlist() {
  const [, navigate] = useLocation();
  const { data: signups = [], isLoading } = useQuery<WaitlistSignup[]>({
    queryKey: ["/api/platform-admin/waitlist"],
  });

  function downloadCsv() {
    const csv = toCsv(signups);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `practably-waitlist-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/platform-admin")} data-testid="button-back-to-admin">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-violet-500" />
            <div>
              <h1 className="text-2xl font-bold">Waitlist</h1>
              <p className="text-sm text-muted-foreground">{signups.length} people waiting for a beta invite</p>
            </div>
          </div>
        </div>
        <Button onClick={downloadCsv} disabled={signups.length === 0} data-testid="button-export-waitlist">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Signups</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse bg-muted rounded" />)}</div>
          ) : signups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No one has joined the waitlist yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Coaching focus</TableHead>
                  <TableHead>How heard</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signups.map((s) => (
                  <TableRow key={s.id} data-testid={`row-waitlist-${s.id}`}>
                    <TableCell className="font-medium">{s.email}</TableCell>
                    <TableCell>{s.name || "-"}</TableCell>
                    <TableCell>{s.coachingFocus || "-"}</TableCell>
                    <TableCell>{s.howHeard || "-"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.createdAt ? format(new Date(s.createdAt), "dd/MM/yyyy") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
