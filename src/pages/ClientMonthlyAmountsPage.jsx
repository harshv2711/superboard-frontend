import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

function parseFormDate(dateValue) {
  if (!dateValue) return undefined;
  try {
    return parseISO(dateValue);
  } catch {
    return undefined;
  }
}

export default function ClientMonthlyAmountsPage() {
  const [clients, setClients] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState(null);
  const [drawerError, setDrawerError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(toMonthlyAmountForm());
  const [datePickerOpen, setDatePickerOpen] = useState(false);

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

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => {
      const dateCompare = String(right.date || "").localeCompare(String(left.date || ""));
      if (dateCompare !== 0) return dateCompare;
      return getClientName(clientsById[String(left.client)]).localeCompare(getClientName(clientsById[String(right.client)]));
    }),
    [clientsById, items],
  );

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonthCount = useMemo(
    () => items.filter((item) => String(item?.date || "").slice(0, 7) === currentMonthKey).length,
    [currentMonthKey, items],
  );

  function handleDrawerOpenChange(open) {
    setDrawerOpen(open);
    if (!open) {
      setDrawerMode(null);
      setDrawerError("");
      setSaving(false);
      setDatePickerOpen(false);
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
      const payload = {
        client: Number(form.clientId),
        date: form.date,
        amt: Number(form.amount),
      };

      if (form.id) {
        await superboardApi.clientMonthlyAmounts.patch(form.id, payload);
        toast.success("Client monthly revenue updated successfully.");
      } else {
        await superboardApi.clientMonthlyAmounts.create(payload);
        toast.success("Client monthly revenue created successfully.");
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
                  Total Records <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-foreground">{items.length}</span>
                </div>
                <div className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  This Month <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-foreground">{currentMonthCount}</span>
                </div>
              </div>

              <Button onClick={openCreateDrawer} className="rounded-xl">
                <Plus className="h-4 w-4" />
                Add Monthly Revenue
              </Button>
            </div>

            <Sheet open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
              <SheetContent side="right" className="w-full sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>{drawerMode === "edit" ? "Edit client monthly revenue" : "Add client monthly revenue"}</SheetTitle>
                  <SheetDescription>
                    Create and update monthly revenue records used in Brand KPI reporting.
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

                    <div className="space-y-2">
                      <Label htmlFor="monthly-amount-date">Date</Label>
                      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="monthly-amount-date"
                            type="button"
                            variant="outline"
                            className={cn(
                              "h-10 w-full justify-between rounded-md px-3 text-left font-normal",
                              !form.date && "text-muted-foreground",
                            )}>
                            {form.date ? format(parseISO(form.date), "dd/MM/yyyy") : "Pick a date"}
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={parseFormDate(form.date)}
                            onSelect={(value) => {
                              setForm((prev) => ({
                                ...prev,
                                date: value ? format(value, "yyyy-MM-dd") : "",
                              }));
                              setDatePickerOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

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

                      <Button type="submit" disabled={saving || !form.clientId || !form.date || !form.amount}>
                        {saving ? "Saving..." : form.id ? "Save Changes" : "Create Record"}
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

            <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
              <CardContent className="p-0">
                {loading ? (
                  <p className="p-6 text-sm text-muted-foreground">Loading client monthly revenue...</p>
                ) : sortedItems.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">No client monthly revenue found yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableHead className="px-4 py-3">Client</TableHead>
                        <TableHead className="px-4 py-3">Reporting Month</TableHead>
                        <TableHead className="px-4 py-3">Revenue</TableHead>
                        <TableHead className="px-4 py-3 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedItems.map((item) => (
                        <TableRow key={item.id}>
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
