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
const BASE_WEEK_COLUMNS = [1, 2, 3, 4];

function getPersonName(user) {
  if (!user) return "Unknown";
  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  return fullName || user.username || user.email || `Designer #${user.id}`;
}

function parseDateValue(value) {
  if (!value) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getTaskKpiDate(task) {
  return parseDateValue(task?.target_date || "");
}

function getTaskPoint(task, pointsByTypeId, negativeRemarkPointsByTaskId) {
  const rawBasePoint = pointsByTypeId[String(task?.type_of_work)] ?? 0;
  const basePoint = Number(rawBasePoint);
  const rawExcellencePoint = task?.excellence ?? 0;
  const excellencePoint = Number(rawExcellencePoint);
  const rawNegativeRemarkPoint = negativeRemarkPointsByTaskId[String(task?.id)] ?? 0;
  const negativeRemarkPoint = Number(rawNegativeRemarkPoint);
  const normalizedBasePoint = Number.isFinite(basePoint) ? basePoint : 0;
  const normalizedExcellencePoint = Number.isFinite(excellencePoint) ? excellencePoint : 0;
  const normalizedNegativeRemarkPoint = Number.isFinite(negativeRemarkPoint) ? negativeRemarkPoint : 0;
  return normalizedBasePoint + normalizedExcellencePoint + normalizedNegativeRemarkPoint;
}

function isTaskEligibleForKpi(task) {
  return Boolean(task?.is_marked_completed_by_superadmin || task?.is_marked_completed_by_account_planner);
}

function getWeekOfMonth(date) {
  return Math.min(5, Math.floor((date.getDate() - 1) / 7) + 1);
}

function getWeeksForMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return daysInMonth > 28 ? [...BASE_WEEK_COLUMNS, 5] : BASE_WEEK_COLUMNS;
}

function formatPoint(value) {
  const numeric = Number(value) || 0;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
}

function buildDesignerRows(designers, getValue) {
  return designers.map((designer) => ({
    id: String(designer.id),
    name: getPersonName(designer),
    values: getValue(String(designer.id)),
  }));
}

