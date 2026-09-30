import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/pages/public";
import { WaitlistDialog } from "@/components/waitlist-dialog";
import { Button } from "@/components/ui/button";
import { renderMarkdown } from "@shared/markdown";
import { getPublicSiteUrl, siteConfig } from "@/config/site";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentMarkdown: string;
  seoTitle: string | null;
  seoDescription: string | null;
  authorName: string | null;
  publishedAt: string | null;
}

function setMeta(name: string, content: string, attribute: "name" | "property" = "name") {
  let element = document.head.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.content = content;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function BlogListPage() {
  const { data: posts, isLoading } = useQuery<BlogPost[]>({ queryKey: ["/api/blog"] });

  useEffect(() => {
    document.title = `Blog | ${siteConfig.name}`;
    setMeta("description", "Practical advice for independent coaches on clients, bookings, invoicing, and running a coaching business in the UK.");
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to {siteConfig.name}
        </Link>
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-orange-600">Blog</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Running a coaching business, one useful post at a time.</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">Practical advice on clients, bookings, invoicing, and the day-to-day of independent coaching.</p>

        <div className="mt-12 space-y-8">
          {isLoading && <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden="true" />}
          {!isLoading && posts?.length === 0 && <p className="text-slate-500">No posts yet - check back soon.</p>}
          {posts?.map((post) => (
            <article key={post.id} className="border-b border-slate-200 pb-8">
              <Link href={`/blog/${post.slug}`} className="group">
                <h2 className="text-2xl font-bold text-slate-950 group-hover:text-violet-700">{post.title}</h2>
              </Link>
              <p className="mt-1 text-sm text-slate-500">{formatDate(post.publishedAt)}</p>
              {post.excerpt && <p className="mt-3 text-slate-600">{post.excerpt}</p>}
              <Link href={`/blog/${post.slug}`} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-violet-700 hover:text-violet-900">
                Read more <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

export function BlogPostPage() {
  const [, params] = useRoute<{ slug: string }>("/blog/:slug");
  const slug = params?.slug || "";
  const { data: post, isLoading, isError } = useQuery<BlogPost>({
    queryKey: [`/api/blog/${slug}`],
    enabled: !!slug,
  });

  useEffect(() => {
    if (!post) return;
    const siteUrl = getPublicSiteUrl();
    const title = post.seoTitle || `${post.title} | ${siteConfig.name}`;
    const description = post.seoDescription || post.excerpt || siteConfig.description;
    document.title = title;
    setMeta("description", description);
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:type", "article", "property");
    let canonical = document.head.querySelector("link[rel=canonical]") as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = `${siteUrl}/blog/${post.slug}`;

    let ld = document.getElementById("blog-post-jsonld") as HTMLScriptElement | null;
    if (!ld) { ld = document.createElement("script"); ld.id = "blog-post-jsonld"; ld.type = "application/ld+json"; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      datePublished: post.publishedAt,
      author: { "@type": "Organization", name: post.authorName || siteConfig.name },
      publisher: { "@type": "Organization", name: siteConfig.name },
    });
  }, [post]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" aria-hidden="true" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <PublicHeader />
        <main className="mx-auto max-w-2xl px-5 py-20 text-center sm:px-6">
          <h1 className="text-3xl font-extrabold text-slate-950">Post not found</h1>
          <p className="mt-3 text-slate-600">This post may have been unpublished or moved.</p>
          <Link href="/blog" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the blog
          </Link>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
        <Link href="/blog" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the blog
        </Link>
        <p className="text-sm font-medium text-slate-500">{formatDate(post.publishedAt)} · {post.authorName || siteConfig.name}</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">{post.title}</h1>
        <div
          className="prose prose-slate mt-10 max-w-none prose-headings:tracking-tight prose-a:text-violet-700"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.contentMarkdown) }}
        />
        <div className="mt-14 rounded-2xl border border-violet-200 bg-violet-50 p-6 text-center">
          <p className="text-lg font-bold text-slate-950">Want early access to Practably?</p>
          <p className="mt-1 text-sm text-slate-600">We're in private beta and inviting coaches gradually.</p>
          <WaitlistDialog trigger={<Button className="mt-4 rounded-full bg-violet-600 px-6 font-bold hover:bg-violet-700">Join the waitlist</Button>} />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
