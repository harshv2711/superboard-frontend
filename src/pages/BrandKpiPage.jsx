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

const ALLOWED_KPI_STAGES = new Set(["complete", "approved_by_art_director_waiting_for_approval", "approved"]);

function isTaskEligibleForKpi(task) {
  return ALLOWED_KPI_STAGES.has(String(task?.stage || ""));
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

function resolveOriginalTask(task, tasksById) {
  if (task?.revision_of) return tasksById[String(task.revision_of)] || null;
  if (task?.redo_of) return tasksById[String(task.redo_of)] || null;
  return task || null;
}

function distributeRoundedSalaries(clientRows, designerSalary) {
  const salaryTarget = Math.round(Number(designerSalary || 0));
  if (!clientRows.length || salaryTarget <= 0) {
    return clientRows.map((row) => ({
      ...row,
      salary: 0,
    }));
  }

  const allocatedRows = clientRows.map((row) => {
    const rawSalary = (Number(row.percentage || 0) / 100) * salaryTarget;
    const salary = Math.floor(rawSalary);
    return {
      ...row,
      rawSalary,
      salary,
      remainder: rawSalary - salary,
    };
  });

  let remaining = salaryTarget - allocatedRows.reduce((sum, row) => sum + row.salary, 0);
  const rankedIndexes = allocatedRows
    .map((row, index) => ({ index, remainder: row.remainder, points: row.points }))
    .sort((left, right) => right.remainder - left.remainder || right.points - left.points || left.index - right.index);

  for (let index = 0; index < rankedIndexes.length && remaining > 0; index += 1) {
    allocatedRows[rankedIndexes[index].index].salary += 1;
    remaining -= 1;
  }

  return allocatedRows.map(({ rawSalary: _rawSalary, remainder: _remainder, ...row }) => row);
}

export default function BrandKpiPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [clients, setClients] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [typeOfWork, setTypeOfWork] = useState([]);
  const [negativeRemarkLinks, setNegativeRemarkLinks] = useState([]);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));
  const [selectedDesignerId, setSelectedDesignerId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [loadedClients, loadedDesigners, loadedTasks, loadedTypeOfWork, loadedNegativeRemarkLinks] = await Promise.all([
          superboardApi.clients.listAll({ page_size: 300 }),
          superboardApi.designers.listAll({ page_size: 500 }),
          superboardApi.tasks.listAll({ page_size: 3000 }),
          superboardApi.typeOfWork.listAll({ page_size: 500 }),
          superboardApi.negativeRemarksOnTask.listAll({ page_size: 3000 }),
        ]);

        if (cancelled) return;

        setClients(Array.isArray(loadedClients) ? loadedClients : []);
        setDesigners(Array.isArray(loadedDesigners) ? loadedDesigners : []);
        setTasks(Array.isArray(loadedTasks) ? loadedTasks : []);
        setTypeOfWork(Array.isArray(loadedTypeOfWork) ? loadedTypeOfWork : []);
        setNegativeRemarkLinks(Array.isArray(loadedNegativeRemarkLinks) ? loadedNegativeRemarkLinks : []);
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

  const availableYears = useMemo(() => {
    const years = new Set([currentYear]);
    tasks.forEach((item) => {
      const monthKey = getMonthKeyFromDate(item?.target_date || item?.created_at);
      if (monthKey) years.add(Number(monthKey.slice(0, 4)));
    });
    return Array.from(years).sort((left, right) => right - left);
  }, [currentYear, tasks]);

  const selectedMonthKey = `${selectedYear}-${String(Number(selectedMonth)).padStart(2, "0")}`;

  const clientsById = useMemo(() => {
    return clients.reduce((accumulator, client) => {
      accumulator[String(client.id)] = client;
      return accumulator;
    }, {});
  }, [clients]);

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

  const designerById = useMemo(() => {
    return designers.reduce((accumulator, designer) => {
      accumulator[String(designer.id)] = designer;
      return accumulator;
    }, {});
  }, [designers]);

  const designerOptions = useMemo(() => {
    return designers
      .filter((designer) => String(designer.role || "") === "designer")
      .map((designer) => ({
        id: String(designer.id),
        name: getDesignerName(designer),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [designers]);

  const designerSalaryById = useMemo(() => {
    return designers.reduce((accumulator, designer) => {
      accumulator[String(designer.id)] = Number(designer.salary || 0);
      return accumulator;
    }, {});
  }, [designers]);

  const monthlyGroupedDesignerKpi = useMemo(() => {
    const eligibleTasks = tasks.filter((task) => (
      isTaskEligibleForKpi(task)
      && getMonthKeyFromDate(task?.created_at) === selectedMonthKey
    ));

    const groupedTasks = eligibleTasks.reduce((accumulator, task) => {
      const originalTask = resolveOriginalTask(task, tasksById);
      if (!originalTask?.id) return accumulator;

      const originalTaskId = String(originalTask.id);
      if (!accumulator[originalTaskId]) {
        accumulator[originalTaskId] = {
          originalTask,
          relatedTasks: {},
        };
      }
      accumulator[originalTaskId].relatedTasks[String(task.id)] = task;
      return accumulator;
    }, {});

    const originalTaskGroups = Object.values(groupedTasks).map((group) => {
      const relatedTasks = Object.values(group.relatedTasks);
      const points = calculateOriginalTaskPoints(
        group.originalTask,
        tasksById,
        childTaskIdsByParentId,
        negativeRemarkPointsByTaskId,
        pointsByTypeId,
      );

      return {
        originalTask: group.originalTask,
        relatedTasks,
        points,
      };
    });

    const pointsByDesigner = originalTaskGroups.reduce((accumulator, group) => {
      const designerId = String(group.originalTask?.designer || "");
      if (!designerId) return accumulator;
      if (selectedDesignerId !== "all" && designerId !== selectedDesignerId) return accumulator;

      const clientId = String(group.originalTask?.client || "");
      if (!accumulator[designerId]) {
        accumulator[designerId] = {
          totalPoints: 0,
          totalTasks: 0,
          clients: {},
        };
      }

      accumulator[designerId].totalPoints += group.points;
      accumulator[designerId].totalTasks += 1;
      accumulator[designerId].clients[clientId] = (accumulator[designerId].clients[clientId] || 0) + group.points;
      return accumulator;
    }, {});

    const designerRows = Object.entries(pointsByDesigner)
      .map(([designerId, designerData]) => {
        const salary = Number(designerSalaryById[designerId] || 0);
        const totalPoints = Number(designerData.totalPoints || 0);

        const clientRows = Object.entries(designerData.clients)
          .map(([clientId, points]) => ({
            clientId,
            clientName: getClientName(clientsById[clientId]),
            points: Number(points || 0),
            percentage: totalPoints > 0 ? (Number(points || 0) / totalPoints) * 100 : 0,
          }))
          .sort((left, right) => right.points - left.points || left.clientName.localeCompare(right.clientName));

        return {
          id: designerId,
          name: getDesignerName(designerById[designerId]),
          salary,
          totalPoints,
          totalTasks: Number(designerData.totalTasks || 0),
          clients: distributeRoundedSalaries(clientRows, salary),
        };
      })
      .sort((left, right) => right.totalPoints - left.totalPoints || left.name.localeCompare(right.name));

    return {
      designerRows,
      totalTaskCount: designerRows.reduce((sum, row) => sum + row.totalTasks, 0),
    };
  }, [
    childTaskIdsByParentId,
    clientsById,
    designerById,
    designerSalaryById,
    negativeRemarkPointsByTaskId,
    pointsByTypeId,
    selectedDesignerId,
    selectedMonthKey,
    tasks,
    tasksById,
  ]);

  const designerRows = monthlyGroupedDesignerKpi.designerRows;
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
                    Salary Distribution
                  </Badge>
                  <p className="max-w-3xl text-sm text-muted-foreground">
                    Monthly designer points split by client, with contribution percentage and salary distribution based on that share.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:max-w-5xl xl:grid-cols-3">
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

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Select Designer</p>
                    <Select value={selectedDesignerId} onValueChange={setSelectedDesignerId}>
                      <SelectTrigger className="h-11 w-full rounded-2xl bg-background">
                        <SelectValue placeholder="Select designer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Designers</SelectItem>
                        {designerOptions.map((designer) => (
                          <SelectItem key={designer.id} value={designer.id}>
                            {designer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 p-4 lg:p-6">
                <Card className="overflow-hidden rounded-[24px] border-border/80 shadow-sm">
                  <CardHeader className="border-b border-border/70 bg-muted/25">
                    <CardTitle className="text-lg">Designer-wise Client Salary Distribution</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loading ? (
                      <p className="p-6 text-sm text-muted-foreground">Loading Brand KPI...</p>
                    ) : designerRows.length === 0 ? (
                      <p className="p-6 text-sm text-muted-foreground">No designer KPI task chains found for the selected month.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableHead className="px-4 py-3">Designer Name</TableHead>
                            <TableHead className="px-4 py-3">Total Points</TableHead>
                            <TableHead className="px-4 py-3">Client</TableHead>
                            <TableHead className="px-4 py-3">Client Points</TableHead>
                            <TableHead className="px-4 py-3">Contribution %</TableHead>
                            <TableHead className="px-4 py-3">Monthly Salary</TableHead>
                            <TableHead className="px-4 py-3">Distributed Salary</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {designerRows.flatMap((row) =>
                            row.clients.map((clientRow, index) => (
                              <TableRow key={`${row.id}-${clientRow.clientId}`}>
                                <TableCell className="px-4 py-4 font-medium">
                                  <div>{row.name}</div>
                                  {index === 0 ? <div className="mt-1 text-xs text-muted-foreground">{row.clients.length} client(s)</div> : null}
                                </TableCell>
                                <TableCell className="px-4 py-4">{formatNumber(row.totalPoints)}</TableCell>
                                <TableCell className="px-4 py-4">{clientRow.clientName}</TableCell>
                                <TableCell className="px-4 py-4">{formatNumber(clientRow.points)}</TableCell>
                                <TableCell className="px-4 py-4">{formatNumber(clientRow.percentage)}%</TableCell>
                                <TableCell className="px-4 py-4">{formatCurrency(row.salary)}</TableCell>
                                <TableCell className="px-4 py-4">{formatCurrency(clientRow.salary)}</TableCell>
                              </TableRow>
                            )),
                          )}
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
