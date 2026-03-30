import { superboardApi } from "@/api/superboardApi";
import { AppSidebar } from "@/components/app-sidebar";
import { Editor } from "@/components/blocks/editor-00/editor";
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
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Trash2, X } from "lucide-react";
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

const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "pinterest", label: "Pinterest" },
  { value: "snapchat", label: "Snapchat" },
  { value: "threads", label: "Threads" },
  { value: "whatsapp", label: "WhatsApp" },
];
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

function getTaskPlatformLabel(task) {
  const rawValue = String(task?.platform || "");
  if (!rawValue) return "-";
  return PLATFORM_OPTIONS.find((option) => option.value === rawValue)?.label || rawValue;
}

function formatRemarkPoint(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.?0+$/, "");
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

function getTaskDateValue(task) {
  const candidates = [task.target_date, task.created_at];
  return candidates.find((value) => getIsoDateKey(value)) || "";
}

function getTaskCreatedDateKey(task) {
  return getIsoDateKey(task?.created_at);
}

function getTaskTargetDateKey(task) {
  return getIsoDateKey(task?.target_date);
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
  if (task?.stage === "approved" || isTaskCompleted(task)) {
    return "border-emerald-300 bg-emerald-50/60";
  }
  if (task?.stage === "approved_by_art_director_waiting_for_approval") {
    return "border-amber-300 bg-amber-50/60";
  }
  if (task?.stage === "complete") {
    return "border-sky-300 bg-sky-50/60";
  }
  return "border-slate-300 bg-white";
}

