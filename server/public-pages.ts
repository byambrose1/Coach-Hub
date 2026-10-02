import { publicMetadata, publicSite, privacySections, termsSections, publicPlansFromConfig, type PublicSection } from "@shared/public-site";
import { renderMarkdown } from "@shared/markdown";
import type { IStorage } from "./storage";

type PublicStorage = Pick<IStorage, "getPublishedBlogPosts" | "getPublishedBlogPost" | "getPlatformConfig">;
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]!));
const paragraphs = (values: string[]) => values.map(value => `<p>${escape(value)}</p>`).join("");
const sections = (values: PublicSection[]) => values.map(section =>
  `<section><h2>${escape(section.heading)}</h2>${paragraphs(section.paragraphs)}</section>`).join("");
const privatePath = /^\/(dashboard|settings|clients|schedule|payments|admin|platform-admin|feedback)(\/|$)/;

export async function renderPublicDocument(template: string, requestPath: string, storage: PublicStorage) {
  const pathname = new URL(requestPath, publicSite.siteUrl).pathname.replace(/\/$/, "") || "/";
  let metadata = publicMetadata[pathname];
  let status = 200;
  let body = "";
  let jsonLd = "";
  let article = false;
  const notice = `<aside>${escape(publicSite.betaNotice)}</aside>`;
  if (pathname === "/privacy") body = `${notice}<p>Effective date: ${escape(publicSite.effectiveDate)}</p>${sections(privacySections)}`;
  else if (pathname === "/terms") body = `${notice}<p>Effective date: ${escape(publicSite.effectiveDate)}</p>${sections(termsSections)}`;
  else if (pathname === "/support") body = paragraphs([
    `Email support: ${publicSite.supportEmail}`, publicSite.paidPlanSupportResponse,
    "Please do not send health responses, passwords or payment credentials in a support message.",
    "We help with account access, bookings, invoices and payment records.",
  ]);
  else if (pathname === "/pricing") {
    const plans = publicPlansFromConfig(await storage.getPlatformConfig());
    const prices = plans.map(plan => `${plan.label}: £${plan.price}${plan.name === "free" ? "" : " per month"}, up to ${plan.max} clients.`).join(" ");
    metadata = { ...metadata, description: `Compare Practably plans. ${prices}` };
    body = paragraphs([prices, publicSite.vatTreatment, publicSite.paymentProviderFees,
      publicSite.directDebitNotice, publicSite.refundTerms, publicSite.cancellationTerms]);
  }
  else if (pathname === "/") body = `${notice}${paragraphs([
    "The simple business hub for independent coaches.",
    "Manage client records, bookings, PARQ forms, packages, invoices and payment records in one dashboard.",
    "The Free plan supports up to five clients and does not require a payment card.",
    publicSite.directDebitNotice,
  ])}<a href="/api/login">Sign up or log in</a>`;
  else if (pathname === "/blog") {
    const posts = await storage.getPublishedBlogPosts();
    body = posts.map(post => `<article><h2><a href="/blog/${escape(encodeURIComponent(post.slug))}">${escape(post.title)}</a></h2><p>${escape(post.excerpt)}</p></article>`).join("") || "<p>No posts yet.</p>";
  } else if (pathname.startsWith("/blog/")) {
    let slug = pathname.slice("/blog/".length);
    try { slug = decodeURIComponent(slug); } catch { slug = ""; }
    const post = await storage.getPublishedBlogPost(slug);
    if (post?.published) {
      article = true;
      metadata = { title: post.seoTitle || `${post.title} | Practably`, description: post.seoDescription || post.excerpt || publicMetadata["/blog"].description };
      body = `<article><h2>${escape(post.title)}</h2>${renderMarkdown(post.contentMarkdown)}</article>`;
      jsonLd = `<script id="blog-post-jsonld" type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org", "@type": "Article", headline: post.title,
        datePublished: post.publishedAt, author: { "@type": "Organization", name: post.authorName || "Practably" },
        url: `${publicSite.siteUrl}${pathname}`,
      }).replace(/</g, "\\u003c")}</script>`;
    } else status = 404;
  } else if (!privatePath.test(pathname)) status = 404;

  if (status === 404) {
    metadata = { title: "Page not found | Practably", description: "This page does not exist or is no longer published." };
    body = "<p>This page does not exist or is no longer published.</p>";
  }
  const canonical = `${publicSite.siteUrl}${pathname}`;
  const title = metadata?.title || "Practably";
  const description = metadata?.description || "Sign in to your Practably coaching workspace.";
  const tags = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(description)}">`,
    `<meta name="robots" content="${metadata && status === 200 ? "index,follow" : "noindex,nofollow"}">`,
    `<link rel="canonical" href="${escape(canonical)}">`,
    ...[["og:title", title], ["og:description", description], ["og:url", canonical],
      ["og:type", article ? "article" : "website"], ["og:image", `${publicSite.siteUrl}/practably-social.svg`]]
      .map(([name, value]) => `<meta property="${name}" content="${escape(value)}">`),
    ...[["twitter:card", "summary"], ["twitter:title", title], ["twitter:description", description],
      ["twitter:image", `${publicSite.siteUrl}/practably-social.svg`]]
      .map(([name, value]) => `<meta name="${name}" content="${escape(value)}">`),
    jsonLd,
  ].join("\n");
  const clean = template.replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\b[^>]*(?:name|property)=["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'][^>]*>/gi, "")
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, "");
  const content = metadata ? `<header><a href="/">Practably</a><nav><a href="/pricing">Pricing</a> <a href="/blog">Blog</a> <a href="/api/login">Sign up or log in</a></nav></header><main class="mx-auto max-w-4xl px-5 py-12 prose prose-slate"><h1>${escape(title.replace(/ \| Practably$/, ""))}</h1>${body}</main><footer><a href="/privacy">Privacy</a> <a href="/terms">Terms</a> <a href="/support">Support</a></footer>` : "";
  return {
    status,
    html: clean.replace("</head>", `${tags}\n</head>`).replace('<div id="root"></div>', `<div id="root">${content}</div>`),
  };
}