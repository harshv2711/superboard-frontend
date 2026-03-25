import { AppSidebar } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Editor } from "@/components/blocks/editor-00/editor";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { superboardApi } from "@/api/superboardApi";
import { ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Keyboard, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { toast } from "sonner";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

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

function getClientLogo(client) {
  const logo = client?.logo || client?.client_logo || client?.clientLogo || "";
  if (!logo) return "";
  if (logo.startsWith("http://") || logo.startsWith("https://")) return logo;
  return `${API_BASE_URL}${logo.startsWith("/") ? logo : `/${logo}`}`;
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

function getClientAccentColor(client) {
  const color = client?.accentColor || client?.accent_color || client?.color || "";
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : "";
}

function getScopeLabel(scope) {
  return scope.name || scope.title || scope.scope || scope.description || `Scope #${scope.id}`;
}

function getScopeDescription(scope) {
  return scope.description || scope.notes || scope.details || "";
}

function getServiceCategory(scope) {
  return scope.service_category_name || scope.serviceCategoryName || scope.category_name || scope.category?.name || "-";
}

function getDeliverableName(scope) {
  return (
    scope.deliverable_name ||
    scope.deliverableName ||
    scope.deliverable ||
    scope.name ||
    scope.title ||
    getScopeLabel(scope)
  );
}

function getDeliverableTypeOfWorkDisplay(scope) {
  if (Array.isArray(scope.type_of_work_names) && scope.type_of_work_names.length > 0) {
    return scope.type_of_work_names.join(", ");
  }
  return getDeliverableName(scope);
}

function getDeliverableTypeOfWorkItems(scope) {
  if (Array.isArray(scope.type_of_work_names) && scope.type_of_work_names.length > 0) {
    return scope.type_of_work_names.filter(Boolean);
  }
  const deliverableName = getDeliverableName(scope);
  return deliverableName ? [deliverableName] : [];
}

function getUnit(scope) {
  return scope.totalUnit ?? scope.total_unit ?? scope.monthly_unit ?? scope.monthlyUnit ?? scope.unit_per_month ?? scope.unit ?? "-";
}

function toRows(payload) {
  if (Array.isArray(payload)) return payload;
  return payload?.results || [];
}

function extractTextFromLexical(node) {
  if (!node) return "";
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.children)) return "";
  return node.children.map((child) => extractTextFromLexical(child)).join(" ");
}

function getScopeDescriptionForSubmit(scopeForm) {
  const plain = String(scopeForm.description || "").trim();
  if (plain) return plain;
  const fromSerialized = extractTextFromLexical(scopeForm.descriptionSerialized?.root)
    .replace(/\s+/g, " ")
    .trim();
  return fromSerialized;
}

function getDeliverableNameFromTypeOfWorkIds(typeOfWorkIds, typeOfWorkOptions) {
  if (!Array.isArray(typeOfWorkIds) || typeOfWorkIds.length === 0) return "";
  const namesById = new Map(
    typeOfWorkOptions.map((option) => [String(option.id), String(option.work_type_name || "").trim()]),
  );
  return typeOfWorkIds
    .map((id) => namesById.get(String(id)) || "")
    .filter(Boolean)
    .join(", ");
}

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

function toClientForm(client) {
  return {
    id: client?.id || null,
    name: client?.name || "",
    clientInterface: client?.clientInterface || client?.client_interface || "",
    clientInterfaceContactNumber:
      client?.clientInterfaceContactNumber || client?.client_interface_contact_number || client?.contact_number || "",
    logo: null,
    logoUrl: getClientLogo(client),
    removeLogo: false,
    attachmentFiles: [],
    attachments: [],
    accentColor: getClientAccentColor(client) || "#111827",
  };
}

function toScopeForm(clientId = "") {
  return {
    id: null,
    clientId: clientId ? String(clientId) : "",
    serviceCategory: "",
    typeOfWorkIds: [],
    description: "",
    descriptionSerialized: EMPTY_EDITOR_STATE,
    monthlyUnit: "",
  };
}

const EMPTY_SERVICE_CATEGORY_FORM = {
  name: "",
  description: "",
};

const EMPTY_TYPE_OF_WORK_FORM = {
  workTypeName: "",
};

