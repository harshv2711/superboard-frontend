import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { toast } from "sonner";
import "swiper/css";

const TASK_PRIORITY_LABELS = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const TASK_PRIORITY_BADGE_STYLES = {
  high: "border-rose-200 bg-rose-50 text-rose-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-emerald-200 bg-emerald-50 text-emerald-700",
};
const EXCELLENCE_OPTIONS = Array.from({ length: 20 }, (_, index) => ((index + 1) * 0.5).toFixed(1));

function getClientName(client) {
  return client.name || client.client_name || client.title || `Client #${client.id}`;
}

function getClientInterface(client) {
  return client.client_interface || client.clientInterface || client.interface_name || client.contact_person || "-";
}

function getClientInterfaceContactNumber(client) {
  return (
    client.client_interface_contact_number ||
    client.clientInterfaceContactNumber ||
    client.contact_number ||
    client.phone ||
    client.mobile ||
    "-"
  );
}

function getOwnerUserIds(client) {
  if (!Array.isArray(client?.owner_user_ids)) return [];
  return client.owner_user_ids.map((value) => String(value));
}

function getTaskName(task) {
  return task.task_name || task.name || task.title || `Task #${task.id}`;
}

function getTaskStatus(task) {
  if (task?.redo_of) return "Redo";
  if (task?.revision_of) return "Revision";
  return "Original";
}

function getTaskTypeLabel(task) {
  if (task?.redo_of) return "Redo";
  if (task?.revision_of) return "Revision";
  return "Original";
}

function getTaskPriority(task) {
  const rawPriority = task.priority || "";
  return TASK_PRIORITY_LABELS[rawPriority] || rawPriority || "-";
}

function getTaskPriorityBadgeClass(task) {
  const rawPriority = task?.priority || "";
  return TASK_PRIORITY_BADGE_STYLES[rawPriority] || "border-border bg-background text-foreground";
}

function getTaskServiceCategory(task) {
  return task.service_category_name || task.serviceCategoryName || task.category_name || "-";
}

function getOriginalTaskId(task) {
  if (!task) return "";
  return task.id ? String(task.id) : "";
}

function getRedoTaskId(task) {
  if (!task) return "";
  return task.redo_of ? String(task.redo_of) : task.id ? String(task.id) : "";
}

function getTaskDescription(task) {
  return task.instructions || task.description || task.notes || "-";
}

function getTaskDateValue(task) {
  const candidates = [task.target_date, task.created_at];
  return candidates.find((value) => getIsoDateKey(value)) || "";
}