function canDesignerModifyCompletion(task) {
  return task?.stage !== "approved_by_art_director_waiting_for_approval" && task?.stage !== "approved";
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
  return task?.stage === "approved";
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
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

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
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={item.isSelected ? "default" : "secondary"} className="rounded-full px-3 py-1">
                          {item.kind}
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          {item.client_name || "-"}
                        </Badge>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Platform</p>
            <p className="mt-2 font-medium text-foreground">{getTaskPlatformLabel(task)}</p>
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
  scopeOfWorkId: "",
  revisionOfId: "",
  redoOfId: "",
  revisionType: "",
  createdBy: "",
  createdByName: "",
  taskName: "",
  instructions: "",
  instructionsSerialized: EMPTY_EDITOR_STATE,
  instructionsByArtDirector: "",
  instructionsByArtDirectorSerialized: EMPTY_EDITOR_STATE,
  priority: "medium",
  designerId: "",
  typeOfWorkId: "",
  platform: "",
  slides: "1",
  impressions: "",
  ctr: "",
  engagementRate: "",
  targetDate: "",
  excellence: "",
  excellenceReason: "",
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

export default function ClientsWorkPage({ headerTitle = "Task Manager" }) {
  const swiperRef = useRef(null);
  const clientFilterRef = useRef(null);
  const designerFilterRef = useRef(null);
  const now = new Date();
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [typeOfWorkOptions, setTypeOfWorkOptions] = useState([]);
  const [negativeRemarkOptions, setNegativeRemarkOptions] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [taskAttachments, setTaskAttachments] = useState([]);
  const [negativeRemarkLinks, setNegativeRemarkLinks] = useState([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [selectedDesignerId, setSelectedDesignerId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
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
  const [deletingHistoryTaskId, setDeletingHistoryTaskId] = useState(null);
  const [deletingTaskAttachmentId, setDeletingTaskAttachmentId] = useState(null);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [inlineTypeOfWorkOpen, setInlineTypeOfWorkOpen] = useState(false);
  const [inlineTypeOfWorkForm, setInlineTypeOfWorkForm] = useState(EMPTY_INLINE_TYPE_OF_WORK_FORM);
  const [updatingDesignerCompletionTaskId, setUpdatingDesignerCompletionTaskId] = useState(null);
  const [originalTaskOptions, setOriginalTaskOptions] = useState([]);
  const [scopeOfWorkOptions, setScopeOfWorkOptions] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTaskId, setHistoryTaskId] = useState(null);
  const [dateFrom, setDateFrom] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`);
  const [dateTo, setDateTo] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`,
  );
  const [targetDateFrom, setTargetDateFrom] = useState("");
  const [targetDateTo, setTargetDateTo] = useState("");
  const [showOriginal, setShowOriginal] = useState(true);
  const [showRevision, setShowRevision] = useState(true);
  const [showRedo, setShowRedo] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [clientFilterOpen, setClientFilterOpen] = useState(false);
  const [clientFilterQuery, setClientFilterQuery] = useState("");
  const [designerFilterOpen, setDesignerFilterOpen] = useState(false);
  const [designerFilterQuery, setDesignerFilterQuery] = useState("");
  const currentUserId = String(currentUser?.id || currentUser?.user_id || "");
  const currentUserRole = currentUser?.role || "";
  const isSuperuser = currentUserRole === "superuser";
  const isAccountPlanner = currentUserRole === "account_planner";
  const isArtDirector = currentUserRole === "art_director";
  const isDesigner = currentUserRole === "designer";
  const isDesignerEditMode = drawerMode === "edit" && currentUserRole === "designer";
  const isArtDirectorReadOnlyTask = false;
  const isReadOnlyTaskForm = isDesignerEditMode || isArtDirectorReadOnlyTask;
  const isRevisionTaskForm = Boolean(taskForm.revisionOfId);
  const canManageTypeOfWork = isSuperuser || currentUserRole === "art_director";
  const canViewPoints = !isAccountPlanner && !isArtDirector && !isDesigner;
  const canEditExcellence = drawerMode === "edit" && (isArtDirector || isSuperuser);
  const accountPlannerCompletionBlocked =
    isAccountPlanner &&
    (!taskForm.isMarkedCompletedByArtDirector || !taskForm.isMarkedCompletedByDesigner);
  const artDirectorCompletionBlocked = isArtDirector && !taskForm.isMarkedCompletedByDesigner;
  const selectedClientId = selectedClientIds[0] || "";

  useEffect(() => {
    let cancelled = false;
    async function loadClients() {
      try {
        setLoadingClients(true);
        setClientsError("");
        const me = await superboardApi.auth.me();
        const rows = await superboardApi.clients.listAll({ page_size: 300 });
        const allUsers = await superboardApi.designers.listAll({ page_size: 300 });
        const allScopeOfWork = await superboardApi.scopeOfWork.listAll({ page_size: 300 });
        const allTypeOfWork = await superboardApi.typeOfWork.listAll({ page_size: 300 });
        const allNegativeRemarks = await superboardApi.negativeRemarks.listAll({ page_size: 300 });
        const sorted = [...rows].sort((a, b) => getClientName(a).localeCompare(getClientName(b)));
        if (cancelled) return;
        setCurrentUser(me);
        setClients(sorted);
        setUsers(allUsers);
        setScopeOfWorkOptions(Array.isArray(allScopeOfWork) ? allScopeOfWork : []);
        setTypeOfWorkOptions(allTypeOfWork);
        setNegativeRemarkOptions(Array.isArray(allNegativeRemarks) ? allNegativeRemarks : []);
        setSelectedClientIds((prev) => {
          const validIds = prev.filter((id) => sorted.some((client) => String(client.id) === String(id)));
          if (validIds.length > 0) return validIds;
          return sorted[0]?.id ? [String(sorted[0].id)] : [];
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

  useEffect(() => {
    let cancelled = false;
    async function loadTasks() {
      if (selectedClientIds.length === 0) {
        setTasks([]);
        return;
      }

      try {
        setLoadingTasks(true);
        setTasksError("");
        const [taskLists, attachments, remarkLinks] = await Promise.all([
          Promise.all(
            selectedClientIds.map((clientId) =>
              superboardApi.tasks.listAll({ client: clientId, page_size: 300 }),
            ),
          ),
          superboardApi.taskAttachments.listAll({ page_size: 1000 }),
          superboardApi.negativeRemarksOnTask.listAll({ page_size: 1000 }),
        ]);

        if (cancelled) return;
        const mergedRows = Array.from(
          new Map(
            taskLists
              .flat()
              .filter((row) => row?.id)
              .map((row) => [String(row.id), row]),
          ).values(),
        );
        setTasks(mergedRows);
        setTaskAttachments(Array.isArray(attachments) ? attachments : []);
        setNegativeRemarkLinks(Array.isArray(remarkLinks) ? remarkLinks : []);
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
  }, [currentUserRole, reloadTick, selectedClientIds]);

  const selectedClient = useMemo(() => {
    return clients.find((client) => String(client.id) === String(selectedClientId)) || null;
  }, [clients, selectedClientId]);
  const clientOptions = useMemo(() => {
    return clients.map((client) => ({
      id: String(client.id),
      name: getClientName(client),
    }));
  }, [clients]);
  const selectedClientValues = useMemo(() => {
    return clientOptions.filter((client) => selectedClientIds.includes(client.id));
  }, [clientOptions, selectedClientIds]);
  const visibleClientOptions = useMemo(() => {
    const query = clientFilterQuery.trim().toLowerCase();
    if (!query) return clientOptions;
    return clientOptions.filter((client) => client.name.toLowerCase().includes(query));
  }, [clientFilterQuery, clientOptions]);
  const filteredScopeOfWorkOptions = useMemo(() => {
    return scopeOfWorkOptions.filter((item) => String(item.client || item.client_id || "") === String(taskForm.clientId));
  }, [scopeOfWorkOptions, taskForm.clientId]);
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
  const visibleDesignerOptions = useMemo(() => {
    const query = designerFilterQuery.trim().toLowerCase();
    if (!query) return designerOptions;
    return designerOptions.filter((designer) => {
      const label = designer.first_name || designer.last_name
        ? `${designer.first_name || ""} ${designer.last_name || ""}`.trim()
        : designer.email || "";
      return label.toLowerCase().includes(query);
    });
  }, [designerFilterQuery, designerOptions]);
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery.trim() !== "") {
        const lowerSearch = searchQuery.toLowerCase();
        const taskName = getTaskName(task).toLowerCase();
        if (!taskName.includes(lowerSearch)) return false;
      }

      if (selectedDesignerId && String(task.designer || "") !== String(selectedDesignerId)) return false;

      const taskType = getTaskStatus(task).toLowerCase();
      if (taskType === "original" && !showOriginal) return false;
      if (taskType === "revision" && !showRevision) return false;
      if (taskType === "redo" && !showRedo) return false;

      const completed = isTaskCompleted(task);
      if (completed && !showCompleted) return false;

      const createdDateKey = getTaskCreatedDateKey(task);
      if (!createdDateKey) return false;
      if (dateFrom && createdDateKey < dateFrom) return false;
      if (dateTo && createdDateKey > dateTo) return false;

      const targetDateKey = getTaskTargetDateKey(task);
      if (targetDateFrom) {
        if (!targetDateKey || targetDateKey < targetDateFrom) return false;
      }
      if (targetDateTo) {
        if (!targetDateKey || targetDateKey > targetDateTo) return false;
      }

      return true;
    });
  }, [
    dateFrom,
    dateTo,
    searchQuery,
    selectedDesignerId,
    showCompleted,
    showOriginal,
    showRedo,
    showRevision,
    targetDateFrom,
    targetDateTo,
    tasks,
  ]);
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

  function resetFilters() {
    setSearchQuery("");
    setSelectedClientIds(clients[0]?.id ? [String(clients[0].id)] : []);
    setClientFilterQuery("");
    setSelectedDesignerId(isDesigner ? currentUserId : "");
    setDesignerFilterQuery("");
    setDateFrom("");
    setDateTo("");
    setTargetDateFrom("");
    setTargetDateTo("");
    setShowOriginal(true);
    setShowRevision(true);
    setShowRedo(true);
    setShowCompleted(true);
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
      scopeOfWorkId: resolveScopeOfWorkId(baseTask, scopeOfWorkOptions),
      createdBy: currentUserId,
      createdByName: currentUser?.email || "",
      revisionOfId: originalTaskId,
      redoOfId: "",
      taskName: baseTask?.task_name || "",
      instructions: baseTask?.instructions || "",
      instructionsSerialized: createSerializedFromText(baseTask?.instructions || ""),
      instructionsByArtDirector: baseTask?.InstructionsByArtDirector || "",
      instructionsByArtDirectorSerialized: createSerializedFromText(baseTask?.InstructionsByArtDirector || ""),
      revisionType: "",
      priority: baseTask?.priority || "medium",
      designerId: baseTask?.designer ? String(baseTask.designer) : "",
      typeOfWorkId: baseTask?.type_of_work ? String(baseTask.type_of_work) : "",
      platform: baseTask?.platform || "",
      slides: baseTask?.slides === null || baseTask?.slides === undefined || baseTask?.slides === "" ? "1" : String(baseTask.slides),
      impressions:
        baseTask?.impressions === null || baseTask?.impressions === undefined || baseTask?.impressions === ""
          ? ""
          : String(baseTask.impressions),
      ctr:
        baseTask?.ctr === null || baseTask?.ctr === undefined || baseTask?.ctr === ""
          ? ""
          : String(baseTask.ctr),
      engagementRate:
        baseTask?.engagement_rate === null || baseTask?.engagement_rate === undefined || baseTask?.engagement_rate === ""
          ? ""
          : String(baseTask.engagement_rate),
      targetDate: baseTask?.target_date || new Date().toISOString().slice(0, 10),
      excellence:
        baseTask?.excellence === null || baseTask?.excellence === undefined || baseTask?.excellence === ""
          ? ""
          : String(baseTask.excellence),
      excellenceReason: "",
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
      scopeOfWorkId: resolveScopeOfWorkId(baseTask, scopeOfWorkOptions),
      createdBy: currentUserId,
      createdByName: currentUser?.email || "",
      revisionOfId: "",
      redoOfId: redoTaskId,
      taskName: baseTask?.task_name || "",
      instructions: baseTask?.instructions || "",
      instructionsSerialized: createSerializedFromText(baseTask?.instructions || ""),
      instructionsByArtDirector: baseTask?.InstructionsByArtDirector || "",
      instructionsByArtDirectorSerialized: createSerializedFromText(baseTask?.InstructionsByArtDirector || ""),
      revisionType: baseTask?.revision_type || "",
      priority: baseTask?.priority || "medium",
      designerId: baseTask?.designer ? String(baseTask.designer) : "",
      typeOfWorkId: baseTask?.type_of_work ? String(baseTask.type_of_work) : "",
      platform: baseTask?.platform || "",
      slides: baseTask?.slides === null || baseTask?.slides === undefined || baseTask?.slides === "" ? "1" : String(baseTask.slides),
      impressions:
        baseTask?.impressions === null || baseTask?.impressions === undefined || baseTask?.impressions === ""
          ? ""
          : String(baseTask.impressions),
      ctr:
        baseTask?.ctr === null || baseTask?.ctr === undefined || baseTask?.ctr === ""
          ? ""
          : String(baseTask.ctr),
      engagementRate:
        baseTask?.engagement_rate === null || baseTask?.engagement_rate === undefined || baseTask?.engagement_rate === ""
          ? ""
          : String(baseTask.engagement_rate),
      targetDate: baseTask?.target_date || new Date().toISOString().slice(0, 10),
      excellence:
        baseTask?.excellence === null || baseTask?.excellence === undefined || baseTask?.excellence === ""
          ? ""
          : String(baseTask.excellence),
      excellenceReason: "",
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
      const attachments = await superboardApi.taskAttachments.listAll({ task: task.id, page_size: 100 });
      const existingRemarkLinks = negativeRemarkLinksByTaskId[String(task.id)] || [];
      setTaskForm({
        id: task.id,
        clientId,
        scopeOfWorkId: resolveScopeOfWorkId(task, scopeOfWorkOptions),
        revisionOfId: task.revision_of ? String(task.revision_of) : "",
        redoOfId: task.redo_of ? String(task.redo_of) : "",
        createdBy: task.created_by ? String(task.created_by) : "",
        createdByName: task.created_by_name || "",
        taskName: task.task_name || "",
        instructions: task.instructions || "",
        instructionsSerialized: createSerializedFromText(task.instructions || ""),
        instructionsByArtDirector: task.InstructionsByArtDirector || "",
        instructionsByArtDirectorSerialized: createSerializedFromText(task.InstructionsByArtDirector || ""),
        revisionType: task.revision_type || "",
        priority: task.priority || "medium",
        designerId: task.designer ? String(task.designer) : "",
        typeOfWorkId: task.type_of_work ? String(task.type_of_work) : "",
        platform: task.platform || "",
        slides: task.slides === null || task.slides === undefined || task.slides === "" ? "1" : String(task.slides),
        impressions:
          task.impressions === null || task.impressions === undefined || task.impressions === ""
            ? ""
            : String(task.impressions),
        ctr:
          task.ctr === null || task.ctr === undefined || task.ctr === ""
            ? ""
            : String(task.ctr),
        engagementRate:
          task.engagement_rate === null || task.engagement_rate === undefined || task.engagement_rate === ""
            ? ""
            : String(task.engagement_rate),
        targetDate: task.target_date || "",
        excellence:
          task.excellence === null || task.excellence === undefined || task.excellence === ""
            ? ""
            : String(task.excellence),
        excellenceReason: task.excellence_reason || "",
        isMarkedCompletedByAccountPlanner: Boolean(task.is_marked_completed_by_account_planner),
        isMarkedCompletedByArtDirector: Boolean(task.is_marked_completed_by_art_director),
        isMarkedCompletedByDesigner: Boolean(task.is_marked_completed_by_designer),
        haveMajorChanges: Boolean(task.have_major_changes),
        haveMinorChanges: Boolean(task.have_minor_changes),
        negativeRemarkIds: existingRemarkLinks.map((link) => String(link.negative_remark)),
        negativeRemarkLinks: existingRemarkLinks,
        attachments: Array.isArray(attachments) ? attachments : [],
        attachmentFiles: [],
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
    const point = isAccountPlanner ? "0.5" : inlineTypeOfWorkForm.point.trim();

    if (!workTypeName) {
      toast.error("Work type name is required.");
      return;
    }

    if (!isAccountPlanner && !point) {
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
      setInlineTypeOfWorkForm(getEmptyInlineTypeOfWorkForm(isAccountPlanner));
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
      if (!taskForm.scopeOfWorkId && !taskForm.revisionOfId && !taskForm.redoOfId) {
        const message = "Scope Of Work is required.";
        setDrawerError(message);
        toast.error(message);
        return;
      }
      if (isRevisionTaskForm && !taskForm.haveMajorChanges && !taskForm.haveMinorChanges) {
        const message = "Revision changes are required.";
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
          scope_of_work: taskForm.scopeOfWorkId ? Number(taskForm.scopeOfWorkId) : null,
          priority: taskForm.priority,
          type_of_work: taskForm.typeOfWorkId ? Number(taskForm.typeOfWorkId) : null,
          platform: taskForm.platform || "",
          slides: taskForm.slides ? Number(taskForm.slides) : 1,
          impressions: taskForm.impressions ? Number(taskForm.impressions) : null,
          ctr: taskForm.ctr ? Number(taskForm.ctr) : null,
          engagement_rate: taskForm.engagementRate ? Number(taskForm.engagementRate) : null,
          revision_type: taskForm.revisionType || "",
          target_date: taskForm.targetDate || null,
        };

        if (!isArtDirector) {
          payload.instructions = taskForm.instructions;
          payload.is_marked_completed_by_account_planner = taskForm.isMarkedCompletedByAccountPlanner;
        }

        if (!isAccountPlanner) {
          payload.InstructionsByArtDirector = taskForm.instructionsByArtDirector || null;
        }

        if (canEditExcellence) {
          payload.excellence = taskForm.excellence ? Number(taskForm.excellence) : null;
          payload.excellence_reason = taskForm.excellenceReason.trim() || null;
        }

        if (isRevisionTaskForm) {
          payload.have_major_changes = taskForm.haveMajorChanges;
          payload.have_minor_changes = taskForm.haveMinorChanges;
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
        if (taskForm.negativeRemarkIds.length > 0) {
          await Promise.all(
            taskForm.negativeRemarkIds.map((remarkId) =>
              superboardApi.negativeRemarksOnTask.create({
                task: createdTask.id,
                negative_remark: Number(remarkId),
              }),
            ),
          );
        }
        if (taskForm.attachmentFiles.length > 0) {
          await Promise.all(
            taskForm.attachmentFiles.map(async (file) => {
              const formData = new FormData();
              formData.append("task", String(createdTask.id));
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
        toast.success("Task created successfully.");
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

  async function handleDeleteHistoryTask(taskId) {
    if (!taskId || !window.confirm("Delete this task?")) return;
    const task = taskById.get(String(taskId));
    if (!task || !canManageTask(task)) {
      toast.error("You do not have permission to delete this task.");
      return;
    }
    setDeletingHistoryTaskId(String(taskId));
    try {
      await superboardApi.tasks.remove(taskId);
      toast.success("Task deleted successfully.");
      setReloadTick((value) => value + 1);
      setHistoryOpen(false);
      setHistoryTaskId(null);
    } catch (requestError) {
      toast.error(requestError.message || "Failed to delete task.");
    } finally {
      setDeletingHistoryTaskId(null);
    }
  }

  async function handleDeleteTaskAttachment(attachmentId) {
    if (!attachmentId) return;
    if (!window.confirm("Delete this attachment?")) return;

    setDeletingTaskAttachmentId(String(attachmentId));
    setDrawerError("");
    try {
      await superboardApi.taskAttachments.remove(attachmentId);
      setTaskForm((prev) => ({
        ...prev,
        attachments: prev.attachments.filter((attachment) => String(attachment.id) !== String(attachmentId)),
      }));
      toast.success("Attachment deleted successfully.");
    } catch (requestError) {
      const message = requestError.message || "Failed to delete attachment.";
      setDrawerError(message);
      toast.error(message);
    } finally {
      setDeletingTaskAttachmentId(null);
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
      const nextStage = checked ? "complete" : (task?.stage === "backlog" ? "backlog" : "on_going");
      await superboardApi.tasks.patch(task.id, {
        stage: nextStage,
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
      const aDate = new Date(a.created_at || 0).getTime();
      const bDate = new Date(b.created_at || 0).getTime();
      if (aDate !== bDate) return bDate - aDate;
      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [filteredTasks]);

  const dateSlides = useMemo(() => {
    let effectiveDateFrom = dateFrom;
    let effectiveDateTo = dateTo;

    if (!effectiveDateFrom || !effectiveDateTo) {
      const createdDates = visibleTasks
        .map((task) => getTaskCreatedDateKey(task))
        .filter(Boolean)
        .sort();

      if (createdDates.length === 0) return [];
      effectiveDateFrom = effectiveDateFrom || createdDates[0];
      effectiveDateTo = effectiveDateTo || createdDates[createdDates.length - 1];
    }

    if (!effectiveDateFrom || !effectiveDateTo || effectiveDateFrom > effectiveDateTo) return [];

    const slides = [];
    const cursor = new Date(`${effectiveDateFrom}T00:00:00`);
    const end = new Date(`${effectiveDateTo}T00:00:00`);

    while (cursor.getTime() <= end.getTime()) {
      const year = cursor.getFullYear();
      const monthIndex = cursor.getMonth();
      const day = cursor.getDate();
      const dateKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const tasksForDate = visibleTasks.filter((task) => getTaskCreatedDateKey(task) === dateKey);

      slides.push({
        dateKey,
        day,
        weekDay: DAY_SHORT[cursor.getDay()],
        monthLabel: MONTH_NAMES[monthIndex],
        year,
        tasks: tasksForDate,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return slides;
  }, [dateFrom, dateTo, visibleTasks]);

  const loading = loadingClients || loadingTasks;
  const error = clientsError || tasksError;
  const headerActions = (
    <Button type="button" variant="outline" className="rounded-full" onClick={() => setFilterDrawerOpen(true)}>
      <Search className="h-4 w-4" />
      Search & Filter
    </Button>
  );

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
          <SiteHeader title={headerTitle} actions={headerActions} />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-background p-4 lg:p-6">
            <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-[260px] flex-wrap items-center gap-3">
                  <>
                    <label htmlFor="client-select" className="text-sm font-semibold text-muted-foreground">
                      Client
                    </label>
                    <Select value={selectedClientId || undefined} onValueChange={(value) => setSelectedClientIds(value ? [String(value)] : [])}>
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

            <Sheet open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
              <SheetContent side="right" className="flex h-full flex-col overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[768px]">
                <SheetHeader className="border-b border-border px-6 py-6">
                  <SheetTitle>Search & Filter</SheetTitle>
                  <SheetDescription>Refine the Task Manager list by name, client, designer, created date, target date, and task type.</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  <div className="space-y-5 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                    <div className="space-y-2">
                      <Label htmlFor="task-manager-search" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Search by Task Name
                      </Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="task-manager-search"
                          placeholder="Search tasks by name..."
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          className="h-11 rounded-xl bg-background pl-10 shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="task-manager-client-filter" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
                                      setSelectedClientIds((prev) => prev.filter((id) => id !== client.id));
                                    }}>
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">Select clients</span>
                            )}
                          </div>
                          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${clientFilterOpen ? "rotate-180" : ""}`} />
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
                                      onClick={() =>
                                        setSelectedClientIds((prev) =>
                                          prev.includes(client.id) ? prev.filter((id) => id !== client.id) : [...prev, client.id],
                                        )
                                      }
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") {
                                          event.preventDefault();
                                          setSelectedClientIds((prev) =>
                                            prev.includes(client.id) ? prev.filter((id) => id !== client.id) : [...prev, client.id],
                                          );
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

                    {currentUserRole !== "designer" && currentUserRole !== "account_planner" ? (
                      <div className="space-y-2">
                        <Label htmlFor="task-manager-designer-filter" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
                              {selectedDesignerId ? (
                                (() => {
                                  const selectedDesigner = designerOptions.find((designer) => String(designer.id) === String(selectedDesignerId));
                                  const label = selectedDesigner
                                    ? selectedDesigner.first_name || selectedDesigner.last_name
                                      ? `${selectedDesigner.first_name || ""} ${selectedDesigner.last_name || ""}`.trim()
                                      : selectedDesigner.email
                                    : "Selected designer";
                                  return (
                                    <Badge variant="secondary" className="h-8 rounded-full px-3 text-sm">
                                      <span className="truncate max-w-44">{label}</span>
                                      <button
                                        type="button"
                                        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setSelectedDesignerId("");
                                        }}>
                                        <X className="h-3 w-3" />
                                      </button>
                                    </Badge>
                                  );
                                })()
                              ) : (
                                <span className="text-sm text-muted-foreground">All designers</span>
                              )}
                            </div>
                            <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${designerFilterOpen ? "rotate-180" : ""}`} />
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
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-muted"
                                  onClick={() => setSelectedDesignerId("")}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      setSelectedDesignerId("");
                                    }
                                  }}>
                                  <div className="flex items-center gap-3">
                                    <Checkbox checked={!selectedDesignerId} tabIndex={-1} className="pointer-events-none" />
                                    <span className="text-sm font-medium text-foreground">All designers</span>
                                  </div>
                                  {!selectedDesignerId ? <Check className="h-4 w-4 text-primary" /> : null}
                                </div>
                                {visibleDesignerOptions.length > 0 ? (
                                  visibleDesignerOptions.map((designer) => {
                                    const label = designer.first_name || designer.last_name
                                      ? `${designer.first_name || ""} ${designer.last_name || ""}`.trim()
                                      : designer.email;
                                    const isChecked = String(selectedDesignerId) === String(designer.id);
                                    return (
                                      <div
                                        key={String(designer.id)}
                                        role="button"
                                        tabIndex={0}
                                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-muted"
                                        onClick={() => setSelectedDesignerId(String(designer.id))}
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter" || event.key === " ") {
                                            event.preventDefault();
                                            setSelectedDesignerId(String(designer.id));
                                          }
                                        }}>
                                        <div className="flex items-center gap-3">
                                          <Checkbox checked={isChecked} tabIndex={-1} className="pointer-events-none" />
                                          <span className="text-sm font-medium text-foreground">{label}</span>
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
                        <Label htmlFor="task-manager-date-from" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Created Date From
                        </Label>
                        <Input
                          id="task-manager-date-from"
                          type="date"
                          value={dateFrom}
                          onChange={(event) => setDateFrom(event.target.value)}
                          className="h-11 rounded-xl bg-background shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-manager-date-to" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Created Date To
                        </Label>
                        <Input
                          id="task-manager-date-to"
                          type="date"
                          value={dateTo}
                          onChange={(event) => setDateTo(event.target.value)}
                          className="h-11 rounded-xl bg-background shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="task-manager-target-date-from" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Target Date From
                        </Label>
                        <Input
                          id="task-manager-target-date-from"
                          type="date"
                          value={targetDateFrom}
                          onChange={(event) => setTargetDateFrom(event.target.value)}
                          className="h-11 rounded-xl bg-background shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-manager-target-date-to" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Target Date To
                        </Label>
                        <Input
                          id="task-manager-target-date-to"
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
                        Show {visibleTasks.length} task(s)
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Sheet open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
            <SheetContent side="right" className="flex h-full flex-col overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[768px]">
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
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="task-client">Client</Label>
                          <Select
                            value={taskForm.clientId || undefined}
                            disabled={drawerMode === "edit" || currentUserRole === "designer"}
                            onValueChange={(nextClientId) => {
                              setTaskForm((prev) => ({
                                ...prev,
                                clientId: nextClientId,
                                scopeOfWorkId:
                                  scopeOfWorkOptions.some(
                                    (item) =>
                                      String(item.client || item.client_id || "") === String(nextClientId) &&
                                      String(item.id) === String(prev.scopeOfWorkId),
                                  )
                                    ? prev.scopeOfWorkId
                                    : "",
                                revisionOfId: "",
                                redoOfId: "",
                              }));
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
                                {item.deliverable_name || item.scope_of_work_name || `Scope #${item.id}`}
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

                      <div className={`grid grid-cols-1 gap-4 ${canEditExcellence ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
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
                            {typeOfWorkOptions.map((item) => (
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
                            className={isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : ""}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="task-platform">Platform</Label>
                          <Select
                            value={taskForm.platform || "__none__"}
                            disabled={isReadOnlyTaskForm}
                            onValueChange={(value) =>
                              setTaskForm((prev) => ({ ...prev, platform: value === "__none__" ? "" : value }))
                            }>
                            <SelectTrigger id="task-platform" className={`h-9 w-full rounded-md ${isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : ""}`}>
                              <SelectValue placeholder="Select platform" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              <SelectItem value="__none__">Select platform</SelectItem>
                              {PLATFORM_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="task-impressions">Impressions</Label>
                          <Input
                            id="task-impressions"
                            type="number"
                            min="0"
                            step="1"
                            value={taskForm.impressions}
                            disabled={isReadOnlyTaskForm}
                            onChange={(event) => setTaskForm((prev) => ({ ...prev, impressions: event.target.value }))}
                            className={isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : ""}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="task-ctr">CTR (%)</Label>
                          <Input
                            id="task-ctr"
                            type="number"
                            min="0"
                            step="0.01"
                            value={taskForm.ctr}
                            disabled={isReadOnlyTaskForm}
                            onChange={(event) => setTaskForm((prev) => ({ ...prev, ctr: event.target.value }))}
                            className={isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : ""}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="task-engagement-rate">Engagement Rate (%)</Label>
                          <Input
                            id="task-engagement-rate"
                            type="number"
                            min="0"
                            step="0.01"
                            value={taskForm.engagementRate}
                            disabled={isReadOnlyTaskForm}
                            onChange={(event) => setTaskForm((prev) => ({ ...prev, engagementRate: event.target.value }))}
                            className={isReadOnlyTaskForm ? "bg-muted text-muted-foreground" : ""}
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
                            {!isAccountPlanner ? (
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
                            ) : null}
                          </div>
                          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => {
                                setInlineTypeOfWorkOpen(false);
                                setInlineTypeOfWorkForm(getEmptyInlineTypeOfWorkForm(isAccountPlanner));
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

                      {drawerMode === "edit" && !isAccountPlanner && !isDesigner ? (
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
                {!selectedClient ? (
                  <p className="text-sm text-muted-foreground">
                    No clients are assigned to your account.
                  </p>
                ) : null}
                {selectedClient && visibleTasks.length === 0 ? (
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
                                attachments={attachmentsByTaskId[String(task.id)] || []}
                                negativeRemarkLinks={negativeRemarkLinksByTaskId[String(task.id)] || []}
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
      <TaskHistoryDrawer
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        task={historyTask}
        items={historyItems}
        canDeleteItem={canManageTask}
        deletingTaskId={deletingHistoryTaskId}
        onDeleteItem={handleDeleteHistoryTask}
      />
      <Toaster />
    </TooltipProvider>
  );
}
