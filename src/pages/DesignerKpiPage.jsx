import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Check, ChevronDown, Download, X } from "lucide-react";
import { toast } from "sonner";

const MONTH_LABELS = ["Jan", "Feb", "March", "April", "May", "June", "July", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BASE_WEEK_COLUMNS = [1, 2, 3, 4];

function getPersonName(user) {
  if (!user) return "Unknown";
  const source = user.user && typeof user.user === "object" ? user.user : user;
  const fullName = `${source.first_name || ""} ${source.last_name || ""}`.trim();
  return fullName || source.email || user.email || `Designer #${source.id || user.id}`;
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
  const designerFilterRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState([]);
  const [availableYears, setAvailableYears] = useState([currentYear]);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1));
  const [selectedDesignerIds, setSelectedDesignerIds] = useState([]);
  const [designerFilterOpen, setDesignerFilterOpen] = useState(false);
  const [designerFilterQuery, setDesignerFilterQuery] = useState("");
  const [trendRows, setTrendRows] = useState([]);
  const [error, setError] = useState("");
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isLoadingScores, setIsLoadingScores] = useState(true);
  const [isLoadingTrend, setIsLoadingTrend] = useState(true);

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
        const yearsPayload = await superboardApi.tasks.designerKpiYears();
        const years = Array.isArray(yearsPayload?.years)
          ? yearsPayload.years.filter((year) => Number.isInteger(Number(year))).map(Number)
          : [];

        if (cancelled) return;
        setCurrentUser(me || null);
        setUsers(Array.isArray(loadedUsers) ? loadedUsers : []);
        setAvailableYears(years.length > 0 ? years : [currentYear]);
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

  useEffect(() => {
    function handleClickOutside(event) {
      if (designerFilterRef.current && !designerFilterRef.current.contains(event.target)) {
        setDesignerFilterOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const designers = useMemo(() => {
    const visibleUsers = users.filter((user) => user?.id && (currentUser?.role !== "designer" || user?.id === currentUser?.id));
    return visibleUsers.slice().sort((left, right) => getPersonName(left).localeCompare(getPersonName(right)));
  }, [currentUser?.id, currentUser?.role, users]);

  useEffect(() => {
    if (availableYears.length === 0) return;

    const normalizedSelectedYear = Number(selectedYear);
    if (!availableYears.includes(normalizedSelectedYear)) {
      setSelectedYear(String(availableYears[0]));
    }
  }, [availableYears, selectedYear]);

  useEffect(() => {
    if (designers.length === 0) return;

    if (currentUser?.role === "designer") {
      setSelectedDesignerIds([String(currentUser.id || currentUser.user_id || designers[0]?.id || "")].filter(Boolean));
      return;
    }

    setSelectedDesignerIds((prev) => prev.filter((id) => designers.some((designer) => String(designer.id) === String(id))));
  }, [currentUser?.id, currentUser?.role, currentUser?.user_id, designers]);

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

  useEffect(() => {
    let cancelled = false;

    async function loadTrend() {
      if (isLoadingMeta) return;

      setIsLoadingTrend(true);

      try {
        const trendPayload = await Promise.all(
          designers.map(async (designer) => {
            const monthlyScores = await Promise.all(
              Array.from({ length: 12 }, async (_, monthIndex) => {
                const monthKey = `${selectedYear}-${String(monthIndex + 1).padStart(2, "0")}`;
                const payload = await superboardApi.tasks.designerKpi({
                  designerId: designer.id,
                  month: monthKey,
                });

                return {
                  month: monthIndex + 1,
                  label: MONTH_LABELS[monthIndex],
                  total: Number(payload?.total_kpi_score || 0),
                  weekly: payload?.weekly_scores || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                };
              }),
            );

            return {
              id: String(designer.id),
              name: getPersonName(designer),
              monthly: Object.fromEntries(monthlyScores.map((item) => [String(item.month), item.total])),
              monthlyWeekly: Object.fromEntries(monthlyScores.map((item) => [String(item.month), item.weekly || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }])),
              total: monthlyScores.reduce((sum, item) => sum + item.total, 0),
            };
          }),
        );

        if (cancelled) return;
        setTrendRows(trendPayload);
      } catch (loadError) {
        if (cancelled) return;
        setTrendRows([]);
        setError(loadError.message || "Failed to load designer monthly trend.");
      } finally {
        if (!cancelled) setIsLoadingTrend(false);
      }
    }

    loadTrend();
    return () => {
      cancelled = true;
    };
  }, [designers, isLoadingMeta, selectedYear]);

  const selectedDesignerValues = useMemo(
    () => designers.filter((designer) => selectedDesignerIds.includes(String(designer.id))),
    [designers, selectedDesignerIds],
  );
  const visibleDesignerOptions = useMemo(() => {
    const query = designerFilterQuery.trim().toLowerCase();
    if (!query) return designers;
    return designers.filter((designer) => getPersonName(designer).toLowerCase().includes(query));
  }, [designerFilterQuery, designers]);
  const filteredRows = useMemo(() => {
    if (selectedDesignerIds.length === 0) return rows;
    return rows.filter((row) => selectedDesignerIds.includes(String(row.id)));
  }, [rows, selectedDesignerIds]);
  const filteredTrendRows = useMemo(() => {
    if (selectedDesignerIds.length === 0) return trendRows;
    return trendRows.filter((row) => selectedDesignerIds.includes(String(row.id)));
  }, [selectedDesignerIds, trendRows]);
  const totalTeamScore = useMemo(
    () => filteredRows.reduce((total, row) => total + (Number(row.total) || 0), 0),
    [filteredRows],
  );
  const weekColumns = useMemo(
    () => getWeeksForMonth(Number(selectedYear), Number(selectedMonth)),
    [selectedMonth, selectedYear],
  );
  const trendChartData = useMemo(() => {
    return MONTH_LABELS.map((label, index) => {
      const monthKey = String(index + 1);
      const teamTotal = filteredTrendRows.reduce((sum, row) => sum + Number(row.monthly?.[monthKey] || 0), 0);
      return {
        month: label,
        total: teamTotal,
      };
    });
  }, [filteredTrendRows]);

  const selectedMonthLabel = MONTH_LABELS[Number(selectedMonth) - 1] || "Month";
  const isLoading = isLoadingMeta || isLoadingScores;

  function handleExportTrend() {
    if (filteredTrendRows.length === 0) {
      toast.error("No designer monthly trend data available to export.");
      return;
    }

    const monthlyMatrixRows = filteredTrendRows.map((row) => ({
      Designer: row.name,
      Jan: Number(row.monthly?.["1"] || 0),
      Feb: Number(row.monthly?.["2"] || 0),
      March: Number(row.monthly?.["3"] || 0),
      April: Number(row.monthly?.["4"] || 0),
      May: Number(row.monthly?.["5"] || 0),
      June: Number(row.monthly?.["6"] || 0),
      July: Number(row.monthly?.["7"] || 0),
      Aug: Number(row.monthly?.["8"] || 0),
      Sep: Number(row.monthly?.["9"] || 0),
      Oct: Number(row.monthly?.["10"] || 0),
      Nov: Number(row.monthly?.["11"] || 0),
      Dec: Number(row.monthly?.["12"] || 0),
      Total: Number(row.total || 0),
    }));

    monthlyMatrixRows.push({
      Designer: "Team Total",
      Jan: trendChartData[0]?.total || 0,
      Feb: trendChartData[1]?.total || 0,
      March: trendChartData[2]?.total || 0,
      April: trendChartData[3]?.total || 0,
      May: trendChartData[4]?.total || 0,
      June: trendChartData[5]?.total || 0,
      July: trendChartData[6]?.total || 0,
      Aug: trendChartData[7]?.total || 0,
      Sep: trendChartData[8]?.total || 0,
      Oct: trendChartData[9]?.total || 0,
      Nov: trendChartData[10]?.total || 0,
      Dec: trendChartData[11]?.total || 0,
      Total: trendChartData.reduce((sum, item) => sum + Number(item.total || 0), 0),
    });

    const allMonthlyWeeklyRows = [];
    filteredTrendRows.forEach((row) => {
      MONTH_LABELS.forEach((monthLabel, index) => {
        const monthNumber = index + 1;
        const monthWeeks = getWeeksForMonth(Number(selectedYear), monthNumber);
        const monthlyWeekly = row.monthlyWeekly?.[String(monthNumber)] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const exportRow = {
          Designer: row.name,
          Month: monthLabel,
        };

        [1, 2, 3, 4, 5].forEach((week) => {
          exportRow[`Week ${week}`] = monthWeeks.includes(week)
            ? Number(monthlyWeekly?.[String(week)] ?? monthlyWeekly?.[week] ?? 0)
            : "";
        });
        exportRow.Total = Number(row.monthly?.[String(monthNumber)] || 0);
        allMonthlyWeeklyRows.push(exportRow);
      });
    });

    const workbook = XLSX.utils.book_new();
    const monthlyWorksheet = XLSX.utils.json_to_sheet(monthlyMatrixRows);
    const allMonthlyWeeklyWorksheet = XLSX.utils.json_to_sheet(allMonthlyWeeklyRows);
    XLSX.utils.book_append_sheet(workbook, monthlyWorksheet, "Monthly Matrix");
    XLSX.utils.book_append_sheet(workbook, allMonthlyWeeklyWorksheet, "All Monthly Weekly");
    XLSX.writeFile(workbook, `designer-kpi-trend-${selectedYear}.xlsx`);
  }

  function toggleDesignerSelection(designerId) {
    setSelectedDesignerIds((prev) =>
      prev.includes(designerId) ? prev.filter((id) => id !== designerId) : [...prev, designerId],
    );
  }

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
                      revision points, redo points, excellence, signed negative remark values, and Additional Points
                      split into weeks using the Additional Points date.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" className="rounded-full" onClick={handleExportTrend} disabled={isLoadingTrend || filteredTrendRows.length === 0}>
                      <Download className="h-4 w-4" />
                      Export Trend
                    </Button>
                    <div className="rounded-[24px] border border-border/70 bg-background/80 px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {selectedMonthLabel} {selectedYear} total
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{formatPoint(totalTeamScore)}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:max-w-4xl">
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

                  {currentUser?.role !== "designer" ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Select Designer</p>
                      <div className="relative" ref={designerFilterRef}>
                        <div
                          role="button"
                          tabIndex={0}
                          className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-input bg-background px-4 py-3 text-left shadow-sm transition hover:bg-muted/40"
                          onClick={() => setDesignerFilterOpen((open) => !open)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setDesignerFilterOpen((open) => !open);
                            }
                          }}>
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                            {selectedDesignerValues.length > 0 ? (
                              selectedDesignerValues.map((designer) => (
                                <Badge key={String(designer.id)} variant="secondary" className="h-8 rounded-full px-3 text-sm">
                                  <span className="max-w-44 truncate">{getPersonName(designer)}</span>
                                  <button
                                    type="button"
                                    className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleDesignerSelection(String(designer.id));
                                    }}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">All designers</span>
                            )}
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
                              <div
                                role="button"
                                tabIndex={0}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-muted"
                                onClick={() => setSelectedDesignerIds([])}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setSelectedDesignerIds([]);
                                  }
                                }}>
                                <div className="flex items-center gap-3">
                                  <Checkbox checked={selectedDesignerIds.length === 0} tabIndex={-1} className="pointer-events-none" />
                                  <span className="text-sm font-medium text-foreground">All designers</span>
                                </div>
                                {selectedDesignerIds.length === 0 ? <Check className="h-4 w-4 text-primary" /> : null}
                              </div>
                              {visibleDesignerOptions.map((designer) => {
                                const isChecked = selectedDesignerIds.includes(String(designer.id));
                                return (
                                  <div
                                    key={String(designer.id)}
                                    role="button"
                                    tabIndex={0}
                                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-muted"
                                    onClick={() => toggleDesignerSelection(String(designer.id))}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        toggleDesignerSelection(String(designer.id));
                                      }
                                    }}>
                                    <div className="flex items-center gap-3">
                                      <Checkbox checked={isChecked} tabIndex={-1} className="pointer-events-none" />
                                      <span className="text-sm font-medium text-foreground">{getPersonName(designer)}</span>
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
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="space-y-5 p-4 lg:p-6">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading designer KPI...</p>
                ) : designers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No designers found for this account.</p>
                ) : filteredRows.length === 0 && filteredTrendRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No KPI data found for the selected designer.</p>
                ) : (
                  <>
                    <div className="overflow-hidden rounded-[24px] border border-border/80">
                      <div className="border-b border-border/70 bg-muted/35 px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">{selectedMonthLabel} {selectedYear} weekly points</p>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/25 hover:bg-muted/25">
                              <TableHead className="sticky left-0 z-10 h-12 min-w-44 bg-white px-4 text-xs font-semibold uppercase tracking-[0.18em] shadow-[8px_0_20px_-12px_rgba(15,23,42,0.28)]">
                                Designer
                              </TableHead>
                              {weekColumns.map((week) => (
                                <TableHead key={week} className="h-12 min-w-24 px-4 text-xs font-semibold uppercase tracking-[0.18em]">
                                  Week {week}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredRows.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="sticky left-0 z-[1] bg-white px-4 py-4 font-medium shadow-[8px_0_20px_-12px_rgba(15,23,42,0.28)]">
                                  {row.name}
                                </TableCell>
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
                    </div>

                    <div className="overflow-hidden rounded-[24px] border border-border/80">
                      <div className="border-b border-border/70 bg-muted/35 px-4 py-3">
                        <p className="text-sm font-semibold text-foreground">{selectedYear} designer monthly matrix</p>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/25 hover:bg-muted/25">
                              <TableHead className="sticky left-0 z-10 h-12 min-w-44 bg-white px-4 text-xs font-semibold uppercase tracking-[0.18em] shadow-[8px_0_20px_-12px_rgba(15,23,42,0.28)]">
                                Designer
                              </TableHead>
                              {MONTH_LABELS.map((monthLabel) => (
                                <TableHead key={monthLabel} className="h-12 min-w-24 px-4 text-xs font-semibold uppercase tracking-[0.18em]">
                                  {monthLabel}
                                </TableHead>
                              ))}
                              <TableHead className="h-12 min-w-24 px-4 text-xs font-semibold uppercase tracking-[0.18em]">Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredTrendRows.map((row) => (
                              <TableRow key={`trend-${row.id}`}>
                                <TableCell className="sticky left-0 z-[1] bg-white px-4 py-4 font-medium shadow-[8px_0_20px_-12px_rgba(15,23,42,0.28)]">
                                  {row.name}
                                </TableCell>
                                {MONTH_LABELS.map((_, index) => (
                                  <TableCell key={`${row.id}-${index + 1}`} className="px-4 py-4">
                                    {formatPoint(row.monthly?.[String(index + 1)] || 0)}
                                  </TableCell>
                                ))}
                                <TableCell className="px-4 py-4 font-semibold">{formatPoint(row.total)}</TableCell>
                              </TableRow>
                            ))}
                            {filteredTrendRows.length > 0 ? (
                              <TableRow className="bg-muted/15">
                                <TableCell className="sticky left-0 z-[1] bg-white px-4 py-4 font-semibold shadow-[8px_0_20px_-12px_rgba(15,23,42,0.28)]">
                                  Team Total
                                </TableCell>
                                {trendChartData.map((item) => (
                                  <TableCell key={`team-${item.month}`} className="px-4 py-4 font-semibold">
                                    {formatPoint(item.total)}
                                  </TableCell>
                                ))}
                                <TableCell className="px-4 py-4 font-semibold">
                                  {formatPoint(trendChartData.reduce((sum, item) => sum + Number(item.total || 0), 0))}
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </TableBody>
                        </Table>
                      </div>
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
