import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function toTypeOfWorkForm(item = null) {
  return {
    id: item?.id || null,
    workTypeName: item?.work_type_name || "",
    point: item?.point != null ? String(item.point) : "",
    taskCount: item?.task_count || 0,
  };
}

export default function TypeOfWorkPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState(null);
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [form, setForm] = useState(toTypeOfWorkForm());
  const [selectedIds, setSelectedIds] = useState([]);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function loadItems() {
    try {
      setLoading(true);
      setError("");
      const rows = await superboardApi.typeOfWork.listAll({ page_size: 300 });
      setItems(rows);
    } catch (requestError) {
      const message = requestError.message || "Failed to load type of work.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.work_type_name || "").localeCompare(b.work_type_name || "")),
    [items],
  );
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedItems]);
  const isAllVisibleSelected = paginatedItems.length > 0 && paginatedItems.every((item) => selectedIds.includes(item.id));

  useEffect(() => {
    setPage((prev) => Math.min(prev, Math.max(1, Math.ceil(sortedItems.length / pageSize))));
  }, [pageSize, sortedItems.length]);

  function handleDrawerOpenChange(open) {
    setDrawerOpen(open);
    if (!open) {
      setDrawerMode(null);
      setDrawerError("");
      setSaving(false);
      setForm(toTypeOfWorkForm());
    }
  }

  function openCreateDrawer() {
    setDrawerMode("create");
    setDrawerError("");
    setForm(toTypeOfWorkForm());
    setDrawerOpen(true);
  }

  function openEditDrawer(item) {
    setDrawerMode("edit");
    setDrawerError("");
    setForm(toTypeOfWorkForm(item));
    setDrawerOpen(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setDrawerError("");
    try {
      const payload = {
        work_type_name: form.workTypeName.trim(),
        point: Number(form.point),
      };

      if (form.id) {
        await superboardApi.typeOfWork.patch(form.id, payload);
        toast.success("Type of work updated successfully.");
      } else {
        await superboardApi.typeOfWork.create(payload);
        toast.success("Type of work created successfully.");
      }

      await loadItems();
      handleDrawerOpenChange(false);
    } catch (requestError) {
      const message = requestError.message || "Failed to save type of work.";
      setDrawerError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId) {
    if (!itemId || !window.confirm("Delete this type of work?")) return;
    try {
      await superboardApi.typeOfWork.remove(itemId);
      toast.success("Type of work deleted successfully.");
      await loadItems();
      if (String(form.id || "") === String(itemId)) {
        handleDrawerOpenChange(false);
      }
    } catch (requestError) {
      const message = requestError.message || "Failed to delete type of work.";
      setDrawerError(message);
      toast.error(message);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;

    const protectedItems = items.filter((item) => selectedIds.includes(item.id) && Number(item.task_count || 0) > 0);
    if (protectedItems.length > 0) {
      toast.error("One or more selected type of work items are already used by tasks and cannot be deleted.");
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedIds.length} selected type of work item(s)?`);
    if (!confirmed) return;

    setDeletingSelected(true);
    try {
      await Promise.all(selectedIds.map((itemId) => superboardApi.typeOfWork.remove(itemId)));
      toast.success(`${selectedIds.length} type of work item(s) deleted successfully.`);
      setSelectedIds([]);
      await loadItems();
      if (form.id && selectedIds.includes(form.id)) {
        handleDrawerOpenChange(false);
      }
    } catch (requestError) {
      const message = requestError.message || "Failed to delete selected type of work items.";
      toast.error(message);
    } finally {
      setDeletingSelected(false);
    }
  }

  function toggleSelected(itemId) {
    setSelectedIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  }

  function toggleSelectAllVisible(checked) {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...paginatedItems.map((item) => item.id)])));
      return;
    }
    setSelectedIds((prev) => prev.filter((id) => !paginatedItems.some((item) => item.id === id)));
  }

  function getPointTone(point) {
    if (Number(point) < 0) return "border-rose-200 bg-rose-50 text-rose-700";
    if (Number(point) > 0) return "border-emerald-200 bg-emerald-50 text-emerald-700";
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  function getPointLabel(point) {
    const value = Number(point);
    if (value < 0) return "Negative";
    if (value > 0) return "Positive";
    return "Neutral";
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title="Type Of Work" />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden p-4 lg:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground">
                  Overview
                </div>
                <div className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  Total Items <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-foreground">{items.length}</span>
                </div>
                <div className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  Selected <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-foreground">{selectedIds.length}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-destructive text-destructive hover:bg-destructive/10"
                    onClick={handleBulkDelete}
                    disabled={deletingSelected}>
                    <Trash2 className="h-4 w-4" />
                    {deletingSelected ? "Deleting..." : `Delete Selected (${selectedIds.length})`}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" className="rounded-xl">
                  <Columns3 className="h-4 w-4" />
                  Columns
                </Button>
                <Button onClick={openCreateDrawer} className="rounded-xl">
                  <Plus className="h-4 w-4" />
                  Add Type Of Work
                </Button>
              </div>
            </div>

            <Sheet open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
              <SheetContent side="right" className="w-full sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>{drawerMode === "edit" ? "Edit type of work" : "Add type of work"}</SheetTitle>
                  <SheetDescription>
                    {drawerMode === "edit" ? "Update or delete this type of work." : "Create a new type of work."}
                  </SheetDescription>
                </SheetHeader>

                <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4">
                  <form className="space-y-4 rounded-lg border p-3" onSubmit={handleSave}>
                    <div className="space-y-2">
                      <Label htmlFor="type-of-work-name">Work type name</Label>
                      <Input
                        id="type-of-work-name"
                        value={form.workTypeName}
                        onChange={(event) => setForm((prev) => ({ ...prev, workTypeName: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type-of-work-point">Point</Label>
                      <Input
                        id="type-of-work-point"
                        type="number"
                        step="any"
                        value={form.point}
                        onChange={(event) => setForm((prev) => ({ ...prev, point: event.target.value }))}
                        required
                      />
                    </div>
                    {drawerError ? <p className="text-sm text-destructive">{drawerError}</p> : null}
                    <div className="flex flex-col gap-2">
                      <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : drawerMode === "edit" ? "Update type of work" : "Add type of work"}
                      </Button>
                      {drawerMode === "edit" && form.id ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(form.id)}
                          disabled={Number(form.taskCount || 0) > 0}>
                          <Trash2 className="h-4 w-4" />
                          Delete type of work
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </div>
              </SheetContent>
            </Sheet>

            {loading ? <p className="text-sm text-muted-foreground">Loading type of work...</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {!loading && !error ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="w-12 px-4">
                        <input
                          type="checkbox"
                          checked={isAllVisibleSelected}
                          onChange={(event) => toggleSelectAllVisible(event.target.checked)}
                          aria-label="Select all visible rows"
                        />
                      </TableHead>
                      <TableHead className="w-10 px-2"></TableHead>
                      <TableHead className="px-4">Work Type Name</TableHead>
                      <TableHead className="px-4">Point Status</TableHead>
                      <TableHead className="px-4">Point</TableHead>
                      <TableHead className="px-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          No type of work found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(item.id)}
                              onChange={() => toggleSelected(item.id)}
                              aria-label={`Select ${item.work_type_name}`}
                            />
                          </TableCell>
                          <TableCell className="px-2 py-4 text-muted-foreground">::</TableCell>
                          <TableCell className="px-4 py-4 text-base font-medium text-foreground">
                            {item.work_type_name}
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <Badge variant="outline" className={getPointTone(item.point)}>
                              {getPointLabel(item.point)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-4 text-base font-semibold text-foreground">
                            {item.point}
                          </TableCell>
                          <TableCell className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDrawer(item)}
                                aria-label="Edit type of work">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" aria-label="More actions">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                                onClick={() => handleDelete(item.id)}
                                disabled={Number(item.task_count || 0) > 0}
                                aria-label="Delete type of work">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    {selectedIds.length} of {items.length} row(s) selected.
                  </p>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Rows per page</span>
                      <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                        <SelectTrigger className="h-9 w-[92px] rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                        {[5, 10, 20, 50].map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </p>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setPage(1)} disabled={currentPage === 1}>
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl"
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl"
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl"
                        onClick={() => setPage(totalPages)}
                        disabled={currentPage === totalPages}>
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}
