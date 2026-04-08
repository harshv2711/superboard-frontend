import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function toMonthlyAmountForm(item = null) {
  return {
    id: item?.id || null,
    clientId: item?.client != null ? String(item.client) : "",
    date: item?.date || "",
    rangeFrom: item?.date ? String(item.date).slice(0, 7) : "",
    rangeTo: item?.date ? String(item.date).slice(0, 7) : "",
    amount: item?.amt != null ? String(item.amt) : "",
  };
}

function getClientName(client) {
  return client?.name || client?.client_name || `Client #${client?.id || ""}`;
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

function formatMonthLabel(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function normalizeMonthInputToDate(monthValue) {
  if (!monthValue) return "";
  return `${monthValue}-01`;
}

function enumerateMonthsInRange(fromMonth, toMonth) {
  if (!fromMonth || !toMonth) return [];
  const [fromYear, fromMonthNumber] = fromMonth.split("-").map(Number);
  const [toYear, toMonthNumber] = toMonth.split("-").map(Number);
  if (!fromYear || !fromMonthNumber || !toYear || !toMonthNumber) return [];

  const cursor = new Date(fromYear, fromMonthNumber - 1, 1);
  const end = new Date(toYear, toMonthNumber - 1, 1);
  if (cursor > end) return [];

  const months = [];
  while (cursor <= end) {
    months.push(format(cursor, "yyyy-MM-dd"));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function excelDateToIso(value) {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-01`;
  }

  const cleaned = String(value || "").trim();
  if (!cleaned) return "";
  if (/^\d{4}-\d{2}$/.test(cleaned)) return `${cleaned}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return `${cleaned.slice(0, 7)}-01`;

  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function ClientMonthlyAmountsPage() {
  const [clients, setClients] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedClientFilter, setSelectedClientFilter] = useState("__all__");
  const [sortBy, setSortBy] = useState("month_desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState(null);
  const [drawerError, setDrawerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [form, setForm] = useState(toMonthlyAmountForm());

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [clientRows, monthlyAmountRows] = await Promise.all([
        superboardApi.clients.listAll({ page_size: 300 }),
        superboardApi.clientMonthlyAmounts.listAll({ page_size: 3000 }),
      ]);

      setClients(Array.isArray(clientRows) ? clientRows : []);
      setItems(Array.isArray(monthlyAmountRows) ? monthlyAmountRows : []);
    } catch (requestError) {
      const message = requestError.message || "Failed to load client monthly revenue.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const clientsById = useMemo(
    () => clients.reduce((accumulator, client) => {
      accumulator[String(client.id)] = client;
      return accumulator;
    }, {}),
    [clients],
  );

  const filteredAndSortedItems = useMemo(() => {
    const filteredItems = selectedClientFilter === "__all__"
      ? [...items]
      : items.filter((item) => String(item.client || "") === String(selectedClientFilter));

    const dedupedItems = Array.from(
      new Map(
        filteredItems
          .sort((left, right) => Number(right.id || 0) - Number(left.id || 0))
          .map((item) => [`${String(item.client || "")}-${String(item.date || "")}`, item]),
      ).values(),
    );

    return dedupedItems.sort((left, right) => {
      const leftClientName = getClientName(clientsById[String(left.client)]);
      const rightClientName = getClientName(clientsById[String(right.client)]);
      const leftDate = String(left.date || "");
      const rightDate = String(right.date || "");
      const leftAmount = Number(left.amt || 0);
      const rightAmount = Number(right.amt || 0);

      if (sortBy === "month_asc") {
        const dateCompare = leftDate.localeCompare(rightDate);
        if (dateCompare !== 0) return dateCompare;
        return leftClientName.localeCompare(rightClientName);
      }

      if (sortBy === "client_asc") {
        const clientCompare = leftClientName.localeCompare(rightClientName);
        if (clientCompare !== 0) return clientCompare;
        return rightDate.localeCompare(leftDate);
      }

      if (sortBy === "client_desc") {
        const clientCompare = rightClientName.localeCompare(leftClientName);
        if (clientCompare !== 0) return clientCompare;
        return rightDate.localeCompare(leftDate);
      }

      if (sortBy === "revenue_desc") {
        const amountCompare = rightAmount - leftAmount;
        if (amountCompare !== 0) return amountCompare;
        return rightDate.localeCompare(leftDate);
      }

      if (sortBy === "revenue_asc") {
        const amountCompare = leftAmount - rightAmount;
        if (amountCompare !== 0) return amountCompare;
        return rightDate.localeCompare(leftDate);
      }

      const dateCompare = rightDate.localeCompare(leftDate);
      if (dateCompare !== 0) return dateCompare;
      return leftClientName.localeCompare(rightClientName);
    });
  }, [clientsById, items, selectedClientFilter, sortBy]);

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonthCount = useMemo(
    () => filteredAndSortedItems.filter((item) => String(item?.date || "").slice(0, 7) === currentMonthKey).length,
    [currentMonthKey, filteredAndSortedItems],
  );
  const visibleItemIds = useMemo(
    () => filteredAndSortedItems.map((item) => String(item.id)),
    [filteredAndSortedItems],
  );
  const allVisibleSelected = visibleItemIds.length > 0 && visibleItemIds.every((id) => selectedItemIds.includes(id));
  const hasAnyVisibleSelected = visibleItemIds.some((id) => selectedItemIds.includes(id));

  useEffect(() => {
    setSelectedItemIds((prev) => prev.filter((id) => items.some((item) => String(item.id) === String(id))));
  }, [items]);

  function handleDrawerOpenChange(open) {
    setDrawerOpen(open);
    if (!open) {
      setDrawerMode(null);
      setDrawerError("");
      setSaving(false);
      setForm(toMonthlyAmountForm());
    }
  }

  function openCreateDrawer() {
    setDrawerMode("create");
    setDrawerError("");
    setForm(toMonthlyAmountForm({
      date: new Date().toISOString().slice(0, 10),
    }));
    setDrawerOpen(true);
  }

  function openEditDrawer(item) {
    setDrawerMode("edit");
    setDrawerError("");
    setForm(toMonthlyAmountForm(item));
    setDrawerOpen(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setDrawerError("");

    try {
      if (form.id) {
        const payload = {
          client: Number(form.clientId),
          date: form.date,
          amt: Number(form.amount),
        };
        await superboardApi.clientMonthlyAmounts.patch(form.id, payload);
        toast.success("Client monthly revenue updated successfully.");
      } else {
        const monthlyDates = enumerateMonthsInRange(form.rangeFrom, form.rangeTo);
        if (monthlyDates.length === 0) {
          throw new Error("Please choose a valid month range.");
        }
        const response = await superboardApi.clientMonthlyAmounts.applyRange({
          client: Number(form.clientId),
          from_month: form.rangeFrom,
          to_month: form.rangeTo,
          amt: Number(form.amount),
        });

        const totalMonths = Number(response?.created_count || 0) + Number(response?.updated_count || 0) || monthlyDates.length;
        toast.success(`Client monthly revenue applied to ${totalMonths} month(s).`);
      }

      await loadData();
      handleDrawerOpenChange(false);
    } catch (requestError) {
      const message = requestError.message || "Failed to save client monthly revenue.";
      setDrawerError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId) {
    if (!itemId || !window.confirm("Delete this client monthly revenue?")) return;

    try {
      await superboardApi.clientMonthlyAmounts.remove(itemId);
      toast.success("Client monthly revenue deleted successfully.");
      await loadData();
      if (String(form.id || "") === String(itemId)) {
        handleDrawerOpenChange(false);
      }
    } catch (requestError) {
      const message = requestError.message || "Failed to delete client monthly revenue.";
      toast.error(message);
    }
  }

  async function handleBulkDelete() {
    if (selectedItemIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedItemIds.length} selected client monthly revenue record(s)?`)) return;

    try {
      setBulkDeleting(true);
      await Promise.all(selectedItemIds.map((itemId) => superboardApi.clientMonthlyAmounts.remove(itemId)));
      toast.success(`Deleted ${selectedItemIds.length} client monthly revenue record(s).`);
      setSelectedItemIds([]);
      await loadData();
    } catch (requestError) {
      const message = requestError.message || "Failed to delete selected client monthly revenue records.";
      toast.error(message);
    } finally {
      setBulkDeleting(false);
    }
  }

  function handleExportExcel() {
    const rows = filteredAndSortedItems.map((item) => ({
      Client: getClientName(clientsById[String(item.client)]),
      "Reporting Month": formatMonthLabel(item.date),
      Year: String(item.date || "").slice(0, 4),
      Month: formatMonthLabel(item.date).split(" ")[0] || "",
      Revenue: Number(item.amt || 0),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Client Monthly Revenue");
    XLSX.writeFile(workbook, "client-monthly-revenue.xlsx");
  }

  async function handleImportExcel(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      const clientNameMap = new Map(
        clientOptions.map((client) => [getClientName(client).trim().toLowerCase(), String(client.id)]),
      );

      const groupedRows = new Map();

      for (const row of rows) {
        const clientLabel = String(row.Client || row.client || "").trim();
        const revenueValue = row.Revenue ?? row.revenue ?? row.Amount ?? row.amount;
        const reportingMonthValue = row["Reporting Month"] || row.reporting_month || row.Month || row.month;
        const yearValue = row.Year || row.year;

        if (!clientLabel || revenueValue === "") continue;

        const clientId = clientNameMap.get(clientLabel.toLowerCase());
        if (!clientId) {
          throw new Error(`Client not found in import file: ${clientLabel}`);
        }

        let monthIso = "";
        if (yearValue && reportingMonthValue && !String(reportingMonthValue).includes(" ")) {
          const parsed = new Date(`${String(reportingMonthValue)} 1, ${String(yearValue)}`);
          if (!Number.isNaN(parsed.getTime())) {
            monthIso = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-01`;
          }
        }
        if (!monthIso) {
          monthIso = excelDateToIso(reportingMonthValue);
        }
        if (!monthIso) {
          throw new Error(`Invalid reporting month for client ${clientLabel}`);
        }

        groupedRows.set(`${clientId}-${monthIso}`, {
          clientId,
          monthIso,
          amount: Number(revenueValue),
        });
      }

      const existingByKey = new Map(
        items.map((item) => [`${String(item.client)}-${String(item.date)}`, item]),
      );

      await Promise.all(
        Array.from(groupedRows.values()).map((row) => {
          const payload = {
            client: Number(row.clientId),
            date: row.monthIso,
            amt: row.amount,
          };
          const existing = existingByKey.get(`${row.clientId}-${row.monthIso}`);
          if (existing?.id) {
            return superboardApi.clientMonthlyAmounts.patch(existing.id, payload);
          }
          return superboardApi.clientMonthlyAmounts.create(payload);
        }),
      );

      await loadData();
      toast.success(`Imported ${groupedRows.size} monthly revenue row(s) from Excel.`);
    } catch (requestError) {
      toast.error(requestError.message || "Failed to import Excel file.");
    } finally {
      event.target.value = "";
      setImporting(false);
    }
  }

  const clientOptions = useMemo(
    () => [...clients].sort((left, right) => getClientName(left).localeCompare(getClientName(right))),
    [clients],
  );

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title="Client Monthly Revenue" />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden p-4 lg:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground">
                  Overview
                </div>
                <div className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  Total Records <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-foreground">{filteredAndSortedItems.length}</span>
                </div>
                <div className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  This Month <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-foreground">{currentMonthCount}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedItemIds.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-destructive text-destructive hover:bg-destructive/10"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}>
                    <Trash2 className="h-4 w-4" />
                    {bulkDeleting ? "Deleting..." : `Delete Selected (${selectedItemIds.length})`}
                  </Button>
                ) : null}

                <Button type="button" variant="outline" className="rounded-xl" onClick={handleExportExcel}>
                  <Download className="h-4 w-4" />
                  Export Excel
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={importing}
                  onClick={() => document.getElementById("monthly-revenue-import-input")?.click()}>
                  <Upload className="h-4 w-4" />
                  {importing ? "Importing..." : "Import Excel"}
                </Button>
                <input
                  id="monthly-revenue-import-input"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleImportExcel}
                />

                <Button onClick={openCreateDrawer} className="rounded-xl">
                  <Plus className="h-4 w-4" />
                  Add Monthly Revenue
                </Button>
              </div>
            </div>

            <Sheet open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
              <SheetContent side="right" className="w-full sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>{drawerMode === "edit" ? "Edit client monthly revenue" : "Add client monthly revenue"}</SheetTitle>
                  <SheetDescription>
                    {drawerMode === "edit"
                      ? "Update a single monthly revenue record used in Brand KPI reporting."
                      : "Apply one revenue amount across every month in a selected date range."}
                  </SheetDescription>
                </SheetHeader>

                <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4">
                  <form className="space-y-4 rounded-lg border p-4" onSubmit={handleSave}>
                    <div className="space-y-2">
                      <Label htmlFor="monthly-amount-client">Client</Label>
                      <Select
                        value={form.clientId}
                        onValueChange={(value) => setForm((prev) => ({ ...prev, clientId: value }))}>
                        <SelectTrigger id="monthly-amount-client">
                          <SelectValue placeholder="Select client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientOptions.map((client) => (
                            <SelectItem key={client.id} value={String(client.id)}>
                              {getClientName(client)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {form.id ? (
                      <div className="space-y-2">
                        <Label htmlFor="monthly-amount-date">Date</Label>
                        <Input
                          id="monthly-amount-date"
                          type="month"
                          value={form.date ? String(form.date).slice(0, 7) : ""}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              date: normalizeMonthInputToDate(event.target.value),
                            }))
                          }
                          required
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="monthly-amount-range-from">Month From</Label>
                          <Input
                            id="monthly-amount-range-from"
                            type="month"
                            value={form.rangeFrom}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                rangeFrom: event.target.value,
                                date: normalizeMonthInputToDate(event.target.value),
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="monthly-amount-range-to">Month To</Label>
                          <Input
                            id="monthly-amount-range-to"
                            type="month"
                            value={form.rangeTo}
                            min={form.rangeFrom || undefined}
                            onChange={(event) => setForm((prev) => ({ ...prev, rangeTo: event.target.value }))}
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="monthly-amount-amt">Revenue</Label>
                      <Input
                        id="monthly-amount-amt"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.amount}
                        onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                        placeholder="Enter amount"
                        required
                      />
                    </div>

                    {drawerError ? (
                      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {drawerError}
                      </p>
                    ) : null}

                    <div className="flex items-center justify-between gap-3 pt-2">
                      {form.id ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(form.id)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      ) : <div />}

                      <Button
                        type="submit"
                        disabled={saving || !form.clientId || !(form.id ? form.date : form.rangeFrom && form.rangeTo) || !form.amount}>
                        {saving ? "Saving..." : form.id ? "Save Changes" : "Apply Revenue Range"}
                      </Button>
                    </div>
                  </form>
                </div>
              </SheetContent>
            </Sheet>

            {error ? (
              <Card className="border-destructive/40">
                <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
              </Card>
            ) : null}

            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <div className="min-w-[220px] space-y-2">
                <Label htmlFor="monthly-revenue-client-filter">Client Filter</Label>
                <Select value={selectedClientFilter} onValueChange={setSelectedClientFilter}>
                  <SelectTrigger id="monthly-revenue-client-filter" className="rounded-xl">
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All clients</SelectItem>
                    {clientOptions.map((client) => (
                      <SelectItem key={client.id} value={String(client.id)}>
                        {getClientName(client)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[220px] space-y-2">
                <Label htmlFor="monthly-revenue-sort">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="monthly-revenue-sort" className="rounded-xl">
                    <SelectValue placeholder="Select sorting" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month_desc">Month: Newest First</SelectItem>
                    <SelectItem value="month_asc">Month: Oldest First</SelectItem>
                    <SelectItem value="client_asc">Client: A to Z</SelectItem>
                    <SelectItem value="client_desc">Client: Z to A</SelectItem>
                    <SelectItem value="revenue_desc">Revenue: High to Low</SelectItem>
                    <SelectItem value="revenue_asc">Revenue: Low to High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
              <CardContent className="p-0">
                {loading ? (
                  <p className="p-6 text-sm text-muted-foreground">Loading client monthly revenue...</p>
                ) : filteredAndSortedItems.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">No client monthly revenue found yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableHead className="w-12 px-4 py-3">
                          <Checkbox
                            checked={allVisibleSelected ? true : hasAnyVisibleSelected ? "indeterminate" : false}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedItemIds((prev) => Array.from(new Set([...prev, ...visibleItemIds])));
                                return;
                              }
                              setSelectedItemIds((prev) => prev.filter((id) => !visibleItemIds.includes(id)));
                            }}
                            aria-label="Select all visible monthly revenue rows"
                          />
                        </TableHead>
                        <TableHead className="px-4 py-3">Client</TableHead>
                        <TableHead className="px-4 py-3">Reporting Month</TableHead>
                        <TableHead className="px-4 py-3">Revenue</TableHead>
                        <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="px-4 py-4">
                            <Checkbox
                              checked={selectedItemIds.includes(String(item.id))}
                              onCheckedChange={(checked) =>
                                setSelectedItemIds((prev) =>
                                  checked
                                    ? Array.from(new Set([...prev, String(item.id)]))
                                    : prev.filter((id) => id !== String(item.id)),
                                )
                              }
                              aria-label={`Select monthly revenue row ${item.id}`}
                            />
                          </TableCell>
                          <TableCell className="px-4 py-4 font-medium">
                            {getClientName(clientsById[String(item.client)])}
                          </TableCell>
                          <TableCell className="px-4 py-4">{formatMonthLabel(item.date)}</TableCell>
                          <TableCell className="px-4 py-4">{formatCurrency(item.amt)}</TableCell>
                          <TableCell className="px-4 py-4 text-right">
                            <Button type="button" variant="ghost" size="sm" onClick={() => openEditDrawer(item)}>
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
        <Toaster richColors position="top-right" />
      </SidebarProvider>
    </TooltipProvider>
  );
}
