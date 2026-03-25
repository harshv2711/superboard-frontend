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

const ROLE_OPTIONS = [
  { value: "superuser", label: "Superuser" },
  { value: "admin", label: "Admin" },
  { value: "account_planner", label: "Account Planner" },
  { value: "art_director", label: "Art Director" },
  { value: "designer", label: "Designer" },
  { value: "human_resource", label: "Human Resource" },
];

function toUserForm(item = null) {
  return {
    id: item?.id || null,
    email: item?.email || "",
    firstName: item?.first_name || "",
    lastName: item?.last_name || "",
    role: item?.role || "designer",
    password: "",
  };
}

function getRoleLabel(role) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label || role || "Unknown";
}

export default function ManageUsersPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("create");
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [form, setForm] = useState(toUserForm());

  async function loadItems() {
    try {
      setLoading(true);
      setError("");
      const rows = await superboardApi.users.listAll({ page_size: 500 });
      setItems(Array.isArray(rows) ? rows : []);
    } catch (requestError) {
      const message = requestError.message || "Failed to load users.";
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
    () => [...items].sort((a, b) => String(a.email || "").localeCompare(String(b.email || ""))),
    [items],
  );

  function handleDrawerOpenChange(open) {
    setDrawerOpen(open);
    if (!open) {
      setDrawerMode("create");
      setDrawerError("");
      setSaving(false);
      setForm(toUserForm());
    }
  }

  function openCreateDrawer() {
    setDrawerMode("create");
    setDrawerError("");
    setForm(toUserForm());
    setDrawerOpen(true);
  }

  function openEditDrawer(item) {
    setDrawerMode("edit");
    setDrawerError("");
    setForm(toUserForm(item));
    setDrawerOpen(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setDrawerError("");
    try {
      const payload = {
        email: form.email.trim().toLowerCase(),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        role: form.role,
      };

      if (form.password.trim()) {
        payload.password = form.password;
      }

      if (form.id) {
        await superboardApi.users.patch(form.id, payload);
        toast.success("User updated successfully.");
      } else {
        await superboardApi.users.create(payload);
        toast.success("User created successfully.");
      }

      await loadItems();
      handleDrawerOpenChange(false);
    } catch (requestError) {
      const message = requestError.message || "Failed to save user.";
      setDrawerError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId) {
    if (!itemId || !window.confirm("Delete this user?")) return;
    try {
      await superboardApi.users.remove(itemId);
      toast.success("User deleted successfully.");
      await loadItems();
      if (String(form.id || "") === String(itemId)) {
        handleDrawerOpenChange(false);
      }
    } catch (requestError) {
      const message = requestError.message || "Failed to delete user.";
      setDrawerError(message);
      toast.error(message);
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title="Manage Users" />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden p-4 lg:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground">
                  Superuser Access
                </div>
                <div className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  Total Users <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-foreground">{items.length}</span>
                </div>
              </div>

              <Button onClick={openCreateDrawer} className="rounded-xl">
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </div>

            <Sheet open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
              <SheetContent side="right" className="w-full sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>{drawerMode === "edit" ? "Edit user" : "Add user"}</SheetTitle>
                  <SheetDescription>
                    {drawerMode === "edit" ? "Update or delete this user account." : "Create a new user account."}
                  </SheetDescription>
                </SheetHeader>

                <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4">
                  <form className="space-y-4 rounded-lg border p-3" onSubmit={handleSave}>
                    <div className="space-y-2">
                      <Label htmlFor="user-email">Email</Label>
                      <Input id="user-email" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-first-name">First Name</Label>
                      <Input id="user-first-name" value={form.firstName} onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-last-name">Last Name</Label>
                      <Input id="user-last-name" value={form.lastName} onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>User Role</Label>
                      <Select value={form.role} onValueChange={(value) => setForm((prev) => ({ ...prev, role: value }))}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-password">{form.id ? "New Password" : "Password"}</Label>
                      <Input
                        id="user-password"
                        type="password"
                        value={form.password}
                        onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                        required={!form.id}
                      />
                    </div>
                    {drawerError ? <p className="text-sm text-destructive">{drawerError}</p> : null}
                    <div className="flex flex-col gap-2">
                      <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : drawerMode === "edit" ? "Update user" : "Add user"}
                      </Button>
                      {drawerMode === "edit" && form.id ? (
                        <Button type="button" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => handleDelete(form.id)}>
                          <Trash2 className="h-4 w-4" />
                          Delete user
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </div>
              </SheetContent>
            </Sheet>

            {loading ? <p className="text-sm text-muted-foreground">Loading users...</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {!loading && !error ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="px-4">Email</TableHead>
                      <TableHead className="px-4">Name</TableHead>
                      <TableHead className="px-4">Role</TableHead>
                      <TableHead className="px-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          No users found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedItems.map((item) => {
                        const fullName = `${item.first_name || ""} ${item.last_name || ""}`.trim();
                        return (
                    <TableRow key={item.id}>
                      <TableCell className="px-4 py-4 font-medium">{item.email}</TableCell>
                      <TableCell className="px-4 py-4">{fullName || "-"}</TableCell>
                      <TableCell className="px-4 py-4">{getRoleLabel(item.role)}</TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditDrawer(item)} aria-label="Edit user">
                          <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
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
