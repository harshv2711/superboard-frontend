import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
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
import { Pencil, Plus, Trash2 } from "lucide-react";

function toEmployeeForm(item = null) {
  return {
    id: item?.id || null,
    user: item?.id ? String(item.id) : "",
    designation: item?.designation || "",
    salary: item?.salary != null ? String(item.salary) : "",
  };
}

function hasEmployeeProfile(user) {
  const designation = String(user?.designation || "").trim();
  const salary = user?.salary;
  return Boolean(user?.has_employee_profile || designation || (salary !== null && salary !== undefined && salary !== ""));
}

export default function EmployeesPage() {
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("create");
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [form, setForm] = useState(toEmployeeForm());

  async function loadItems() {
    try {
      setLoading(true);
      setError("");
      const userRows = await superboardApi.users.listAll({ page_size: 500 });
      const normalizedUsers = Array.isArray(userRows) ? userRows : [];
      setUsers(normalizedUsers);
      setItems(normalizedUsers.filter((user) => hasEmployeeProfile(user)));
    } catch (requestError) {
      const message = requestError.message || "Failed to load employees.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  const availableUsers = useMemo(() => {
    return users
      .filter((user) => {
        if (String(form.id || "") && String(user.id) === String(form.user)) return true;
        return !hasEmployeeProfile(user);
      })
      .sort((a, b) => String(a.email || "").localeCompare(String(b.email || "")));
  }, [form.id, form.user, items, users]);

  function handleDrawerOpenChange(open) {
    setDrawerOpen(open);
    if (!open) {
      setDrawerMode("create");
      setDrawerError("");
      setSaving(false);
      setForm(toEmployeeForm());
    }
  }

  function openCreateDrawer() {
    setDrawerMode("create");
    setDrawerError("");
    setForm(toEmployeeForm());
    setDrawerOpen(true);
  }

  function openEditDrawer(item) {
    setDrawerMode("edit");
    setDrawerError("");
    setForm(toEmployeeForm(item));
    setDrawerOpen(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setDrawerError("");
    try {
      const payload = {
        designation: form.designation.trim(),
        salary: Number(form.salary),
      };

      if (form.id) {
        await superboardApi.users.patch(form.id, payload);
        toast.success("Employee updated successfully.");
      } else {
        await superboardApi.users.patch(Number(form.user), payload);
        toast.success("Employee created successfully.");
      }

      await loadItems();
      handleDrawerOpenChange(false);
    } catch (requestError) {
      const message = requestError.message || "Failed to save employee.";
      setDrawerError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId) {
    if (!itemId || !window.confirm("Delete this employee profile?")) return;
    try {
      await superboardApi.users.patch(itemId, { remove_employee_profile: true });
      toast.success("Employee deleted successfully.");
      await loadItems();
      if (String(form.id || "") === String(itemId)) {
        handleDrawerOpenChange(false);
      }
    } catch (requestError) {
      const message = requestError.message || "Failed to delete employee.";
      setDrawerError(message);
      toast.error(message);
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title="Employees" />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden p-4 lg:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground">
                  Superuser Access
                </div>
                <div className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  Total Employees <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-foreground">{items.length}</span>
                </div>
              </div>

              <Button onClick={openCreateDrawer} className="rounded-xl">
                <Plus className="h-4 w-4" />
                Add Employee
              </Button>
            </div>

            <Sheet open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
              <SheetContent side="right" className="w-full sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>{drawerMode === "edit" ? "Edit employee" : "Add employee"}</SheetTitle>
                  <SheetDescription>
                    {drawerMode === "edit" ? "Update or delete this employee profile." : "Create a new employee profile."}
                  </SheetDescription>
                </SheetHeader>

                <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4">
                  <form className="space-y-4 rounded-lg border p-3" onSubmit={handleSave}>
                    <div className="space-y-2">
                      <Label>User</Label>
                      <Select value={form.user} onValueChange={(value) => setForm((prev) => ({ ...prev, user: value }))}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUsers.map((user) => (
                            <SelectItem key={user.id} value={String(user.id)}>
                              {user.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employee-designation">Designation</Label>
                      <Input id="employee-designation" value={form.designation} onChange={(event) => setForm((prev) => ({ ...prev, designation: event.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employee-salary">Salary</Label>
                      <Input id="employee-salary" type="number" step="0.01" value={form.salary} onChange={(event) => setForm((prev) => ({ ...prev, salary: event.target.value }))} required />
                    </div>
                    {drawerError ? <p className="text-sm text-destructive">{drawerError}</p> : null}
                    <div className="flex flex-col gap-2">
                      <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : drawerMode === "edit" ? "Update employee" : "Add employee"}
                      </Button>
                      {drawerMode === "edit" && form.id ? (
                        <Button type="button" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => handleDelete(form.id)}>
                          <Trash2 className="h-4 w-4" />
                          Delete employee
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </div>
              </SheetContent>
            </Sheet>

            {loading ? <p className="text-sm text-muted-foreground">Loading employees...</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {!loading && !error ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="px-4">User</TableHead>
                      <TableHead className="px-4">Name</TableHead>
                      <TableHead className="px-4">Designation</TableHead>
                      <TableHead className="px-4">Salary</TableHead>
                      <TableHead className="px-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          No employee profiles found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="px-4 py-4 font-medium">{item.email}</TableCell>
                          <TableCell className="px-4 py-4">{`${item.first_name || ""} ${item.last_name || ""}`.trim() || "-"}</TableCell>
                          <TableCell className="px-4 py-4">{item.designation}</TableCell>
                          <TableCell className="px-4 py-4">{item.salary}</TableCell>
                          <TableCell className="px-4 py-4 text-right">
                            <Button variant="ghost" size="icon" onClick={() => openEditDrawer(item)} aria-label="Edit employee">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}
