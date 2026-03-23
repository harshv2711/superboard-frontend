import { useEffect, useMemo, useState } from "react";
import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BarChart3, Boxes, CalendarRange } from "lucide-react";

function getClientName(client) {
  return client?.name || client?.client_name || `Client #${client?.id}`;
}

function getScopeDeliverableName(scope) {
  return scope?.deliverable_name || scope?.name || `Scope #${scope?.id}`;
}

function getScopeTypeNames(scope) {
  if (Array.isArray(scope?.type_of_work_names) && scope.type_of_work_names.length > 0) {
    return scope.type_of_work_names;
  }
  return [];
}

function formatUnits(scope) {
  const value = scope?.totalUnit ?? scope?.total_unit;
  return Number.isFinite(Number(value)) ? String(value) : "-";
}

function getTaskMonthValue(task) {
  return task?.target_date || task?.created_at || "";
}

function isTaskCompleted(task) {
  return Boolean(
    task?.is_marked_completed_by_superadmin ||
      (
        task?.is_marked_completed_by_account_planner &&
        task?.is_marked_completed_by_art_director &&
        task?.is_marked_completed_by_designer
      ),
  );
}

function getMonthKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey).split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return monthKey;
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}

export default function DeliverablesTrackerPage() {
  const [clients, setClients] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError("");

      try {
        const [me, loadedClients, loadedScopes, loadedTasks] = await Promise.all([
          superboardApi.auth.me(),
          superboardApi.clients.listAll({ page_size: 300 }),
          superboardApi.scopeOfWork.listAll({ page_size: 500 }),
          superboardApi.tasks.listAll({ page_size: 1000 }),
        ]);

        if (cancelled) return;

        setCurrentUser(me || null);
        setClients(Array.isArray(loadedClients) ? loadedClients : []);
        setScopes(Array.isArray(loadedScopes) ? loadedScopes : []);
        setTasks(Array.isArray(loadedTasks) ? loadedTasks : []);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message || "Failed to load deliverables tracker data.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const clientsById = useMemo(
    () =>
      clients.reduce((accumulator, client) => {
        accumulator[String(client.id)] = client;
        return accumulator;
      }, {}),
    [clients],
  );

  const monthKeys = useMemo(() => {
    const keys = Array.from(
      new Set(
        tasks
          .map((task) => getMonthKey(getTaskMonthValue(task)))
          .filter(Boolean),
      ),
    ).sort();

    if (keys.length > 0) return keys;
    return [getMonthKey(new Date().toISOString())];
  }, [tasks]);

  const taskCountByClientTypeAndMonth = useMemo(() => {
    return tasks.reduce((accumulator, task) => {
      if (!isTaskCompleted(task)) return accumulator;
      const clientId = String(task?.client || "");
      const typeOfWorkId = String(task?.type_of_work || "");
      const monthKey = getMonthKey(getTaskMonthValue(task));
      if (!clientId || !typeOfWorkId || !monthKey) return accumulator;
      const key = `${clientId}:${typeOfWorkId}:${monthKey}`;
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});
  }, [tasks]);

  const trackerRows = useMemo(() => {
    return scopes
      .map((scope) => {
        const clientId = String(scope?.client || "");
        const typeIds = Array.isArray(scope?.type_of_work) ? scope.type_of_work.map((value) => String(value)) : [];
        const monthCounts = Object.fromEntries(
          monthKeys.map((monthKey) => {
            const count = typeIds.reduce(
              (total, typeId) => total + Number(taskCountByClientTypeAndMonth[`${clientId}:${typeId}:${monthKey}`] || 0),
              0,
            );
            return [monthKey, count];
          }),
        );
        const taskCount = Object.values(monthCounts).reduce((sum, count) => sum + Number(count || 0), 0);
        const clientName = getClientName(clientsById[clientId]) || `Client #${clientId}`;

        return {
          ...scope,
          clientId,
          clientName,
          taskCount,
          monthCounts,
          typeNames: getScopeTypeNames(scope),
          deliverableName: getScopeDeliverableName(scope),
          serviceCategoryName: scope?.service_category_name || "-",
        };
      })
      .sort((left, right) => {
        const clientCompare = left.clientName.localeCompare(right.clientName);
        if (clientCompare !== 0) return clientCompare;
        return left.deliverableName.localeCompare(right.deliverableName);
      });
  }, [clientsById, monthKeys, scopes, taskCountByClientTypeAndMonth]);

  const clientTabs = useMemo(() => {
    return Object.values(
      trackerRows.reduce((accumulator, row) => {
        if (!row.clientId) return accumulator;
        if (!accumulator[row.clientId]) {
          accumulator[row.clientId] = {
            id: row.clientId,
            name: row.clientName,
            rows: [],
            totalTasks: 0,
            totalUnits: 0,
          };
        }

        accumulator[row.clientId].rows.push(row);
        accumulator[row.clientId].totalTasks += row.taskCount;
        accumulator[row.clientId].totalUnits += Number((row?.totalUnit ?? row?.total_unit) || 0);
        return accumulator;
      }, {}),
    );
  }, [trackerRows]);

  useEffect(() => {
    if (!clientTabs.length) {
      setSelectedClientId("");
      return;
    }
    if (!clientTabs.some((client) => client.id === selectedClientId)) {
      setSelectedClientId(clientTabs[0].id);
    }
  }, [clientTabs, selectedClientId]);

  const selectedClient = useMemo(() => {
    return clientTabs.find((client) => client.id === selectedClientId) || null;
  }, [clientTabs, selectedClientId]);

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title="Deliverables Tracker" />
          <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden p-4 lg:p-6">
            {error ? (
              <Card className="border-destructive/40">
                <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
              </Card>
            ) : null}

            <Card className="overflow-hidden border-border/80 shadow-sm">
              <CardHeader className="gap-3 border-b border-border/70 bg-[linear-gradient(180deg,_rgba(248,248,250,0.95),_rgba(255,255,255,1))]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
                      Monthly View
                    </Badge>
                    <CardTitle className="text-2xl tracking-tight">Tasks per Scope of Work</CardTitle>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="rounded-full px-3 py-1.5">
                      <Boxes className="mr-2 size-3.5" />
                      {trackerRows.length} scopes
                    </Badge>
                    <Badge variant="secondary" className="rounded-full px-3 py-1.5">
                      <BarChart3 className="mr-2 size-3.5" />
                      {monthKeys.length} month{monthKeys.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Each client shows scope of work, planned units, and completed task counts month wise.
                </p>
              </CardHeader>
              <CardContent className="p-4 lg:p-6">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading deliverables tracker...</p>
                ) : clientTabs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No scope of work records found for this account.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(260px,380px)_1fr] lg:items-center">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Client</p>
                        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                          <SelectTrigger className="h-11 rounded-2xl bg-white shadow-sm">
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientTabs.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedClient ? (
                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <Badge variant="secondary" className="rounded-full px-3 py-1">
                            {selectedClient.rows.length} scopes
                          </Badge>
                          <Badge variant="secondary" className="rounded-full px-3 py-1">
                            {selectedClient.totalUnits} units
                          </Badge>
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            {selectedClient.totalTasks} completed tasks
                          </Badge>
                        </div>
                      ) : null}
                    </div>

                    {selectedClient ? (
                      <div className="overflow-hidden rounded-3xl border border-border/80 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/20">
                                <TableHead className="min-w-[320px]">Scope Of Work</TableHead>
                                <TableHead className="min-w-[120px]">Total Units</TableHead>
                                {monthKeys.map((monthKey) => (
                                  <TableHead key={monthKey} className="min-w-[120px] text-right">
                                    <span className="inline-flex items-center gap-2">
                                      <CalendarRange className="size-3.5 text-muted-foreground" />
                                      {formatMonthLabel(monthKey)}
                                    </span>
                                  </TableHead>
                                ))}
                                <TableHead className="min-w-[100px] text-right">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedClient.rows.map((row) => (
                                <TableRow key={row.id} className="align-top">
                                  <TableCell className="max-w-[360px] whitespace-normal py-5 font-medium">
                                    <div className="text-base font-semibold text-foreground">{row.deliverableName}</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <Badge variant="outline" className="rounded-full px-2.5 py-1 text-[11px]">
                                        {row.serviceCategoryName}
                                      </Badge>
                                      <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                                        {row.taskCount} completed task{row.taskCount === 1 ? "" : "s"}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-5">
                                    <span className="inline-flex min-w-14 items-center justify-center rounded-full bg-muted px-3 py-1.5 text-sm font-semibold">
                                      {formatUnits(row)}
                                    </span>
                                  </TableCell>
                                  {monthKeys.map((monthKey) => (
                                    <TableCell key={monthKey} className="py-5 text-right">
                                      <span className="inline-flex min-w-12 items-center justify-center rounded-full bg-muted px-3 py-1.5 text-sm font-semibold">
                                        {row.monthCounts?.[monthKey] || 0}
                                      </span>
                                    </TableCell>
                                  ))}
                                  <TableCell className="py-5 text-right">
                                    <span className="inline-flex min-w-12 items-center justify-center rounded-full bg-foreground px-3 py-1.5 text-sm font-semibold text-background">
                                      {row.taskCount}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  );
}
