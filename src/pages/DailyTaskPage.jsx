import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Editor } from "@/components/blocks/editor-00/editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ChevronDown, Download, Filter, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

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
const EMPTY_EDITOR_STATE = {
  root: {
    children: [
      {
        children: [],
        direction: null,
        format: "",
        indent: 0,
        type: "paragraph",
        version: 1,
      },
    ],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
};

const EMPTY_TASK_FORM = {
  id: null,
  clientId: "",
  scopeOfWorkId: "",
  revisionOfId: "",
  redoOfId: "",
  revisionType: "",
  taskName: "",
  instructions: "",
  instructionsSerialized: EMPTY_EDITOR_STATE,
  instructionsByArtDirector: "",
  instructionsByArtDirectorSerialized: EMPTY_EDITOR_STATE,
  priority: "medium",
  designerId: "",
  typeOfWorkId: "",
  slides: "1",
  targetDate: new Date().toISOString().slice(0, 10),
  excellence: "",
  excellenceReason: "",
  isMarkedCompletedBySuperadmin: false,
  isMarkedCompletedByAccountPlanner: false,
  isMarkedCompletedByArtDirector: false,
  isMarkedCompletedByDesigner: false,
  haveMajorChanges: false,
  haveMinorChanges: false,
  negativeRemarkIds: [],
  negativeRemarkLinks: [],
  attachments: [],
  attachmentFiles: [],
};

const EMPTY_INLINE_TYPE_OF_WORK_FORM = {
  workTypeName: "",
  point: "",
};

function getEmptyInlineTypeOfWorkForm(isAccountPlanner = false) {
  return {
    workTypeName: "",
    point: isAccountPlanner ? "0.5" : "",
  };
}

function createSerializedFromText(text) {
  return {
    root: {
      children: [
        {
          children: text
            ? [
                {
                  detail: 0,
                  format: 0,
                  mode: "normal",
                  style: "",
                  text,
                  type: "text",
                  version: 1,
                },
              ]
            : [],
          direction: null,
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        },
      ],
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  };
}

function getClientName(client) {
  return client.name || client.client_name || client.title || `Client #${client.id}`;
}

function getOwnerUserIds(client) {
  if (!Array.isArray(client?.owner_user_ids)) return [];
  return client.owner_user_ids.map((value) => String(value));
}

function getTaskName(task) {
  return task.task_name || task.name || task.title || `Task #${task.id}`;
}

function getTaskPriority(task) {
  const rawPriority = task.priority || "";
  return TASK_PRIORITY_LABELS[rawPriority] || rawPriority || "-";
}

function getTaskPriorityBadgeClass(task) {
  const rawPriority = task?.priority || "";
  return TASK_PRIORITY_BADGE_STYLES[rawPriority] || "border-border bg-background text-foreground";
}

function getAttachmentUrl(attachment) {
  const file = attachment?.file_url || attachment?.file || "";
  if (!file) return "";
  if (file.startsWith("http://") || file.startsWith("https://")) return file;
  return `${API_BASE_URL}${file.startsWith("/") ? file : `/${file}`}`;
}

function getAttachmentName(attachment) {
  const file = attachment?.file_url || attachment?.file || "";
  if (!file) return "Attachment";
  return String(file).split("/").pop() || "Attachment";
}

function truncateFileName(name, maxLength = 32) {
  const value = String(name || "");
  if (value.length <= maxLength) return value;
  const extensionIndex = value.lastIndexOf(".");
  const extension = extensionIndex > 0 ? value.slice(extensionIndex) : "";
  const baseName = extension ? value.slice(0, extensionIndex) : value;
  const available = Math.max(8, maxLength - extension.length - 3);
  return `${baseName.slice(0, available)}...${extension}`;
}

function formatRemarkPoint(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
}

function getOriginalTaskId(task) {
  if (!task) return "";
  return task.id ? String(task.id) : "";
}

function getRedoTaskId(task) {
  if (!task) return "";
  return task.redo_of ? String(task.redo_of) : task.id ? String(task.id) : "";
}

function formatDate(isoDate) {
  if (!isoDate) return "-";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
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

function getTaskServiceCategory(task) {
  return task.service_category_name || task.serviceCategoryName || task.category_name || "-";
}

function getScopeOfWorkLabel(scope) {
  return scope?.service_category_name || scope?.serviceCategoryName || scope?.deliverable_name || `Scope #${scope?.id}`;
}

function getScopeOfWorkIdValue(value) {
  const rawValue = value?.scope_of_work ?? value?.scopeOfWork ?? value?.scope_of_work_id ?? value?.scopeOfWorkId ?? value;
  if (!rawValue) return "";
  if (typeof rawValue === "object") return rawValue?.id ? String(rawValue.id) : "";
  return String(rawValue);
}

function resolveScopeOfWorkId(task, scopeOptions = []) {
  const directId = getScopeOfWorkIdValue(task);
  if (directId) return directId;

  const clientId = String(task?.client || task?.client_id || "");
  const scopeName = String(task?.scope_of_work_name || task?.scopeOfWorkName || "").trim().toLowerCase();
  const serviceCategoryName = String(task?.service_category_name || task?.serviceCategoryName || "").trim().toLowerCase();

  const matchingScope = scopeOptions.find((scope) => {
    const scopeClientId = String(scope?.client || scope?.client_id || "");
    if (clientId && scopeClientId !== clientId) return false;

    const deliverableName = String(scope?.deliverable_name || "").trim().toLowerCase();
    const scopeServiceCategoryName = String(scope?.service_category_name || scope?.serviceCategoryName || "").trim().toLowerCase();

    if (scopeName && deliverableName === scopeName) return true;
    if (scopeName && serviceCategoryName) {
      return deliverableName === scopeName && scopeServiceCategoryName === serviceCategoryName;
    }
    return false;
  });

  return matchingScope?.id ? String(matchingScope.id) : "";
}

function getTaskType(task) {
  if (task?.revision_of) return "revision";
  if (task?.redo_of) return "redo";
  return "original";
}

function getTaskTypeLabel(task) {
  const taskType = typeof task === "string" ? task : getTaskType(task);
  if (taskType === "revision") return "Revision";
  if (taskType === "redo") return "Redo";
  return "Original";
}

function isTaskCompleted(task) {
  return Boolean(task?.is_marked_completed_by_superadmin || task?.is_marked_completed_by_account_planner);
}

function getTaskStartDateKey(task) {
  return String(task?.created_at || "").slice(0, 10);
}

function getTaskCompletionDateKey(task) {
  if (!isTaskCompleted(task)) return "";
  return String(task?.updated_at || task?.created_at || "").slice(0, 10);
}

function getTaskHistoryKind(task) {
  if (task?.revision_of) return "Revision";
  if (task?.redo_of) return "Redo";
  return "Original";
}

function formatDateTime(isoDate) {
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

function TaskHistoryDrawer({ open, onOpenChange, task, items, canDeleteItem, deletingTaskId, onDeleteItem }) {
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
                  {index < items.length - 1 ? (
                    <div className="absolute left-[11px] top-8 h-[calc(100%+0.5rem)] w-px bg-border" />
                  ) : null}
                  <div
                    className={`absolute left-0 top-1.5 h-6 w-6 rounded-full border-4 ${
                      item.isSelected ? "border-primary bg-primary/15" : "border-slate-300 bg-background"
                    }`}
                  />
                  <div
                    className={`rounded-3xl border px-5 py-4 shadow-sm ${
                      item.isSelected ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                    }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={item.isSelected ? "default" : "secondary"} className="rounded-full px-3 py-1">
                          {item.kind}
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          {item.client_name || "-"}
                        </Badge>
                        {item.isSelected ? (
                          <Badge variant="outline" className="rounded-full border-primary/40 px-3 py-1 text-primary">
                            Selected task
                          </Badge>
                        ) : null}
                      </div>
                      {canDeleteItem?.(item) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => onDeleteItem?.(item.id)}
                          disabled={deletingTaskId === String(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete task</span>
                        </Button>
                      ) : null}
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
  attachments,
  negativeRemarkLinks,
  isAccountPlanner,
  isArtDirector,
  isDesigner,
  canEdit,
  canManageTaskFlow,
  hasHistory,
  designerOptions,
  assigningDesigner,
  updatingDesignerCompletion,
  onEdit,
  onAssignDesigner,
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
              <Badge className="rounded-full bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-600">
                Completed
              </Badge>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Instructions/ Brief by Brand</p>
            <p className="mt-2 font-medium text-foreground">{task.instructions || "No instructions added."}</p>
          </div>
          {!isAccountPlanner ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Instructions By Art Director</p>
              <p className="mt-2 font-medium text-foreground">{task.InstructionsByArtDirector || "-"}</p>
            </div>
          ) : null}
          {!isAccountPlanner && !isDesigner && task.excellence_reason ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Excellence Reason</p>
              <p className="mt-2 font-medium text-foreground">{task.excellence_reason}</p>
            </div>
          ) : null}
          {!isDesigner && (isArtDirector || !isAccountPlanner) ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Designer</p>
              {isArtDirector ? (
                <Select
                  value={task.designer ? String(task.designer) : "__unassigned__"}
                  onValueChange={(value) => onAssignDesigner(task, value)}
                  disabled={assigningDesigner}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl border-border/70 bg-background font-medium text-foreground">
                    <SelectValue placeholder="Select designer" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                    {designerOptions.map((user) => (
                      <SelectItem key={String(user.id)} value={String(user.id)}>
                        {user.email || user.username || user.full_name || `User #${user.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="mt-2 font-medium text-foreground">{task.designer_name || "Unassigned"}</p>
              )}
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
          {attachments.length > 0 ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Attachments</p>
              <div className="mt-2 space-y-2">
                {attachments.map((attachment) => (
                  <div key={String(attachment.id)} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <span className="block truncate text-sm font-medium text-foreground">{truncateFileName(getAttachmentName(attachment))}</span>
                    </div>
                    <a
                      href={getAttachmentUrl(attachment)}
                      download
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Download ${getAttachmentName(attachment)}`}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-muted">
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {!isAccountPlanner && !isDesigner && negativeRemarkLinks.length > 0 ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Negative Remarks</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {negativeRemarkLinks.map((link) => (
                  <Badge key={String(link.id)} variant="outline" className="rounded-full px-3 py-1 text-xs">
                    {link.negative_remark_name}
                    {link.point !== undefined && link.point !== null ? ` (${formatRemarkPoint(link.point)})` : ""}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {canEdit || canManageTaskFlow || hasHistory ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {canManageTaskFlow ? (
              <Button type="button" variant="outline" className="rounded-full" onClick={() => onAddRevision(task)}>
                Add revision
              </Button>
            ) : null}
            {canManageTaskFlow ? (
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

export default function DailyTaskPage() {
  const todayKey = new Date().toISOString().slice(0, 10);
  const clientFilterRef = useRef(null);
  const designerFilterRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [scopeOfWorkOptions, setScopeOfWorkOptions] = useState([]);
  const [typeOfWorkOptions, setTypeOfWorkOptions] = useState([]);
  const [negativeRemarkOptions, setNegativeRemarkOptions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskAttachments, setTaskAttachments] = useState([]);
  const [negativeRemarkLinks, setNegativeRemarkLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("create");
  const [savingTask, setSavingTask] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);
  const [deletingHistoryTaskId, setDeletingHistoryTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [inlineTypeOfWorkOpen, setInlineTypeOfWorkOpen] = useState(false);
  const [inlineTypeOfWorkForm, setInlineTypeOfWorkForm] = useState(EMPTY_INLINE_TYPE_OF_WORK_FORM);
  const [savingInlineTypeOfWork, setSavingInlineTypeOfWork] = useState(false);
  const [assigningDesignerTaskId, setAssigningDesignerTaskId] = useState(null);
  const [updatingDesignerCompletionTaskId, setUpdatingDesignerCompletionTaskId] = useState(null);
  const [deletingTaskAttachmentId, setDeletingTaskAttachmentId] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [selectedDesignerIds, setSelectedDesignerIds] = useState([]);
  const [clientFilterOpen, setClientFilterOpen] = useState(false);
  const [clientFilterQuery, setClientFilterQuery] = useState("");
  const [designerFilterOpen, setDesignerFilterOpen] = useState(false);
  const [designerFilterQuery, setDesignerFilterQuery] = useState("");
  const [dateFrom, setDateFrom] = useState(todayKey);
  const [dateTo, setDateTo] = useState(todayKey);
  const [targetDateFrom, setTargetDateFrom] = useState("");
  const [targetDateTo, setTargetDateTo] = useState("");
  const [showOriginal, setShowOriginal] = useState(true);
  const [showRevision, setShowRevision] = useState(true);
  const [showRedo, setShowRedo] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTaskId, setHistoryTaskId] = useState(null);

  const currentUserId = String(currentUser?.id || currentUser?.user_id || "");
  const currentUserRole = currentUser?.role || "";
  const isSuperuser = currentUserRole === "superuser";
  const isAccountPlanner = currentUserRole === "account_planner";
  const isArtDirector = currentUserRole === "art_director";
  const isDesigner = currentUserRole === "designer";
  const isDesignerEditMode = drawerMode === "edit" && isDesigner;
  const isReadOnlyTaskForm = isDesignerEditMode;
  const canManageTypeOfWork = Boolean(currentUserRole);
  const canViewPoints = !isAccountPlanner && !isArtDirector && !isDesigner;
  const canEditExcellence = drawerMode === "edit" && (isArtDirector || isSuperuser);
  const accountPlannerCompletionBlocked =
    isAccountPlanner &&
    (!taskForm.isMarkedCompletedByArtDirector || !taskForm.isMarkedCompletedByDesigner);
  const artDirectorCompletionBlocked = isArtDirector && !taskForm.isMarkedCompletedByDesigner;
  const canToggleSuperadminCompletion = isSuperuser;
  const canToggleAccountPlannerCompletion =
    isSuperuser || (isAccountPlanner && !accountPlannerCompletionBlocked);
  const canToggleArtDirectorCompletion =
    isSuperuser || (isArtDirector && !artDirectorCompletionBlocked && !taskForm.isMarkedCompletedByAccountPlanner);
  const canToggleDesignerCompletion =
    isSuperuser ||
    (isDesigner &&
      !taskForm.isMarkedCompletedByArtDirector &&
      !taskForm.isMarkedCompletedByAccountPlanner &&
      !taskForm.isMarkedCompletedBySuperadmin);

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      try {
        setLoading(true);
        setError("");
        const me = await superboardApi.auth.me();
        const [allClients, allUsers, allScopeOfWork, allTypeOfWork, allNegativeRemarks, allTasks, allTaskAttachments, allNegativeRemarkLinks] = await Promise.all([
          superboardApi.clients.listAll({ page_size: 300 }),
          superboardApi.designers.listAll({ page_size: 300 }),
          superboardApi.scopeOfWork.listAll({ page_size: 300 }),
          superboardApi.typeOfWork.listAll({ page_size: 300 }),
          superboardApi.negativeRemarks.listAll({ page_size: 300 }),
          superboardApi.tasks.listAll({ page_size: 300 }),
          superboardApi.taskAttachments.listAll({ page_size: 1000 }),
          superboardApi.negativeRemarksOnTask.listAll({ page_size: 1000 }),
        ]);

        if (cancelled) return;
        setCurrentUser(me);
        setClients([...allClients].sort((a, b) => getClientName(a).localeCompare(getClientName(b))));
        setUsers(allUsers);
        setScopeOfWorkOptions(Array.isArray(allScopeOfWork) ? allScopeOfWork : []);
        setTypeOfWorkOptions(allTypeOfWork);
        setNegativeRemarkOptions(Array.isArray(allNegativeRemarks) ? allNegativeRemarks : []);
        setTasks(allTasks);
        setTaskAttachments(Array.isArray(allTaskAttachments) ? allTaskAttachments : []);
        setNegativeRemarkLinks(Array.isArray(allNegativeRemarkLinks) ? allNegativeRemarkLinks : []);
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError.message || "Failed to load daily tasks.";
        setError(message);
        toast.error(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPage();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

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
    if (isDesigner) return [];
    return clients.filter((client) => getOwnerUserIds(client).includes(currentUserId));
  }, [clients, currentUserId, isArtDirector, isDesigner, isSuperuser]);

  const allowedClientIds = useMemo(() => new Set(allowedClients.map((client) => String(client.id))), [allowedClients]);
  const designerOptions = useMemo(() => users, [users]);
  const filteredScopeOfWorkOptions = useMemo(() => {
    if (!taskForm.clientId) return [];
    return scopeOfWorkOptions.filter((item) => String(item.client || item.client_id || "") === String(taskForm.clientId));
  }, [scopeOfWorkOptions, taskForm.clientId]);
  const filteredTypeOfWorkOptions = useMemo(() => typeOfWorkOptions, [typeOfWorkOptions]);
  const canEditTask = useMemo(() => {
    return (task) => {
      if (isSuperuser) return true;
      if (isArtDirector) return true;
      if (isDesigner) return false;
      return allowedClientIds.has(String(task.client || ""));
    };
  }, [allowedClientIds, isArtDirector, isDesigner, isSuperuser]);

  const canDesignerEditTask = useMemo(() => {
    return (task) => isDesigner && String(task?.designer || "") === currentUserId;
  }, [currentUserId, isDesigner]);

  const canOpenTaskEditor = useMemo(() => {
    return (task) => canEditTask(task) || canDesignerEditTask(task);
  }, [canDesignerEditTask, canEditTask]);

  const filterClients = useMemo(() => {
    if (isSuperuser || isArtDirector || isAccountPlanner) {
      return allowedClients;
    }
    const visibleClientIds = new Set(
      tasks
        .filter((task) => String(task.designer || "") === currentUserId)
        .map((task) => String(task.client || ""))
    );
    return clients.filter((client) => visibleClientIds.has(String(client.id)));
  }, [allowedClients, clients, currentUserId, isAccountPlanner, isArtDirector, isSuperuser, tasks]);

  const clientOptions = useMemo(() => {
    return filterClients.map((client) => ({
      id: String(client.id),
      name: getClientName(client),
    }));
  }, [filterClients]);

  const selectedClientValues = useMemo(() => {
    return clientOptions.filter((client) => selectedClientIds.includes(client.id));
  }, [clientOptions, selectedClientIds]);

  const artDirectorDesignerOptions = useMemo(() => {
    return designerOptions.map((designer) => ({
      id: String(designer.id),
      name: designer.email || designer.name || `Designer #${designer.id}`,
    }));
  }, [designerOptions]);

  const selectedDesignerValues = useMemo(() => {
    return artDirectorDesignerOptions.filter((designer) => selectedDesignerIds.includes(designer.id));
  }, [artDirectorDesignerOptions, selectedDesignerIds]);

  const attachmentsByTaskId = useMemo(() => {
    return taskAttachments.reduce((accumulator, attachment) => {
      const key = String(attachment.task || "");
      if (!key) return accumulator;
      if (!accumulator[key]) accumulator[key] = [];
      accumulator[key].push(attachment);
      return accumulator;
    }, {});
  }, [taskAttachments]);
  const negativeRemarkLinksByTaskId = useMemo(() => {
    return negativeRemarkLinks.reduce((accumulator, link) => {
      const key = String(link.task || "");
      if (!key) return accumulator;
      if (!accumulator[key]) accumulator[key] = [];
      accumulator[key].push(link);
      return accumulator;
    }, {});
  }, [negativeRemarkLinks]);

  const visibleClientOptions = useMemo(() => {
    const query = clientFilterQuery.trim().toLowerCase();
    if (!query) return clientOptions;
    return clientOptions.filter((client) => client.name.toLowerCase().includes(query));
  }, [clientFilterQuery, clientOptions]);

  const visibleDesignerOptions = useMemo(() => {
    const query = designerFilterQuery.trim().toLowerCase();
    if (!query) return artDirectorDesignerOptions;
    return artDirectorDesignerOptions.filter((designer) => designer.name.toLowerCase().includes(query));
  }, [artDirectorDesignerOptions, designerFilterQuery]);

  const allFilteredTasks = useMemo(() => {
    const effectiveDateFrom = dateFrom || todayKey;
    const effectiveDateTo = dateTo || todayKey;

    return tasks
      .filter((task) => {
        if (isSuperuser || isArtDirector) return true;
        if (isDesigner) return String(task.designer || "") === currentUserId;
        return allowedClientIds.has(String(task.client || ""));
      })
      .filter((task) => {
        if (searchQuery.trim() !== "") {
          const lowerSearch = searchQuery.toLowerCase();
          const taskName = getTaskName(task).toLowerCase();
          if (!taskName.includes(lowerSearch)) return false;
        }

        if (selectedClientIds.length > 0) {
          if (!selectedClientIds.includes(String(task.client || ""))) return false;
        }
        if (isArtDirector && selectedDesignerIds.length > 0) {
          if (!selectedDesignerIds.includes(String(task.designer || ""))) return false;
        }

        const taskType = getTaskType(task);
        if (taskType === "original" && !showOriginal) return false;
        if (taskType === "revision" && !showRevision) return false;
        if (taskType === "redo" && !showRedo) return false;

        const completed = isTaskCompleted(task);
        if (completed && !showCompleted) return false;

        const taskStartDateKey = getTaskStartDateKey(task);
        if (!taskStartDateKey) return false;
        if (effectiveDateFrom && taskStartDateKey < effectiveDateFrom) return false;
        if (effectiveDateTo && taskStartDateKey > effectiveDateTo) return false;

        const taskTargetDateKey = String(task.target_date || "").slice(0, 10);
        if (targetDateFrom) {
          if (!taskTargetDateKey || taskTargetDateKey < targetDateFrom) return false;
        }
        if (targetDateTo) {
          if (!taskTargetDateKey || taskTargetDateKey > targetDateTo) return false;
        }
        return true;
      })
      .sort((left, right) => {
        const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
        const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
        return rightTime - leftTime;
      });
  }, [
    allowedClientIds,
    currentUserId,
    dateFrom,
    dateTo,
    isArtDirector,
    isDesigner,
    isSuperuser,
    selectedDesignerIds,
    selectedClientIds,
    searchQuery,
    targetDateFrom,
    targetDateTo,
    showCompleted,
    showOriginal,
    showRedo,
    showRevision,
    todayKey,
    tasks,
  ]);

  const taskById = useMemo(() => {
    const entries = tasks.map((task) => [String(task.id), task]);
    return new Map(entries);
  }, [tasks]);

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
          kind: getTaskHistoryKind(item),
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

  function openCreateTask() {
    if (isDesigner) {
      toast.error("Designers cannot create tasks from Daily Task.");
      return;
    }

    setDrawerMode("create");
    setTaskForm({
      ...EMPTY_TASK_FORM,
      clientId: String(allowedClients[0]?.id || ""),
      targetDate: todayKey,
      negativeRemarkIds: [],
      negativeRemarkLinks: [],
      attachments: [],
      attachmentFiles: [],
    });
    setInlineTypeOfWorkOpen(false);
    setInlineTypeOfWorkForm(getEmptyInlineTypeOfWorkForm(isAccountPlanner));
    setCreateOpen(true);
  }

  function openCreateRevisionTask(task) {
    if (!canEditTask(task)) {
      toast.error("You do not have permission to create a revision for this task.");
      return;
    }

    setDrawerMode("create");
    setTaskForm({
      ...EMPTY_TASK_FORM,
      clientId: String(task.client || ""),
      scopeOfWorkId: resolveScopeOfWorkId(task, scopeOfWorkOptions),
      revisionOfId: getOriginalTaskId(task),
      redoOfId: "",
      taskName: task.task_name || "",
      instructions: task.instructions || "",
      instructionsSerialized: createSerializedFromText(task.instructions || ""),
      instructionsByArtDirector: task.InstructionsByArtDirector || "",
      instructionsByArtDirectorSerialized: createSerializedFromText(task.InstructionsByArtDirector || ""),
      revisionType: task.revision_type || "",
      priority: task.priority || "medium",
      designerId: task.designer ? String(task.designer) : "",
      typeOfWorkId: task.type_of_work ? String(task.type_of_work) : "",
      slides: task.slides === null || task.slides === undefined || task.slides === "" ? "1" : String(task.slides),
      targetDate: task.target_date || todayKey,
      excellence:
        task.excellence === null || task.excellence === undefined || task.excellence === ""
          ? ""
          : String(task.excellence),
      excellenceReason: "",
      isMarkedCompletedBySuperadmin: false,
      isMarkedCompletedByAccountPlanner: false,
      isMarkedCompletedByArtDirector: false,
      isMarkedCompletedByDesigner: false,
      haveMajorChanges: false,
      haveMinorChanges: false,
      negativeRemarkIds: [],
      negativeRemarkLinks: [],
      attachments: [],
      attachmentFiles: [],
    });
    setInlineTypeOfWorkOpen(false);
    setInlineTypeOfWorkForm(getEmptyInlineTypeOfWorkForm(isAccountPlanner));
    setCreateOpen(true);
  }

  function openCreateRedoTask(task) {
    if (!canEditTask(task)) {
      toast.error("You do not have permission to create a redo for this task.");
      return;
    }

    setDrawerMode("create");
    setTaskForm({
      ...EMPTY_TASK_FORM,
      clientId: String(task.client || ""),
      scopeOfWorkId: resolveScopeOfWorkId(task, scopeOfWorkOptions),
      revisionOfId: "",
      redoOfId: getRedoTaskId(task),
      taskName: task.task_name || "",
      instructions: task.instructions || "",
      instructionsSerialized: createSerializedFromText(task.instructions || ""),
      instructionsByArtDirector: task.InstructionsByArtDirector || "",
      instructionsByArtDirectorSerialized: createSerializedFromText(task.InstructionsByArtDirector || ""),
      revisionType: "",
      priority: task.priority || "medium",
      designerId: task.designer ? String(task.designer) : "",
      typeOfWorkId: task.type_of_work ? String(task.type_of_work) : "",
      slides: task.slides === null || task.slides === undefined || task.slides === "" ? "1" : String(task.slides),
      targetDate: task.target_date || todayKey,
      excellence:
        task.excellence === null || task.excellence === undefined || task.excellence === ""
          ? ""
          : String(task.excellence),
      excellenceReason: "",
      isMarkedCompletedBySuperadmin: false,
      isMarkedCompletedByAccountPlanner: false,
      isMarkedCompletedByArtDirector: false,
      isMarkedCompletedByDesigner: false,
      haveMajorChanges: false,
      haveMinorChanges: false,
      negativeRemarkIds: [],
      negativeRemarkLinks: [],
      attachments: [],
      attachmentFiles: [],
    });
    setInlineTypeOfWorkOpen(false);
    setInlineTypeOfWorkForm(getEmptyInlineTypeOfWorkForm(isAccountPlanner));
    setCreateOpen(true);
  }

  async function openEditTask(task) {
    if (!canOpenTaskEditor(task)) {
      toast.error("You do not have permission to edit this task.");
      return;
    }

    setDrawerMode("edit");
    const existingRemarkLinks = negativeRemarkLinksByTaskId[String(task.id)] || [];
    try {
      const [retrievedTask, attachments] = await Promise.all([
        superboardApi.tasks.retrieve(task.id),
        superboardApi.taskAttachments.listAll({ task: task.id, page_size: 100 }),
      ]);

      setTaskForm({
        id: retrievedTask.id,
        clientId: String(retrievedTask.client || task.client || ""),
        scopeOfWorkId: getScopeOfWorkIdValue(retrievedTask),
        revisionOfId: retrievedTask.revision_of ? String(retrievedTask.revision_of) : "",
        redoOfId: retrievedTask.redo_of ? String(retrievedTask.redo_of) : "",
        taskName: retrievedTask.task_name || "",
        instructions: retrievedTask.instructions || "",
        instructionsSerialized: createSerializedFromText(retrievedTask.instructions || ""),
        instructionsByArtDirector: retrievedTask.InstructionsByArtDirector || "",
        instructionsByArtDirectorSerialized: createSerializedFromText(retrievedTask.InstructionsByArtDirector || ""),
        revisionType: retrievedTask.revision_type || "",
        priority: retrievedTask.priority || "medium",
        designerId: retrievedTask.designer ? String(retrievedTask.designer) : "",
        typeOfWorkId: retrievedTask.type_of_work ? String(retrievedTask.type_of_work) : "",
        slides:
          retrievedTask.slides === null || retrievedTask.slides === undefined || retrievedTask.slides === ""
            ? "1"
            : String(retrievedTask.slides),
        targetDate: retrievedTask.target_date || todayKey,
        excellence:
          retrievedTask.excellence === null || retrievedTask.excellence === undefined || retrievedTask.excellence === ""
            ? ""
            : String(retrievedTask.excellence),
        excellenceReason: retrievedTask.excellence_reason || "",
        isMarkedCompletedBySuperadmin: Boolean(retrievedTask.is_marked_completed_by_superadmin),
        isMarkedCompletedByAccountPlanner: Boolean(retrievedTask.is_marked_completed_by_account_planner),
        isMarkedCompletedByArtDirector: Boolean(retrievedTask.is_marked_completed_by_art_director),
        isMarkedCompletedByDesigner: Boolean(retrievedTask.is_marked_completed_by_designer),
        haveMajorChanges: Boolean(retrievedTask.have_major_changes),
        haveMinorChanges: Boolean(retrievedTask.have_minor_changes),
        negativeRemarkIds: existingRemarkLinks.map((link) => String(link.negative_remark)),
        negativeRemarkLinks: existingRemarkLinks,
        attachments: Array.isArray(attachments) ? attachments : [],
        attachmentFiles: [],
      });
    } catch (requestError) {
      toast.error(requestError.message || "Failed to load task details.");
      setTaskForm({
        id: task.id,
        clientId: String(task.client || ""),
        scopeOfWorkId: resolveScopeOfWorkId(task, scopeOfWorkOptions),
        revisionOfId: task.revision_of ? String(task.revision_of) : "",
        redoOfId: task.redo_of ? String(task.redo_of) : "",
        taskName: task.task_name || "",
        instructions: task.instructions || "",
        instructionsSerialized: createSerializedFromText(task.instructions || ""),
        instructionsByArtDirector: task.InstructionsByArtDirector || "",
        instructionsByArtDirectorSerialized: createSerializedFromText(task.InstructionsByArtDirector || ""),
        revisionType: task.revision_type || "",
        priority: task.priority || "medium",
        designerId: task.designer ? String(task.designer) : "",
        typeOfWorkId: task.type_of_work ? String(task.type_of_work) : "",
        slides: task.slides === null || task.slides === undefined || task.slides === "" ? "1" : String(task.slides),
        targetDate: task.target_date || todayKey,
        excellence:
          task.excellence === null || task.excellence === undefined || task.excellence === ""
            ? ""
            : String(task.excellence),
        excellenceReason: task.excellence_reason || "",
        isMarkedCompletedBySuperadmin: Boolean(task.is_marked_completed_by_superadmin),
        isMarkedCompletedByAccountPlanner: Boolean(task.is_marked_completed_by_account_planner),
        isMarkedCompletedByArtDirector: Boolean(task.is_marked_completed_by_art_director),
        isMarkedCompletedByDesigner: Boolean(task.is_marked_completed_by_designer),
        haveMajorChanges: Boolean(task.have_major_changes),
        haveMinorChanges: Boolean(task.have_minor_changes),
        negativeRemarkIds: existingRemarkLinks.map((link) => String(link.negative_remark)),
        negativeRemarkLinks: existingRemarkLinks,
        attachments: [],
        attachmentFiles: [],
      });
    }
    setInlineTypeOfWorkOpen(false);
    setInlineTypeOfWorkForm(getEmptyInlineTypeOfWorkForm(isAccountPlanner));
    setCreateOpen(true);
  }

  async function handleCreateInlineTypeOfWork() {
    const workTypeName = inlineTypeOfWorkForm.workTypeName.trim();
    const point = isAccountPlanner ? "0.5" : inlineTypeOfWorkForm.point.trim();

    if (!workTypeName) {
      toast.error("Work type name is required.");
      return;
    }

    setSavingInlineTypeOfWork(true);
    try {
      const created = await superboardApi.typeOfWork.create({
        work_type_name: workTypeName,
        point: point === "" ? 0 : Number(point),
      });
      const allTypeOfWork = await superboardApi.typeOfWork.listAll({ page_size: 300 });
      setTypeOfWorkOptions(allTypeOfWork);
      setTaskForm((prev) => ({ ...prev, typeOfWorkId: String(created.id) }));
      setInlineTypeOfWorkForm(getEmptyInlineTypeOfWorkForm(isAccountPlanner));
      setInlineTypeOfWorkOpen(false);
      toast.success("Type of work created successfully.");
    } catch (requestError) {
      toast.error(requestError.message || "Failed to create type of work.");
    } finally {
      setSavingInlineTypeOfWork(false);
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault();

    const trimmedTaskName = taskForm.taskName.trim();
    if (!taskForm.clientId) {
      toast.error("Client is required.");
      return;
    }
    if (!trimmedTaskName) {
      toast.error("Task name is required.");
      return;
    }
    if (!taskForm.scopeOfWorkId && !taskForm.revisionOfId && !taskForm.redoOfId) {
      toast.error("Scope Of Work is required.");
      return;
    }
    if (isRevisionTaskForm && !taskForm.haveMajorChanges && !taskForm.haveMinorChanges) {
      toast.error("Revision changes are required.");
      return;
    }

    setSavingTask(true);
    try {
      const isRevisionCreate = drawerMode !== "edit" && Boolean(taskForm.revisionOfId);
      const isRedoCreate = drawerMode !== "edit" && Boolean(taskForm.redoOfId);
      const payload = {
        client: Number(taskForm.clientId),
        scope_of_work: taskForm.scopeOfWorkId ? Number(taskForm.scopeOfWorkId) : null,
        task_name: trimmedTaskName,
        instructions: taskForm.instructions,
        priority: taskForm.priority,
        type_of_work: taskForm.typeOfWorkId ? Number(taskForm.typeOfWorkId) : null,
        slides: taskForm.slides ? Number(taskForm.slides) : 1,
        revision_type: taskForm.revisionType || "",
        target_date: taskForm.targetDate || todayKey,
      };

      if (taskForm.revisionOfId) {
        payload.revision_of = Number(taskForm.revisionOfId);
        if (drawerMode === "edit") payload.redo_of = null;
      } else if (taskForm.redoOfId) {
        payload.redo_of = Number(taskForm.redoOfId);
        if (drawerMode === "edit") payload.revision_of = null;
      } else if (drawerMode === "edit") {
        payload.revision_of = null;
        payload.redo_of = null;
      }

      if (!isAccountPlanner) {
        payload.InstructionsByArtDirector = taskForm.instructionsByArtDirector || null;
        payload.designer = taskForm.designerId ? Number(taskForm.designerId) : null;
      }

      if (canEditExcellence) {
        payload.excellence = taskForm.excellence ? Number(taskForm.excellence) : null;
        payload.excellence_reason = taskForm.excellenceReason.trim() || null;
      }

      if (isRevisionTaskForm) {
        payload.have_major_changes = taskForm.haveMajorChanges;
        payload.have_minor_changes = taskForm.haveMinorChanges;
      }

      if (drawerMode === "edit") {
        if (isSuperuser) {
          payload.is_marked_completed_by_superadmin = taskForm.isMarkedCompletedBySuperadmin;
          payload.is_marked_completed_by_account_planner = taskForm.isMarkedCompletedByAccountPlanner;
          payload.is_marked_completed_by_art_director = taskForm.isMarkedCompletedByArtDirector;
          payload.is_marked_completed_by_designer = taskForm.isMarkedCompletedByDesigner;
        } else if (isAccountPlanner) {
          payload.is_marked_completed_by_account_planner = taskForm.isMarkedCompletedByAccountPlanner;
        } else if (isArtDirector) {
          payload.is_marked_completed_by_art_director = taskForm.isMarkedCompletedByArtDirector;
        } else if (isDesigner) {
          payload.is_marked_completed_by_designer = taskForm.isMarkedCompletedByDesigner;
        }
      }

      if (drawerMode === "edit" && taskForm.id) {
        const updatedTask = await superboardApi.tasks.patch(taskForm.id, payload);
        const taskId = updatedTask?.id || taskForm.id;
        const selectedRemarkIds = new Set(taskForm.negativeRemarkIds.map(String));
        const existingRemarkLinks = taskForm.negativeRemarkLinks || [];
        await Promise.all(
          existingRemarkLinks
            .filter((link) => !selectedRemarkIds.has(String(link.negative_remark)))
            .map((link) => superboardApi.negativeRemarksOnTask.remove(link.id)),
        );
        await Promise.all(
          Array.from(selectedRemarkIds)
            .filter((remarkId) => !existingRemarkLinks.some((link) => String(link.negative_remark) === String(remarkId)))
            .map((remarkId) =>
              superboardApi.negativeRemarksOnTask.create({
                task: taskId,
                negative_remark: Number(remarkId),
              }),
            ),
        );
        toast.success("Task updated successfully.");
      } else {
        const createdTask = await superboardApi.tasks.create(payload);
        const taskId = createdTask?.id;
        if (taskForm.negativeRemarkIds.length > 0) {
          await Promise.all(
            taskForm.negativeRemarkIds.map((remarkId) =>
              superboardApi.negativeRemarksOnTask.create({
                task: taskId,
                negative_remark: Number(remarkId),
              }),
            ),
          );
        }
        if (taskForm.attachmentFiles.length > 0) {
          await Promise.all(
            taskForm.attachmentFiles.map(async (file) => {
              const formData = new FormData();
              formData.append("task", String(taskId));
              formData.append("file", file);
              await superboardApi.taskAttachments.create(formData);
            }),
          );
        }
        toast.success(
          isRevisionCreate ? "Revision created successfully." : isRedoCreate ? "Redo created successfully." : "Task created successfully.",
        );
        if (taskForm.attachmentFiles.length > 0) {
          toast.success(
            taskForm.attachmentFiles.length === 1
              ? "Task attachment uploaded successfully."
              : `${taskForm.attachmentFiles.length} task attachments uploaded successfully.`,
          );
        }
      }

      if (drawerMode === "edit" && taskForm.id && taskForm.attachmentFiles.length > 0) {
        await Promise.all(
          taskForm.attachmentFiles.map(async (file) => {
            const formData = new FormData();
            formData.append("task", String(taskForm.id));
            formData.append("file", file);
            await superboardApi.taskAttachments.create(formData);
          }),
        );
        toast.success(
          taskForm.attachmentFiles.length === 1
            ? "Task attachment uploaded successfully."
            : `${taskForm.attachmentFiles.length} task attachments uploaded successfully.`,
        );
      }
      setCreateOpen(false);
      setTaskForm(EMPTY_TASK_FORM);
      setDrawerMode("create");
      setReloadTick((value) => value + 1);
    } catch (requestError) {
      const isRevisionCreate = drawerMode !== "edit" && Boolean(taskForm.revisionOfId);
      const isRedoCreate = drawerMode !== "edit" && Boolean(taskForm.redoOfId);
      toast.error(
        requestError.message ||
          (isRevisionCreate ? "Failed to create revision." : isRedoCreate ? "Failed to create redo." : "Failed to create task."),
      );
    } finally {
      setSavingTask(false);
    }
  }

  async function handleDeleteTask() {
    if (drawerMode !== "edit" || !taskForm.id) return;

    const confirmed = window.confirm("Delete this task? This action cannot be undone.");
    if (!confirmed) return;

    setDeletingTask(true);
    try {
      await superboardApi.tasks.remove(taskForm.id);
      toast.success("Task deleted successfully.");
      setCreateOpen(false);
      setTaskForm(EMPTY_TASK_FORM);
      setDrawerMode("create");
      setReloadTick((value) => value + 1);
    } catch (requestError) {
      toast.error(requestError.message || "Failed to delete task.");
    } finally {
      setDeletingTask(false);
    }
  }

  async function handleDeleteHistoryTask(taskId) {
    if (!taskId) return;
    const task = taskById.get(String(taskId));
    if (!task || !canEditTask(task)) return;

    const confirmed = window.confirm("Delete this task? This action cannot be undone.");
    if (!confirmed) return;

    setDeletingTask(true);
    setDeletingHistoryTaskId(String(taskId));
    try {
      await superboardApi.tasks.remove(taskId);
      toast.success("Task deleted successfully.");
      setHistoryOpen(false);
      setHistoryTaskId(null);
      setReloadTick((value) => value + 1);
    } catch (requestError) {
      toast.error(requestError.message || "Failed to delete task.");
    } finally {
      setDeletingTask(false);
      setDeletingHistoryTaskId(null);
    }
  }

  async function handleDeleteTaskAttachment(attachmentId) {
    if (!attachmentId) return;
    if (!window.confirm("Delete this attachment?")) return;

    setDeletingTaskAttachmentId(String(attachmentId));
    try {
      await superboardApi.taskAttachments.remove(attachmentId);
      setTaskForm((prev) => ({
        ...prev,
        attachments: prev.attachments.filter((attachment) => String(attachment.id) !== String(attachmentId)),
      }));
      toast.success("Attachment deleted successfully.");
    } catch (requestError) {
      toast.error(requestError.message || "Failed to delete attachment.");
    } finally {
      setDeletingTaskAttachmentId(null);
    }
  }

  const isRevisionDrawer = drawerMode !== "edit" && Boolean(taskForm.revisionOfId);
  const isRedoDrawer = drawerMode !== "edit" && Boolean(taskForm.redoOfId);
  const isRevisionTaskForm = Boolean(taskForm.revisionOfId);
  const canManageNegativeRemarks = drawerMode === "edit" && !isAccountPlanner && !isDesigner;
  const drawerTitle = drawerMode === "edit" ? "Edit task" : isRevisionDrawer ? "Create Revision" : isRedoDrawer ? "Create Redo" : "Create task";
  const drawerDescription =
    drawerMode === "edit"
      ? "Update the selected task."
      : isRevisionDrawer
        ? "Create a revision for the selected task."
        : isRedoDrawer
          ? "Create a redo for the selected task."
          : "Create a new task for today.";
  const drawerSubmitLabel = savingTask ? "Saving..." : isRevisionDrawer ? "Create Revision" : isRedoDrawer ? "Create Redo" : "Create task";

  async function handleAssignDesigner(task, designerId) {
    if (!isArtDirector || !task?.id) return;

    const nextDesignerId = designerId === "__unassigned__" ? null : Number(designerId);
    const currentDesignerId = task?.designer ? Number(task.designer) : null;

    if (currentDesignerId === nextDesignerId) return;

    setAssigningDesignerTaskId(String(task.id));
    try {
      await superboardApi.tasks.patch(task.id, {
        designer: nextDesignerId,
      });
      toast.success(nextDesignerId ? "Designer assigned successfully." : "Designer unassigned successfully.");
      setReloadTick((value) => value + 1);
    } catch (requestError) {
      toast.error(requestError.message || "Failed to update designer.");
    } finally {
      setAssigningDesignerTaskId(null);
    }
  }

  async function handleToggleDesignerCompletion(task, checked) {
    if (!canDesignerEditTask(task)) {
      toast.error("You do not have permission to update this task.");
      return;
    }
    if (!canDesignerModifyCompletion(task)) {
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
      toast.error(requestError.message || "Failed to update designer completion.");
    } finally {
      setUpdatingDesignerCompletionTaskId(null);
    }
  }

  function toggleClientFilter(clientId) {
    setSelectedClientIds((prev) => {
      if (prev.includes(clientId)) {
        return prev.filter((value) => value !== clientId);
      }
      return [...prev, clientId];
    });
  }

  function toggleDesignerFilter(designerId) {
    setSelectedDesignerIds((prev) => {
      if (prev.includes(designerId)) {
        return prev.filter((value) => value !== designerId);
      }
      return [...prev, designerId];
    });
  }

  function resetFilters() {
    setSearchQuery("");
    setSelectedClientIds([]);
    setSelectedDesignerIds([]);
    setClientFilterQuery("");
    setDesignerFilterQuery("");
    setDateFrom("");
    setDateTo("");
    setTargetDateFrom("");
    setTargetDateTo("");
    setShowOriginal(true);
    setShowRevision(true);
    setShowRedo(true);
    setShowCompleted(false);
  }

  function openTaskHistory(task) {
    setHistoryTaskId(task?.id || null);
    setHistoryOpen(true);
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader
            title="Daily Task"
            actions={
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setFilterDrawerOpen(true)}>
                  <Search className="h-4 w-4" />
                  Search & Filter
                </Button>
                {!isDesigner ? (
                  <Button type="button" className="rounded-xl" onClick={openCreateTask} disabled={allowedClients.length === 0}>
                    <Plus className="h-4 w-4" />
                    Create Task
                  </Button>
                ) : null}
              </div>
            }
          />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden p-4 lg:p-6">
            <section>
              {loading ? (
                <Card className="rounded-[28px] border border-dashed border-border/80 bg-card/70 shadow-sm">
                  <CardContent className="flex min-h-80 items-center justify-center p-8 text-center text-sm text-muted-foreground">
                    Loading today&apos;s tasks...
                  </CardContent>
                </Card>
              ) : error ? (
                <Card className="rounded-[28px] border border-dashed border-destructive/40 bg-card/70 shadow-sm">
                  <CardContent className="flex min-h-80 items-center justify-center p-8 text-center text-sm text-destructive">
                    {error}
                  </CardContent>
                </Card>
              ) : allFilteredTasks.length === 0 ? (
                <Card className="rounded-[28px] border border-dashed border-border/80 bg-card/70 shadow-sm">
                  <CardContent className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
                    <p className="text-lg font-semibold text-foreground">No tasks found</p>
                    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                      Create a task and it will appear here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {allFilteredTasks.map((task) => (
                    <TaskCard
                      key={String(task.id)}
                      task={task}
                      attachments={attachmentsByTaskId[String(task.id)] || []}
                      negativeRemarkLinks={negativeRemarkLinksByTaskId[String(task.id)] || []}
                      isAccountPlanner={isAccountPlanner}
                      isArtDirector={isArtDirector}
                      isDesigner={isDesigner}
                      canEdit={!isDesigner && canOpenTaskEditor(task)}
                      canManageTaskFlow={canEditTask(task)}
                      hasHistory={taskIdsWithHistory.has(String(task.id))}
                      designerOptions={designerOptions}
                      assigningDesigner={assigningDesignerTaskId === String(task.id)}
                      updatingDesignerCompletion={updatingDesignerCompletionTaskId === String(task.id)}
                      onEdit={openEditTask}
                      onAssignDesigner={handleAssignDesigner}
                      onToggleDesignerCompletion={handleToggleDesignerCompletion}
                      onAddRevision={openCreateRevisionTask}
                      onAddRedo={openCreateRedoTask}
                      onOpenHistory={openTaskHistory}
                    />
                  ))}
                </div>
              )}
            </section>

            <TaskHistoryDrawer
              open={historyOpen}
              onOpenChange={(open) => {
                setHistoryOpen(open);
                if (!open) setHistoryTaskId(null);
              }}
              task={historyTask}
              items={historyItems}
              canDeleteItem={canEditTask}
              deletingTaskId={deletingHistoryTaskId}
              onDeleteItem={handleDeleteHistoryTask}
            />

            <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
              <SheetContent side="right" className="flex h-full flex-col overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[768px]">
                <SheetHeader className="border-b border-border px-6 py-6">
                  <SheetTitle>Search & Filter</SheetTitle>
                  <SheetDescription>Refine the Daily Task list by name, client, designer, created date, target date, and task type.</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <div className="space-y-5 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                    <div className="space-y-2">
                      <Label htmlFor="task-search" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Search by Task Name
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="task-search"
                          placeholder="Search tasks by name..."
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          className="h-11 rounded-xl bg-background pl-10 shadow-sm"
                        />
                      </div>
                    </div>

                    {filterClients.length > 0 ? (
                      <div className="space-y-2">
                        <Label htmlFor="client-filter" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Filter by Client
                        </Label>
                        <div className="relative" ref={clientFilterRef}>
                          <div
                            role="button"
                            tabIndex={0}
                            className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left shadow-sm transition hover:bg-muted/40"
                            onClick={() => setClientFilterOpen((open) => !open)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setClientFilterOpen((open) => !open);
                              }
                            }}>
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                              {selectedClientValues.length > 0 ? (
                                selectedClientValues.map((client) => (
                                  <Badge key={client.id} variant="secondary" className="h-8 rounded-full px-3 text-sm">
                                    <span className="truncate max-w-44">{client.name}</span>
                                    <button
                                      type="button"
                                      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleClientFilter(client.id);
                                      }}>
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-muted-foreground">Select clients</span>
                              )}
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-muted-foreground transition ${clientFilterOpen ? "rotate-180" : ""}`}
                            />
                          </div>

                          {clientFilterOpen ? (
                            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-border bg-popover p-3 shadow-xl">
                              <Input
                                value={clientFilterQuery}
                                onChange={(event) => setClientFilterQuery(event.target.value)}
                                placeholder="Search clients..."
                                className="h-10 rounded-lg"
                              />
                              <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                                {visibleClientOptions.length > 0 ? (
                                  visibleClientOptions.map((client) => {
                                    const isChecked = selectedClientIds.includes(client.id);
                                    return (
                                      <div
                                        key={client.id}
                                        role="button"
                                        tabIndex={0}
                                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-muted"
                                        onClick={() => toggleClientFilter(client.id)}
                                        onKeyDown={(event) => {
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
                                  })
                                ) : (
                                  <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                                    No clients found.
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {isArtDirector ? (
                      <div className="space-y-2">
                        <Label htmlFor="designer-filter" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Filter by Designer
                        </Label>
                        <div className="relative" ref={designerFilterRef}>
                          <div
                            role="button"
                            tabIndex={0}
                            className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-left shadow-sm transition hover:bg-muted/40"
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
                                  <Badge key={designer.id} variant="secondary" className="h-8 rounded-full px-3 text-sm">
                                    <span className="truncate max-w-44">{designer.name}</span>
                                    <button
                                      type="button"
                                      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        toggleDesignerFilter(designer.id);
                                      }}>
                                      <X className="h-3 w-3" />
                                    </button>
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-muted-foreground">Select designers</span>
                              )}
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-muted-foreground transition ${designerFilterOpen ? "rotate-180" : ""}`}
                            />
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
                                {visibleDesignerOptions.length > 0 ? (
                                  visibleDesignerOptions.map((designer) => {
                                    const isChecked = selectedDesignerIds.includes(designer.id);
                                    return (
                                      <div
                                        key={designer.id}
                                        role="button"
                                        tabIndex={0}
                                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-muted"
                                        onClick={() => toggleDesignerFilter(designer.id)}
                                        onKeyDown={(event) => {
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
                                  })
                                ) : (
                                  <div className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                                    No designers found.
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="task-date-from" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Created Date From
                        </Label>
                        <Input
                          id="task-date-from"
                          type="date"
                          value={dateFrom}
                          onChange={(event) => setDateFrom(event.target.value)}
                          className="h-11 rounded-xl bg-background shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-date-to" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Created Date To
                        </Label>
                        <Input
                          id="task-date-to"
                          type="date"
                          value={dateTo}
                          onChange={(event) => setDateTo(event.target.value)}
                          className="h-11 rounded-xl bg-background shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="task-target-date-from" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Target Date From
                        </Label>
                        <Input
                          id="task-target-date-from"
                          type="date"
                          value={targetDateFrom}
                          onChange={(event) => setTargetDateFrom(event.target.value)}
                          className="h-11 rounded-xl bg-background shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-target-date-to" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Target Date To
                        </Label>
                        <Input
                          id="task-target-date-to"
                          type="date"
                          value={targetDateTo}
                          onChange={(event) => setTargetDateTo(event.target.value)}
                          className="h-11 rounded-xl bg-background shadow-sm"
                        />
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
                        Show {allFilteredTasks.length} task(s)
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Sheet
              open={createOpen}
              onOpenChange={(open) => {
                setCreateOpen(open);
                if (!open) {
                  setDrawerMode("create");
                  setTaskForm(EMPTY_TASK_FORM);
                  setInlineTypeOfWorkOpen(false);
                  setInlineTypeOfWorkForm(getEmptyInlineTypeOfWorkForm(isAccountPlanner));
                }
              }}>
              <SheetContent side="right" className="flex h-full w-full flex-col overflow-hidden p-0 data-[side=right]:sm:max-w-[786px]">
                <SheetHeader className="px-6 pt-6">
                  <SheetTitle>{drawerTitle}</SheetTitle>
                  <SheetDescription>{drawerDescription}</SheetDescription>
                </SheetHeader>
                <div className="mt-4 flex-1 overflow-y-auto px-6 pb-6">
                  <form className="space-y-4 rounded-lg border p-3" onSubmit={handleCreateTask}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="task-client">Client</Label>
                        <Select
                          value={taskForm.clientId || undefined}
                          disabled={isReadOnlyTaskForm}
                          onValueChange={(value) =>
                            setTaskForm((prev) => ({
                              ...prev,
                              clientId: value,
                              scopeOfWorkId:
                                scopeOfWorkOptions.some(
                                  (item) =>
                                    String(item.client || "") === String(value) &&
                                    String(item.id) === String(prev.scopeOfWorkId),
                                )
                                  ? prev.scopeOfWorkId
                                  : "",
                            }))
                          }>
                          <SelectTrigger id="task-client" className={`h-9 w-full rounded-md ${isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : ""}`}>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {allowedClients.map((client) => (
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
                          disabled={isReadOnlyTaskForm}
                          onChange={(event) => setTaskForm((prev) => ({ ...prev, taskName: event.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="task-scope-of-work">Scope Of Work</Label>
                      <Select
                        value={taskForm.scopeOfWorkId || "__none__"}
                        disabled={isReadOnlyTaskForm}
                        onValueChange={(value) =>
                          setTaskForm((prev) => ({ ...prev, scopeOfWorkId: value === "__none__" ? "" : value }))
                        }>
                        <SelectTrigger id="task-scope-of-work" className={`h-9 w-full rounded-md ${isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : ""}`}>
                          <SelectValue placeholder="Select scope of work" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value="__none__">No scope selected</SelectItem>
                          {filteredScopeOfWorkOptions.map((item) => (
                            <SelectItem key={String(item.id)} value={String(item.id)}>
                              {getScopeOfWorkLabel(item)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="task-instructions">Instructions / Brief by Brand</Label>
                      {isReadOnlyTaskForm ? (
                        <textarea
                          id="task-instructions"
                          className="min-h-24 w-full rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground"
                          value={taskForm.instructions}
                          disabled
                        />
                      ) : (
                        <Editor
                          editorSerializedState={taskForm.instructionsSerialized}
                          onSerializedChange={(value) => setTaskForm((prev) => ({ ...prev, instructionsSerialized: value }))}
                          onPlainTextChange={(value) => setTaskForm((prev) => ({ ...prev, instructions: value }))}
                        />
                      )}
                    </div>

                    {!isAccountPlanner ? (
                      <div className="space-y-2">
                        <Label htmlFor="task-instructions-by-art-director">Instructions By Art Director</Label>
                        {isReadOnlyTaskForm ? (
                          <textarea
                            id="task-instructions-by-art-director"
                            className="min-h-24 w-full rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground"
                            value={taskForm.instructionsByArtDirector}
                            disabled
                          />
                        ) : (
                          <Editor
                            editorSerializedState={taskForm.instructionsByArtDirectorSerialized}
                            onSerializedChange={(value) =>
                              setTaskForm((prev) => ({ ...prev, instructionsByArtDirectorSerialized: value }))
                            }
                            onPlainTextChange={(value) =>
                              setTaskForm((prev) => ({ ...prev, instructionsByArtDirector: value }))
                            }
                          />
                        )}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                                setInlineTypeOfWorkForm(getEmptyInlineTypeOfWorkForm(isAccountPlanner));
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
                          {filteredTypeOfWorkOptions.map((item) => (
                            <SelectItem key={String(item.id)} value={String(item.id)}>
                              {item.work_type_name}
                            </SelectItem>
                          ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="task-slides">Slides</Label>
                        <Input
                          id="task-slides"
                          type="number"
                          min="1"
                          step="1"
                          value={taskForm.slides}
                          disabled={isReadOnlyTaskForm}
                          onChange={(event) => setTaskForm((prev) => ({ ...prev, slides: event.target.value }))}
                        />
                      </div>

                    </div>

                    {inlineTypeOfWorkOpen ? (
                      <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
                          <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="inline-type-of-work-name">Work Type Name</Label>
                              <Input
                                id="inline-type-of-work-name"
                                value={inlineTypeOfWorkForm.workTypeName}
                                disabled={isReadOnlyTaskForm}
                                onChange={(event) =>
                                  setInlineTypeOfWorkForm((prev) => ({ ...prev, workTypeName: event.target.value }))
                                }
                              />
                            </div>
                            {!isAccountPlanner ? (
                              <div className="space-y-2">
                                <Label htmlFor="inline-type-of-work-point">Point</Label>
                                <Input
                                  id="inline-type-of-work-point"
                                  type="number"
                                  step="any"
                                  value={inlineTypeOfWorkForm.point}
                                  disabled={isReadOnlyTaskForm}
                                  onChange={(event) =>
                                    setInlineTypeOfWorkForm((prev) => ({ ...prev, point: event.target.value }))
                                  }
                                  placeholder="0"
                                />
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-xl"
                              disabled={isReadOnlyTaskForm}
                              onClick={() => {
                                setInlineTypeOfWorkOpen(false);
                                setInlineTypeOfWorkForm(getEmptyInlineTypeOfWorkForm(isAccountPlanner));
                              }}>
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              className="rounded-xl"
                              disabled={savingInlineTypeOfWork || isReadOnlyTaskForm}
                              onClick={handleCreateInlineTypeOfWork}>
                              {savingInlineTypeOfWork ? "Saving..." : "Save Type Of Work"}
                            </Button>
                          </div>
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
                          {designerOptions.map((user) => (
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

                    <div className={`grid grid-cols-1 gap-4 ${canEditExcellence ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
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

                      <div className="space-y-2">
                        <Label htmlFor="task-target-date">Target Date</Label>
                        <Input
                          id="task-target-date"
                          type="date"
                          value={taskForm.targetDate}
                          disabled={isReadOnlyTaskForm}
                          onChange={(event) => setTaskForm((prev) => ({ ...prev, targetDate: event.target.value }))}
                        />
                      </div>

                      {canEditExcellence ? (
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
                      ) : null}
                    </div>

                    {canEditExcellence ? (
                      <div className="space-y-2">
                        <Label htmlFor="task-excellence-reason">Excellence Reason</Label>
                        <textarea
                          id="task-excellence-reason"
                          className={`min-h-24 w-full rounded-md border px-3 py-2 text-sm ${isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : "bg-background"}`}
                          value={taskForm.excellenceReason}
                          disabled={isReadOnlyTaskForm}
                          onChange={(event) => setTaskForm((prev) => ({ ...prev, excellenceReason: event.target.value }))}
                        />
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label htmlFor="task-attachments">Task Attachments</Label>
                      <Input
                        id="task-attachments"
                        type="file"
                        multiple
                        disabled={isReadOnlyTaskForm}
                        onChange={(event) =>
                          setTaskForm((prev) => ({
                            ...prev,
                            attachmentFiles: [...prev.attachmentFiles, ...Array.from(event.target.files || [])],
                          }))
                        }
                      />
                      {taskForm.attachmentFiles.length > 0 ? (
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Selected attachments</p>
                          <div className="mt-2 space-y-2">
                            {taskForm.attachmentFiles.map((file, index) => (
                              <div key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
                                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{file.name}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  disabled={isReadOnlyTaskForm}
                                  onClick={() =>
                                    setTaskForm((prev) => ({
                                      ...prev,
                                      attachmentFiles: prev.attachmentFiles.filter((_, fileIndex) => fileIndex !== index),
                                    }))
                                  }>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {drawerMode === "edit" && taskForm.attachments.length > 0 ? (
                        <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Existing attachments</p>
                          <div className="mt-2 space-y-2">
                            {taskForm.attachments.map((attachment) => (
                              <div key={String(attachment.id)} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
                                <a
                                  href={getAttachmentUrl(attachment)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="min-w-0 flex-1 truncate text-sm text-foreground transition hover:text-primary">
                                  {getAttachmentName(attachment)}
                                </a>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  disabled={String(deletingTaskAttachmentId) === String(attachment.id)}
                                  onClick={() => handleDeleteTaskAttachment(attachment.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {canManageNegativeRemarks ? (
                      <div className="space-y-2">
                        <Label>Negative Remarks</Label>
                        {negativeRemarkOptions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No negative remarks available.</p>
                        ) : (
                          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                            <div className="space-y-2">
                              {negativeRemarkOptions.map((remark) => {
                                const remarkId = String(remark.id);
                                const isChecked = taskForm.negativeRemarkIds.includes(remarkId);
                                return (
                                  <label key={remarkId} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background px-3 py-3">
                                    <Checkbox
                                      checked={isChecked}
                                      disabled={isReadOnlyTaskForm}
                                      onCheckedChange={(checked) =>
                                        setTaskForm((prev) => ({
                                          ...prev,
                                          negativeRemarkIds: Boolean(checked)
                                            ? [...prev.negativeRemarkIds, remarkId]
                                            : prev.negativeRemarkIds.filter((id) => id !== remarkId),
                                        }))
                                      }
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-foreground">
                                        {remark.remark_name}
                                        {remark.point !== undefined && remark.point !== null ? ` (${formatRemarkPoint(remark.point)})` : ""}
                                      </p>
                                      {remark.description ? (
                                        <p className="mt-1 text-xs text-muted-foreground">{remark.description}</p>
                                      ) : null}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {isRevisionTaskForm ? (
                      <div className="space-y-2">
                          <Label>Revision Changes</Label>
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3">
                              <input
                                type="radio"
                                name="task-revision-changes"
                                checked={taskForm.haveMajorChanges}
                                disabled={isReadOnlyTaskForm}
                                onChange={() =>
                                  setTaskForm((prev) => ({
                                    ...prev,
                                    haveMajorChanges: true,
                                    haveMinorChanges: false,
                                  }))
                                }
                              />
                              <span className="text-sm text-foreground">Have major changes</span>
                            </label>
                            <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3">
                              <input
                                type="radio"
                                name="task-revision-changes"
                                checked={taskForm.haveMinorChanges}
                                disabled={isReadOnlyTaskForm}
                                onChange={() =>
                                  setTaskForm((prev) => ({
                                    ...prev,
                                    haveMajorChanges: false,
                                    haveMinorChanges: true,
                                  }))
                                }
                              />
                              <span className="text-sm text-foreground">Have minor changes</span>
                            </label>
                          </div>
                      </div>
                    ) : null}

                    {drawerMode === "edit" ? (
                      <div className="space-y-3 rounded-2xl border border-border/80 bg-muted/20 p-4">
                        <p className="text-sm font-semibold text-foreground">Completion Status</p>
                        <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3">
                          <Checkbox
                            checked={taskForm.isMarkedCompletedBySuperadmin}
                            disabled={isReadOnlyTaskForm || !canToggleSuperadminCompletion}
                            onCheckedChange={(checked) =>
                              setTaskForm((prev) => ({
                                ...prev,
                                isMarkedCompletedBySuperadmin: Boolean(checked),
                              }))
                            }
                          />
                          <span className="text-sm text-foreground">Is marked completed by superadmin</span>
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3">
                          <Checkbox
                            checked={taskForm.isMarkedCompletedByAccountPlanner}
                            disabled={
                              isReadOnlyTaskForm ||
                              !canToggleAccountPlannerCompletion ||
                              (accountPlannerCompletionBlocked && !taskForm.isMarkedCompletedByAccountPlanner)
                            }
                            onCheckedChange={(checked) =>
                              setTaskForm((prev) => ({
                                ...prev,
                                isMarkedCompletedByAccountPlanner: Boolean(checked),
                              }))
                            }
                          />
                          <span className="text-sm text-foreground">Is marked completed by account planner</span>
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
                        <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3">
                          <Checkbox
                            checked={taskForm.isMarkedCompletedByArtDirector}
                            disabled={isReadOnlyTaskForm || !canToggleArtDirectorCompletion}
                            onCheckedChange={(checked) =>
                              setTaskForm((prev) => ({
                                ...prev,
                                isMarkedCompletedByArtDirector: Boolean(checked),
                              }))
                            }
                          />
                          <span className="text-sm text-foreground">Is marked completed by art director</span>
                        </label>
                        <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-3">
                          <Checkbox
                            checked={taskForm.isMarkedCompletedByDesigner}
                            disabled={!canToggleDesignerCompletion}
                            onCheckedChange={(checked) =>
                              setTaskForm((prev) => ({
                                ...prev,
                                isMarkedCompletedByDesigner: Boolean(checked),
                              }))
                            }
                          />
                          <span className="text-sm text-foreground">Is marked completed by designer</span>
                        </label>
                      </div>
                    ) : null}

                    {drawerMode === "edit" ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleDeleteTask}
                          disabled={isReadOnlyTaskForm || savingTask || deletingTask}
                          className="w-full rounded-xl">
                          {deletingTask ? "Deleting..." : "Delete task"}
                        </Button>
                        <Button type="submit" disabled={savingTask || deletingTask} className="w-full rounded-xl">
                          {savingTask ? "Saving..." : "Update task"}
                        </Button>
                      </div>
                    ) : (
                      <Button type="submit" disabled={savingTask} className="w-full rounded-xl">
                        {drawerSubmitLabel}
                      </Button>
                    )}
                  </form>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}
