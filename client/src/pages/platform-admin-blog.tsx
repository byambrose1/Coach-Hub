import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, FileText, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { permissionMessage } from "@/lib/permission-message";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentMarkdown: string;
  seoTitle: string | null;
  seoDescription: string | null;
  authorName: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
}

const emptyDraft = {
  title: "",
  slug: "",
  excerpt: "",
  contentMarkdown: "",
  seoTitle: "",
  seoDescription: "",
  authorName: "The Practably Team",
  published: false,
};

function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function PostEditor({ post, onClose }: { post: BlogPost | null; onClose: () => void }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState(
    post
      ? { ...post, excerpt: post.excerpt || "", seoTitle: post.seoTitle || "", seoDescription: post.seoDescription || "", authorName: post.authorName || "" }
      : emptyDraft,
  );
  const [slugEdited, setSlugEdited] = useState(!!post);

  const mutation = useMutation({
    mutationFn: async () => {
      if (post) {
        await apiRequest("PUT", `/api/platform-admin/blog/${post.id}`, draft);
      } else {
        await apiRequest("POST", "/api/platform-admin/blog", draft);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/blog"] });
      toast({ title: post ? "Post updated" : "Post created" });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't save post", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{post ? "Edit post" : "New post"}</DialogTitle>
          <DialogDescription>Content is written in simple markdown: # headings, **bold**, *italic*, - lists, [links](url).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={draft.title}
              onChange={(e) => {
                const title = e.target.value;
                setDraft((d) => ({ ...d, title, slug: slugEdited ? d.slug : slugify(title) }));
              }}
              data-testid="input-blog-title"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Slug (URL: /blog/...)</Label>
            <Input
              value={draft.slug}
              onChange={(e) => { setSlugEdited(true); setDraft((d) => ({ ...d, slug: slugify(e.target.value) })); }}
              data-testid="input-blog-slug"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Excerpt (shown on the blog list page)</Label>
            <Textarea rows={2} value={draft.excerpt} onChange={(e) => setDraft((d) => ({ ...d, excerpt: e.target.value }))} data-testid="input-blog-excerpt" />
          </div>
          <div className="space-y-1.5">
            <Label>Content (markdown)</Label>
            <Textarea rows={14} className="font-mono text-sm" value={draft.contentMarkdown} onChange={(e) => setDraft((d) => ({ ...d, contentMarkdown: e.target.value }))} data-testid="input-blog-content" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>SEO title (optional)</Label>
              <Input value={draft.seoTitle} onChange={(e) => setDraft((d) => ({ ...d, seoTitle: e.target.value }))} placeholder="Defaults to post title" />
            </div>
            <div className="space-y-1.5">
              <Label>Author name</Label>
              <Input value={draft.authorName} onChange={(e) => setDraft((d) => ({ ...d, authorName: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>SEO description (optional)</Label>
            <Textarea rows={2} value={draft.seoDescription} onChange={(e) => setDraft((d) => ({ ...d, seoDescription: e.target.value }))} placeholder="Defaults to excerpt" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={draft.published} onCheckedChange={(v) => setDraft((d) => ({ ...d, published: v }))} data-testid="switch-blog-published" />
            <Label>Published (visible at /blog)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !draft.title.trim() || !draft.slug.trim() || !draft.contentMarkdown.trim()}
            data-testid="button-save-blog-post"
          >
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PlatformAdminBlog() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: posts = [], isLoading, error, refetch } = useQuery<BlogPost[]>({ queryKey: ["/api/platform-admin/blog"] });
  const [editing, setEditing] = useState<BlogPost | null | "new">(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/platform-admin/blog/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform-admin/blog"] });
      toast({ title: "Post deleted" });
    },
  });

  return (
    <div className="min-h-screen bg-background p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/platform-admin")} data-testid="button-back-to-admin">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-violet-500" />
            <div>
              <h1 className="text-2xl font-bold">Blog</h1>
              <p className="text-sm text-muted-foreground">{posts.length} posts</p>
            </div>
          </div>
        </div>
        <Button onClick={() => setEditing("new")} data-testid="button-new-blog-post">
          <Plus className="h-4 w-4 mr-2" /> New post
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Posts</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse bg-muted rounded" />)}</div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p role="alert" className="text-sm text-destructive">
                {permissionMessage(error, "Access denied: platform publishing is available to the owner only.")}
              </p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
            </div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No posts yet. Create your first one.</p>
          ) : (
            <div className="divide-y">
              {posts.map((post) => (
                <div key={post.id} className="flex items-center justify-between py-3" data-testid={`row-blog-post-${post.id}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{post.title}</p>
                      <Badge variant={post.published ? "default" : "outline"} className="text-xs">
                        {post.published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">/blog/{post.slug} · {format(new Date(post.createdAt), "dd/MM/yyyy")}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {post.published && (
                      <Button variant="ghost" size="icon" asChild data-testid={`link-view-post-${post.id}`}>
                        <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setEditing(post)} data-testid={`button-edit-post-${post.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { if (confirm(`Delete "${post.title}"? This can't be undone.`)) deleteMutation.mutate(post.id); }}
                      data-testid={`button-delete-post-${post.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editing && <PostEditor post={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
