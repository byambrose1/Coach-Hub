import { useState } from "react";
import { Calendar, Users, CreditCard, Settings, LayoutDashboard, LogOut, ShieldCheck, MessageSquarePlus } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BrandMark } from "@/components/brand-mark";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Schedule", url: "/schedule", icon: Calendar },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Practice tools", url: "/practice-admin", icon: ShieldCheck },
];

const bottomItems = [
  { title: "Settings", url: "/settings", icon: Settings },
];

function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [type, setType] = useState("general");
  const [message, setMessage] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/feedback", { type, message });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Thanks for the feedback!", description: "We'll take a look." });
      setMessage("");
      setType("general");
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't send feedback", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Feedback & feature requests</DialogTitle>
          <DialogDescription>Tell us what's working, what's broken, or what you'd like to see next.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger data-testid="select-feedback-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General feedback</SelectItem>
              <SelectItem value="feature">Feature request</SelectItem>
              <SelectItem value="bug">Bug report</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            placeholder="What's on your mind?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[120px]"
            data-testid="input-feedback-message"
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!message.trim() || mutation.isPending}
            data-testid="button-send-feedback"
          >
            {mutation.isPending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const { data: platformRole } = useQuery<{ role: "owner" | "support" }>({
    queryKey: ["/api/platform-admin/role"],
  });
  const visibleNavItems = platformRole?.role === "owner" || platformRole?.role === "support"
    ? [...navItems, { title: "Admin", url: "/admin", icon: ShieldCheck }]
    : navItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <BrandMark className="h-8 w-8 flex-shrink-0" />
          <div>
            <h2 className="font-semibold text-sm leading-tight" data-testid="text-app-name">Practably</h2>
            <p className="text-xs text-muted-foreground">Coach Dashboard</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.url || (item.url !== "/" && location.startsWith(item.url))}
                    className="data-[active=true]:bg-sidebar-accent"
                  >
                    <a href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {bottomItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                data-active={location === item.url}
                className="data-[active=true]:bg-sidebar-accent"
              >
                <a href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                  <item.icon className="w-4 h-4" />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setFeedbackOpen(true)} data-testid="button-open-feedback">
              <MessageSquarePlus className="w-4 h-4" />
              <span>Feedback & ideas</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
        {user && (
          <div className="p-3 border-t flex items-center gap-3">
            <Avatar className="w-8 h-8">
              {user.profileImageUrl && <AvatarImage src={user.profileImageUrl} />}
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {(user.firstName?.[0] || user.email?.[0] || "C").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" data-testid="text-user-name">
                {user.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : user.email || "Coach"}
              </p>
            </div>
            <a href="/api/logout" data-testid="button-logout" className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </a>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
