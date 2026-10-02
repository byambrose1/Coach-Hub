import { useEffect } from "react";
import { useLocation } from "wouter";
import { publicMetadata, publicSite } from "@shared/public-site";

export function PublicSeo() {
  const [location] = useLocation();
  useEffect(() => {
    const pathname = location.replace(/\/$/, "") || "/";
    if (pathname.startsWith("/blog/")) return; // Article query supplies its own metadata.
    const page = publicMetadata[pathname];
    document.title = page?.title || "Practably";
    const set = (name: string, content: string, property = false) => {
      const attribute = property ? "property" : "name";
      let element = document.head.querySelector(`meta[${attribute}="${name}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };
    set("robots", page ? "index,follow" : "noindex,nofollow");
    set("description", page?.description || "Sign in to your Practably workspace.");
    for (const prefix of ["og", "twitter"]) {
      set(`${prefix}:title`, document.title, prefix === "og");
      set(`${prefix}:description`, page?.description || "", prefix === "og");
    }
    set("og:type", "website", true);
    set("og:url", `${publicSite.siteUrl}${pathname}`, true);
    const canonical = document.head.querySelector('link[rel="canonical"]') || document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    canonical.setAttribute("href", `${publicSite.siteUrl}${pathname}`);
    if (!canonical.isConnected) document.head.appendChild(canonical);
    document.querySelectorAll('script[type="application/ld+json"]').forEach(element => element.remove());
  }, [location]);
  return null;
}