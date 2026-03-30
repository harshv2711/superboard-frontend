import { useEffect, useMemo, useState } from "react";
import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

function formatPoint(value) {
  const numeric = Number(value) || 0;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
}

function getWeeksForMonth(year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return daysInMonth > 28 ? [...BASE_WEEK_COLUMNS, 5] : BASE_WEEK_COLUMNS;
}

export default function DesignerKpiPage() {
  const currentYear = new Date().getFullYear();
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [error, setError] = useState("");
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isLoadingScores, setIsLoadingScores] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      setIsLoadingMeta(true);
      setError("");

      try {
        const me = await superboardApi.auth.me();
        const loadedUsers = me?.role === "designer"
          ? [me]
          : await superboardApi.designers.listAll({ page_size: 500 });

        if (cancelled) return;
        setCurrentUser(me || null);
        setUsers(Array.isArray(loadedUsers) ? loadedUsers : []);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError.message || "Failed to load designer list.");
      } finally {
        if (!cancelled) setIsLoadingMeta(false);
      }
    }

    loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  const designers = useMemo(() => {
    const visibleUsers = users.filter((user) => user?.id && (currentUser?.role !== "designer" || user?.id === currentUser?.id));
    return visibleUsers.slice().sort((left, right) => getPersonName(left).localeCompare(getPersonName(right)));
  }, [currentUser?.id, currentUser?.role, users]);

  const availableYears = useMemo(
    () => Array.from({ length: 5 }, (_, index) => currentYear - 2 + index).sort((left, right) => right - left),
    [currentYear],
  );

  const selectedMonthValue = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

  useEffect(() => {
    let cancelled = false;

    async function loadScores() {
      if (isLoadingMeta) return;

      setIsLoadingScores(true);
      setError("");

      try {
        const scoreRows = await Promise.all(
          designers.map(async (designer) => {
            const payload = await superboardApi.tasks.designerKpi({
              designerId: designer.id,
              month: selectedMonthValue,
            });

            return {
              id: String(designer.id),
              name: getPersonName(designer),
              total: Number(payload?.total_kpi_score || 0),
              weekly: payload?.weekly_scores || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            };
          }),
        );

        if (cancelled) return;
        setRows(scoreRows);
      } catch (loadError) {
        if (cancelled) return;
        setRows([]);
        setError(loadError.message || "Failed to load designer KPI data.");
      } finally {
        if (!cancelled) setIsLoadingScores(false);
      }
    }

    loadScores();
    return () => {
      cancelled = true;
    };
  }, [designers, isLoadingMeta, selectedMonthValue]);

  const totalTeamScore = useMemo(
    () => rows.reduce((total, row) => total + (Number(row.total) || 0), 0),
    [rows],
  );
  const weekColumns = useMemo(
    () => getWeeksForMonth(Number(selectedYear), Number(selectedMonth)),
    [selectedMonth, selectedYear],
  );

  const selectedMonthLabel = MONTH_LABELS[Number(selectedMonth) - 1] || "Month";
  const isLoading = isLoadingMeta || isLoadingScores;

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
                      Monthly designer KPI is calculated by the backend using tasks created in the selected month and in Complete,
                      Approved By Art Director, and Approved by Client stages, with grouped original-task chains, slide multiplier,
                      revision points, redo points, excellence, and negative remarks.
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-border/70 bg-background/80 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {selectedMonthLabel} {selectedYear} total
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{formatPoint(totalTeamScore)}</p>
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
                        <p className="text-sm font-semibold text-foreground">{selectedMonthLabel} {selectedYear} weekly points</p>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/25 hover:bg-muted/25">
                            <TableHead className="h-12 min-w-44 px-4 text-xs font-semibold uppercase tracking-[0.18em]">Designer</TableHead>
                            {weekColumns.map((week) => (
                              <TableHead key={week} className="h-12 min-w-24 px-4 text-xs font-semibold uppercase tracking-[0.18em]">
                                Week {week}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="px-4 py-4 font-medium">{row.name}</TableCell>
                              {weekColumns.map((week) => (
                                <TableCell key={`${row.id}-${week}`} className="px-4 py-4">
                                  {formatPoint(row.weekly?.[String(week)] ?? row.weekly?.[week] ?? 0)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="overflow-hidden rounded-[24px] border border-border/80">
                      <div className="border-b border-border/70 bg-muted/35 px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">{selectedMonthLabel} {selectedYear} designer points</p>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/25 hover:bg-muted/25">
                            <TableHead className="h-12 min-w-44 px-4 text-xs font-semibold uppercase tracking-[0.18em]">Designer</TableHead>
                            <TableHead className="h-12 min-w-32 px-4 text-xs font-semibold uppercase tracking-[0.18em]">KPI Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rows.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="px-4 py-4 font-medium">{row.name}</TableCell>
                              <TableCell className="px-4 py-4">{formatPoint(row.total)}</TableCell>
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
