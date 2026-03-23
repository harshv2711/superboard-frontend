import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ArrowRight } from "lucide-react";

const ROLE_COPY = {
  superuser: {
    eyebrow: "Superuser",
    title: "Control the full workspace from one place",
    description: "Review the current workspace state, jump into client management, and keep delivery teams aligned.",
    primaryLink: "/account-planing/clients",
    primaryLabel: "Open Client Directory",
    secondaryLink: "/account-planing/clients-work",
    secondaryLabel: "Open Task Manager",
  },
  account_planner: {
    eyebrow: "Account Planner",
    title: "Stay on top of clients, scope, and task planning",
    description: "Use this space to move from client setup to execution without losing context.",
    primaryLink: "/account-planing/clients",
    primaryLabel: "Open Client Directory",
    secondaryLink: "/account-planing/clients-work",
    secondaryLabel: "Open Task Manager",
  },
  art_director: {
    eyebrow: "Art Director",
    title: "Lead creative delivery with clear visibility",
    description: "Review the pipeline, move into active work, and keep production quality consistent.",
    primaryLink: "/art-director/task-manager",
    primaryLabel: "Open Task Manager",
    secondaryLink: "/art-director/daily-task",
    secondaryLabel: "Open Daily Task",
  },
  designer: {
    eyebrow: "Designer",
    title: "Start with the work assigned to your queue",
    description: "Jump directly into active tasks and keep progress moving across client timelines.",
    primaryLink: "/designer/clients-work",
    primaryLabel: "Open Task Manager",
    secondaryLink: "/designer/daily-task",
    secondaryLabel: "Open Daily Task",
  },
};

function getRoleCopy(role) {
  return ROLE_COPY[role] || ROLE_COPY.account_planner;
}

export default function WelcomePage() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      try {
        const me = await superboardApi.auth.me();
        if (cancelled) return;
        setCurrentUser(me);
      } catch {
        if (cancelled) return;
      }
    }

    loadPage();
    return () => {
      cancelled = true;
    };
  }, []);

  const role = currentUser?.role || "";
  const roleCopy = useMemo(() => getRoleCopy(role), [role]);
  const firstName = currentUser?.first_name?.trim() || "";
  const fallbackName =
    `${currentUser?.first_name || ""} ${currentUser?.last_name || ""}`.trim() || currentUser?.email || "there";
  const greetingName = firstName || fallbackName;

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title="Welcome" />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden p-4 lg:p-6">
            <section className="rounded-[28px] border border-border/80 bg-[radial-gradient(circle_at_top_left,_rgba(0,0,0,0.04),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,248,250,1))] p-6 shadow-sm lg:p-8">
              <div className="max-w-3xl space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{roleCopy.eyebrow}</p>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground lg:text-5xl">Welcome back, {greetingName}</h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">{roleCopy.description}</p>
                  <p className="text-xl font-semibold tracking-tight text-foreground">{roleCopy.title}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button asChild className="rounded-xl">
                    <Link to={roleCopy.primaryLink}>
                      {roleCopy.primaryLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-xl">
                    <Link to={roleCopy.secondaryLink}>{roleCopy.secondaryLabel}</Link>
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}