export default function ClientsPage() {
  const [drawerMode, setDrawerMode] = useState(null);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [clientForm, setClientForm] = useState(toClientForm(null));
  const [savingClient, setSavingClient] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState(null);
  const [scopeForm, setScopeForm] = useState(toScopeForm());
  const [scopeOriginal, setScopeOriginal] = useState(null);
  const [savingScope, setSavingScope] = useState(false);
  const [scopeTypeOfWorkQuery, setScopeTypeOfWorkQuery] = useState("");
  const [scopeTypeOfWorkOpen, setScopeTypeOfWorkOpen] = useState(false);
  const [serviceCategoryOptions, setServiceCategoryOptions] = useState([]);
  const [typeOfWorkOptions, setTypeOfWorkOptions] = useState([]);
  const [inlineTypeOfWorkOpen, setInlineTypeOfWorkOpen] = useState(false);
  const [inlineTypeOfWorkForm, setInlineTypeOfWorkForm] = useState(EMPTY_TYPE_OF_WORK_FORM);
  const [inlineServiceCategoryOpen, setInlineServiceCategoryOpen] = useState(false);
  const [inlineServiceCategoryForm, setInlineServiceCategoryForm] = useState(EMPTY_SERVICE_CATEGORY_FORM);
  const [savingServiceCategory, setSavingServiceCategory] = useState(false);
  const [savingTypeOfWork, setSavingTypeOfWork] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [expandedClientInterfaces, setExpandedClientInterfaces] = useState({});
  const [expandedScopeLists, setExpandedScopeLists] = useState({});

  const currentUserId = String(currentUser?.id || currentUser?.user_id || "");
  const currentUserRole = currentUser?.role || "";
  const isSuperuser = currentUserRole === "superuser";
  const ownedClientIds = useMemo(() => {
    if (isSuperuser) {
      return new Set(columns.map(({ client }) => String(client.id)));
    }
    return new Set(
      columns
        .map(({ client }) => client)
        .filter((client) => getOwnerUserIds(client).includes(currentUserId))
        .map((client) => String(client.id)),
    );
  }, [columns, currentUserId, isSuperuser]);
  const ownedClients = useMemo(() => {
    return columns.map(({ client }) => client).filter((client) => ownedClientIds.has(String(client.id)));
  }, [columns, ownedClientIds]);

  const canManageClient = useCallback(
    (client) => ownedClientIds.has(String(client?.id || "")),
    [ownedClientIds],
  );

  const toggleClientInterface = useCallback((clientId) => {
    setExpandedClientInterfaces((prev) => ({
      ...prev,
      [clientId]: !prev[clientId],
    }));
  }, []);

  const toggleScopeList = useCallback((clientId) => {
    setExpandedScopeLists((prev) => ({
      ...prev,
      [clientId]: !prev[clientId],
    }));
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const me = await superboardApi.auth.me();
      setCurrentUser(me);

      const clientsResponse = await superboardApi.clients.listAll({ page_size: 300 });
      const serviceCategoryRows = await superboardApi.serviceCategories.listAll({ page_size: 300 });
      const typeOfWorkRows = await superboardApi.typeOfWork.listAll({ page_size: 300 });
      const clients = [...clientsResponse].sort((a, b) => getClientName(a).localeCompare(getClientName(b)));
      const sortedServiceCategories = [...serviceCategoryRows].sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || "")),
      );
      const sortedTypeOfWork = [...typeOfWorkRows].sort((a, b) =>
        String(a?.work_type_name || "").localeCompare(String(b?.work_type_name || "")),
      );
      const scopeResults = await Promise.allSettled(
        clients.map(async (client) => {
          const payload = await superboardApi.scopeOfWork.list({
            client: client.id,
            page_size: 300,
          });
          return {
            client,
            scopes: toRows(payload),
          };
        }),
      );

      const nextColumns = scopeResults.map((result, index) => {
        const client = clients[index];
        if (result.status === "fulfilled") {
          return {
            client,
            scopes: result.value.scopes,
            loadError: "",
          };
        }

        return {
          client,
          scopes: [],
          loadError: result.reason?.message || "Failed to load scope for this client.",
        };
      });

      setColumns(nextColumns);
      setServiceCategoryOptions(sortedServiceCategories);
      setTypeOfWorkOptions(sortedTypeOfWork);
    } catch (loadError) {
      setCurrentUser(null);
      setError(loadError.message || "Failed to load clients.");
      toast.error(loadError.message || "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredTypeOfWorkOptions = useMemo(() => {
    const query = scopeTypeOfWorkQuery.trim().toLowerCase();
    if (!query) return typeOfWorkOptions;
    return typeOfWorkOptions.filter((option) => String(option.work_type_name || "").toLowerCase().includes(query));
  }, [scopeTypeOfWorkQuery, typeOfWorkOptions]);

  const selectedTypeOfWorkOptions = useMemo(() => {
    if (scopeForm.typeOfWorkIds.length === 0) return [];
    return typeOfWorkOptions.filter((option) => scopeForm.typeOfWorkIds.includes(String(option.id)));
  }, [scopeForm.typeOfWorkIds, typeOfWorkOptions]);

  const existingScopeServiceCategoryIds = useMemo(() => {
    const clientId = String(scopeForm.clientId || "");
    if (!clientId) return new Set();
    const clientColumn = columns.find((column) => String(column.client.id) === clientId);
    const scopeId = String(scopeForm.id || "");
    return new Set(
      (clientColumn?.scopes || [])
        .filter((scope) => String(scope.id || "") !== scopeId)
        .map((scope) => String(scope.service_category ?? scope.serviceCategory ?? scope.category?.id ?? ""))
        .filter(Boolean),
    );
  }, [columns, scopeForm.clientId, scopeForm.id]);

  const availableServiceCategoryOptions = useMemo(() => {
    return serviceCategoryOptions.filter(
      (option) =>
        !existingScopeServiceCategoryIds.has(String(option.id)) ||
        String(scopeForm.serviceCategory || "") === String(option.id),
    );
  }, [existingScopeServiceCategoryIds, scopeForm.serviceCategory, serviceCategoryOptions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (columns.length === 0) return;
    setScopeForm((prev) => {
      if (prev.clientId) return prev;
      const defaultClientId = ownedClients[0]?.id || "";
      return {
        ...prev,
        clientId: String(defaultClientId),
      };
    });
  }, [columns, ownedClients]);

  function handleDrawerOpenChange(open) {
    setDrawerOpen(open);
    if (!open) {
      setDrawerMode(null);
      setDrawerLoading(false);
      setDrawerError("");
      setInlineServiceCategoryOpen(false);
      setInlineServiceCategoryForm(EMPTY_SERVICE_CATEGORY_FORM);
      setInlineTypeOfWorkOpen(false);
      setInlineTypeOfWorkForm(EMPTY_TYPE_OF_WORK_FORM);
      setSavingServiceCategory(false);
      setSavingTypeOfWork(false);
    }
  }

  function openCreateClientDrawer() {
    if (!(currentUserRole === "account_planner" || isSuperuser)) {
      toast.error("Only account planners or superusers can create clients.");
      return;
    }
    setDrawerError("");
    setDrawerMode("create-client");
    setClientForm(toClientForm(null));
    setDrawerOpen(true);
  }

  async function openEditClientDrawer(clientId) {
    const client = columns.find((column) => String(column.client.id) === String(clientId))?.client;
    if (!canManageClient(client)) {
      toast.error("You only have view access for this client.");
      return;
    }
    setDrawerLoading(true);
    setDrawerError("");
    setDrawerMode("edit-client");
    setDrawerOpen(true);
    try {
      const client = await superboardApi.clients.retrieve(clientId);
      const attachments = await superboardApi.clientAttachments.listAll({ client: clientId, page_size: 100 });
      setClientForm({
        ...toClientForm(client),
        attachments,
      });
    } catch (requestError) {
      setDrawerError(requestError.message || "Failed to fetch client.");
      toast.error(requestError.message || "Failed to fetch client.");
    } finally {
      setDrawerLoading(false);
    }
  }

  function openCreateScopeDrawer(clientId) {
    const nextClientId = String(clientId || scopeForm.clientId || ownedClients[0]?.id || "");
    const client = columns.find((column) => String(column.client.id) === nextClientId)?.client;
    if (!canManageClient(client)) {
      toast.error("You only have view access for this client.");
      return;
    }
    setDrawerError("");
    setDrawerMode("create-scope");
    setScopeOriginal(null);
    setScopeForm((prev) => ({
      ...toScopeForm(nextClientId),
      serviceCategory: String(serviceCategoryOptions[0]?.id || ""),
    }));
    setScopeTypeOfWorkQuery("");
    setScopeTypeOfWorkOpen(false);
    setInlineTypeOfWorkOpen(false);
    setInlineTypeOfWorkForm(EMPTY_TYPE_OF_WORK_FORM);
    setInlineServiceCategoryOpen(false);
    setInlineServiceCategoryForm(EMPTY_SERVICE_CATEGORY_FORM);
    setDrawerOpen(true);
  }

  async function handleSaveClient(event) {
    event.preventDefault();
    setSavingClient(true);
    setDrawerError("");
    try {
      const trimmedName = clientForm.name.trim();
      const trimmedClientInterface = clientForm.clientInterface.trim();

      if (!trimmedName) {
        throw new Error("Client name is required.");
      }
      if (!trimmedClientInterface) {
        throw new Error("Client interface is required.");
      }

      if (drawerMode === "create-client" && currentUser?.role !== "account_planner") {
        if (!isSuperuser) throw new Error("Only account planners or superusers can create clients.");
      }

      const payload = {
        name: trimmedName,
        clientInterface: trimmedClientInterface,
        clientInterfaceContactNumber: clientForm.clientInterfaceContactNumber.trim(),
        accentColor: clientForm.accentColor,
      };
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        formData.append(key, value);
      });
      if (clientForm.logo instanceof File) {
        formData.append("logo", clientForm.logo);
      } else if (clientForm.removeLogo) {
        formData.append("logo", "");
      }

      let savedClientId = clientForm.id;

      if (clientForm.id) {
        await superboardApi.clients.patch(clientForm.id, formData);
        toast.success("Client updated successfully.");
      } else {
        const createdClient = await superboardApi.clients.create(formData);
        savedClientId = createdClient.id;
        toast.success("Client created successfully.");
      }

      if (clientForm.attachmentFiles.length > 0 && savedClientId) {
        await Promise.all(
          clientForm.attachmentFiles.map(async (file) => {
            const attachmentFormData = new FormData();
            attachmentFormData.append("client", String(savedClientId));
            attachmentFormData.append("file", file);
            await superboardApi.clientAttachments.create(attachmentFormData);
          }),
        );
        toast.success(
          clientForm.attachmentFiles.length === 1
            ? "Client attachment uploaded successfully."
            : `${clientForm.attachmentFiles.length} client attachments uploaded successfully.`,
        );
      }

      await loadData();
      setClientForm(toClientForm(null));
      if (drawerMode === "create-client") {
        handleDrawerOpenChange(false);
      }
    } catch (requestError) {
      setDrawerError(requestError.message || "Failed to save client.");
      toast.error(requestError.message || "Failed to save client.");
    } finally {
      setSavingClient(false);
    }
  }

  async function handleDeleteClient(clientId) {
    if (!window.confirm("Delete this client?")) return;
    setDrawerError("");
    try {
      await superboardApi.clients.remove(clientId);
      toast.success("Client deleted successfully.");
      await loadData();
      if (clientForm.id === clientId) {
        setClientForm(toClientForm(null));
      }
      handleDrawerOpenChange(false);
    } catch (requestError) {
      setDrawerError(requestError.message || "Failed to delete client.");
      toast.error(requestError.message || "Failed to delete client.");
    }
  }

  async function handleDeleteClientAttachment(attachmentId) {
    if (!attachmentId) return;
    if (!window.confirm("Delete this attachment?")) return;

    setDeletingAttachmentId(String(attachmentId));
    setDrawerError("");
    try {
      await superboardApi.clientAttachments.remove(attachmentId);
      setClientForm((prev) => ({
        ...prev,
        attachments: prev.attachments.filter((attachment) => String(attachment.id) !== String(attachmentId)),
      }));
      toast.success("Attachment deleted successfully.");
    } catch (requestError) {
      const message = requestError.message || "Failed to delete attachment.";
      setDrawerError(message);
      toast.error(message);
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  async function handleCreateScope(event) {
    event.preventDefault();
    setSavingScope(true);
    setDrawerError("");
    try {
      const selectedClientId = String(scopeForm.clientId || "");
      const selectedServiceCategoryId = String(scopeForm.serviceCategory || "");
      const normalizedTotalUnit = scopeForm.monthlyUnit === "" ? 0 : Number(scopeForm.monthlyUnit);
      const selectedTypeOfWorkIds = scopeForm.typeOfWorkIds.map(Number);
      const derivedDeliverableName = getDeliverableNameFromTypeOfWorkIds(scopeForm.typeOfWorkIds, typeOfWorkOptions);

      if (!selectedClientId) {
        throw new Error("Client is required.");
      }
      if (!selectedServiceCategoryId) {
        throw new Error("Service category is required.");
      }
      if (existingScopeServiceCategoryIds.has(selectedServiceCategoryId)) {
        throw new Error("This client already has a scope of work for the selected service category.");
      }
      if (!derivedDeliverableName) {
        throw new Error("At least one deliverable/type of work is required.");
      }
      if (Number.isNaN(normalizedTotalUnit) || normalizedTotalUnit < 0) {
        throw new Error("Total unit must be zero or greater.");
      }

      const plainDescription = getScopeDescriptionForSubmit(scopeForm);

      if (scopeForm.id) {
        const nextState = {
          clientId: selectedClientId,
          serviceCategory: selectedServiceCategoryId,
          typeOfWorkIds: [...scopeForm.typeOfWorkIds].sort(),
          deliverableName: derivedDeliverableName,
          description: plainDescription || "",
          monthlyUnit: String(normalizedTotalUnit),
        };

        const updates = {};
        if (!scopeOriginal || nextState.clientId !== scopeOriginal.clientId) updates.client = Number(nextState.clientId);
        if (!scopeOriginal || nextState.serviceCategory !== scopeOriginal.serviceCategory) {
          updates.service_category = Number(nextState.serviceCategory);
        }
        if (
          !scopeOriginal ||
          JSON.stringify(nextState.typeOfWorkIds) !== JSON.stringify(scopeOriginal.typeOfWorkIds)
        ) {
          updates.type_of_work = selectedTypeOfWorkIds;
        }
        if (!scopeOriginal || nextState.deliverableName !== scopeOriginal.deliverableName) {
          updates.deliverable_name = nextState.deliverableName;
        }
        if (!scopeOriginal || nextState.description !== scopeOriginal.description) {
          updates.description = nextState.description;
        }
        if (!scopeOriginal || nextState.monthlyUnit !== scopeOriginal.monthlyUnit) {
          updates.total_unit = normalizedTotalUnit;
        }

        if (Object.keys(updates).length === 0) {
          toast.success("No changes to update.");
          setSavingScope(false);
          return;
        }

        await superboardApi.scopeOfWork.patch(scopeForm.id, updates);
        toast.success("Scope of work updated successfully.");
      } else {
        const payload = {
          client: Number(selectedClientId),
          service_category: Number(selectedServiceCategoryId),
          type_of_work: selectedTypeOfWorkIds,
          deliverable_name: derivedDeliverableName,
          description: plainDescription || "",
          total_unit: normalizedTotalUnit,
        };
        await superboardApi.scopeOfWork.create(payload);
        toast.success("Scope of work added successfully.");
      }

      await loadData();
      setScopeForm((prev) => toScopeForm(prev.clientId || ""));
      setScopeOriginal(null);
      handleDrawerOpenChange(false);
    } catch (requestError) {
      setDrawerError(requestError.message || "Failed to save scope of work.");
      toast.error(requestError.message || "Failed to save scope of work.");
    } finally {
      setSavingScope(false);
    }
  }

  async function handleDeleteScope(scopeId) {
    if (!scopeId) return;
    if (!window.confirm("Delete this scope of work?")) return;

    setDrawerError("");
    try {
      await superboardApi.scopeOfWork.remove(scopeId);
      toast.success("Scope of work deleted successfully.");
      await loadData();
      setScopeForm((prev) => toScopeForm(prev.clientId || ""));
      setScopeOriginal(null);
      handleDrawerOpenChange(false);
    } catch (requestError) {
      const message = requestError.message || "Failed to delete scope of work.";
      setDrawerError(message);
      toast.error(message);
    }
  }

  async function handleCreateServiceCategory() {
    const name = inlineServiceCategoryForm.name.trim();
    const description = inlineServiceCategoryForm.description.trim();

    if (!name) {
      toast.error("Service category name is required.");
      return;
    }

    setSavingServiceCategory(true);
    try {
      const created = await superboardApi.serviceCategories.create({ name, description });
      const allCategories = await superboardApi.serviceCategories.listAll({ page_size: 300 });
      const sortedCategories = [...allCategories].sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
      setServiceCategoryOptions(sortedCategories);
      setScopeForm((prev) => ({ ...prev, serviceCategory: String(created.id) }));
      setInlineServiceCategoryForm(EMPTY_SERVICE_CATEGORY_FORM);
      setInlineServiceCategoryOpen(false);
      toast.success("Service category created successfully.");
    } catch (requestError) {
      toast.error(requestError.message || "Failed to create service category.");
    } finally {
      setSavingServiceCategory(false);
    }
  }

  async function handleCreateTypeOfWork() {
    const workTypeName = inlineTypeOfWorkForm.workTypeName.trim();
    const point = 0.5;

    if (!workTypeName) {
      toast.error("Work type name is required.");
      return;
    }

    setSavingTypeOfWork(true);
    try {
      const created = await superboardApi.typeOfWork.create({
        work_type_name: workTypeName,
        point,
      });
      const allTypeOfWork = await superboardApi.typeOfWork.listAll({ page_size: 300 });
      setTypeOfWorkOptions(allTypeOfWork);
      setScopeForm((prev) => ({
        ...prev,
        typeOfWorkIds: [...new Set([...prev.typeOfWorkIds, String(created.id)])],
      }));
      setInlineTypeOfWorkForm(EMPTY_TYPE_OF_WORK_FORM);
      setInlineTypeOfWorkOpen(false);
      toast.success("Type of work created successfully.");
    } catch (requestError) {
      toast.error(requestError.message || "Failed to create type of work.");
    } finally {
      setSavingTypeOfWork(false);
    }
  }

  function createSerializedFromText(text) {
    return {
      root: {
        children: [
          {
            children: [
              {
                detail: 0,
                format: 0,
                mode: "normal",
                style: "",
                text: text || "",
                type: "text",
                version: 1,
              },
            ],
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

  function normalizeServiceCategoryForForm(scope) {
    return String(scope.service_category ?? scope.serviceCategory ?? scope.category?.id ?? "");
  }

  function normalizeTypeOfWorkIdsForForm(scope) {
    if (Array.isArray(scope.type_of_work)) {
      return scope.type_of_work.map((id) => String(id));
    }
    return [];
  }

  function handleEditScope(scope, clientId) {
    const client = columns.find((column) => String(column.client.id) === String(clientId))?.client;
    if (!canManageClient(client)) {
      toast.error("You only have view access for this client.");
      return;
    }
    const nextScope = {
      id: scope.id,
      clientId: String(clientId),
      serviceCategory: normalizeServiceCategoryForForm(scope),
      typeOfWorkIds: normalizeTypeOfWorkIdsForForm(scope),
      description: getScopeDescription(scope) || "",
      descriptionSerialized: createSerializedFromText(getScopeDescription(scope) || ""),
      monthlyUnit: String(scope.totalUnit ?? scope.total_unit ?? scope.monthly_unit ?? scope.monthlyUnit ?? scope.unit_per_month ?? scope.unit ?? ""),
    };
    setScopeForm(nextScope);
    setScopeOriginal({
      clientId: nextScope.clientId,
      serviceCategory: nextScope.serviceCategory,
      typeOfWorkIds: [...nextScope.typeOfWorkIds].sort(),
      deliverableName:
        scope.deliverable_name || scope.deliverableName || scope.deliverable || scope.name || "",
      description: nextScope.description,
      monthlyUnit: nextScope.monthlyUnit,
    });
    setScopeTypeOfWorkQuery("");
    setScopeTypeOfWorkOpen(false);
    setDrawerMode("edit-scope");
    setInlineServiceCategoryOpen(false);
    setInlineServiceCategoryForm(EMPTY_SERVICE_CATEGORY_FORM);
    setDrawerOpen(true);
  }

  return (
    <TooltipProvider>
      <SidebarProvider className="min-h-screen [--header-height:calc(theme(spacing.14))]">
        <AppSidebar variant="inset" />
        <SidebarInset className="min-w-0 overflow-x-hidden">
          <SiteHeader title="Client Directory" />
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden p-4 lg:p-6">
            <div className="mb-5 rounded-2xl border border-border/80 bg-card px-4 py-4 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Client Directory</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground">
                      Number of Clients: {columns.length}
                    </div>
                    <div className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground">
                      Clients Managed by You: {ownedClients.length}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="rounded-xl"
                    onClick={openCreateClientDrawer}
                    disabled={!(currentUserRole === "account_planner" || isSuperuser)}>
                    <Plus className="h-4 w-4" />
                    Create Client
                  </Button>
                </div>
              </div>
            </div>

            <Sheet open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
              <SheetContent side="right" className="w-full sm:max-w-[900px]">
                <SheetHeader>
                  <SheetTitle>
                    {drawerMode === "create-client" && "Create client"}
                    {drawerMode === "edit-client" && "Edit client"}
                    {drawerMode === "create-scope" && "Add scope of work"}
                    {drawerMode === "edit-scope" && "Edit scope of work"}
                  </SheetTitle>
                  <SheetDescription>
                    {drawerMode === "create-client" && "Create a new client profile."}
                    {drawerMode === "edit-client" && "Update or delete this client."}
                    {drawerMode === "create-scope" && "Create a scope item for a client."}
                    {drawerMode === "edit-scope" && "Update this scope item."}
                  </SheetDescription>
                </SheetHeader>

                <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4">
                  {drawerMode === "create-client" || drawerMode === "edit-client" ? (
                    <form className="space-y-4 rounded-lg border p-3" onSubmit={handleSaveClient}>
                      <div className="space-y-2">
                        <Label htmlFor="client-name">Name</Label>
                        <Input
                          id="client-name"
                          value={clientForm.name}
                          onChange={(event) => setClientForm((prev) => ({ ...prev, name: event.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="client-interface">Client interface</Label>
                        <Input
                          id="client-interface"
                          value={clientForm.clientInterface}
                          onChange={(event) => setClientForm((prev) => ({ ...prev, clientInterface: event.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="client-interface-contact">Client interface contact number</Label>
                        <Input
                          id="client-interface-contact"
                          value={clientForm.clientInterfaceContactNumber}
                          onChange={(event) =>
                            setClientForm((prev) => ({ ...prev, clientInterfaceContactNumber: event.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="client-logo">Client logo</Label>
                        <Input
                          id="client-logo"
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            setClientForm((prev) => ({
                              ...prev,
                              logo: event.target.files?.[0] || null,
                              logoUrl: event.target.files?.[0] ? URL.createObjectURL(event.target.files[0]) : prev.logoUrl,
                              removeLogo: false,
                            }))
                          }
                        />
                        {clientForm.logoUrl ? (
                          <div className="relative inline-flex">
                            <img
                              src={clientForm.logoUrl}
                              alt={`${clientForm.name || "Client"} logo`}
                              className="h-20 w-20 rounded-xl border border-border object-contain bg-background p-2"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute -right-2 -top-2 h-8 w-8 rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:bg-destructive/10 hover:text-destructive"
                              onClick={() =>
                                setClientForm((prev) => ({
                                  ...prev,
                                  logo: null,
                                  logoUrl: "",
                                  removeLogo: true,
                                }))
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete client logo</span>
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="client-attachment">Client attachment</Label>
                        <Input
                          id="client-attachment"
                          type="file"
                          multiple
                          onChange={(event) =>
                            setClientForm((prev) => ({
                              ...prev,
                              attachmentFiles: Array.from(event.target.files || []),
                            }))
                          }
                        />
                        {clientForm.attachmentFiles.length > 0 ? (
                          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Selected attachments
                            </p>
                            <div className="mt-2 space-y-1">
                              {clientForm.attachmentFiles.map((file) => (
                                <p key={`${file.name}-${file.size}-${file.lastModified}`} className="text-xs text-muted-foreground">
                                  {file.name}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {drawerMode === "edit-client" && clientForm.attachments.length > 0 ? (
                          <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                              Existing attachments
                            </p>
                            <div className="mt-2 space-y-2">
                              {clientForm.attachments.map((attachment) => (
                                <div
                                  key={String(attachment.id)}
                                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2">
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
                                    disabled={String(deletingAttachmentId) === String(attachment.id)}
                                    onClick={() => handleDeleteClientAttachment(attachment.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="client-accent-color">Accent color</Label>
                        <div className="flex items-center gap-3">
                          <Input
                            id="client-accent-color"
                            type="color"
                            value={clientForm.accentColor}
                            onChange={(event) =>
                              setClientForm((prev) => ({ ...prev, accentColor: event.target.value.toUpperCase() }))
                            }
                            className="h-11 w-20 cursor-pointer p-1"
                          />
                          <Input
                            value={clientForm.accentColor}
                            onChange={(event) =>
                              setClientForm((prev) => ({ ...prev, accentColor: event.target.value.toUpperCase() }))
                            }
                            placeholder="#111827"
                            maxLength={7}
                          />
                        </div>
                      </div>

                      {drawerLoading ? <p className="text-sm text-muted-foreground">Loading client...</p> : null}
                      {drawerError ? <p className="text-sm text-destructive">{drawerError}</p> : null}

                      <SheetFooter className="p-0">
                        <div className="flex w-full flex-col gap-2">
                          <Button type="submit" disabled={savingClient || drawerLoading}>
                            {savingClient ? "Saving..." : drawerMode === "edit-client" ? "Update client" : "Create client"}
                          </Button>
                          {drawerMode === "edit-client" && clientForm.id ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="border-destructive text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteClient(clientForm.id)}>
                              Delete client
                            </Button>
                          ) : null}
                        </div>
                      </SheetFooter>
                    </form>
                  ) : null}

                  {drawerMode === "create-scope" || drawerMode === "edit-scope" ? (
                    <form className="space-y-4 rounded-lg border p-3" onSubmit={handleCreateScope}>
                      <div className="space-y-2">
                        <Label htmlFor="scope-client">Client</Label>
                        <Select
                          value={scopeForm.clientId || undefined}
                          onValueChange={(value) => setScopeForm((prev) => ({ ...prev, clientId: value }))}>
                          <SelectTrigger id="scope-client" className="h-9 w-full rounded-md">
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                          {ownedClients.map((client) => (
                            <SelectItem key={String(client.id)} value={String(client.id)}>
                              {getClientName(client)}
                            </SelectItem>
                          ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="scope-service-category">Service category</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto px-0 py-0 text-sm font-medium"
                            onClick={() => {
                              setInlineServiceCategoryOpen((prev) => !prev);
                              setInlineServiceCategoryForm(EMPTY_SERVICE_CATEGORY_FORM);
                            }}>
                            <Plus className="h-4 w-4" />
                            Add new
                          </Button>
                        </div>
                        <Select
                          value={scopeForm.serviceCategory || undefined}
                          onValueChange={(value) =>
                            setScopeForm((prev) => ({
                              ...prev,
                              serviceCategory: value,
                            }))
                          }>
                          <SelectTrigger id="scope-service-category" className="h-9 w-full rounded-md">
                            <SelectValue placeholder="Select service category" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                          {availableServiceCategoryOptions.map((option) => (
                            <SelectItem key={String(option.id)} value={String(option.id)}>
                              {option.name}
                            </SelectItem>
                          ))}
                          </SelectContent>
                        </Select>
                        {scopeForm.clientId && availableServiceCategoryOptions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            All service categories already have a scope of work for this client.
                          </p>
                        ) : null}
                        {inlineServiceCategoryOpen ? (
                          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
                            <div className="mb-3">
                              <p className="text-sm font-semibold text-foreground">Create New Service Category</p>
                              <p className="text-xs text-muted-foreground">
                                Add it here and use it immediately for this scope item.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="inline-service-category-name" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                  Name
                                </Label>
                                <Input
                                  id="inline-service-category-name"
                                  value={inlineServiceCategoryForm.name}
                                  onChange={(event) =>
                                    setInlineServiceCategoryForm((prev) => ({ ...prev, name: event.target.value }))
                                  }
                                  placeholder="Enter service category name"
                                  className="h-11"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="inline-service-category-description" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                  Description
                                </Label>
                                <textarea
                                  id="inline-service-category-description"
                                  className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                                  value={inlineServiceCategoryForm.description}
                                  onChange={(event) =>
                                    setInlineServiceCategoryForm((prev) => ({ ...prev, description: event.target.value }))
                                  }
                                  placeholder="Describe this service category"
                                />
                              </div>
                            </div>
                            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl"
                                onClick={() => {
                                  setInlineServiceCategoryOpen(false);
                                  setInlineServiceCategoryForm(EMPTY_SERVICE_CATEGORY_FORM);
                                }}>
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                className="rounded-xl"
                                onClick={handleCreateServiceCategory}
                                disabled={savingServiceCategory}>
                                {savingServiceCategory ? "Saving..." : "Create Service Category"}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="text-sm font-medium">Deliverable/ Type of work</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-auto px-0 py-0 text-sm font-medium"
                            onClick={() => {
                              setInlineTypeOfWorkOpen((prev) => !prev);
                              setInlineTypeOfWorkForm(EMPTY_TYPE_OF_WORK_FORM);
                            }}>
                            <Plus className="h-4 w-4" />
                            Add new
                          </Button>
                        </div>
                        <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
                          {selectedTypeOfWorkOptions.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {selectedTypeOfWorkOptions.map((option) => (
                                <Badge
                                  key={String(option.id)}
                                  variant="secondary"
                                  className="max-w-full rounded-full px-3 py-1 text-xs">
                                  <span className="truncate">{option.work_type_name}</span>
                                  <button
                                    type="button"
                                    className="ml-2 text-muted-foreground transition hover:text-foreground"
                                    onClick={() =>
                                      setScopeForm((prev) => ({
                                        ...prev,
                                        typeOfWorkIds: prev.typeOfWorkIds.filter((value) => value !== String(option.id)),
                                      }))
                                    }>
                                    ×
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-muted/40"
                            onClick={() => setScopeTypeOfWorkOpen((prev) => !prev)}>
                            <span>
                              {selectedTypeOfWorkOptions.length > 0
                                ? `${selectedTypeOfWorkOptions.length} deliverable/type of work selected`
                                : "Select deliverable/type of work"}
                            </span>
                            <ChevronDown
                              className={`h-4 w-4 shrink-0 text-muted-foreground transition ${scopeTypeOfWorkOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                          {scopeTypeOfWorkOpen ? (
                            <div className="space-y-2 rounded-lg border border-border/60 bg-background p-2">
                              <Input
                                value={scopeTypeOfWorkQuery}
                                onChange={(event) => setScopeTypeOfWorkQuery(event.target.value)}
                                placeholder="Search deliverable/type of work..."
                                className="h-9 rounded-lg"
                              />
                              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                                {filteredTypeOfWorkOptions.length > 0 ? (
                                  filteredTypeOfWorkOptions.map((option) => {
                                    const isChecked = scopeForm.typeOfWorkIds.includes(String(option.id));
                                    return (
                                      <label
                                        key={String(option.id)}
                                        className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2">
                                        <Checkbox
                                          checked={isChecked}
                                          onCheckedChange={(checked) =>
                                            setScopeForm((prev) => ({
                                              ...prev,
                                              typeOfWorkIds: checked
                                                ? [...prev.typeOfWorkIds, String(option.id)]
                                                : prev.typeOfWorkIds.filter((value) => value !== String(option.id)),
                                            }))
                                          }
                                        />
                                        <span className="text-sm text-foreground">{option.work_type_name}</span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                                    No deliverable/type of work matches your search.
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                        {inlineTypeOfWorkOpen ? (
                          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
                            <div className="mb-3">
                              <p className="text-sm font-semibold text-foreground">Create New Type Of Work</p>
                              <p className="text-xs text-muted-foreground">
                                Add it here and use it immediately for this scope item.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="inline-scope-type-of-work-name" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                  Work Type Name
                                </Label>
                                <Input
                                  id="inline-scope-type-of-work-name"
                                  value={inlineTypeOfWorkForm.workTypeName}
                                  onChange={(event) =>
                                    setInlineTypeOfWorkForm((prev) => ({ ...prev, workTypeName: event.target.value }))
                                  }
                                  placeholder="Enter work type name"
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
                                  setInlineTypeOfWorkForm(EMPTY_TYPE_OF_WORK_FORM);
                                }}>
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                className="rounded-xl"
                                onClick={handleCreateTypeOfWork}
                                disabled={savingTypeOfWork}>
                                {savingTypeOfWork ? "Saving..." : "Create Type Of Work"}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="scope-description">Description</Label>
                        <Editor
                          editorSerializedState={scopeForm.descriptionSerialized}
                          onSerializedChange={(value) => setScopeForm((prev) => ({ ...prev, descriptionSerialized: value }))}
                          onPlainTextChange={(value) => setScopeForm((prev) => ({ ...prev, description: value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="scope-monthly-unit">Total monthly unit</Label>
                        <Input
                          id="scope-monthly-unit"
                          type="number"
                          min="0"
                          value={scopeForm.monthlyUnit}
                          onChange={(event) => setScopeForm((prev) => ({ ...prev, monthlyUnit: event.target.value }))}
                          required
                        />
                      </div>
                      {drawerError ? <p className="text-sm text-destructive">{drawerError}</p> : null}
                      <div className="flex w-full flex-col gap-2">
                        <Button type="submit" disabled={savingScope}>
                          {savingScope ? "Saving..." : drawerMode === "edit-scope" ? "Update scope of work" : "Add scope of work"}
                        </Button>
                        {drawerMode === "edit-scope" && scopeForm.id ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="border-destructive text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteScope(scopeForm.id)}>
                            Delete scope of work
                          </Button>
                        ) : null}
                      </div>
                    </form>
                  ) : null}
                </div>
              </SheetContent>
            </Sheet>

            {loading ? <p className="text-sm text-muted-foreground">Loading clients and scope...</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {!loading && !error && columns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center">
                <p className="text-sm font-medium text-foreground">No clients found.</p>
                <p className="text-xs text-muted-foreground">Create a client to start adding scope and planning work.</p>
              </div>
            ) : null}

            {!loading && !error && columns.length > 0 ? (
              <div className="min-w-0 space-y-5 pt-6">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="client-swiper-prev inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-background text-foreground shadow-sm transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                    aria-label="Previous clients">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="client-swiper-next inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-background text-foreground shadow-sm transition hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                    aria-label="Next clients">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <Swiper
                  modules={[Keyboard, Navigation]}
                  keyboard={{ enabled: true }}
                  navigation={{
                    prevEl: ".client-swiper-prev",
                    nextEl: ".client-swiper-next",
                  }}
                  spaceBetween={24}
                  slidesPerView={1}
                  breakpoints={{
                    768: { slidesPerView: 2 },
                    1440: { slidesPerView: 3 },
                  }}
                  className="min-w-0 !overflow-visible pb-2">
                  {columns.map(({ client, scopes, loadError }) => (
                    <SwiperSlide
                      key={String(client.id ?? getClientName(client))}
                      className="h-auto self-stretch pb-2">
                      <Card
                        className="flex h-full flex-col overflow-hidden rounded-[30px] border-border/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                        style={{
                          boxShadow: getClientAccentColor(client)
                            ? `0 18px 45px -28px ${getClientAccentColor(client)}66`
                            : undefined,
                        }}>
                        <CardHeader
                          className="border-b pb-4 pt-5"
                          style={{
                            background: getClientAccentColor(client)
                              ? `linear-gradient(180deg, ${getClientAccentColor(client)}12 0%, rgba(255,255,255,0.96) 48%, rgba(255,255,255,1) 100%)`
                              : undefined,
                            boxShadow: getClientAccentColor(client)
                              ? `inset 4px 0 0 0 ${getClientAccentColor(client)}`
                              : undefined,
                          }}>
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold shadow-sm">
                                {scopes.length} scope item(s)
                              </Badge>
                              {canManageClient(client) ? (
                                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs bg-background/70">
                                  Managed by you
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs bg-background/70">
                                  View only
                                </Badge>
                              )}
                            </div>
                            <div className="rounded-[24px] border border-white/70 bg-background/88 p-4 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.28)] backdrop-blur">
                              <div className="flex min-w-0 items-start gap-4">
                                <div
                                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] border border-white/70 bg-background/95 p-2.5 shadow-[0_18px_30px_-24px_rgba(15,23,42,0.45)]">
                                  {getClientLogo(client) ? (
                                    <img
                                      src={getClientLogo(client)}
                                      alt={`${getClientName(client)} logo`}
                                      className="max-h-full max-w-full object-contain"
                                    />
                                  ) : (
                                    <span
                                      className="text-xl font-semibold uppercase tracking-tight"
                                      style={{ color: getClientAccentColor(client) || undefined }}>
                                      {getClientName(client).slice(0, 2)}
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 space-y-3">
                                  <div className="space-y-1">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                      Client
                                    </p>
                                    <CardTitle className="min-w-0 text-[1.15rem] leading-tight tracking-[-0.02em] text-balance sm:text-[1.25rem]">
                                      {getClientName(client)}
                                    </CardTitle>
                                  </div>
                                  {canManageClient(client) ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 rounded-full border border-border/70 bg-background/90 px-3 shadow-sm hover:bg-background"
                                        onClick={() => openCreateScopeDrawer(client.id)}>
                                        <Plus className="h-4 w-4" />
                                        Add scope
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-9 rounded-full border border-border/70 bg-background/90 px-3 shadow-sm hover:bg-background"
                                        onClick={() => openEditClientDrawer(client.id)}>
                                        <Pencil className="h-4 w-4" />
                                        Edit
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div className="overflow-hidden rounded-[22px] border border-border/70 bg-background/90">
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
                                onClick={() => toggleClientInterface(String(client.id))}
                                aria-expanded={Boolean(expandedClientInterfaces[String(client.id)])}>
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    Client Interface
                                  </p>
                                </div>
                                <ChevronDown
                                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                                    expandedClientInterfaces[String(client.id)] ? "rotate-180" : ""
                                  }`}
                                />
                              </button>
                              {expandedClientInterfaces[String(client.id)] ? (
                                <div className="border-t border-border/60 bg-muted/[0.18] px-4 py-3">
                                  <div className="grid gap-3">
                                    <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2.5">
                                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                        Client Interface Name
                                      </span>
                                      <p className="mt-1 font-medium text-foreground">{getClientInterface(client)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2.5">
                                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                        Client Interface Number
                                      </span>
                                      <p className="mt-1 font-medium text-foreground">{getClientInterfaceContactNumber(client)}</p>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-5 bg-gradient-to-b from-background to-muted/20 pt-5 lg:pt-6">
                          <div className="overflow-hidden rounded-[22px] border border-border/70 bg-background/90">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
                              onClick={() => toggleScopeList(String(client.id))}
                              aria-expanded={Boolean(expandedScopeLists[String(client.id)])}>
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                  View Scope Of Work
                                </p>
                              </div>
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                                  expandedScopeLists[String(client.id)] ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                            {expandedScopeLists[String(client.id)] ? (
                              <div className="border-t border-border/60 bg-muted/[0.18] px-4 py-4">
                                {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}
                                {!loadError && scopes.length === 0 ? (
                                  <div className="rounded-2xl border border-dashed border-border bg-background/80 px-4 py-8 text-center">
                                    <p className="text-sm font-medium text-foreground">No scope items yet</p>
                                    <p className="mt-1 text-sm text-muted-foreground">Add a scope item to start organizing work for this client.</p>
                                  </div>
                                ) : null}

                                {!loadError && scopes.length > 0 ? (
                                  <div className="space-y-4">
                                    {scopes.map((scope) => (
                                      <Card
                                        key={String(scope.id ?? getScopeLabel(scope))}
                                        className="rounded-[28px] border border-border/80 bg-background py-0 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.45)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                                        <CardHeader className="p-4 pb-2">
                                          <div className="flex items-center justify-between gap-3">
                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                              <span className="inline-flex rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                Scope Of Work
                                              </span>
                                            </div>
                                            {canManageClient(client) ? (
                                              <Button
                                                type="button"
                                                size="icon-sm"
                                                variant="ghost"
                                                className="shrink-0 rounded-full border border-border/70 bg-background shadow-sm hover:bg-muted/50"
                                                onClick={() => handleEditScope(scope, client.id)}
                                                aria-label="Edit scope">
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                            ) : null}
                                          </div>
                                        </CardHeader>
                                        <CardContent className="grid gap-3 p-4 pt-0 text-sm">
                                          <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3.5">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                              Service Category
                                            </p>
                                            <p className="mt-2 text-[1rem] font-medium text-foreground">
                                              {getServiceCategory(scope)}
                                            </p>
                                          </div>
                                          <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3.5">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                              Deliverable/ Type of work
                                            </p>
                                            {getDeliverableTypeOfWorkItems(scope).length > 0 ? (
                                              <ul className="mt-2 space-y-1 text-[1rem] font-medium text-foreground">
                                                {getDeliverableTypeOfWorkItems(scope).map((item, index) => (
                                                  <li key={`${String(scope.id ?? getScopeLabel(scope))}-${index}`}>{item}</li>
                                                ))}
                                              </ul>
                                            ) : (
                                              <p className="mt-2 text-[1rem] font-medium text-foreground">-</p>
                                            )}
                                          </div>
                                          <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3.5">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                              Total monthly unit
                                            </p>
                                            <p className="mt-2 text-[1rem] font-medium text-foreground">{getUnit(scope)}</p>
                                          </div>
                                          <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3.5">
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                              Description
                                            </p>
                                            <p className="mt-2 leading-relaxed text-muted-foreground">{getScopeDescription(scope) || "-"}</p>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    </SwiperSlide>
                  ))}
                </Swiper>
              </div>
            ) : null}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </TooltipProvider>
  );
}
