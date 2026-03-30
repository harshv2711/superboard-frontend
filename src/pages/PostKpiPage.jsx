import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const MONTH_LABELS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PLATFORM_LABELS = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  threads: "Threads",
  whatsapp: "WhatsApp",
};

function getClientName(client) {
  return client?.name || client?.client_name || `Client #${client?.id || ""}`;
}

function getOwnerUserIds(client) {
  if (!Array.isArray(client?.owner_user_ids)) return [];
  return client.owner_user_ids.map((value) => String(value));
}

function getTaskName(task) {
  return task?.task_name || task?.name || `Task #${task?.id || ""}`;
}

function getPlatformLabel(task) {
  const rawValue = String(task?.platform || "");
  if (!rawValue) return "-";
  return PLATFORM_LABELS[rawValue] || rawValue;
}

function formatMetricNumber(value, maximumFractionDigits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(numeric);
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return `${formatMetricNumber(numeric, 2)}%`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isTaskInMonth(task, year, monthIndex) {
  const rawValue = task?.target_date || task?.created_at || "";
  if (!rawValue) return false;
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === year && date.getMonth() === monthIndex;
}

export default function PostKpiPage() {
  const clientFilterRef = useRef(null);
  const designerFilterRef = useRef(null);
  const now = useMemo(() => new Date(), []);
  const initialYear = now.getFullYear();
  const initialMonthIndex = now.getMonth();

  const [currentUser, setCurrentUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedYear, setSelectedYear] = useState(String(initialYear));
  const [selectedMonth, setSelectedMonth] = useState(String(initialMonthIndex));
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [selectedDesignerIds, setSelectedDesignerIds] = useState([]);
  const [clientFilterOpen, setClientFilterOpen] = useState(false);
  const [designerFilterOpen, setDesignerFilterOpen] = useState(false);
  const [clientFilterQuery, setClientFilterQuery] = useState("");
  const [designerFilterQuery, setDesignerFilterQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const currentYear = Number(selectedYear);
  const currentMonthIndex = Number(selectedMonth);
  const currentMonthLabel = `${MONTH_LABELS[currentMonthIndex]} ${currentYear}`;

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [me, loadedClients, loadedUsers, loadedTasks] = await Promise.all([
          superboardApi.auth.me(),
          superboardApi.clients.listAll({ page_size: 300 }),
          superboardApi.designers.listAll({ page_size: 300 }),
          superboardApi.tasks.listAll({ page_size: 3000 }),
        ]);

        if (cancelled) return;
        setCurrentUser(me || null);
        setClients(Array.isArray(loadedClients) ? loadedClients : []);
        setUsers(Array.isArray(loadedUsers) ? loadedUsers : []);
        setTasks(Array.isArray(loadedTasks) ? loadedTasks : []);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message || "Failed to load Post KPI.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (clientFilterRef.current && !clientFilterRef.current.contains(event.target)) {
        setClientFilterOpen(false);
      }
      if (designerFilterRef.current && !designerFilterRef.current.contains(event.target)) {
        setDesignerFilterOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allowedClientIds = useMemo(() => {
    const role = currentUser?.role || "";
    const currentUserId = String(currentUser?.id || currentUser?.user_id || "");

    if (role === "superuser" || role === "art_director") {
      return null;
    }

    if (role === "account_planner") {
      return new Set(
        clients
          .filter((client) => getOwnerUserIds(client).includes(currentUserId))
          .map((client) => String(client.id)),
      );
    }

    return new Set();
  }, [clients, currentUser]);

  const allowedClients = useMemo(() => {
    if (!allowedClientIds) return clients;
    return clients.filter((client) => allowedClientIds.has(String(client.id)));
  }, [allowedClientIds, clients]);

  const clientOptions = useMemo(
    () => allowedClients.map((client) => ({ id: String(client.id), name: getClientName(client) })),
    [allowedClients],
  );
  const selectedClientValues = useMemo(
    () => clientOptions.filter((client) => selectedClientIds.includes(client.id)),
    [clientOptions, selectedClientIds],
  );
  const visibleClientOptions = useMemo(() => {
    const query = clientFilterQuery.trim().toLowerCase();
    if (!query) return clientOptions;
    return clientOptions.filter((client) => client.name.toLowerCase().includes(query));
  }, [clientFilterQuery, clientOptions]);

  const designerOptions = useMemo(() => (
    users
      .filter((user) => String(user.role || "") === "designer")
      .map((user) => ({ id: String(user.id), name: user.email || `Designer #${user.id}` }))
  ), [users]);
  const selectedDesignerValues = useMemo(
    () => designerOptions.filter((designer) => selectedDesignerIds.includes(designer.id)),
    [designerOptions, selectedDesignerIds],
  );
  const visibleDesignerOptions = useMemo(() => {
    const query = designerFilterQuery.trim().toLowerCase();
    if (!query) return designerOptions;
    return designerOptions.filter((designer) => designer.name.toLowerCase().includes(query));
  }, [designerFilterQuery, designerOptions]);

  const availableYears = useMemo(() => {
    const years = new Set([initialYear]);
    tasks.forEach((task) => {
      const rawValue = task?.target_date || task?.created_at || "";
      const date = new Date(rawValue);
      if (!Number.isNaN(date.getTime())) years.add(date.getFullYear());
    });
    return [...years].sort((left, right) => right - left);
  }, [initialYear, tasks]);

  const visibleTasks = useMemo(() => {
    const rows = tasks.filter((task) => {
      if (allowedClientIds && !allowedClientIds.has(String(task?.client || ""))) return false;
      if (!isTaskInMonth(task, currentYear, currentMonthIndex)) return false;
      if (selectedClientIds.length > 0 && !selectedClientIds.includes(String(task?.client || ""))) return false;
      if (selectedDesignerIds.length > 0 && !selectedDesignerIds.includes(String(task?.designer || ""))) return false;
      return true;
    });

    return rows.sort((left, right) => {
      const leftTime = new Date(left?.target_date || left?.created_at || 0).getTime();
      const rightTime = new Date(right?.target_date || right?.created_at || 0).getTime();
      return rightTime - leftTime;
    });
  }, [allowedClientIds, currentMonthIndex, currentYear, selectedClientIds, selectedDesignerIds, tasks]);

  const clientsById = useMemo(() => {
    return clients.reduce((accumulator, client) => {
      accumulator[String(client.id)] = client;
      return accumulator;
    }, {});
  }, [clients]);

  function toggleClientFilter(clientId) {
    setSelectedClientIds((prev) => (
      prev.includes(clientId) ? prev.filter((value) => value !== clientId) : [...prev, clientId]
    ));
  }

  function toggleDesignerFilter(designerId) {
    setSelectedDesignerIds((prev) => (
      prev.includes(designerId) ? prev.filter((value) => value !== designerId) : [...prev, designerId]
    ));
  }

  function clearFilters() {
    setSelectedYear(String(initialYear));
    setSelectedMonth(String(initialMonthIndex));
    setSelectedClientIds([]);
    setSelectedDesignerIds([]);
    setClientFilterQuery("");
    setDesignerFilterQuery("");
  }

  const summary = useMemo(() => {
    const withImpressions = visibleTasks.filter((task) => Number.isFinite(Number(task?.impressions)));
    const ctrValues = visibleTasks
      .map((task) => Number(task?.ctr))
      .filter((value) => Number.isFinite(value));
    const engagementValues = visibleTasks
      .map((task) => Number(task?.engagement_rate))
      .filter((value) => Number.isFinite(value));

    const totalImpressions = withImpressions.reduce((sum, task) => sum + Number(task?.impressions || 0), 0);
    const averageCtr = ctrValues.length ? ctrValues.reduce((sum, value) => sum + value, 0) / ctrValues.length : NaN;
    const averageEngagement = engagementValues.length
      ? engagementValues.reduce((sum, value) => sum + value, 0) / engagementValues.length
      : NaN;

    return {
      totalTasks: visibleTasks.length,
      totalImpressions,
      averageCtr,
      averageEngagement,
    };
  }, [visibleTasks]);

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title="Post KPI" />
          <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden p-4 lg:p-6">
            {error ? (
              <Card className="border-destructive/40">
                <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
              </Card>
            ) : null}

            <Card className="overflow-hidden rounded-[28px] border-border/80 shadow-sm">
              <CardHeader className="gap-4 border-b border-border/70 bg-[linear-gradient(180deg,_rgba(248,248,250,0.95),_rgba(255,255,255,1))]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.24em]">
                      Reports and Analytics
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Current month task metrics with impressions, CTR, and engagement rate.
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-border/70 bg-background/80 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Reporting window
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{currentMonthLabel}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="post-kpi-year" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Year</Label>
                    <select
                      id="post-kpi-year"
                      value={selectedYear}
                      onChange={(event) => setSelectedYear(event.target.value)}
                      className="flex h-11 w-full rounded-xl border border-border bg-background px-4 text-sm shadow-sm outline-none"
                    >
                      {availableYears.map((year) => (
                        <option key={year} value={String(year)}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="post-kpi-month" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Month</Label>
                    <select
                      id="post-kpi-month"
                      value={selectedMonth}
                      onChange={(event) => setSelectedMonth(event.target.value)}
                      className="flex h-11 w-full rounded-xl border border-border bg-background px-4 text-sm shadow-sm outline-none"
                    >
                      {MONTH_LABELS.map((month, index) => (
                        <option key={month} value={String(index)}>{month}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Client</Label>
                    <div className="relative" ref={clientFilterRef}>
                      <div
                        role="button"
                        tabIndex={0}
                        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left shadow-sm transition hover:bg-muted/40"
                        onClick={() => setClientFilterOpen((open) => !open)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setClientFilterOpen((open) => !open);
                          }
                        }}
                      >
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          {selectedClientValues.length > 0 ? selectedClientValues.map((client) => (
                            <Badge key={client.id} variant="secondary" className="h-8 rounded-full px-3 text-sm">
                              <span className="truncate max-w-32">{client.name}</span>
                              <button
                                type="button"
                                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleClientFilter(client.id);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          )) : <span className="text-sm text-muted-foreground">Select clients</span>}
                        </div>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${clientFilterOpen ? "rotate-180" : ""}`} />
                      </div>
                      {clientFilterOpen ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-border bg-popover p-3 shadow-xl">
                          <Input
                            value={clientFilterQuery}
                            onChange={(event) => setClientFilterQuery(event.target.value)}
                            placeholder="Search clients..."
                            className="h-10 rounded-lg"
                          />
                          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                            {visibleClientOptions.map((client) => {
                              const isChecked = selectedClientIds.includes(client.id);
                              return (
                                <div
                                  key={client.id}
                                  role="button"
                                  tabIndex={0}
                                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-muted"
                                  onClick={() => toggleClientFilter(client.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      toggleClientFilter(client.id);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <Checkbox checked={isChecked} tabIndex={-1} className="pointer-events-none" />
                                    <span className="text-sm font-medium text-foreground">{client.name}</span>
                                  </div>
                                  {isChecked ? <Check className="h-4 w-4 text-primary" /> : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Designer</Label>
                    <div className="relative" ref={designerFilterRef}>
                      <div
                        role="button"
                        tabIndex={0}
                        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left shadow-sm transition hover:bg-muted/40"
                        onClick={() => setDesignerFilterOpen((open) => !open)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setDesignerFilterOpen((open) => !open);
                          }
                        }}
                      >
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          {selectedDesignerValues.length > 0 ? selectedDesignerValues.map((designer) => (
                            <Badge key={designer.id} variant="secondary" className="h-8 rounded-full px-3 text-sm">
                              <span className="truncate max-w-32">{designer.name}</span>
                              <button
                                type="button"
                                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleDesignerFilter(designer.id);
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          )) : <span className="text-sm text-muted-foreground">Select designers</span>}
                        </div>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${designerFilterOpen ? "rotate-180" : ""}`} />
                      </div>
                      {designerFilterOpen ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-border bg-popover p-3 shadow-xl">
                          <Input
                            value={designerFilterQuery}
                            onChange={(event) => setDesignerFilterQuery(event.target.value)}
                            placeholder="Search designers..."
                            className="h-10 rounded-lg"
                          />
                          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                            {visibleDesignerOptions.map((designer) => {
                              const isChecked = selectedDesignerIds.includes(designer.id);
                              return (
                                <div
                                  key={designer.id}
                                  role="button"
                                  tabIndex={0}
                                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-muted"
                                  onClick={() => toggleDesignerFilter(designer.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      toggleDesignerFilter(designer.id);
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-3">
                                    <Checkbox checked={isChecked} tabIndex={-1} className="pointer-events-none" />
                                    <span className="text-sm font-medium text-foreground">{designer.name}</span>
                                  </div>
                                  {isChecked ? <Check className="h-4 w-4 text-primary" /> : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={clearFilters}>
                    Clear filters
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3 xl:max-w-4xl">
                  <div className="rounded-[24px] border border-border/70 bg-background/80 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tasks</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{formatMetricNumber(summary.totalTasks, 0)}</p>
                  </div>
                  <div className="rounded-[24px] border border-border/70 bg-background/80 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Total Impressions</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{formatMetricNumber(summary.totalImpressions, 0)}</p>
                  </div>
                  <div className="rounded-[24px] border border-border/70 bg-background/80 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Average CTR / Engagement</p>
                    <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                      {formatPercent(summary.averageCtr)} / {formatPercent(summary.averageEngagement)}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 p-4 lg:p-6">
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading post KPI...</p>
                ) : visibleTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks found for the current month.</p>
                ) : (
                  <div className="overflow-hidden rounded-[24px] border border-border/80">
                    <div className="border-b border-border/70 bg-muted/35 px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">{currentMonthLabel} task metrics</p>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/25 hover:bg-muted/25">
                          <TableHead className="h-12 min-w-56 px-4 text-xs font-semibold uppercase tracking-[0.18em]">Task</TableHead>
                          <TableHead className="h-12 min-w-44 px-4 text-xs font-semibold uppercase tracking-[0.18em]">Client</TableHead>
                          <TableHead className="h-12 min-w-44 px-4 text-xs font-semibold uppercase tracking-[0.18em]">Designer</TableHead>
                          <TableHead className="h-12 min-w-32 px-4 text-xs font-semibold uppercase tracking-[0.18em]">Platform</TableHead>
                          <TableHead className="h-12 min-w-36 px-4 text-xs font-semibold uppercase tracking-[0.18em]">Target Date</TableHead>
                          <TableHead className="h-12 min-w-32 px-4 text-xs font-semibold uppercase tracking-[0.18em]">Impressions</TableHead>
                          <TableHead className="h-12 min-w-28 px-4 text-xs font-semibold uppercase tracking-[0.18em]">CTR</TableHead>
                          <TableHead className="h-12 min-w-36 px-4 text-xs font-semibold uppercase tracking-[0.18em]">Engagement Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleTasks.map((task) => (
                          <TableRow key={String(task.id)}>
                            <TableCell className="px-4 py-4 font-medium text-foreground">{getTaskName(task)}</TableCell>
                            <TableCell className="px-4 py-4">
                              {task.client_name || getClientName(clientsById[String(task.client || "")]) || "-"}
                            </TableCell>
                            <TableCell className="px-4 py-4">{task.designer_name || "-"}</TableCell>
                            <TableCell className="px-4 py-4">{getPlatformLabel(task)}</TableCell>
                            <TableCell className="px-4 py-4">{formatDate(task.target_date || task.created_at)}</TableCell>
                            <TableCell className="px-4 py-4">{formatMetricNumber(task.impressions, 0)}</TableCell>
                            <TableCell className="px-4 py-4">{formatPercent(task.ctr)}</TableCell>
                            <TableCell className="px-4 py-4">{formatPercent(task.engagement_rate)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}