export default function DesignerKpiPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [typeOfWork, setTypeOfWork] = useState([]);
  const [negativeRemarkLinks, setNegativeRemarkLinks] = useState([]);
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError("");

      try {
        const me = await superboardApi.auth.me();
        const requests = [
          superboardApi.tasks.listAll({ page_size: 2000 }),
          superboardApi.typeOfWork.listAll({ page_size: 500 }),
          superboardApi.negativeRemarksOnTask.listAll({ page_size: 2000 }),
        ];

        if (me?.role === "designer") {
          requests.push(Promise.resolve([me]));
        } else {
          requests.push(superboardApi.designers.listAll({ page_size: 500 }));
        }

        const [loadedTasks, loadedTypeOfWork, loadedNegativeRemarkLinks, loadedUsers] = await Promise.all(requests);
        if (cancelled) return;

        setCurrentUser(me || null);
        setTasks(Array.isArray(loadedTasks) ? loadedTasks : []);
        setTypeOfWork(Array.isArray(loadedTypeOfWork) ? loadedTypeOfWork : []);
        setNegativeRemarkLinks(Array.isArray(loadedNegativeRemarkLinks) ? loadedNegativeRemarkLinks : []);
        setUsers(Array.isArray(loadedUsers) ? loadedUsers : []);
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

  const pointsByTypeId = useMemo(
    () =>
      typeOfWork.reduce((accumulator, item) => {
        accumulator[String(item.id)] = item.point ?? 0;
        return accumulator;
      }, {}),
    [typeOfWork],
  );

  const negativeRemarkPointsByTaskId = useMemo(
    () =>
      negativeRemarkLinks.reduce((accumulator, link) => {
        const taskId = String(link?.task || "");
        if (!taskId) return accumulator;
        const numericPoint = Number(link?.point ?? 0);
        accumulator[taskId] = (accumulator[taskId] ?? 0) + (Number.isFinite(numericPoint) ? numericPoint : 0);
        return accumulator;
      }, {}),
    [negativeRemarkLinks],
  );

  const designers = useMemo(() => {
    const rows = users.filter((user) => user?.id && (currentUser?.role !== "designer" || user?.id === currentUser?.id));
    return rows.slice().sort((left, right) => getPersonName(left).localeCompare(getPersonName(right)));
  }, [currentUser?.id, currentUser?.role, users]);

  const availableYears = useMemo(() => {
    const yearSet = new Set([new Date().getFullYear()]);

    tasks.forEach((task) => {
      if (!isTaskEligibleForKpi(task)) return;
      const completedDate = getTaskKpiDate(task);
      if (!completedDate) return;
      yearSet.add(completedDate.getFullYear());
    });

    return Array.from(yearSet).sort((left, right) => right - left);
  }, [tasks]);

  useEffect(() => {
    if (!availableYears.length) return;
    if (!availableYears.includes(Number(selectedYear))) {
      setSelectedYear(String(availableYears[0]));
    }
  }, [availableYears, selectedYear]);

  const completedTasks = useMemo(() => {
    return tasks.filter((task) => isTaskEligibleForKpi(task) && task?.designer);
  }, [tasks]);

  const weeklyRows = useMemo(() => {
    const year = Number(selectedYear);
    const month = Number(selectedMonth) - 1;
    const totalsByDesigner = {};

    completedTasks.forEach((task) => {
      const completedDate = getTaskKpiDate(task);
      if (!completedDate) return;
      if (completedDate.getFullYear() !== year || completedDate.getMonth() !== month) return;

      const designerId = String(task.designer);
      const week = getWeekOfMonth(completedDate);
      if (!totalsByDesigner[designerId]) {
        totalsByDesigner[designerId] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      }
      totalsByDesigner[designerId][week] += getTaskPoint(task, pointsByTypeId, negativeRemarkPointsByTaskId);
    });

    return buildDesignerRows(designers, (designerId) => totalsByDesigner[designerId] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  }, [completedTasks, designers, negativeRemarkPointsByTaskId, pointsByTypeId, selectedMonth, selectedYear]);

  const weekColumns = useMemo(() => {
    return getWeeksForMonth(Number(selectedYear), Number(selectedMonth));
  }, [selectedMonth, selectedYear]);

  const monthlyRows = useMemo(() => {
    const year = Number(selectedYear);
    const totalsByDesigner = {};

    completedTasks.forEach((task) => {
      const completedDate = getTaskKpiDate(task);
      if (!completedDate) return;
      if (completedDate.getFullYear() !== year) return;

      const designerId = String(task.designer);
      const monthIndex = completedDate.getMonth();
      if (!totalsByDesigner[designerId]) {
        totalsByDesigner[designerId] = Array.from({ length: 12 }, () => 0);
      }
      totalsByDesigner[designerId][monthIndex] += getTaskPoint(task, pointsByTypeId, negativeRemarkPointsByTaskId);
    });

    return buildDesignerRows(designers, (designerId) => totalsByDesigner[designerId] || Array.from({ length: 12 }, () => 0));
  }, [completedTasks, designers, negativeRemarkPointsByTaskId, pointsByTypeId, selectedYear]);

  const selectedMonthLabel = MONTH_LABELS[Number(selectedMonth) - 1] || "Month";

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title="Designer KPI" />
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
                      Team Performance
                    </Badge>
                    <p className="max-w-3xl text-sm text-muted-foreground">
                      Shows designer points for tasks approved by superadmin or account planner. Type of work points, excellence, and task negative remarks all adjust the earned total. Weekly totals use the selected month, and monthly totals use the selected year.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:max-w-md">
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
                </div>
              </CardHeader>

              <CardContent className="space-y-5 p-4 lg:p-6">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading designer KPI...</p>
                ) : designers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No designers found for this account.</p>
                ) : (
                  <>
                    <div className="overflow-hidden rounded-[24px] border border-border/80">
                      <div className="border-b border-border/70 bg-muted/35 px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">{selectedMonthLabel} weekly points</p>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/25 hover:bg-muted/25">
                            <TableHead className="h-12 min-w-44 px-4 text-xs font-semibold uppercase tracking-[0.18em]">Designer</TableHead>
                            {weekColumns.map((week) => (
                              <TableHead key={week} className="h-12 min-w-28 px-4 text-xs font-semibold uppercase tracking-[0.18em]">
                                Week {week}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {weeklyRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="px-4 py-4 font-medium">{row.name}</TableCell>
                              {weekColumns.map((week) => (
                                <TableCell key={week} className="px-4 py-4">
                                  {formatPoint(row.values[week])}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="overflow-hidden rounded-[24px] border border-border/80">
                      <div className="border-b border-border/70 bg-muted/35 px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">{selectedYear} monthly points</p>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/25 hover:bg-muted/25">
                            <TableHead className="h-12 min-w-44 px-4 text-xs font-semibold uppercase tracking-[0.18em]">Designer</TableHead>
                            {MONTH_LABELS.map((month) => (
                              <TableHead key={month} className="h-12 min-w-24 px-4 text-xs font-semibold uppercase tracking-[0.18em]">
                                {month}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthlyRows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="px-4 py-4 font-medium">{row.name}</TableCell>
                              {row.values.map((value, index) => (
                                <TableCell key={`${row.id}-${index}`} className="px-4 py-4">
                                  {formatPoint(value)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
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
