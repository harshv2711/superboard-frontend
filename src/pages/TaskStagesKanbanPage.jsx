import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { Check, ChevronDown, Filter, LoaderCircle, RefreshCw, Search, X } from "lucide-react";
import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";

const TONES = {
  blue: "border-blue-200 bg-blue-50/70",
  amber: "border-amber-200 bg-amber-50/70",
  emerald: "border-emerald-200 bg-emerald-50/70",
  rose: "border-rose-200 bg-rose-50/70",
  violet: "border-violet-200 bg-violet-50/70",
};

const KANBAN_STAGE_COLUMNS = [
  { id: "backlog", name: "Backlog", tone: TONES.blue },
  { id: "on_going", name: "Ongoing", tone: TONES.amber },
  { id: "complete", name: "Complete", tone: TONES.emerald },
  {
    id: "approved_by_art_director_waiting_for_approval",
    name: "Approved By Art Director/ Waiting for approval",
    tone: TONES.violet,
  },
  { id: "approved", name: "Approved", tone: TONES.rose },
];

const KANBAN_VIEW_CONFIG = {
  designer: {
    title: "Designer Kanban",
    columns: KANBAN_STAGE_COLUMNS,
  },
  art_director: {
    title: "Art Director Kanban",
    columns: KANBAN_STAGE_COLUMNS,
  },
  account_planner: {
    title: "Account Planner Kanban",
    columns: KANBAN_STAGE_COLUMNS,
  },
};

function formatDate(value) {
  if (!value) return "No target date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No target date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getTaskKind(task) {
  if (task?.redo_of) return "Redo";
  if (task?.revision_of) return "Revision";
  return "Original";
}

function getTaskStage(task) {
  const rawStage = String(task?.stage || "backlog");

  if (rawStage === "waiting_for_approval" || rawStage === "send_for_approval") {
    return "approved_by_art_director_waiting_for_approval";
  }

  if (KANBAN_STAGE_COLUMNS.some((column) => column.id === rawStage)) {
    return rawStage;
  }

  return "backlog";
}

function getTaskWorkflowColumn(task, viewMode) {
  void viewMode;
  return getTaskStage(task);
}

function getTaskType(task) {
  if (task?.revision_of) return "revision";
  if (task?.redo_of) return "redo";
  return "original";
}

function isTaskCompleted(task) {
  return getTaskStage(task) === "approved";
}

function getClientName(client) {
  return client.name || client.client_name || client.title || `Client #${client.id}`;
}

function getOwnerUserIds(client) {
  if (!Array.isArray(client?.owner_user_ids)) return [];
  return client.owner_user_ids.map((value) => String(value));
}

