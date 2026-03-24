import { useEffect, useMemo, useState } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const MONTH_OPTIONS = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

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
  const deliverableName = getScopeDeliverableName(scope);
  return deliverableName ? [deliverableName] : [];
}

function getServiceCategoryName(scope) {
  return scope?.service_category_name || "-";
}

function getTotalUnit(scope) {
  const value = scope?.totalUnit ?? scope?.total_unit;
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function getTaskName(task) {
  return task?.task_name || task?.name || `Task #${task?.id}`;
}

function getTaskDate(task) {
  const rawValue = task?.target_date || task?.created_at || null;
  if (!rawValue) return null;
  const date = new Date(rawValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRootOriginalTaskId(task, taskById) {
  let current = task;
  const seen = new Set();

  while (current && (current.revision_of || current.redo_of)) {
    const parentId = String(current.revision_of || current.redo_of || "");
    if (!parentId || seen.has(parentId)) break;
    seen.add(parentId);
    current = taskById.get(parentId);
  }

  return current?.id ? String(current.id) : "";
}

function getDeliverableStatus(totalMonthlyUnit, deliveredCount) {
  if (totalMonthlyUnit === deliveredCount) {
    return {
      label: "Complete",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (totalMonthlyUnit > deliveredCount) {
    return {
      label: "Under Deliverable",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Over Deliverable",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  };
}

function SortableTableHeader({ column, label, align = "left" }) {
  return (
    <div className={align === "right" ? "flex justify-end" : "flex justify-start"}>
      <Button
        variant="ghost"
        className={
          align === "right"
            ? "h-auto px-0 py-0 text-right text-[15px] font-semibold text-foreground hover:bg-transparent"
            : "h-auto px-0 py-0 text-left text-[15px] font-semibold text-foreground hover:bg-transparent"
        }
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        {label}
        <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  );
}

function DeliverablesDataTable({ deliverables }) {
  const [sorting, setSorting] = useState([]);

  const data = useMemo(
    () =>
      deliverables.map((deliverable, index) => ({
        ...deliverable,
        order: index + 1,
      })),
    [deliverables],
  );

  const columns = useMemo(
    () => [
      {
        accessorKey: "order",
        header: "No.",
        cell: ({ row }) => (
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {String(row.original.order).padStart(2, "0")}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => <SortableTableHeader column={column} label="List of Deliverable" />,
        cell: ({ row }) => <span className="text-lg font-semibold text-foreground">{row.original.name}</span>,
      },
      {
        accessorKey: "revisions",
        header: ({ column }) => <SortableTableHeader column={column} label="Number of Revision" align="right" />,
        cell: ({ row }) => (
          <div className="text-right">
            <span className="inline-flex min-w-16 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-lg font-semibold tabular-nums text-amber-700">
              {row.original.revisions}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "redos",
        header: ({ column }) => <SortableTableHeader column={column} label="Number of Redo" align="right" />,
        cell: ({ row }) => (
          <div className="text-right">
            <span className="inline-flex min-w-16 items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-lg font-semibold tabular-nums text-slate-700">
              {row.original.redos}
            </span>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-hidden rounded-[28px] border border-border/70 bg-white shadow-[0_10px_30px_-28px_rgba(15,23,42,0.3)]">
      <Table>
        <TableHeader className="bg-white">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-b border-border/70 bg-white hover:bg-white">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={
                    header.id === "order"
                      ? "w-[10%] whitespace-nowrap px-8 py-5 text-[13px] font-semibold uppercase tracking-[0.24em] text-muted-foreground"
                      : header.id === "name"
                        ? "w-[48%] whitespace-nowrap px-8 py-5"
                        : "w-[21%] whitespace-nowrap px-8 py-5 text-right"
                  }
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/[0.08]">
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={
                      cell.column.id === "order"
                        ? "px-8 py-7 align-middle"
                        : cell.column.id === "name"
                          ? "px-8 py-7 align-middle"
                          : "px-8 py-7 align-middle text-right"
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-white">
              <TableCell className="px-8 py-10 text-sm text-muted-foreground" colSpan={columns.length}>
                No original deliverables found for this scope.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function DeliverablesTrackerPage() {
  const now = useMemo(() => new Date(), []);
  const [clients, setClients] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth()));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError("");

      try {
        const [loadedClients, loadedScopes, loadedTasks] = await Promise.all([
          superboardApi.clients.listAll({ page_size: 300 }),
          superboardApi.scopeOfWork.listAll({ page_size: 500 }),
          superboardApi.tasks.listAll({ page_size: 2000 }),
        ]);

        if (cancelled) return;

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

  const taskById = useMemo(
    () => new Map(tasks.filter((task) => task?.id).map((task) => [String(task.id), task])),
    [tasks],
  );

  const clientOptions = useMemo(() => {
    const clientIds = new Set(scopes.map((scope) => String(scope?.client || "")).filter(Boolean));
    return clients
      .filter((client) => clientIds.has(String(client.id)))
      .sort((left, right) => getClientName(left).localeCompare(getClientName(right)));
  }, [clients, scopes]);

  useEffect(() => {
    if (!clientOptions.length) {
      setSelectedClientId("");
      return;
    }
    if (!clientOptions.some((client) => String(client.id) === String(selectedClientId))) {
      setSelectedClientId(String(clientOptions[0].id));
    }
  }, [clientOptions, selectedClientId]);

  const selectedClient = useMemo(() => {
    return clientsById[String(selectedClientId)] || null;
  }, [clientsById, selectedClientId]);

  const selectedScopes = useMemo(() => {
    return scopes
      .filter((scope) => String(scope?.client || "") === String(selectedClientId))
      .sort((left, right) => getScopeDeliverableName(left).localeCompare(getScopeDeliverableName(right)));
  }, [scopes, selectedClientId]);

  const yearOptions = useMemo(() => {
    const years = new Set();
    tasks.forEach((task) => {
      const date = getTaskDate(task);
      if (date) years.add(String(date.getFullYear()));
    });
    years.add(String(now.getFullYear()));
    return Array.from(years).sort((left, right) => Number(right) - Number(left));
  }, [now, tasks]);

  useEffect(() => {
    if (!yearOptions.includes(selectedYear)) {
      setSelectedYear(yearOptions[0] || String(now.getFullYear()));
    }
  }, [now, selectedYear, yearOptions]);

  const scopeReports = useMemo(() => {
    return selectedScopes.map((scope) => {
      const scopeId = String(scope.id);
      const scopeTasks = tasks.filter((task) => {
        if (String(task?.scope_of_work || "") !== scopeId) return false;
        const taskDate = getTaskDate(task);
        if (!taskDate) return false;
        return String(taskDate.getMonth()) === selectedMonth && String(taskDate.getFullYear()) === selectedYear;
      });
      const originalTasks = scopeTasks
        .filter((task) => !task?.revision_of && !task?.redo_of)
        .sort((left, right) => {
          const leftDate = getTaskDate(left)?.getTime() || 0;
          const rightDate = getTaskDate(right)?.getTime() || 0;
          if (leftDate !== rightDate) return leftDate - rightDate;
          return Number(left?.id || 0) - Number(right?.id || 0);
        });

      const countsByOriginalId = {};

      scopeTasks.forEach((task) => {
        if (!task?.revision_of && !task?.redo_of) return;
        const rootOriginalTaskId = getRootOriginalTaskId(task, taskById);
        if (!rootOriginalTaskId) return;
        if (!countsByOriginalId[rootOriginalTaskId]) {
          countsByOriginalId[rootOriginalTaskId] = { revisions: 0, redos: 0 };
        }
        if (task?.revision_of) countsByOriginalId[rootOriginalTaskId].revisions += 1;
        if (task?.redo_of) countsByOriginalId[rootOriginalTaskId].redos += 1;
      });

      const deliverables = originalTasks.map((task) => {
        const originalId = String(task.id);
        return {
          id: originalId,
          name: getTaskName(task),
          revisions: countsByOriginalId[originalId]?.revisions || 0,
          redos: countsByOriginalId[originalId]?.redos || 0,
        };
      });

      return {
        id: scopeId,
        serviceCategoryName: getServiceCategoryName(scope),
        deliverableTypeOfWorkList: getScopeTypeNames(scope),
        totalMonthlyUnit: getTotalUnit(scope),
        deliverables,
        deliveredCount: deliverables.length,
        deliverableStatus: getDeliverableStatus(getTotalUnit(scope), deliverables.length),
      };
    });
  }, [selectedMonth, selectedScopes, selectedYear, taskById, tasks]);

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
              <CardHeader className="border-b border-border/70 bg-[linear-gradient(180deg,_rgba(248,248,250,0.95),_rgba(255,255,255,1))]">
                <div className="flex flex-col gap-5">
                  <div className="space-y-2">
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em]">
                      Report View
                    </Badge>
                    <CardTitle className="text-xl tracking-tight">Deliverables Tracker</CardTitle>
                  </div>
                  <div className="grid w-full gap-4 md:grid-cols-[minmax(260px,1.4fr)_minmax(180px,0.7fr)_minmax(160px,0.6fr)] md:items-end">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Client</p>
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="h-12 w-full rounded-2xl bg-white shadow-sm">
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientOptions.map((client) => (
                            <SelectItem key={String(client.id)} value={String(client.id)}>
                              {getClientName(client)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Month</p>
                      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="h-12 w-full rounded-2xl bg-white shadow-sm">
                          <SelectValue placeholder="Select month" />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTH_OPTIONS.map((month) => (
                            <SelectItem key={month.value} value={month.value}>
                              {month.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Year</p>
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="h-12 w-full rounded-2xl bg-white shadow-sm">
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map((year) => (
                            <SelectItem key={year} value={year}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-4 lg:p-6">
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading deliverables tracker...</p>
                ) : !selectedClient ? (
                  <p className="text-sm text-muted-foreground">No client scope of work records found.</p>
                ) : scopeReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No scope of work records found for this client.</p>
                ) : (
                  <div className="space-y-6">
                    {scopeReports.map((report) => (
                        <div
                          key={report.id}
                          className="overflow-hidden rounded-[24px] border border-border/80 bg-[linear-gradient(180deg,_rgba(255,255,255,1),_rgba(250,250,252,1))] shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)]"
                        >
                        <div className="border-b border-border/70 px-5 py-5 sm:px-6">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Client Name</p>
                              <p className="text-xl font-semibold tracking-tight text-foreground">{getClientName(selectedClient)}</p>
                            </div>
                            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                              Scope Report
                            </Badge>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2.5">
                            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                              {report.deliveredCount} deliverable{report.deliveredCount === 1 ? "" : "s"}
                            </Badge>
                            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                              {report.totalMonthlyUnit} monthly unit{report.totalMonthlyUnit === 1 ? "" : "s"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${report.deliverableStatus.className}`}
                            >
                              {report.deliverableStatus.label}
                            </Badge>
                          </div>
                        </div>

                        <div className="border-b border-border/70 bg-muted/[0.18] px-5 py-4 sm:px-6">
                          <p className="text-lg font-semibold text-foreground">Scope Of Work</p>
                        </div>

                        <div className="grid gap-4 border-b border-border/70 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(220px,1fr)_minmax(340px,2fr)_minmax(180px,220px)]">
                          <div className="rounded-2xl border border-border/70 bg-white px-5 py-4 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Service Category</p>
                            <p className="mt-2 text-base font-medium text-foreground">{report.serviceCategoryName}</p>
                          </div>

                          <div className="rounded-2xl border border-border/70 bg-white px-5 py-4 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Deliverable/ Type of work</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {report.deliverableTypeOfWorkList.length > 0 ? (
                                report.deliverableTypeOfWorkList.map((item) => (
                                  <Badge key={item} variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
                                    {item}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/70 bg-white px-5 py-4 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total Monthly Unit</p>
                            <p className="mt-2 text-2xl font-semibold text-foreground">{report.totalMonthlyUnit}</p>
                          </div>
                        </div>

                        <div className="overflow-x-auto px-4 py-4 sm:px-6 sm:py-5">
                          <DeliverablesDataTable deliverables={report.deliverables} />
                        </div>
                      </div>
                    ))}
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