function formatDate(isoDate) {
  if (!isoDate) return "-";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateTime(isoDate) {
  if (!isoDate) return "-";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatTimestamp(isoDate) {
  if (!isoDate) return "-";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getTaskCardToneClass(task) {
  if (Boolean(task?.is_marked_completed_by_superadmin) || isTaskCompleted(task)) {
    return "border-emerald-300 bg-emerald-50/60";
  }
  if (Boolean(task?.is_marked_completed_by_art_director)) {
    return "border-amber-300 bg-amber-50/60";
  }
  if (Boolean(task?.is_marked_completed_by_designer)) {
    return "border-sky-300 bg-sky-50/60";
  }
  return "border-slate-300 bg-white";
}

function canDesignerModifyCompletion(task) {
  const artDirectorCompleted = task?.is_marked_completed_by_art_director ?? task?.isMarkedCompletedByArtDirector;
  const accountPlannerCompleted = task?.is_marked_completed_by_account_planner ?? task?.isMarkedCompletedByAccountPlanner;
  const superadminCompleted = task?.is_marked_completed_by_superadmin ?? task?.isMarkedCompletedBySuperadmin;
  return !artDirectorCompleted && !accountPlannerCompleted && !superadminCompleted;
}

function getIsoDateKey(value) {
  if (!value) return "";
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getDateParts(value) {
  const dateKey = getIsoDateKey(value);
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month: month - 1, day };
}

function isTaskCompleted(task) {
  return Boolean(
    task?.is_marked_completed_by_account_planner &&
      task?.is_marked_completed_by_art_director &&
      task?.is_marked_completed_by_designer,
  );
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function TaskHistoryDrawer({ open, onOpenChange, task, items }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full !w-full flex-col overflow-hidden p-0 sm:!w-[40vw] sm:!max-w-[900px]">
        <SheetHeader className="border-b border-border px-6 py-6">
          <SheetTitle>Task history</SheetTitle>
          <SheetDescription>
            {task ? `Timeline for ${getTaskName(task)}` : "View revision and redo history for this task."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {items.length > 0 ? (
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id} className="relative pl-8">
                  {index < items.length - 1 ? <div className="absolute left-[11px] top-8 h-[calc(100%+0.5rem)] w-px bg-border" /> : null}
                  <div
                    className={`absolute left-0 top-1.5 h-6 w-6 rounded-full border-4 ${
                      item.isSelected ? "border-primary bg-primary/15" : "border-slate-300 bg-background"
                    }`}
                  />
                  <div
                    className={`rounded-3xl border px-5 py-4 shadow-sm ${
                      item.isSelected ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                    }`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.isSelected ? "default" : "secondary"} className="rounded-full px-3 py-1">
                        {item.kind}
                      </Badge>
                      <Badge variant="outline" className="rounded-full px-3 py-1">
                        {item.client_name || "-"}
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <p className="text-lg font-semibold text-foreground">{getTaskName(item)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.instructions || "No instructions added."}</p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Service Category</p>
                        <p className="mt-2 font-medium text-foreground">{getTaskServiceCategory(item)}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Type Of Work</p>
                        <p className="mt-2 font-medium text-foreground">{item.type_of_work_name || "-"}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Created</p>
                        <p className="mt-2 font-medium text-foreground">{formatDateTime(item.created_at || item.updated_at)}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Linked From</p>
                        <p className="mt-2 font-medium text-foreground">{item.parentTaskName || "Standalone original task"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="rounded-[28px] border border-dashed border-border/80 bg-card/70 shadow-sm">
              <CardContent className="flex min-h-56 items-center justify-center p-8 text-center text-sm text-muted-foreground">
                No history found for this task.
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TaskCard({
  task,
  isAccountPlanner,
  isArtDirector,
  isDesigner,
  canEdit,
  hasHistory,
  updatingDesignerCompletion,
  onEdit,
  onToggleDesignerCompletion,
  onAddRevision,
  onAddRedo,
  onOpenHistory,
}) {
  const completed = isTaskCompleted(task);

  return (
    <article
      className={`rounded-[24px] border p-5 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_10px_28px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(15,23,42,0.10)] ${getTaskCardToneClass(task)}`}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="rounded-full px-3 py-1">
              {task.client_name || "-"}
            </Badge>
            <Badge variant="outline" className={`rounded-full px-3 py-1 ${getTaskPriorityBadgeClass(task)}`}>
              {getTaskPriority(task)}
            </Badge>
            <Badge variant="secondary" className="rounded-full px-3 py-1">
              {getTaskTypeLabel(task)}
            </Badge>
            {completed ? (
              <Badge className="rounded-full bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-600">Completed</Badge>
            ) : null}
          </div>
          {canEdit && !isDesigner ? (
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => onEdit(task)}>
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold tracking-tight text-foreground">{getTaskName(task)}</h3>
        </div>
        <div className="grid gap-3 text-sm">
          <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Instructions</p>
            <p className="mt-2 font-medium text-foreground">{task.instructions || "No instructions added."}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Instructions By Art Director</p>
            <p className="mt-2 font-medium text-foreground">{task.InstructionsByArtDirector || "-"}</p>
          </div>
          {(isArtDirector || !isAccountPlanner) ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Designer</p>
              <p className="mt-2 font-medium text-foreground">{task.designer_name || "Unassigned"}</p>
            </div>
          ) : null}
          {isDesigner ? (
            <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <Checkbox
                checked={Boolean(task.is_marked_completed_by_designer)}
                disabled={updatingDesignerCompletion || !canDesignerModifyCompletion(task)}
                onCheckedChange={(checked) => onToggleDesignerCompletion(task, Boolean(checked))}
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Designer Completion
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">Is marked completed by designer</p>
              </div>
            </label>
          ) : null}
          <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Service Category</p>
            <p className="mt-2 font-medium text-foreground">{getTaskServiceCategory(task)}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Type Of Work</p>
            <p className="mt-2 font-medium text-foreground">{task.type_of_work_name || "-"}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Target Date</p>
            <p className="mt-2 font-medium text-foreground">{formatDate(task.target_date)}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Created At</p>
            <p className="mt-2 font-medium text-foreground">{formatTimestamp(task.created_at)}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Updated At</p>
            <p className="mt-2 font-medium text-foreground">{formatTimestamp(task.updated_at)}</p>
          </div>
        </div>
        {canEdit || hasHistory ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {canEdit ? (
              <Button type="button" variant="outline" className="rounded-full" onClick={() => onAddRevision(task)}>
                Add revision
              </Button>
            ) : null}
            {canEdit ? (
              <Button type="button" variant="outline" className="rounded-full" onClick={() => onAddRedo(task)}>
                Add redo
              </Button>
            ) : null}
            {hasHistory ? (
              <Button type="button" variant="outline" className="rounded-full" onClick={() => onOpenHistory(task)}>
                View history
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

const EMPTY_TASK_FORM = {
  id: null,
  clientId: "",
  revisionOfId: "",
  redoOfId: "",
  createdBy: "",
  createdByName: "",
  taskName: "",
  instructions: "",
  instructionsByArtDirector: "",
  priority: "medium",
  designerId: "",
  typeOfWorkId: "",
  targetDate: "",
  excellence: "",
  isMarkedCompletedByAccountPlanner: false,
  isMarkedCompletedByArtDirector: false,
  isMarkedCompletedByDesigner: false,
};

const EMPTY_INLINE_TYPE_OF_WORK_FORM = {
  workTypeName: "",
  point: "",
};

export default function ClientsWorkPage({ headerTitle = "Task Manager" }) {
  const swiperRef = useRef(null);
  const now = new Date();
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [typeOfWorkOptions, setTypeOfWorkOptions] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedDesignerId, setSelectedDesignerId] = useState("");
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [clientsError, setClientsError] = useState("");
  const [tasksError, setTasksError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [savingTask, setSavingTask] = useState(false);
  const [savingInlineTypeOfWork, setSavingInlineTypeOfWork] = useState(false);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [inlineTypeOfWorkOpen, setInlineTypeOfWorkOpen] = useState(false);
  const [inlineTypeOfWorkForm, setInlineTypeOfWorkForm] = useState(EMPTY_INLINE_TYPE_OF_WORK_FORM);
  const [updatingDesignerCompletionTaskId, setUpdatingDesignerCompletionTaskId] = useState(null);
  const [originalTaskOptions, setOriginalTaskOptions] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTaskId, setHistoryTaskId] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const currentUserId = String(currentUser?.id || currentUser?.user_id || "");
  const currentUserRole = currentUser?.role || "";
  const isSuperuser = currentUserRole === "superuser";
  const isAccountPlanner = currentUserRole === "account_planner";
  const isArtDirector = currentUserRole === "art_director";
  const isDesigner = currentUserRole === "designer";
  const isDesignerEditMode = drawerMode === "edit" && currentUserRole === "designer";
  const isArtDirectorReadOnlyTask = false;
  const isReadOnlyTaskForm = isDesignerEditMode || isArtDirectorReadOnlyTask;
  const canManageTypeOfWork = isSuperuser || currentUserRole === "art_director";
  const canViewPoints = !isAccountPlanner && !isArtDirector && !isDesigner;
  const accountPlannerCompletionBlocked =
    isAccountPlanner &&
    (!taskForm.isMarkedCompletedByArtDirector || !taskForm.isMarkedCompletedByDesigner);
  const artDirectorCompletionBlocked = isArtDirector && !taskForm.isMarkedCompletedByDesigner;
  useEffect(() => {
    let cancelled = false;
    async function loadClients() {
      try {
        setLoadingClients(true);
        setClientsError("");
        const me = await superboardApi.auth.me();
        const rows = await superboardApi.clients.listAll({ page_size: 300 });
        const allUsers = await superboardApi.users.listAll({ page_size: 300 });
        const allTypeOfWork = await superboardApi.typeOfWork.listAll({ page_size: 300 });
        const sorted = [...rows].sort((a, b) => getClientName(a).localeCompare(getClientName(b)));
        if (cancelled) return;
        setCurrentUser(me);
        setClients(sorted);
        setUsers(allUsers);
        setTypeOfWorkOptions(allTypeOfWork);
        setSelectedClientId((prev) => {
          if (sorted.some((client) => String(client.id) === String(prev))) return prev;
          return String(sorted[0]?.id || "");
        });
        setSelectedDesignerId((prev) => {
          if (me?.role === "designer") return String(me.id || me.user_id || "");
          return prev;
        });
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError.message || "Failed to load clients.";
        setCurrentUser(null);
        setClientsError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    }
    loadClients();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadTasks() {
      if (!selectedClientId && currentUserRole !== "designer") {
        setTasks([]);
        return;
      }

      try {
        setLoadingTasks(true);
        setTasksError("");
        const query = currentUserRole === "designer" ? { page_size: 300 } : { client: selectedClientId, page_size: 300 };
        const rows = await superboardApi.tasks.listAll(query);

        if (cancelled) return;
        setTasks(rows);
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError.message || "Failed to load tasks.";
        setTasksError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setLoadingTasks(false);
      }
    }
    loadTasks();
    return () => {
      cancelled = true;
    };
  }, [currentUserRole, selectedClientId, reloadTick]);

  const selectedClient = useMemo(() => {
    if (currentUserRole === "designer") return null;
    return clients.find((client) => String(client.id) === String(selectedClientId)) || null;
  }, [clients, currentUserRole, selectedClientId]);
  const isSelectedClientOwner = useMemo(() => {
    if (!selectedClient || !currentUserId) return false;
    return getOwnerUserIds(selectedClient).includes(currentUserId);
  }, [currentUserId, selectedClient]);
  const canCreateTask = useMemo(() => {
    if (!selectedClient) return false;
    return isSuperuser || currentUserRole === "art_director" || (currentUserRole === "account_planner" && isSelectedClientOwner);
  }, [currentUserRole, isSelectedClientOwner, isSuperuser, selectedClient]);
  const canFullyManageTask = useMemo(() => {
    return canCreateTask;
  }, [canCreateTask]);
  const canArtDirectorEditTask = useCallback(
    () => currentUserRole === "art_director",
    [currentUserRole],
  );
  const canDesignerEditTask = useCallback(
    (task) => currentUserRole === "designer" && String(task?.designer || "") === currentUserId,
    [currentUserId, currentUserRole],
  );
  const canManageTask = useCallback(
    (task) => {
      if (currentUserRole === "designer") return canDesignerEditTask(task);
      if (currentUserRole === "art_director") return canArtDirectorEditTask(task);
      return canFullyManageTask;
    },
    [canArtDirectorEditTask, canDesignerEditTask, canFullyManageTask, currentUserRole],
  );
  const canOpenTaskEditor = useCallback(
    (task) => {
      if (currentUserRole === "designer") return canDesignerEditTask(task);
      return canCreateTask || canManageTask(task);
    },
    [canCreateTask, canDesignerEditTask, canManageTask, currentUserRole],
  );
  const taskNameById = useMemo(() => {
    return Object.fromEntries(tasks.filter((task) => task?.id).map((task) => [String(task.id), getTaskName(task)]));
  }, [tasks]);
  const taskById = useMemo(() => {
    return new Map(tasks.filter((task) => task?.id).map((task) => [String(task.id), task]));
  }, [tasks]);
  const designerOptions = useMemo(() => users, [users]);
  const filteredTasks = useMemo(() => {
    if (!selectedDesignerId) return tasks;
    return tasks.filter((task) => String(task.designer || "") === String(selectedDesignerId));
  }, [selectedDesignerId, tasks]);

  const historyTask = useMemo(() => {
    if (!historyTaskId) return null;
    return taskById.get(String(historyTaskId)) || null;
  }, [historyTaskId, taskById]);

  const historyItems = useMemo(() => {
    if (!historyTask) return [];

    const queue = [String(historyTask.id)];
    const visited = new Set();
    const related = [];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visited.has(currentId)) continue;
      visited.add(currentId);

      const currentTask = taskById.get(currentId);
      if (!currentTask) continue;

      related.push(currentTask);

      if (currentTask.revision_of) queue.push(String(currentTask.revision_of));
      if (currentTask.redo_of) queue.push(String(currentTask.redo_of));

      tasks.forEach((task) => {
        if (String(task.revision_of || "") === currentId || String(task.redo_of || "") === currentId) {
          queue.push(String(task.id));
        }
      });
    }

    return related
      .map((item) => {
        const parentId = item.revision_of || item.redo_of || null;
        const parentTask = parentId ? taskById.get(String(parentId)) : null;
        return {
          ...item,
          isSelected: String(item.id) === String(historyTask.id),
          kind: getTaskTypeLabel(item),
          parentTaskName: parentTask ? getTaskName(parentTask) : "",
        };
      })
      .sort((left, right) => {
        const leftTime = new Date(left.created_at || left.updated_at || 0).getTime();
        const rightTime = new Date(right.created_at || right.updated_at || 0).getTime();
        if (leftTime !== rightTime) return rightTime - leftTime;
        return Number(right.id) - Number(left.id);
      });
  }, [historyTask, taskById, tasks]);

  const taskIdsWithHistory = useMemo(() => {
    const ids = new Set();
    tasks.forEach((task) => {
      if (task.revision_of) {
        ids.add(String(task.id));
        ids.add(String(task.revision_of));
      }
      if (task.redo_of) {
        ids.add(String(task.id));
        ids.add(String(task.redo_of));
      }
    });
    return ids;
  }, [tasks]);

  function getDesignerLabel(task) {
    if (task?.designer_name) return task.designer_name;
    const designer = users.find((item) => String(item.id) === String(task?.designer));
    if (!designer) return "-";
    if (designer.first_name || designer.last_name) return `${designer.first_name || ""} ${designer.last_name || ""}`.trim();
    return designer.email || "-";
  }

  function getRevisionOfLabel(task) {
    if (!task?.revision_of) return "-";
    if (task?.revision_of_task_name) return task.revision_of_task_name;
    return taskNameById[String(task.revision_of)] || `Task #${task.revision_of}`;
  }

  function getRedoOfLabel(task) {
    if (!task?.redo_of) return "-";
    if (task?.redo_of_task_name) return task.redo_of_task_name;
    return taskNameById[String(task.redo_of)] || `Task #${task.redo_of}`;
  }

  function openTaskHistory(task) {
    setHistoryTaskId(task?.id ? String(task.id) : null);
    setHistoryOpen(true);
  }

  function resetDrawerState() {
    setDrawerMode(null);
    setDrawerLoading(false);
    setDrawerError("");
    setSavingTask(false);
    setTaskForm(EMPTY_TASK_FORM);
    setOriginalTaskOptions([]);
  }

  function handleDrawerOpenChange(open) {
    setDrawerOpen(open);
    if (!open) resetDrawerState();
  }

  async function loadOriginalTaskOptions(clientId) {
    if (!clientId) {
      setOriginalTaskOptions([]);
      return;
    }
    try {
      const allTasks = await superboardApi.tasks.listAll({ client: clientId, page_size: 300 });
      const originals = allTasks.filter((task) => !task.revision_of && !task.redo_of);
      setOriginalTaskOptions(originals);
    } catch {
      setOriginalTaskOptions([]);
    }
  }

  async function openCreateTaskDrawer() {
    if (!canCreateTask) {
      toast.error("You only have view access for this client.");
      return;
    }
    const activeClientId = String(selectedClientId || "");
    setDrawerMode("create");
    setDrawerLoading(true);
    setDrawerError("");
    setTaskForm({
      ...EMPTY_TASK_FORM,
      clientId: activeClientId,
      createdBy: currentUserId,
      createdByName: currentUser?.email || "",
      targetDate: new Date().toISOString().slice(0, 10),
    });
    setDrawerOpen(true);
    await loadOriginalTaskOptions(activeClientId);
    setDrawerLoading(false);
  }

  async function openCreateRevisionDrawer(baseTask) {
    if (!canFullyManageTask) {
      toast.error("You only have view access for this client.");
      return;
    }
    const clientId = String(baseTask?.client || selectedClientId || "");
    const originalTaskId = getOriginalTaskId(baseTask);
    setDrawerMode("create");
    setDrawerLoading(true);
    setDrawerError("");
    setTaskForm({
      ...EMPTY_TASK_FORM,
      clientId,
      createdBy: currentUserId,
      createdByName: currentUser?.email || "",
      revisionOfId: originalTaskId,
      redoOfId: "",
      taskName: baseTask?.task_name || "",
      instructions: baseTask?.instructions || "",
      instructionsByArtDirector: baseTask?.InstructionsByArtDirector || "",
      priority: baseTask?.priority || "medium",
      designerId: baseTask?.designer ? String(baseTask.designer) : "",
      typeOfWorkId: baseTask?.type_of_work ? String(baseTask.type_of_work) : "",
      targetDate: baseTask?.target_date || new Date().toISOString().slice(0, 10),
      excellence:
        baseTask?.excellence === null || baseTask?.excellence === undefined || baseTask?.excellence === ""
          ? ""
          : String(baseTask.excellence),
      isMarkedCompletedByAccountPlanner: false,
      isMarkedCompletedByArtDirector: false,
      isMarkedCompletedByDesigner: false,
    });
    setDrawerOpen(true);
    await loadOriginalTaskOptions(clientId);
    setDrawerLoading(false);
  }

  async function openCreateRedoDrawer(baseTask) {
    if (!canFullyManageTask) {
      toast.error("You only have view access for this client.");
      return;
    }
    const clientId = String(baseTask?.client || selectedClientId || "");
    const redoTaskId = getRedoTaskId(baseTask);
    setDrawerMode("create");
    setDrawerLoading(true);
    setDrawerError("");
    setTaskForm({
      ...EMPTY_TASK_FORM,
      clientId,
      createdBy: currentUserId,
      createdByName: currentUser?.email || "",
      revisionOfId: "",
      redoOfId: redoTaskId,
      taskName: baseTask?.task_name || "",
      instructions: baseTask?.instructions || "",
      instructionsByArtDirector: baseTask?.InstructionsByArtDirector || "",
      priority: baseTask?.priority || "medium",
      designerId: baseTask?.designer ? String(baseTask.designer) : "",
      typeOfWorkId: baseTask?.type_of_work ? String(baseTask.type_of_work) : "",
      targetDate: baseTask?.target_date || new Date().toISOString().slice(0, 10),
      excellence:
        baseTask?.excellence === null || baseTask?.excellence === undefined || baseTask?.excellence === ""
          ? ""
          : String(baseTask.excellence),
      isMarkedCompletedByAccountPlanner: false,
      isMarkedCompletedByArtDirector: false,
      isMarkedCompletedByDesigner: false,
    });
    setDrawerOpen(true);
    await loadOriginalTaskOptions(clientId);
    setDrawerLoading(false);
  }

  async function openEditTaskDrawer(taskId) {
    const task = tasks.find((item) => String(item.id) === String(taskId));
    if (!canOpenTaskEditor(task)) {
      toast.error("You do not have permission to update this task.");
      return;
    }
    setDrawerMode("edit");
    setDrawerLoading(true);
    setDrawerError("");
    setDrawerOpen(true);
    try {
      const task = await superboardApi.tasks.retrieve(taskId);
      const clientId = String(task.client || selectedClientId || "");
      setTaskForm({
        id: task.id,
        clientId,
        revisionOfId: task.revision_of ? String(task.revision_of) : "",
        redoOfId: task.redo_of ? String(task.redo_of) : "",
        createdBy: task.created_by ? String(task.created_by) : "",
        createdByName: task.created_by_name || "",
        taskName: task.task_name || "",
        instructions: task.instructions || "",
        instructionsByArtDirector: task.InstructionsByArtDirector || "",
        priority: task.priority || "medium",
        designerId: task.designer ? String(task.designer) : "",
        typeOfWorkId: task.type_of_work ? String(task.type_of_work) : "",
        targetDate: task.target_date || "",
        excellence:
          task.excellence === null || task.excellence === undefined || task.excellence === ""
            ? ""
            : String(task.excellence),
        isMarkedCompletedByAccountPlanner: Boolean(task.is_marked_completed_by_account_planner),
        isMarkedCompletedByArtDirector: Boolean(task.is_marked_completed_by_art_director),
        isMarkedCompletedByDesigner: Boolean(task.is_marked_completed_by_designer),
      });
      await loadOriginalTaskOptions(clientId);
    } catch (requestError) {
      setDrawerError(requestError.message || "Failed to load task.");
    } finally {
      setDrawerLoading(false);
    }
  }

  async function handleCreateInlineTypeOfWork() {
    const workTypeName = inlineTypeOfWorkForm.workTypeName.trim();
    const point = inlineTypeOfWorkForm.point.trim();

    if (!workTypeName) {
      toast.error("Work type name is required.");
      return;
    }

    if (!point) {
      toast.error("Point is required.");
      return;
    }

    setSavingInlineTypeOfWork(true);
    try {
      const created = await superboardApi.typeOfWork.create({
        work_type_name: workTypeName,
        point: Number(point),
      });
      const allTypeOfWork = await superboardApi.typeOfWork.listAll({ page_size: 300 });
      setTypeOfWorkOptions(allTypeOfWork);
      setTaskForm((prev) => ({ ...prev, typeOfWorkId: String(created.id) }));
      setInlineTypeOfWorkForm(EMPTY_INLINE_TYPE_OF_WORK_FORM);
      setInlineTypeOfWorkOpen(false);
      toast.success("Type of work created successfully.");
    } catch (requestError) {
      toast.error(requestError.message || "Failed to create type of work.");
    } finally {
      setSavingInlineTypeOfWork(false);
    }
  }

  async function handleSaveTask(event) {
    event.preventDefault();
    if (drawerMode !== "edit" && !canCreateTask) {
      setDrawerError("You do not have permission to create tasks for this client.");
      toast.error("You do not have permission to create tasks for this client.");
      return;
    }
    if (drawerMode === "edit" && !canManageTask({ created_by: taskForm.createdBy, designer: taskForm.designerId })) {
      const message = "You only have view access for this task.";
      setDrawerError(message);
      toast.error(message);
      return;
    }
    const trimmedTaskName = taskForm.taskName.trim();
    if (drawerMode !== "edit" || currentUserRole !== "designer") {
      if (!trimmedTaskName) {
        const message = "Task name is required.";
        setDrawerError(message);
        toast.error(message);
        return;
      }
    }
    setSavingTask(true);
    setDrawerError("");
    try {
      let payload;
      if (drawerMode === "edit" && currentUserRole === "designer") {
        payload = {
          is_marked_completed_by_designer: taskForm.isMarkedCompletedByDesigner,
        };
      } else {
        payload = {
          task_name: trimmedTaskName,
          priority: taskForm.priority,
          type_of_work: taskForm.typeOfWorkId ? Number(taskForm.typeOfWorkId) : null,
          target_date: taskForm.targetDate || null,
        };

        if (!isArtDirector) {
          payload.instructions = taskForm.instructions;
          payload.is_marked_completed_by_account_planner = taskForm.isMarkedCompletedByAccountPlanner;
        }

        if (!isAccountPlanner) {
          payload.InstructionsByArtDirector = taskForm.instructionsByArtDirector || null;
        }

        if (canViewPoints) {
          payload.excellence = taskForm.excellence ? Number(taskForm.excellence) : null;
        }

        if (!isAccountPlanner) {
          payload.designer = taskForm.designerId ? Number(taskForm.designerId) : null;
          payload.is_marked_completed_by_art_director = taskForm.isMarkedCompletedByArtDirector;
          if (currentUserRole === "designer") {
            payload.is_marked_completed_by_designer = taskForm.isMarkedCompletedByDesigner;
          }
        }

        if (taskForm.revisionOfId) {
          payload.revision_of = Number(taskForm.revisionOfId);
          if (drawerMode === "edit") payload.redo_of = null;
        } else if (taskForm.redoOfId) {
          payload.redo_of = Number(taskForm.redoOfId);
          if (drawerMode === "edit") payload.revision_of = null;
        } else if (taskForm.clientId) {
          payload.client = Number(taskForm.clientId);
          if (drawerMode === "edit") {
            payload.revision_of = null;
            payload.redo_of = null;
          }
        }

        if (drawerMode !== "edit" && currentUserId) {
          payload.created_by = Number(currentUserId);
        }
      }

      if (drawerMode === "edit" && currentUserRole === "designer" && !canDesignerEditTask(tasks.find((item) => String(item.id) === String(taskForm.id)))) {
        throw new Error("You do not have permission to update this task.");
      }

      if (drawerMode === "edit" && taskForm.id) {
        await superboardApi.tasks.patch(taskForm.id, payload);
        toast.success("Task updated successfully.");
      } else {
        await superboardApi.tasks.create(payload);
        toast.success("Task created successfully.");
      }

      setReloadTick((value) => value + 1);
      handleDrawerOpenChange(false);
    } catch (requestError) {
      const message = requestError.message || "Failed to save task.";
      setDrawerError(message);
      toast.error(message);
    } finally {
      setSavingTask(false);
    }
  }

  async function handleDeleteTask(taskId) {
    if (!taskId || !window.confirm("Delete this task?")) return;
    if (!canManageTask({ created_by: taskForm.createdBy, designer: taskForm.designerId })) {
      setDrawerError("You do not have permission to delete this task.");
      toast.error("You do not have permission to delete this task.");
      return;
    }
    try {
      await superboardApi.tasks.remove(taskId);
      toast.success("Task deleted successfully.");
      setReloadTick((value) => value + 1);
      handleDrawerOpenChange(false);
    } catch (requestError) {
      const message = requestError.message || "Failed to delete task.";
      setDrawerError(message);
      toast.error(message);
    }
  }

  async function handleToggleDesignerCompletion(task, checked) {
    if (!canDesignerEditTask(task)) {
      setDrawerError("You do not have permission to update this task.");
      toast.error("You do not have permission to update this task.");
      return;
    }
    if (!canDesignerModifyCompletion(task)) {
      setDrawerError("Designer completion is locked for this task.");
      toast.error("Designer completion is locked for this task.");
      return;
    }
    setUpdatingDesignerCompletionTaskId(String(task.id));
    try {
      await superboardApi.tasks.patch(task.id, {
        is_marked_completed_by_designer: Boolean(checked),
      });
      toast.success("Designer completion updated successfully.");
      setReloadTick((value) => value + 1);
    } catch (requestError) {
      const message = requestError.message || "Failed to update designer completion.";
      setDrawerError(message);
      toast.error(message);
    } finally {
      setUpdatingDesignerCompletionTaskId(null);
    }
  }

  const visibleTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const aDate = new Date(getTaskDateValue(a) || a.created_at || 0).getTime();
      const bDate = new Date(getTaskDateValue(b) || b.created_at || 0).getTime();
      if (aDate !== bDate) return bDate - aDate;
      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [filteredTasks]);
  const yearOptions = useMemo(() => {
    const years = Array.from(
      new Set(
        visibleTasks
          .map((task) => getDateParts(task.created_at)?.year)
          .filter((year) => Number.isInteger(year)),
      ),
    ).sort((a, b) => b - a);
    return years.length ? years : [selectedYear];
  }, [selectedYear, visibleTasks]);
  const monthOptions = useMemo(() => {
    const months = Array.from(
      new Set(
        visibleTasks
          .map((task) => getDateParts(task.created_at))
          .filter((parts) => parts?.year === selectedYear)
          .map((parts) => parts.month),
      ),
    ).sort((a, b) => a - b);
    return months.length ? months : [selectedMonth];
  }, [selectedMonth, selectedYear, visibleTasks]);

  useEffect(() => {
    if (!yearOptions.includes(selectedYear)) {
      setSelectedYear(yearOptions[0]);
    }
  }, [selectedYear, yearOptions]);

  useEffect(() => {
    if (!monthOptions.includes(selectedMonth)) {
      setSelectedMonth(monthOptions[0]);
    }
  }, [monthOptions, selectedMonth]);

  const dateSlides = useMemo(() => {
    const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    return Array.from({ length: totalDaysInMonth }, (_, index) => {
      const day = index + 1;
      const mm = String(selectedMonth + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const dateKey = `${selectedYear}-${mm}-${dd}`;
      const dateObj = new Date(selectedYear, selectedMonth, day);
      const tasksForDate = visibleTasks.filter((task) => getIsoDateKey(task.created_at) === dateKey);

      return {
        dateKey,
        day,
        weekDay: DAY_SHORT[dateObj.getDay()],
        monthLabel: MONTH_NAMES[selectedMonth],
        year: selectedYear,
        tasks: tasksForDate,
      };
    });
  }, [selectedMonth, selectedYear, visibleTasks]);

  const loading = loadingClients || loadingTasks;
  const error = clientsError || tasksError;

  // Determine which tasks are parents of revisions or redos for the stacked card UI
  const taskIdsThatAreParentsOfRevisionsOrRedos = useMemo(() => {
    const parentIds = new Set();
    tasks.forEach(t => {
      if (t.revision_of) {
        parentIds.add(String(t.revision_of));
      }
      if (t.redo_of) {
        parentIds.add(String(t.redo_of));
      }
    });
    return parentIds;
  }, [tasks]);

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title={headerTitle} />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-background p-4 lg:p-6">
            <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-[260px] flex-wrap items-center gap-3">
                {currentUserRole !== "designer" ? (
                  <>
                    <label htmlFor="client-select" className="text-sm font-semibold text-muted-foreground">
                      Client
                    </label>
                    <Select value={selectedClientId || undefined} onValueChange={setSelectedClientId}>
                      <SelectTrigger id="client-select" className="h-11 min-w-[300px] rounded-xl px-4 text-sm shadow-sm">
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                      {clients.map((client) => (
                        <SelectItem key={String(client.id)} value={String(client.id)}>
                          {getClientName(client)}
                        </SelectItem>
                      ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : null}
                {currentUserRole !== "designer" ? (
                  <Select
                    value={selectedDesignerId || "__none__"}
                    onValueChange={(value) => setSelectedDesignerId(value === "__none__" ? "" : value)}>
                    <SelectTrigger className="h-11 min-w-[220px] rounded-xl px-4 text-sm shadow-sm" aria-label="Select designer">
                      <SelectValue placeholder="All designers" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                    <SelectItem value="__none__">All designers</SelectItem>
                    {designerOptions.map((designer) => (
                      <SelectItem key={String(designer.id)} value={String(designer.id)}>
                        {designer.first_name || designer.last_name
                          ? `${designer.first_name || ""} ${designer.last_name || ""}`.trim()
                          : designer.email}
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Select value={String(selectedMonth)} onValueChange={(value) => setSelectedMonth(Number(value))}>
                  <SelectTrigger className="h-11 w-[180px] rounded-xl px-4 text-sm shadow-sm" aria-label="Select month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {monthOptions.map((monthIndex) => (
                      <SelectItem key={MONTH_NAMES[monthIndex]} value={String(monthIndex)}>
                        {MONTH_NAMES[monthIndex]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
                  <SelectTrigger className="h-11 w-[140px] rounded-xl px-4 text-sm shadow-sm" aria-label="Select year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canCreateTask ? (
                  <Button className="rounded-full" onClick={openCreateTaskDrawer} disabled={!selectedClientId}>
                    <Plus className="h-4 w-4" />
                    Create Task
                  </Button>
                ) : null}
                <Badge variant="secondary" className="rounded-full px-3 py-2 text-sm">
                  {visibleTasks.length} task(s)
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Previous date"
                  onClick={() => swiperRef.current?.slidePrev()}
                  className="h-10 w-10 rounded-full shadow-sm">
                  <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Next date"
                  onClick={() => swiperRef.current?.slideNext()}
                  className="h-10 w-10 rounded-full shadow-sm">
                  <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
                </Button>
                </div>
              </div>
            </div>

            <Sheet open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
            <SheetContent side="right" className="flex h-full w-full flex-col overflow-hidden p-0 sm:max-w-xl">
              <SheetHeader className="px-6 pt-6">
                  <SheetTitle>{drawerMode === "edit" ? "Edit task" : "Create task"}</SheetTitle>
                  <SheetDescription>
                    {isArtDirectorReadOnlyTask
                      ? "View only. Art directors can edit only tasks they created."
                      : drawerMode === "edit"
                        ? "Update or delete this task."
                        : "Create a new task."}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-4 flex-1 overflow-y-auto px-6 pb-6">
                  {drawerLoading ? <p className="text-sm text-muted-foreground">Loading task...</p> : null}
                  {!drawerLoading ? (
                    <form className="space-y-4 rounded-lg border p-3" onSubmit={handleSaveTask}>
                      <div className="space-y-2">
                        <Label htmlFor="task-client">Client</Label>
                        <Select
                          value={taskForm.clientId || undefined}
                          disabled={drawerMode === "edit" || currentUserRole === "designer"}
                          onValueChange={(nextClientId) => {
                            setTaskForm((prev) => ({ ...prev, clientId: nextClientId, revisionOfId: "", redoOfId: "" }));
                            loadOriginalTaskOptions(nextClientId);
                          }}>
                          <SelectTrigger
                            id="task-client"
                            className={`h-9 w-full rounded-md ${
                              drawerMode === "edit" || currentUserRole === "designer" ? "bg-muted text-muted-foreground" : ""
                            }`}>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                          {clients.map((client) => (
                            <SelectItem key={String(client.id)} value={String(client.id)}>
                              {getClientName(client)}
                            </SelectItem>
                          ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="task-name">Task name</Label>
                        <Input
                          id="task-name"
                          value={taskForm.taskName}
                          required
                          className={isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : ""}
                          disabled={isReadOnlyTaskForm}
                          onChange={(event) => setTaskForm((prev) => ({ ...prev, taskName: event.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="task-instructions">Instructions / Brief by Brand</Label>
                        <textarea
                          id="task-instructions"
                          className={`min-h-24 w-full rounded-md border px-3 py-2 text-sm ${
                            isReadOnlyTaskForm
                                ? "cursor-not-allowed bg-muted text-muted-foreground"
                                : "bg-background"
                          }`}
                          value={taskForm.instructions}
                          disabled={isReadOnlyTaskForm}
                          onChange={(event) => setTaskForm((prev) => ({ ...prev, instructions: event.target.value }))}
                        />
                      </div>

                      {!isAccountPlanner ? (
                        <div className="space-y-2">
                          <Label htmlFor="task-instructions-by-art-director">Instructions By Art Director</Label>
                          <textarea
                            id="task-instructions-by-art-director"
                            className={`min-h-24 w-full rounded-md border px-3 py-2 text-sm ${
                              isReadOnlyTaskForm ? "cursor-not-allowed bg-muted text-muted-foreground" : "bg-background"
                            }`}
                            value={taskForm.instructionsByArtDirector}
                            disabled={isReadOnlyTaskForm}
                            onChange={(event) =>
                              setTaskForm((prev) => ({ ...prev, instructionsByArtDirector: event.target.value }))
                            }
                          />
                        </div>
                      ) : null}

                      <div className={`grid grid-cols-1 gap-4 ${canViewPoints ? "md:grid-cols-2" : ""}`}>
                        <div className="space-y-2">
                          <Label htmlFor="task-priority">Priority</Label>
                          <Select
                            value={taskForm.priority}
                            disabled={isReadOnlyTaskForm}
                            onValueChange={(value) => setTaskForm((prev) => ({ ...prev, priority: value }))}>
                            <SelectTrigger id="task-priority" className={`h-9 w-full rounded-md ${isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : ""}`}>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                            {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {canViewPoints ? (
                          <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="task-excellence">Excellence</Label>
                              <Select
                                value={taskForm.excellence || "__none__"}
                                disabled={isReadOnlyTaskForm}
                                onValueChange={(value) =>
                                  setTaskForm((prev) => ({ ...prev, excellence: value === "__none__" ? "" : value }))
                                }>
                                <SelectTrigger id="task-excellence" className={`h-9 w-full rounded-md ${isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : ""}`}>
                                  <SelectValue placeholder="Select excellence" />
                                </SelectTrigger>
                                <SelectContent className="max-h-72">
                                <SelectItem value="__none__">Select excellence</SelectItem>
                                {EXCELLENCE_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {drawerMode === "edit" ? (
                        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                          <p className="text-sm font-semibold text-foreground">Completion flags</p>
                          {currentUserRole !== "designer" ? (
                            <>
                              <label className="flex items-center gap-3 text-sm text-foreground">
                                <input
                                  type="checkbox"
                                  checked={taskForm.isMarkedCompletedByAccountPlanner}
                                  disabled={
                                    isArtDirector ||
                                    isReadOnlyTaskForm ||
                                    (accountPlannerCompletionBlocked && !taskForm.isMarkedCompletedByAccountPlanner)
                                  }
                                  onChange={
                                    isArtDirector || isReadOnlyTaskForm
                                      ? undefined
                                      : (event) =>
                                          setTaskForm((prev) => ({
                                            ...prev,
                                            isMarkedCompletedByAccountPlanner: event.target.checked,
                                          }))
                                  }
                                />
                                Marked completed by Account Planner
                              </label>
                              {accountPlannerCompletionBlocked ? (
                                <p className="text-[12px] text-amber-700">
                                  Account Planner cannot mark as completed until Art Director and Designer have completed
                                  their tasks.
                                </p>
                              ) : null}
                              {isAccountPlanner && artDirectorCompletionBlocked ? (
                                <p className="text-[12px] text-amber-700">
                                  Art Director cannot mark as completed until Designer has completed the task.
                                </p>
                              ) : null}
                              {!isAccountPlanner ? (
                                <label className="flex items-center gap-3 text-sm text-foreground">
                                  <input
                                  type="checkbox"
                                  checked={taskForm.isMarkedCompletedByArtDirector}
                                  disabled={isReadOnlyTaskForm || artDirectorCompletionBlocked || taskForm.isMarkedCompletedByAccountPlanner}
                                  onChange={(event) =>
                                    setTaskForm((prev) => ({
                                      ...prev,
                                        isMarkedCompletedByArtDirector: event.target.checked,
                                      }))
                                    }
                                  />
                                  Marked completed by Art Director
                                </label>
                              ) : null}
                            </>
                          ) : null}
                          {isAccountPlanner ? null : (
                            <label className="flex items-center gap-3 text-sm text-foreground">
                              <input
                                type="checkbox"
                                checked={taskForm.isMarkedCompletedByDesigner}
                                disabled={isReadOnlyTaskForm || currentUserRole !== "designer" || !canDesignerModifyCompletion(taskForm)}
                                onChange={(event) =>
                                  setTaskForm((prev) => ({
                                    ...prev,
                                    isMarkedCompletedByDesigner: event.target.checked,
                                  }))
                                }
                              />
                              Marked completed by Designer
                            </label>
                          )}
                        </div>
                      ) : null}

                      {!isAccountPlanner ? (
                        <div className="space-y-2">
                          <Label htmlFor="task-designer">Designer</Label>
                          <Select
                            value={taskForm.designerId || "__none__"}
                            disabled={isReadOnlyTaskForm}
                            onValueChange={(value) =>
                              setTaskForm((prev) => ({ ...prev, designerId: value === "__none__" ? "" : value }))
                            }>
                            <SelectTrigger id="task-designer" className={`h-9 w-full rounded-md ${isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : ""}`}>
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                            <SelectItem value="__none__">Unassigned</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={String(user.id)} value={String(user.id)}>
                                {user.first_name || user.last_name
                                  ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                                  : user.email}
                              </SelectItem>
                            ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="task-type-of-work">Type Of Work</Label>
                          {canManageTypeOfWork ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-auto px-0 py-0 text-sm font-medium"
                              disabled={isReadOnlyTaskForm}
                              onClick={() => {
                                setInlineTypeOfWorkOpen((prev) => !prev);
                                setInlineTypeOfWorkForm(EMPTY_INLINE_TYPE_OF_WORK_FORM);
                              }}>
                              <Plus className="h-4 w-4" />
                              Add new
                            </Button>
                          ) : null}
                        </div>
                        <Select
                          value={taskForm.typeOfWorkId || "__none__"}
                          disabled={isReadOnlyTaskForm}
                          onValueChange={(value) =>
                            setTaskForm((prev) => ({ ...prev, typeOfWorkId: value === "__none__" ? "" : value }))
                          }>
                          <SelectTrigger id="task-type-of-work" className={`h-9 w-full rounded-md ${isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : ""}`}>
                            <SelectValue placeholder="Select type of work" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                          <SelectItem value="__none__">Select type of work</SelectItem>
                          {typeOfWorkOptions.map((item) => (
                            <SelectItem key={String(item.id)} value={String(item.id)}>
                              {item.work_type_name}
                            </SelectItem>
                          ))}
                          </SelectContent>
                        </Select>
                        {inlineTypeOfWorkOpen ? (
                          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-foreground">Create New Type Of Work</p>
                                <p className="text-xs text-muted-foreground">Add it here and use it immediately for this task.</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="inline-type-of-work-name" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                  Work Type Name
                                </Label>
                                <Input
                                  id="inline-type-of-work-name"
                                  value={inlineTypeOfWorkForm.workTypeName}
                                  onChange={(event) =>
                                    setInlineTypeOfWorkForm((prev) => ({ ...prev, workTypeName: event.target.value }))
                                  }
                                  placeholder="Enter work type name"
                                  className="h-11"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="inline-type-of-work-point" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                  Point
                                </Label>
                                <Input
                                  id="inline-type-of-work-point"
                                  type="number"
                                  step="any"
                                  value={inlineTypeOfWorkForm.point}
                                  onChange={(event) =>
                                    setInlineTypeOfWorkForm((prev) => ({ ...prev, point: event.target.value }))
                                  }
                                  placeholder="0"
                                  className="h-11"
                                />
                              </div>
                            </div>
                            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => {
                                  setInlineTypeOfWorkOpen(false);
                                  setInlineTypeOfWorkForm(EMPTY_INLINE_TYPE_OF_WORK_FORM);
                                }}>
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                className="rounded-xl"
                                onClick={handleCreateInlineTypeOfWork}
                                disabled={savingInlineTypeOfWork}>
                                {savingInlineTypeOfWork ? "Saving..." : "Create Type Of Work"}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="task-target-date">Target date</Label>
                        <Input
                          id="task-target-date"
                          type="date"
                          value={taskForm.targetDate}
                          className={isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : ""}
                          disabled={isReadOnlyTaskForm}
                          onChange={(event) => setTaskForm((prev) => ({ ...prev, targetDate: event.target.value }))}
                        />
                      </div>

                      {drawerError ? <p className="text-sm text-destructive">{drawerError}</p> : null}
                      <SheetFooter className="p-0">
                        <div className="flex w-full flex-col gap-2">
                          {!isArtDirectorReadOnlyTask ? (
                            <Button type="submit" disabled={savingTask}>
                              {savingTask ? "Saving..." : drawerMode === "edit" ? "Update task" : "Create task"}
                            </Button>
                          ) : null}
                          {drawerMode === "edit" && taskForm.id && currentUserRole !== "designer" && !isArtDirectorReadOnlyTask ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="border-destructive text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteTask(taskForm.id)}>
                              <Trash2 className="h-4 w-4" />
                              Delete task
                            </Button>
                          ) : null}
                        </div>
                      </SheetFooter>
                    </form>
                  ) : null}
                </div>
              </SheetContent>
            </Sheet>

            {loading ? <p className="text-sm text-muted-foreground">Loading client and tasks...</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {!loading && !error ? (
              <div className="relative min-w-0 overflow-x-hidden rounded-xl border border-border bg-muted/30 p-3">
                {!selectedClient && currentUserRole !== "designer" ? (
                  <p className="text-sm text-muted-foreground">
                    No clients are assigned to your account.
                  </p>
                ) : null}
                {(selectedClient || currentUserRole === "designer") && visibleTasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
                    <CalendarDays className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">No tasks found</p>
                    <p className="text-xs text-muted-foreground">
                      There are no tasks for the selected filters.
                    </p>
                  </div>
                ) : null}
                {dateSlides.length > 0 ? (
                  <Swiper
                    className="w-full overflow-hidden"
                    modules={[Keyboard]}
                    onSwiper={(swiper) => {
                      swiperRef.current = swiper;
                    }}
                    keyboard={{ enabled: true }}
                    spaceBetween={16}
                    slidesPerView={1}
                    breakpoints={{
                      900: { slidesPerView: 2 },
                      1280: { slidesPerView: 3 },
                    }}>
                    {dateSlides.map((slide) => (
                      <SwiperSlide
                        key={slide.dateKey}
                        className="h-[66vh] animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
                        <Card className="flex h-full flex-col overflow-hidden border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                          <CardHeader className="z-10 space-y-3 border-b border-border bg-muted/30 pb-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <CardTitle className="min-w-0 break-words text-3xl leading-none font-semibold tracking-tight text-foreground">
                                {slide.weekDay} {slide.day}{" "}
                                <span className="text-muted-foreground">
                                  {slide.monthLabel} {slide.year}
                                </span>
                              </CardTitle>
                              <Badge variant="secondary" className="shrink-0 rounded-full px-3 py-1 text-sm">
                                {slide.tasks.length} task(s)
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto pt-4">
                            {slide.tasks.map((task) => (
                              <TaskCard
                                key={String(task.id ?? getTaskName(task))}
                                task={{
                                  ...task,
                                  client_name: task.client_name || getClientName(selectedClient || {}),
                                  designer_name: getDesignerLabel(task),
                                }}
                                isAccountPlanner={isAccountPlanner}
                                isArtDirector={isArtDirector}
                                isDesigner={currentUserRole === "designer"}
                                canEdit={currentUserRole === "designer" ? false : Boolean(canOpenTaskEditor(task))}
                                hasHistory={taskIdsWithHistory.has(String(task.id))}
                                updatingDesignerCompletion={updatingDesignerCompletionTaskId === String(task.id)}
                                onEdit={(item) => openEditTaskDrawer(item.id)}
                                onToggleDesignerCompletion={handleToggleDesignerCompletion}
                                onAddRevision={openCreateRevisionDrawer}
                                onAddRedo={openCreateRedoDrawer}
                                onOpenHistory={openTaskHistory}
                              />
                            ))}
                          </CardContent>
                        </Card>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                ) : null}
              </div>
            ) : null}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <TaskHistoryDrawer open={historyOpen} onOpenChange={setHistoryOpen} task={historyTask} items={historyItems} />
      <Toaster />
    </TooltipProvider>
  );
}
