import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandMark } from "@/components/brand-mark";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center">
          <BrandMark className="mx-auto h-10 w-10" />
          <h1 className="mt-4 text-2xl font-bold text-slate-950">Page not found</h1>
          <p className="mt-2 text-sm text-slate-600">
            The page you're looking for doesn't exist, or the link may be out of date.
          </p>
          <Button asChild className="mt-6">
            <Link href="/"><ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Back to Practably</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
