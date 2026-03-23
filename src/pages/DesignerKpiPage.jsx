import { useEffect, useMemo, useState } from "react";
import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BarChart3, CheckCircle2, FolderKanban, RefreshCcw, RotateCcw } from "lucide-react";

function getTaskTypeKey(task) {
  if (task?.redo_of) return "redo";
  if (task?.revision_of) return "revision";
  return "original";
}

function getTaskTypeLabel(type) {
  if (type === "redo") return "Redo";
  if (type === "revision") return "Revision";
  return "Original";
}

function getDesignerName(task, usersById) {
  if (task?.designer_name) return task.designer_name;
  const designer = usersById[String(task?.designer)];
  if (!designer) return "Unassigned";
  const fullName = `${designer.first_name || ""} ${designer.last_name || ""}`.trim();
  return fullName || designer.email || `Designer #${designer.id}`;
}

function getClientName(task, clientsById) {
  const client = clientsById[String(task?.client)];
  return client?.name || client?.client_name || `Client #${task?.client}`;
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

export default function DesignerKpiPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError("");

      try {
        const me = await superboardApi.auth.me();
        const requests = [superboardApi.tasks.listAll({ page_size: 500 })];

        if (me?.role !== "designer") {
          requests.push(superboardApi.users.listAll({ page_size: 300 }));
          requests.push(superboardApi.clients.listAll({ page_size: 300 }));
        }

        const [loadedTasks, loadedUsers = [], loadedClients = []] = await Promise.all(requests);
        if (cancelled) return;

        setCurrentUser(me);
        setTasks(Array.isArray(loadedTasks) ? loadedTasks : []);
        setUsers(Array.isArray(loadedUsers) ? loadedUsers : []);
        setClients(Array.isArray(loadedClients) ? loadedClients : []);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message || "Failed to load Designer KPI data.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const usersById = useMemo(
    () =>
      users.reduce((accumulator, user) => {
        accumulator[String(user.id)] = user;
        return accumulator;
      }, {}),
    [users],
  );

  const clientsById = useMemo(
    () =>
      clients.reduce((accumulator, client) => {
        accumulator[String(client.id)] = client;
        return accumulator;
      }, {}),
    [clients],
  );

  const report = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => task.is_marked_completed_by_designer).length;
    const revisionTasks = tasks.filter((task) => Boolean(task.revision_of)).length;
    const redoTasks = tasks.filter((task) => Boolean(task.redo_of)).length;
    const completionRate = totalTasks ? (completedTasks / totalTasks) * 100 : 0;

    const statusBreakdown = Object.entries(
      tasks.reduce((accumulator, task) => {
        const key = getTaskTypeKey(task);
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
      }, {}),
    )
      .map(([status, count]) => ({
        status,
        label: getTaskTypeLabel(status),
        count,
      }))
      .sort((left, right) => right.count - left.count);

    const designerBreakdown = Object.values(
      tasks.reduce((accumulator, task) => {
        const key = String(task.designer || "unassigned");
        if (!accumulator[key]) {
          accumulator[key] = {
            id: key,
            name: getDesignerName(task, usersById),
            tasks: 0,
            completed: 0,
          };
        }

        accumulator[key].tasks += 1;
        if (task.is_marked_completed_by_designer) {
          accumulator[key].completed += 1;
        }
        return accumulator;
      }, {}),
    )
      .map((item) => ({
        ...item,
        completionRate: item.tasks ? (item.completed / item.tasks) * 100 : 0,
      }))
      .sort((left, right) => right.tasks - left.tasks);

    const clientBreakdown = Object.values(
      tasks.reduce((accumulator, task) => {
        const key = String(task.client || "unknown");
        if (!accumulator[key]) {
          accumulator[key] = {
            id: key,
            name: getClientName(task, clientsById),
            tasks: 0,
          };
        }

        accumulator[key].tasks += 1;
        return accumulator;
      }, {}),
    ).sort((left, right) => right.tasks - left.tasks);

    return {
      totalTasks,
      completedTasks,
      revisionTasks,
      redoTasks,
      completionRate,
      statusBreakdown,
      designerBreakdown,
      clientBreakdown,
    };
  }, [clientsById, tasks, usersById]);

  const introCopy =
    currentUser?.role === "designer"
      ? "This report reflects your assigned work and designer completion progress."
      : "This report aggregates designer workload, completion progress, revisions, and redo volume.";

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title="Designer KPI" />
          <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden p-4 lg:p-6">
            <section className="rounded-[28px] border border-border/80 bg-[radial-gradient(circle_at_top_left,_rgba(0,0,0,0.04),_transparent_35%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,248,250,1))] p-6 shadow-sm lg:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.24em]">
                    Reports
                  </Badge>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">Designer KPI</h1>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{introCopy}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-right shadow-sm">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Completion Rate</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{formatPercentage(report.completionRate)}</p>
                </div>
              </div>
            </section>

            {error ? (
              <Card className="border-destructive/40">
                <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
              </Card>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-tight">{isLoading ? "-" : report.totalTasks}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Completed By Designer</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-tight">{isLoading ? "-" : report.completedTasks}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Designers</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-tight">
                    {isLoading ? "-" : report.designerBreakdown.length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Revision / Redo</CardTitle>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCcw className="h-4 w-4" />
                    <RotateCcw className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-tight">
                    {isLoading ? "-" : `${report.revisionTasks} / ${report.redoTasks}`}
                  </p>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? <p className="text-sm text-muted-foreground">Loading status metrics...</p> : null}
                  {!isLoading && report.statusBreakdown.length === 0 ? <p className="text-sm text-muted-foreground">No task data found.</p> : null}
                  {!isLoading
                    ? report.statusBreakdown.map((item) => (
                        <div key={item.status} className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3">
                          <span className="text-sm font-medium">{item.label}</span>
                          <Badge variant="secondary" className="rounded-full">{item.count}</Badge>
                        </div>
                      ))
                    : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{currentUser?.role === "designer" ? "Client Load" : "Designer Performance"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? <p className="text-sm text-muted-foreground">Loading performance metrics...</p> : null}
                  {!isLoading && currentUser?.role === "designer" && report.clientBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No client data found.</p>
                  ) : null}
                  {!isLoading && currentUser?.role !== "designer" && report.designerBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No designer data found.</p>
                  ) : null}
                  {!isLoading && currentUser?.role === "designer"
                      ? report.clientBreakdown.slice(0, 8).map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.tasks} tasks</p>
                          </div>
                          <Badge variant="outline" className="rounded-full">{item.tasks} tasks</Badge>
                        </div>
                      ))
                    : null}
                  {!isLoading && currentUser?.role !== "designer"
                    ? report.designerBreakdown.slice(0, 8).map((item) => (
                        <div key={item.id} className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.completed}/{item.tasks} completed
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{item.tasks} tasks</p>
                            <p className="text-xs text-muted-foreground">{formatPercentage(item.completionRate)}</p>
                          </div>
                        </div>
                      ))
                    : null}
                </CardContent>
              </Card>
            </section>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}
