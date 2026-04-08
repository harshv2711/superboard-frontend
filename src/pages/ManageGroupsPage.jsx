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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Pencil, Plus, Trash2, Users2 } from "lucide-react";

function toGroupForm(item = null) {
  return {
    id: item?.id || null,
    name: item?.name || "",
  };
}

function toMemberForm(item = null) {
  return {
    id: item?.id || null,
    groupId: item?.group != null ? String(item.group) : "",
    userId: item?.user != null ? String(item.user) : "",
  };
}

function getUserLabel(user) {
  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
  return fullName ? `${fullName} (${user?.email || ""})` : user?.email || `User #${user?.id || ""}`;
}

export default function ManageGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupDrawerOpen, setGroupDrawerOpen] = useState(false);
  const [groupDrawerMode, setGroupDrawerMode] = useState("create");
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [memberDrawerMode, setMemberDrawerMode] = useState("create");
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [groupForm, setGroupForm] = useState(toGroupForm());
  const [memberForm, setMemberForm] = useState(toMemberForm());

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const [groupRows, memberRows, userRows] = await Promise.all([
        superboardApi.groups.listAll({ page_size: 500 }),
        superboardApi.groupMembers.listAll({ page_size: 1000 }),
        superboardApi.users.listAll({ page_size: 500 }),
      ]);
      setGroups(Array.isArray(groupRows) ? groupRows : []);
      setMembers(Array.isArray(memberRows) ? memberRows : []);
      setUsers(Array.isArray(userRows) ? userRows : []);
    } catch (requestError) {
      const message = requestError.message || "Failed to load groups.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const groupsById = useMemo(
    () => Object.fromEntries(groups.map((group) => [String(group.id), group])),
    [groups],
  );
  const usersById = useMemo(
    () => Object.fromEntries(users.map((user) => [String(user.id), user])),
    [users],
  );
  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [groups],
  );
  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const groupCompare = String(a.group_name || groupsById[String(a.group)]?.name || "").localeCompare(
          String(b.group_name || groupsById[String(b.group)]?.name || ""),
        );
        if (groupCompare !== 0) return groupCompare;
        return String(a.user_email || usersById[String(a.user)]?.email || "").localeCompare(
          String(b.user_email || usersById[String(b.user)]?.email || ""),
        );
      }),
    [groupsById, members, usersById],
  );

  function handleGroupDrawerOpenChange(open) {
    setGroupDrawerOpen(open);
    if (!open) {
      setGroupDrawerMode("create");
      setDrawerError("");
      setSaving(false);
      setGroupForm(toGroupForm());
    }
  }

  function handleMemberDrawerOpenChange(open) {
    setMemberDrawerOpen(open);
    if (!open) {
      setMemberDrawerMode("create");
      setDrawerError("");
      setSaving(false);
      setMemberForm(toMemberForm());
    }
  }

  function openCreateGroupDrawer() {
    setGroupDrawerMode("create");
    setDrawerError("");
    setGroupForm(toGroupForm());
    setGroupDrawerOpen(true);
  }

  function openEditGroupDrawer(item) {
    setGroupDrawerMode("edit");
    setDrawerError("");
    setGroupForm(toGroupForm(item));
    setGroupDrawerOpen(true);
  }

  function openCreateMemberDrawer() {
    setMemberDrawerMode("create");
    setDrawerError("");
    setMemberForm(
      toMemberForm({
        group: sortedGroups[0]?.id || "",
      }),
    );
    setMemberDrawerOpen(true);
  }

  function openEditMemberDrawer(item) {
    setMemberDrawerMode("edit");
    setDrawerError("");
    setMemberForm(toMemberForm(item));
    setMemberDrawerOpen(true);
  }

  async function handleSaveGroup(event) {
    event.preventDefault();
    setSaving(true);
    setDrawerError("");
    try {
      const payload = {
        name: groupForm.name.trim(),
      };

      if (groupForm.id) {
        await superboardApi.groups.patch(groupForm.id, payload);
        toast.success("Group updated successfully.");
      } else {
        await superboardApi.groups.create(payload);
        toast.success("Group created successfully.");
      }

      await loadData();
      handleGroupDrawerOpenChange(false);
    } catch (requestError) {
      const message = requestError.message || "Failed to save group.";
      setDrawerError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMember(event) {
    event.preventDefault();
    setSaving(true);
    setDrawerError("");
    try {
      const payload = {
        group: Number(memberForm.groupId),
        user: Number(memberForm.userId),
      };

      if (memberForm.id) {
        await superboardApi.groupMembers.patch(memberForm.id, payload);
        toast.success("Group member updated successfully.");
      } else {
        await superboardApi.groupMembers.create(payload);
        toast.success("Group member added successfully.");
      }

      await loadData();
      handleMemberDrawerOpenChange(false);
    } catch (requestError) {
      const message = requestError.message || "Failed to save group member.";
      setDrawerError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup(groupId) {
    if (!groupId || !window.confirm("Delete this group?")) return;
    try {
      await superboardApi.groups.remove(groupId);
      toast.success("Group deleted successfully.");
      await loadData();
      if (String(groupForm.id || "") === String(groupId)) handleGroupDrawerOpenChange(false);
    } catch (requestError) {
      const message = requestError.message || "Failed to delete group.";
      setDrawerError(message);
      toast.error(message);
    }
  }

  async function handleDeleteMember(memberId) {
    if (!memberId || !window.confirm("Delete this group member?")) return;
    try {
      await superboardApi.groupMembers.remove(memberId);
      toast.success("Group member deleted successfully.");
      await loadData();
      if (String(memberForm.id || "") === String(memberId)) handleMemberDrawerOpenChange(false);
    } catch (requestError) {
      const message = requestError.message || "Failed to delete group member.";
      setDrawerError(message);
      toast.error(message);
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title="Manage Groups" />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden p-4 lg:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <div className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground">
                Group Management
              </div>
              <div className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                Total Groups <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-foreground">{groups.length}</span>
              </div>
              <div className="rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                Total Members <span className="ml-1 rounded-full bg-background px-2 py-0.5 text-foreground">{members.length}</span>
              </div>
            </div>

            <Tabs defaultValue="groups" className="space-y-4">
              <TabsList className="w-full justify-start rounded-xl">
                <TabsTrigger value="groups">Groups</TabsTrigger>
                <TabsTrigger value="members">Group Members</TabsTrigger>
              </TabsList>

              <TabsContent value="groups" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                  <p className="text-sm text-muted-foreground">Create and manage your groups.</p>
                  <Button onClick={openCreateGroupDrawer} className="rounded-xl">
                    <Plus className="h-4 w-4" />
                    Add Group
                  </Button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="px-4">Group Name</TableHead>
                        <TableHead className="px-4">Members</TableHead>
                        <TableHead className="px-4 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedGroups.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                            No groups found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedGroups.map((group) => (
                          <TableRow key={group.id}>
                            <TableCell className="px-4 py-4 font-medium">{group.name}</TableCell>
                            <TableCell className="px-4 py-4">
                              {members.filter((member) => String(member.group) === String(group.id)).length}
                            </TableCell>
                            <TableCell className="px-4 py-4 text-right">
                              <Button variant="ghost" size="icon" onClick={() => openEditGroupDrawer(group)} aria-label="Edit group">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="members" className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                  <p className="text-sm text-muted-foreground">Assign users to groups and manage memberships.</p>
                  <Button onClick={openCreateMemberDrawer} className="rounded-xl">
                    <Users2 className="h-4 w-4" />
                    Add Group Member
                  </Button>
                </div>
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="px-4">Group</TableHead>
                        <TableHead className="px-4">User</TableHead>
                        <TableHead className="px-4 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedMembers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                            No group members found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        sortedMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell className="px-4 py-4 font-medium">
                              {member.group_name || groupsById[String(member.group)]?.name || "-"}
                            </TableCell>
                            <TableCell className="px-4 py-4">
                              {member.user_email || usersById[String(member.user)]?.email || "-"}
                            </TableCell>
                            <TableCell className="px-4 py-4 text-right">
                              <Button variant="ghost" size="icon" onClick={() => openEditMemberDrawer(member)} aria-label="Edit group member">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>

            <Sheet open={groupDrawerOpen} onOpenChange={handleGroupDrawerOpenChange}>
              <SheetContent side="right" className="w-full sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>{groupDrawerMode === "edit" ? "Edit group" : "Add group"}</SheetTitle>
                  <SheetDescription>
                    {groupDrawerMode === "edit" ? "Update or delete this group." : "Create a new group."}
                  </SheetDescription>
                </SheetHeader>
                <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4">
                  <form className="space-y-4 rounded-lg border p-3" onSubmit={handleSaveGroup}>
                    <div className="space-y-2">
                      <Label htmlFor="group-name">Group Name</Label>
                      <Input
                        id="group-name"
                        value={groupForm.name}
                        onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))}
                        required
                      />
                    </div>
                    {drawerError ? <p className="text-sm text-destructive">{drawerError}</p> : null}
                    <div className="flex flex-col gap-2">
                      <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : groupDrawerMode === "edit" ? "Update group" : "Add group"}
                      </Button>
                      {groupDrawerMode === "edit" && groupForm.id ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteGroup(groupForm.id)}>
                          <Trash2 className="h-4 w-4" />
                          Delete group
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </div>
              </SheetContent>
            </Sheet>

            <Sheet open={memberDrawerOpen} onOpenChange={handleMemberDrawerOpenChange}>
              <SheetContent side="right" className="w-full sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>{memberDrawerMode === "edit" ? "Edit group member" : "Add group member"}</SheetTitle>
                  <SheetDescription>
                    {memberDrawerMode === "edit" ? "Update or delete this group membership." : "Assign a user to a group."}
                  </SheetDescription>
                </SheetHeader>
                <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4">
                  <form className="space-y-4 rounded-lg border p-3" onSubmit={handleSaveMember}>
                    <div className="space-y-2">
                      <Label>Group</Label>
                      <Select value={memberForm.groupId} onValueChange={(value) => setMemberForm((prev) => ({ ...prev, groupId: value }))}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select group" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedGroups.map((group) => (
                            <SelectItem key={group.id} value={String(group.id)}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>User</Label>
                      <Select value={memberForm.userId} onValueChange={(value) => setMemberForm((prev) => ({ ...prev, userId: value }))}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users
                            .slice()
                            .sort((a, b) => getUserLabel(a).localeCompare(getUserLabel(b)))
                            .map((user) => (
                              <SelectItem key={user.id} value={String(user.id)}>
                                {getUserLabel(user)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {drawerError ? <p className="text-sm text-destructive">{drawerError}</p> : null}
                    <div className="flex flex-col gap-2">
                      <Button type="submit" disabled={saving || !memberForm.groupId || !memberForm.userId}>
                        {saving ? "Saving..." : memberDrawerMode === "edit" ? "Update group member" : "Add group member"}
                      </Button>
                      {memberDrawerMode === "edit" && memberForm.id ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="border-destructive text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteMember(memberForm.id)}>
                          <Trash2 className="h-4 w-4" />
                          Delete group member
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </div>
              </SheetContent>
            </Sheet>

            {loading ? <p className="text-sm text-muted-foreground">Loading groups...</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </TooltipProvider>
  );
}
