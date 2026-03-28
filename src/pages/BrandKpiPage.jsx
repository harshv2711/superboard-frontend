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

const MONTH_LABELS = ["Jan", "Feb", "March", "April", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getClientName(client) {
  return client?.name || client?.client_name || `Client #${client?.id || ""}`;
}

function getDesignerName(user) {
  if (!user) return "Unassigned";
  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  return fullName || user.email || `Designer #${user.id}`;
}

function formatNumber(value, maximumFractionDigits = 2) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function getMonthKeyFromDate(value) {
  if (!value) return "";
  const raw = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";
  return raw.slice(0, 7);
}

function isTaskEligibleForKpi(task) {
  return task?.stage === "approved";
}

function getTaskPointConfig(task, pointsByTypeId) {
  return pointsByTypeId[String(task?.type_of_work || "")] || null;
}

function getRevisionBonus(task, pointConfig) {
  if (!pointConfig) return 0;

  let total = 0;
  if (task?.have_major_changes) {
    total += Number(pointConfig.major_changes_point || 0);
  }
  if (task?.have_minor_changes) {
    total += Number(pointConfig.minor_changes_point || 0);
  }
  return total;
}

function getHighestSlides(...values) {
  const normalizedValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  return normalizedValues.length ? Math.max(...normalizedValues) : 1;
}

function calculateOriginalTaskPoints(task, tasksById, childTaskIdsByParentId, negativeRemarkPointsByTaskId, pointsByTypeId) {
  const pointConfig = getTaskPointConfig(task, pointsByTypeId);
  if (!pointConfig) return 0;

  const revisionIds = childTaskIdsByParentId.revisions[String(task.id)] || [];
  const redoIds = childTaskIdsByParentId.redos[String(task.id)] || [];
  const revisions = revisionIds.map((taskId) => tasksById[taskId]).filter(Boolean);
  const redos = redoIds.map((taskId) => tasksById[taskId]).filter(Boolean);

  const highestOriginalSlides = getHighestSlides(
    task?.slides,
    ...revisions.map((revision) => revision?.slides),
    ...redos.map((redo) => redo?.slides),
  );

  let total = Number(pointConfig.point || 0) * highestOriginalSlides;

  revisions.forEach((revision) => {
    total += getRevisionBonus(revision, pointConfig);
  });

  redos.forEach((redo) => {
    const redoPointConfig = getTaskPointConfig(redo, pointsByTypeId) || pointConfig;
    const redoRevisionIds = childTaskIdsByParentId.revisions[String(redo.id)] || [];
    const redoRevisions = redoRevisionIds.map((taskId) => tasksById[taskId]).filter(Boolean);
    const highestRedoSlides = getHighestSlides(redo?.slides, ...redoRevisions.map((revision) => revision?.slides));

    total += Number(redoPointConfig.redo_point || 0) * highestRedoSlides;
    redoRevisions.forEach((revision) => {
      total += getRevisionBonus(revision, redoPointConfig);
    });
  });

  total += Number(negativeRemarkPointsByTaskId[String(task.id)] || 0);
  total += Number(task?.excellence || 0);

  return total;
}

function getProfitToneClass(value) {
  if (value > 0) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value < 0) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function BrandKpiPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [clients, setClients] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [monthlyAmounts, setMonthlyAmounts] = useState([]);
  const [typeOfWork, setTypeOfWork] = useState([]);
  const [negativeRemarkLinks, setNegativeRemarkLinks] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [loadedClients, loadedDesigners, loadedTasks, loadedMonthlyAmounts, loadedTypeOfWork, loadedNegativeRemarkLinks] = await Promise.all([
          superboardApi.clients.listAll({ page_size: 300 }),
          superboardApi.designers.listAll({ page_size: 500 }),
          superboardApi.tasks.listAll({ page_size: 3000 }),
          superboardApi.clientMonthlyAmounts.listAll({ page_size: 1000 }),
          superboardApi.typeOfWork.listAll({ page_size: 500 }),
          superboardApi.negativeRemarksOnTask.listAll({ page_size: 3000 }),
        ]);

        if (cancelled) return;

        const sortedClients = Array.isArray(loadedClients)
          ? [...loadedClients].sort((left, right) => getClientName(left).localeCompare(getClientName(right)))
          : [];

        setClients(sortedClients);
        setDesigners(Array.isArray(loadedDesigners) ? loadedDesigners : []);
        setTasks(Array.isArray(loadedTasks) ? loadedTasks : []);
        setMonthlyAmounts(Array.isArray(loadedMonthlyAmounts) ? loadedMonthlyAmounts : []);
        setTypeOfWork(Array.isArray(loadedTypeOfWork) ? loadedTypeOfWork : []);
        setNegativeRemarkLinks(Array.isArray(loadedNegativeRemarkLinks) ? loadedNegativeRemarkLinks : []);
        setSelectedClientId((prev) => {
          if (sortedClients.some((client) => String(client.id) === String(prev))) return prev;
          return String(sortedClients[0]?.id || "");
        });
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message || "Failed to load Brand KPI.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedClient = useMemo(
    () => clients.find((client) => String(client.id) === String(selectedClientId)) || null,
    [clients, selectedClientId],
  );

  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);
    monthlyAmounts.forEach((item) => {
      const monthKey = getMonthKeyFromDate(item?.date);
      if (monthKey) years.add(Number(monthKey.slice(0, 4)));
    });
    return Array.from(years).sort((left, right) => right - left);
  }, [currentYear, monthlyAmounts]);

  const selectedMonthKey = `${selectedYear}-${String(Number(selectedMonth)).padStart(2, "0")}`;

  const pointsByTypeId = useMemo(() => {
    return typeOfWork.reduce((accumulator, item) => {
      accumulator[String(item.id)] = item;
      return accumulator;
    }, {});
  }, [typeOfWork]);

  const negativeRemarkPointsByTaskId = useMemo(() => {
    return negativeRemarkLinks.reduce((accumulator, link) => {
      const taskId = String(link?.task || "");
      if (!taskId) return accumulator;
      const numericPoint = Number(link?.point ?? 0);
      accumulator[taskId] = (accumulator[taskId] || 0) + (Number.isFinite(numericPoint) ? numericPoint : 0);
      return accumulator;
    }, {});
  }, [negativeRemarkLinks]);

  const tasksById = useMemo(() => {
    return tasks.reduce((accumulator, task) => {
      accumulator[String(task.id)] = task;
      return accumulator;
    }, {});
  }, [tasks]);

  const childTaskIdsByParentId = useMemo(() => {
    return tasks.reduce(
      (accumulator, task) => {
        if (task?.revision_of) {
          const parentId = String(task.revision_of);
          accumulator.revisions[parentId] = accumulator.revisions[parentId] || [];
          accumulator.revisions[parentId].push(String(task.id));
        }
        if (task?.redo_of) {
          const parentId = String(task.redo_of);
          accumulator.redos[parentId] = accumulator.redos[parentId] || [];
          accumulator.redos[parentId].push(String(task.id));
        }
        return accumulator;
      },
      { revisions: {}, redos: {} },
    );
  }, [tasks]);

  const monthlyEligibleOriginalTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!isTaskEligibleForKpi(task)) return false;
      if (task?.revision_of || task?.redo_of) return false;
      return getMonthKeyFromDate(task?.target_date) === selectedMonthKey;
    });
  }, [selectedMonthKey, tasks]);

  const clientTasks = useMemo(() => {
    return monthlyEligibleOriginalTasks.filter((task) => String(task?.client || "") === String(selectedClientId));
  }, [monthlyEligibleOriginalTasks, selectedClientId]);

  const totalTaskCount = clientTasks.length;

  const designerSalaryById = useMemo(() => {
    return designers.reduce((accumulator, designer) => {
      accumulator[String(designer.id)] = Number(designer.salary || 0);
      return accumulator;
    }, {});
  }, [designers]);

  const designerById = useMemo(() => {
    return designers.reduce((accumulator, designer) => {
      accumulator[String(designer.id)] = designer;
      return accumulator;
    }, {});
  }, [designers]);

  const designerRows = useMemo(() => {
    const clientPointsByDesigner = clientTasks.reduce((accumulator, task) => {
      const designerId = String(task?.designer || "");
      if (!designerId) return accumulator;
      accumulator[designerId] =
        (accumulator[designerId] || 0) +
        calculateOriginalTaskPoints(task, tasksById, childTaskIdsByParentId, negativeRemarkPointsByTaskId, pointsByTypeId);
      return accumulator;
    }, {});

    const totalClientPoints = Object.values(clientPointsByDesigner).reduce((sum, value) => sum + Number(value || 0), 0);

    return Object.entries(clientPointsByDesigner)
      .map(([designerId, clientPoints]) => {
        const salary = Number(designerSalaryById[designerId] || 0);
        const percentage = totalClientPoints > 0 ? (clientPoints / totalClientPoints) * 100 : 0;
        const cost = (percentage / 100) * salary;
        return {
          id: designerId,
          name: getDesignerName(designerById[designerId]),
          clientPoints,
          percentage,
          salary,
          cost,
        };
      })
      .sort((left, right) => right.clientPoints - left.clientPoints || left.name.localeCompare(right.name));
  }, [
    childTaskIdsByParentId,
    clientTasks,
    designerById,
    designerSalaryById,
    negativeRemarkPointsByTaskId,
    pointsByTypeId,
    tasksById,
  ]);

  const totalCost = useMemo(() => {
    return designerRows.reduce((sum, row) => sum + row.cost, 0);
  }, [designerRows]);

  const selectedMonthlyAmount = useMemo(() => {
    const matches = monthlyAmounts
      .filter((item) => String(item?.client || "") === String(selectedClientId))
      .filter((item) => getMonthKeyFromDate(item?.date) === selectedMonthKey)
      .sort((left, right) => String(right.updated_at || "").localeCompare(String(left.updated_at || "")));
    return matches[0] || null;
  }, [monthlyAmounts, selectedClientId, selectedMonthKey]);

  const clientMonthlyAmount = Number(selectedMonthlyAmount?.amt || 0);
  const profit = clientMonthlyAmount - totalCost;

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title="Brand KPI" />
          <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden p-4 lg:p-6">
            {error ? (
              <Card className="border-destructive/40">
                <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
              </Card>
            ) : null}

            <Card className="overflow-hidden rounded-[28px] border-border/80 shadow-sm">
              <CardHeader className="gap-4 border-b border-border/70 bg-[linear-gradient(180deg,_rgba(248,248,250,0.95),_rgba(255,255,255,1))]">
                <div className="space-y-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.24em]">
                    Profit Dashboard
                  </Badge>
                  <p className="max-w-3xl text-sm text-muted-foreground">
                    Select a client to see designer-wise task allocation, cost based on salary share, client monthly amount, and profit or revenue.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3 xl:max-w-4xl">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Select Client</p>
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger className="h-11 w-full rounded-2xl bg-background">
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={String(client.id)} value={String(client.id)}>
                            {getClientName(client)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Select Month</p>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="h-11 w-full rounded-2xl bg-background">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_LABELS.map((label, index) => (
                          <SelectItem key={label} value={String(index + 1)}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Select Year</p>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="h-11 w-full rounded-2xl bg-background">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableYears.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 p-4 lg:p-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Card className="rounded-[24px] border-border/80 shadow-sm">
                    <CardContent className="space-y-2 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Total Tasks</p>
                      <p className="text-3xl font-semibold tracking-tight">{formatNumber(totalTaskCount, 0)}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedClient ? `${getClientName(selectedClient)} in ${MONTH_LABELS[Number(selectedMonth) - 1]} ${selectedYear}` : "No client selected"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[24px] border-border/80 shadow-sm">
                    <CardContent className="space-y-2 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Total Cost</p>
                      <p className="text-3xl font-semibold tracking-tight">{formatCurrency(totalCost)}</p>
                      <p className="text-sm text-muted-foreground">Distributed by client-month points share</p>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[24px] border-border/80 shadow-sm">
                    <CardContent className="space-y-2 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Client Monthly Amount</p>
                      <p className="text-3xl font-semibold tracking-tight">{formatCurrency(clientMonthlyAmount)}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedMonthlyAmount ? `${MONTH_LABELS[Number(selectedMonth) - 1]} ${selectedYear}` : "No amount found for selected month"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className={`rounded-[24px] border shadow-sm ${profit > 0 ? "border-emerald-200" : profit < 0 ? "border-rose-200" : "border-border/80"}`}>
                    <CardContent className="space-y-2 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Profit / Revenue</p>
                      <p className="text-3xl font-semibold tracking-tight">{formatCurrency(profit)}</p>
                      <Badge variant="outline" className={`rounded-full ${getProfitToneClass(profit)}`}>
                        {profit > 0 ? "Positive" : profit < 0 ? "Negative" : "Neutral"}
                      </Badge>
                    </CardContent>
                  </Card>
                </div>

                <Card className="overflow-hidden rounded-[24px] border-border/80 shadow-sm">
                  <CardHeader className="border-b border-border/70 bg-muted/25">
                    <CardTitle className="text-lg">Designer-wise Task Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loading ? (
                      <p className="p-6 text-sm text-muted-foreground">Loading Brand KPI...</p>
                    ) : !selectedClientId ? (
                      <p className="p-6 text-sm text-muted-foreground">Select a client to view Brand KPI.</p>
                    ) : designerRows.length === 0 ? (
                      <p className="p-6 text-sm text-muted-foreground">No designer-assigned tasks found for this client.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableHead className="px-4 py-3">Designer Name</TableHead>
                              <TableHead className="px-4 py-3">Client Points</TableHead>
                              <TableHead className="px-4 py-3">% of Work</TableHead>
                              <TableHead className="px-4 py-3">Salary</TableHead>
                              <TableHead className="px-4 py-3">Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {designerRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="px-4 py-4 font-medium">{row.name}</TableCell>
                              <TableCell className="px-4 py-4">{formatNumber(row.clientPoints)}</TableCell>
                              <TableCell className="px-4 py-4">{formatNumber(row.percentage)}%</TableCell>
                              <TableCell className="px-4 py-4">{formatCurrency(row.salary)}</TableCell>
                              <TableCell className="px-4 py-4">{formatCurrency(row.cost)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
        <Toaster richColors position="top-right" />
      </SidebarProvider>
    </TooltipProvider>
  );
}