function taskMatchesQuery(task, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [task?.task_name, task?.client_name, task?.designer_name, task?.type_of_work_name]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function isTaskInCurrentMonth(task, now = new Date()) {
  if (!task?.target_date) return false;
  const targetDate = new Date(task.target_date);
  if (Number.isNaN(targetDate.getTime())) return false;

  return (
    targetDate.getFullYear() === now.getFullYear()
    && targetDate.getMonth() === now.getMonth()
  );
}

function sortTasks(rows) {
  return [...rows].sort((left, right) => {
    const leftDate = left?.target_date ? new Date(left.target_date).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDate = right?.target_date ? new Date(right.target_date).getTime() : Number.MAX_SAFE_INTEGER;
    if (leftDate !== rightDate) return leftDate - rightDate;
    return String(left?.task_name || "").localeCompare(String(right?.task_name || ""));
  });
}

function buildColumns(tasks, searchQuery, columnConfig, viewMode) {
  const visibleTasks = tasks.filter((task) => taskMatchesQuery(task, searchQuery));

  return columnConfig.map((column, index) => ({
    ...column,
    sequence: index + 1,
    tasks: sortTasks(visibleTasks.filter((task) => getTaskWorkflowColumn(task, viewMode) === column.id)),
  }));
}

function TaskCard({ task, index, disabled = false }) {
  return (
    <Draggable draggableId={`task-${task.id}`} index={index} isDragDisabled={disabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
        >
          <Card className={`gap-3 rounded-[1.4rem] border border-slate-200/90 bg-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.28)] touch-none cursor-grab active:cursor-grabbing ${snapshot.isDragging ? "opacity-50" : ""}`}>
            <CardHeader className="gap-2 pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <CardTitle className="text-lg font-semibold leading-7 text-slate-900">{task.task_name || `Task #${task.id}`}</CardTitle>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                    {task.client_name || "No client"}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 border-slate-300 bg-slate-50 text-slate-700">
                  {getTaskKind(task)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0 text-sm text-slate-600">
              <div className="flex flex-wrap gap-2">
                <Badge className="rounded-full bg-slate-100 text-slate-700 hover:bg-slate-100">
                  {task.priority || "medium"}
                </Badge>
                <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-600">
                  {task.type_of_work_name || "No type of work"}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <p>Designer: {task.designer_name || "Unassigned"}</p>
                <p>Target: {formatDate(task.target_date)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}

function KanbanColumn({ column, isSaving }) {
  return (
    <Droppable droppableId={column.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`flex min-h-[340px] w-[280px] min-w-[280px] flex-col rounded-[1.6rem] border p-4 shadow-[0_22px_60px_-36px_rgba(15,23,42,0.3)] transition md:w-[300px] md:min-w-[300px] xl:w-[260px] xl:min-w-[260px] 2xl:w-[280px] 2xl:min-w-[280px] ${column.tone} ${snapshot.isDraggingOver ? "ring-2 ring-slate-900/15" : ""}`}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="break-words text-sm font-semibold uppercase leading-7 tracking-[0.16em] text-slate-700 md:text-base">
                {column.sequence}. {column.name}
              </h2>
              <p className="text-sm text-slate-500">{column.tasks.length} task{column.tasks.length === 1 ? "" : "s"}</p>
            </div>
            {isSaving ? <LoaderCircle className="mt-1 h-4 w-4 shrink-0 animate-spin text-slate-500" /> : null}
          </div>
          <div className="flex min-h-[200px] flex-1 flex-col gap-3">
            {column.tasks.length ? (
              column.tasks.map((task, index) => (
                <TaskCard key={task.id} task={task} index={index} disabled={isSaving} />
              ))
            ) : (
              <div className="flex min-h-[160px] items-center justify-center rounded-[1.4rem] border border-dashed border-slate-300 bg-white/60 px-4 text-center text-sm text-slate-500">
                Drop tasks here
              </div>
            )}
            {provided.placeholder}
          </div>
        </div>
      )}
    </Droppable>
  );
}

export default function TaskStagesKanbanPage() {
  const location = useLocation();
  const clientFilterRef = useRef(null);
  const designerFilterRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [selectedDesignerIds, setSelectedDesignerIds] = useState([]);
  const [clientFilterOpen, setClientFilterOpen] = useState(false);
  const [clientFilterQuery, setClientFilterQuery] = useState("");
  const [designerFilterOpen, setDesignerFilterOpen] = useState(false);
  const [designerFilterQuery, setDesignerFilterQuery] = useState("");
  const [targetDateFrom, setTargetDateFrom] = useState("");
  const [targetDateTo, setTargetDateTo] = useState("");
  const [showOriginal, setShowOriginal] = useState(true);
  const [showRevision, setShowRevision] = useState(true);
  const [showRedo, setShowRedo] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState("");
  const [error, setError] = useState("");

  const currentMonth = useMemo(() => new Date(), []);
  const currentMonthLabel = useMemo(() => formatMonthLabel(currentMonth), [currentMonth]);
  const viewMode = useMemo(() => {
    if (location.pathname.startsWith("/designer/")) return "designer";
    if (location.pathname.startsWith("/art-director/")) return "art_director";
    return "account_planner";
  }, [location.pathname]);
  const currentViewConfig = useMemo(() => KANBAN_VIEW_CONFIG[viewMode], [viewMode]);
  const currentUserId = String(currentUser?.id || currentUser?.user_id || "");
  const currentUserRole = currentUser?.role || "";
  const isSuperuser = currentUserRole === "superuser";
  const isArtDirector = currentUserRole === "art_director";
  const isDesigner = currentUserRole === "designer";

  async function loadKanbanData({ silent = false } = {}) {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const [me, allClients, allUsers, taskRows] = await Promise.all([
        superboardApi.auth.me(),
        superboardApi.clients.listAll({ page_size: 300 }),
        superboardApi.designers.listAll({ page_size: 300 }),
        superboardApi.tasks.listAll({ page_size: 500 }),
      ]);
      const normalizedTasks = (Array.isArray(taskRows) ? taskRows : []).map((task) => ({
        ...task,
        stage: getTaskStage(task),
      }));
      setCurrentUser(me);
      setClients(Array.isArray(allClients) ? allClients : []);
      setUsers(Array.isArray(allUsers) ? allUsers : []);
      setTasks(normalizedTasks.filter((task) => isTaskInCurrentMonth(task, currentMonth)));
    } catch (loadError) {
      setError(loadError.message || "Failed to load kanban data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadKanbanData();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (clientFilterRef.current && !clientFilterRef.current.contains(event.target)) {
        setClientFilterOpen(false);
      }
      if (designerFilterRef.current && !designerFilterRef.current.contains(event.target)) {
        setDesignerFilterOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allowedClients = useMemo(() => {
    if (isSuperuser || isArtDirector) return clients;
    if (isDesigner) {
      const visibleClientIds = new Set(
        tasks
          .filter((task) => String(task.designer || "") === currentUserId)
          .map((task) => String(task.client || "")),
      );
      return clients.filter((client) => visibleClientIds.has(String(client.id)));
    }
    return clients.filter((client) => getOwnerUserIds(client).includes(currentUserId));
  }, [clients, currentUserId, isArtDirector, isDesigner, isSuperuser, tasks]);

  const clientOptions = useMemo(
    () => allowedClients.map((client) => ({ id: String(client.id), name: getClientName(client) })),
    [allowedClients],
  );
  const selectedClientValues = useMemo(
    () => clientOptions.filter((client) => selectedClientIds.includes(client.id)),
    [clientOptions, selectedClientIds],
  );
  const visibleClientOptions = useMemo(() => {
    const query = clientFilterQuery.trim().toLowerCase();
    if (!query) return clientOptions;
    return clientOptions.filter((client) => client.name.toLowerCase().includes(query));
  }, [clientFilterQuery, clientOptions]);

  const designerOptions = useMemo(
    () => users.map((designer) => ({ id: String(designer.id), name: designer.email || `Designer #${designer.id}` })),
    [users],
  );
  const selectedDesignerValues = useMemo(
    () => designerOptions.filter((designer) => selectedDesignerIds.includes(designer.id)),
    [designerOptions, selectedDesignerIds],
  );
  const visibleDesignerOptions = useMemo(() => {
    const query = designerFilterQuery.trim().toLowerCase();
    if (!query) return designerOptions;
    return designerOptions.filter((designer) => designer.name.toLowerCase().includes(query));
  }, [designerFilterQuery, designerOptions]);

  const filteredTasks = useMemo(() => (
    tasks.filter((task) => {
      if (searchQuery.trim()) {
        const lowerSearch = searchQuery.toLowerCase();
        const haystack = [
          task?.task_name,
          task?.client_name,
          task?.designer_name,
          task?.type_of_work_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(lowerSearch)) return false;
      }

      if (selectedClientIds.length > 0 && !selectedClientIds.includes(String(task.client || ""))) return false;
      if (isArtDirector && selectedDesignerIds.length > 0 && !selectedDesignerIds.includes(String(task.designer || ""))) return false;

      const taskType = getTaskType(task);
      if (taskType === "original" && !showOriginal) return false;
      if (taskType === "revision" && !showRevision) return false;
      if (taskType === "redo" && !showRedo) return false;
      if (isTaskCompleted(task) && !showCompleted) return false;

      const taskTargetDateKey = String(task.target_date || "").slice(0, 10);
      if (targetDateFrom && (!taskTargetDateKey || taskTargetDateKey < targetDateFrom)) return false;
      if (targetDateTo && (!taskTargetDateKey || taskTargetDateKey > targetDateTo)) return false;
      return true;
    })
  ), [isArtDirector, searchQuery, selectedClientIds, selectedDesignerIds, showCompleted, showOriginal, showRedo, showRevision, targetDateFrom, targetDateTo, tasks]);

  const columns = useMemo(
    () => buildColumns(filteredTasks, "", currentViewConfig.columns, viewMode),
    [currentViewConfig.columns, filteredTasks, viewMode],
  );

  const totalVisibleTasks = columns.reduce((sum, column) => sum + column.tasks.length, 0);

  function toggleClientFilter(clientId) {
    setSelectedClientIds((prev) => (prev.includes(clientId) ? prev.filter((value) => value !== clientId) : [...prev, clientId]));
  }

  function toggleDesignerFilter(designerId) {
    setSelectedDesignerIds((prev) => (prev.includes(designerId) ? prev.filter((value) => value !== designerId) : [...prev, designerId]));
  }

  function resetFilters() {
    setSearchQuery("");
    setSelectedClientIds([]);
    setSelectedDesignerIds([]);
    setClientFilterQuery("");
    setDesignerFilterQuery("");
    setTargetDateFrom("");
    setTargetDateTo("");
    setShowOriginal(true);
    setShowRevision(true);
    setShowRedo(true);
    setShowCompleted(true);
  }

  async function moveTaskToColumn(taskId, destinationColumnId) {
    const existingTask = tasks.find((task) => String(task.id) === String(taskId));
    if (!existingTask || getTaskWorkflowColumn(existingTask, viewMode) === destinationColumnId) {
      return;
    }

    setSavingTaskId(String(taskId));

    const patchPayload = { stage: destinationColumnId };

    const previousTasks = tasks;
    setTasks((current) =>
      current.map((task) => (
        String(task.id) === String(taskId)
          ? { ...task, ...patchPayload }
          : task
      )),
    );

    try {
      const updatedTask = await superboardApi.tasks.patch(taskId, patchPayload);
      setTasks((current) =>
        current.map((task) => (
          String(task.id) === String(taskId)
            ? { ...task, ...updatedTask }
            : task
        )),
      );
    } catch (saveError) {
      setTasks(previousTasks);
      toast.error(saveError.message || "Failed to update task stage.");
    } finally {
      setSavingTaskId("");
    }
  }

  async function handleDragEnd(result) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    if (!draggableId.startsWith("task-")) return;

    const taskId = draggableId.replace("task-", "");
    await moveTaskToColumn(taskId, destination.droppableId);
  }

  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader
            title={currentViewConfig.title}
            actions={(
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setFilterDrawerOpen(true)}>
                  <Filter className="h-4 w-4" />
                  Search & Filter
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => loadKanbanData({ silent: true })}
                  disabled={refreshing || loading}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            )}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-4 lg:p-6">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={`Search ${currentMonthLabel} tasks by task, client, designer, or type of work`}
                className="w-full max-w-2xl rounded-full bg-white"
              />
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <Badge variant="outline" className="rounded-full border-slate-300 bg-white px-3 py-1 text-slate-600">{totalVisibleTasks} visible</Badge>
                <Badge variant="outline" className="rounded-full border-slate-300 bg-white px-3 py-1 text-slate-600">{currentMonthLabel}</Badge>
                <Badge variant="outline" className="rounded-full border-slate-300 bg-white px-3 py-1 text-slate-600">{currentViewConfig.columns.length} columns</Badge>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-slate-200 bg-white/80">
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  Loading kanban board...
                </div>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">{error}</div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="kanban-scroll min-w-0 overflow-x-auto px-1 pb-4 [scrollbar-gutter:stable_both-edges]">
                  <div className="flex min-w-max items-start gap-3 pl-1 pr-6">
                    {columns.map((column) => (
                      <KanbanColumn key={column.id} column={column} isSaving={column.tasks.some((task) => String(task.id) === savingTaskId)} />
                    ))}
                  </div>
                </div>
              </DragDropContext>
            )}
          </div>
        </SidebarInset>
        <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
          <SheetContent side="right" className="flex h-full flex-col overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[768px]">
            <SheetHeader className="border-b border-border px-6 py-6">
              <SheetTitle>Search & Filter</SheetTitle>
              <SheetDescription>Refine the Kanban by task, client, designer, target date, and task type.</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-5 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                <div className="space-y-2">
                  <Label htmlFor="kanban-search" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Search by Task Name
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="kanban-search" placeholder="Search tasks by name..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-11 rounded-xl bg-background pl-10 shadow-sm" />
                  </div>
                </div>

                {clientOptions.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Filter by Client</Label>
                    <div className="relative" ref={clientFilterRef}>
                      <div role="button" tabIndex={0} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left shadow-sm transition hover:bg-muted/40" onClick={() => setClientFilterOpen((open) => !open)} onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setClientFilterOpen((open) => !open);
                        }
                      }}>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          {selectedClientValues.length > 0 ? selectedClientValues.map((client) => (
                            <Badge key={client.id} variant="secondary" className="h-8 rounded-full px-3 text-sm">
                              <span className="truncate max-w-44">{client.name}</span>
                              <button type="button" className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground" onClick={(event) => {
                                event.stopPropagation();
                                toggleClientFilter(client.id);
                              }}>
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          )) : <span className="text-sm text-muted-foreground">Select clients</span>}
                        </div>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${clientFilterOpen ? "rotate-180" : ""}`} />
                      </div>
                      {clientFilterOpen ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-border bg-popover p-3 shadow-xl">
                          <Input value={clientFilterQuery} onChange={(event) => setClientFilterQuery(event.target.value)} placeholder="Search clients..." className="h-10 rounded-lg" />
                          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                            {visibleClientOptions.map((client) => {
                              const isChecked = selectedClientIds.includes(client.id);
                              return (
                                <div key={client.id} role="button" tabIndex={0} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-muted" onClick={() => toggleClientFilter(client.id)} onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    toggleClientFilter(client.id);
                                  }
                                }}>
                                  <div className="flex items-center gap-3">
                                    <Checkbox checked={isChecked} tabIndex={-1} className="pointer-events-none" />
                                    <span className="text-sm font-medium text-foreground">{client.name}</span>
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

                {isArtDirector ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Filter by Designer</Label>
                    <div className="relative" ref={designerFilterRef}>
                      <div role="button" tabIndex={0} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left shadow-sm transition hover:bg-muted/40" onClick={() => setDesignerFilterOpen((open) => !open)} onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setDesignerFilterOpen((open) => !open);
                        }
                      }}>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          {selectedDesignerValues.length > 0 ? selectedDesignerValues.map((designer) => (
                            <Badge key={designer.id} variant="secondary" className="h-8 rounded-full px-3 text-sm">
                              <span className="truncate max-w-44">{designer.name}</span>
                              <button type="button" className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground" onClick={(event) => {
                                event.stopPropagation();
                                toggleDesignerFilter(designer.id);
                              }}>
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          )) : <span className="text-sm text-muted-foreground">Select designers</span>}
                        </div>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${designerFilterOpen ? "rotate-180" : ""}`} />
                      </div>
                      {designerFilterOpen ? (
                        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-border bg-popover p-3 shadow-xl">
                          <Input value={designerFilterQuery} onChange={(event) => setDesignerFilterQuery(event.target.value)} placeholder="Search designers..." className="h-10 rounded-lg" />
                          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                            {visibleDesignerOptions.map((designer) => {
                              const isChecked = selectedDesignerIds.includes(designer.id);
                              return (
                                <div key={designer.id} role="button" tabIndex={0} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-muted" onClick={() => toggleDesignerFilter(designer.id)} onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    toggleDesignerFilter(designer.id);
                                  }
                                }}>
                                  <div className="flex items-center gap-3">
                                    <Checkbox checked={isChecked} tabIndex={-1} className="pointer-events-none" />
                                    <span className="text-sm font-medium text-foreground">{designer.name}</span>
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="kanban-target-date-from" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Target Date From</Label>
                    <Input id="kanban-target-date-from" type="date" value={targetDateFrom} onChange={(event) => setTargetDateFrom(event.target.value)} className="h-11 rounded-xl bg-background shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kanban-target-date-to" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Target Date To</Label>
                    <Input id="kanban-target-date-to" type="date" value={targetDateTo} onChange={(event) => setTargetDateTo(event.target.value)} className="h-11 rounded-xl bg-background shadow-sm" />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Show Task Types</p>
                  <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3">
                    <Checkbox checked={showOriginal} onCheckedChange={(checked) => setShowOriginal(Boolean(checked))} />
                    <span className="text-sm text-foreground">Show original tasks</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3">
                    <Checkbox checked={showRevision} onCheckedChange={(checked) => setShowRevision(Boolean(checked))} />
                    <span className="text-sm text-foreground">Show revision tasks</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3">
                    <Checkbox checked={showRedo} onCheckedChange={(checked) => setShowRedo(Boolean(checked))} />
                    <span className="text-sm text-foreground">Show redo tasks</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3">
                    <Checkbox checked={showCompleted} onCheckedChange={(checked) => setShowCompleted(Boolean(checked))} />
                    <span className="text-sm text-foreground">Show completed tasks</span>
                  </label>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={resetFilters}>
                    Clear all filters
                  </Button>
                  <Button type="button" className="rounded-xl" onClick={() => setFilterDrawerOpen(false)}>
                    Show {filteredTasks.length} task(s)
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <Toaster richColors />
      </SidebarProvider>
    </TooltipProvider>
  );
}
