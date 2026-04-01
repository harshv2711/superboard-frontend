function resolveApiBaseUrl() {
  const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();

  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://127.0.0.1:8000";
    }
  }

  return configuredBaseUrl || "http://127.0.0.1:8000";
}

const API_BASE_URL = resolveApiBaseUrl().replace(/\/$/, "");
const AUTH_TOKEN_KEY = "superboard_auth_token";
const AUTH_USER_KEY = "superboard_auth_user";

function getStoredToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

function setStoredToken(token) {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
}

function setStoredUser(user) {
  if (typeof window === "undefined") return;
  if (user && typeof user === "object") {
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    return;
  }
  window.localStorage.removeItem(AUTH_USER_KEY);
}

function readTokenFromResponse(payload) {
  if (!payload || typeof payload !== "object") return "";
  return payload.token || payload.auth_token || payload.key || "";
}

function authHeaderFromToken(token) {
  return token ? { Authorization: `Token ${token}` } : {};
}

function extractErrorMessage(errorData) {
  if (!errorData) return "";
  if (typeof errorData === "string") return errorData;

  if (Array.isArray(errorData)) {
    const first = errorData.find(Boolean);
    return typeof first === "string" ? first : extractErrorMessage(first);
  }

  if (typeof errorData === "object") {
    if (typeof errorData.detail === "string") return errorData.detail;
    if (Array.isArray(errorData.detail)) return extractErrorMessage(errorData.detail);

    const fieldEntries = Object.entries(errorData);
    if (fieldEntries.length > 0) {
      const fieldMessages = fieldEntries
        .map(([field, value]) => {
          const message = extractErrorMessage(value);
          if (!message) return "";
          return `${field}: ${message}`;
        })
        .filter(Boolean);

      if (fieldMessages.length > 0) return fieldMessages.join(" | ");
    }
  }

  return "";
}

function buildUrl(path, query = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

function resolveUrl(pathOrUrl) {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return buildUrl(pathOrUrl);
}

function serializeRequestBody(payload) {
  if (typeof FormData !== "undefined" && payload instanceof FormData) {
    return payload;
  }
  return JSON.stringify(payload);
}

async function httpRequest(path, options = {}) {
  const { skipAuth, ...fetchOptions } = options;
  const currentToken = getStoredToken();
  const authHeaders = skipAuth ? {} : authHeaderFromToken(currentToken);
  const isFormDataBody = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
  const response = await fetch(resolveUrl(path), {
    headers: {
      ...authHeaders,
      ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
      ...(fetchOptions.headers || {}),
    },
    ...fetchOptions,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errorData = await response.json();
      const parsedMessage = extractErrorMessage(errorData);
      if (parsedMessage) message = parsedMessage;
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listAllPages(path, query = {}) {
  let nextUrl = buildUrl(path, query);
  const allRows = [];
  const currentToken = getStoredToken();
  const headers = {
    ...authHeaderFromToken(currentToken),
  };

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers,
    });
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const errorData = await response.json();
        const parsedMessage = extractErrorMessage(errorData);
        if (parsedMessage) message = parsedMessage;
      } catch {
        // keep fallback message
      }
      throw new Error(message);
    }

    const payload = await response.json();
    if (Array.isArray(payload)) {
      allRows.push(...payload);
      nextUrl = null;
    } else {
      allRows.push(...(payload.results || []));
      nextUrl = payload.next;
    }
  }

  return allRows;
}

function createCrud(path) {
  return {
    list: (query = {}) => httpRequest(`${path}?${new URLSearchParams(query).toString()}`),
    listAll: (query = {}) => listAllPages(path, query),
    retrieve: (id) => httpRequest(`${path}${id}/`),
    create: (payload) => httpRequest(path, { method: "POST", body: serializeRequestBody(payload) }),
    update: (id, payload) => httpRequest(`${path}${id}/`, { method: "PUT", body: serializeRequestBody(payload) }),
    patch: (id, payload) => httpRequest(`${path}${id}/`, { method: "PATCH", body: serializeRequestBody(payload) }),
    remove: (id) => httpRequest(`${path}${id}/`, { method: "DELETE" }),
  };
}

const usersCrud = createCrud("/api/users/");
const employeesCrud = createCrud("/api/employees/");
const brandsCrud = createCrud("/api/brands/");
const serviceCategoriesCrud = createCrud("/api/service-categories/");
const typeOfWorkCrud = createCrud("/api/type-of-work/");
const groupsCrud = createCrud("/api/groups/");
const groupMembersCrud = createCrud("/api/group-members/");
const negativeRemarksCrud = createCrud("/api/negative-remarks/");
const negativeRemarksOnTaskCrud = createCrud("/api/negative-remarks-on-task/");
const taskStagesCrud = createCrud("/api/taskstage/");
const taskOnStagesCrud = createCrud("/api/taskonstage/");
const clientsCrud = createCrud("/api/clients/");
const clientAttachmentsCrud = createCrud("/api/client-attachments/");
const clientMonthlyAmountsCrud = createCrud("/api/client-monthly-amounts/");
const taskAttachmentsCrud = createCrud("/api/task-attachments/");
const scopeOfWorkCrud = createCrud("/api/scope-of-work/");
const tasksCrud = createCrud("/api/tasks/");

async function listDesignerUsers(query = {}) {
  const [groups, groupMembers, users] = await Promise.all([
    groupsCrud.listAll({ page_size: 300 }),
    groupMembersCrud.listAll({ page_size: 1000 }),
    usersCrud.listAll({ page_size: 300 }),
  ]);

  const designerGroupIds = new Set(
    (Array.isArray(groups) ? groups : [])
      .filter((group) => String(group?.name || "").trim().toLowerCase() === "designer")
      .map((group) => String(group.id)),
  );

  if (!designerGroupIds.size) {
    return (Array.isArray(users) ? users : []).filter((user) => user?.role === "designer");
  }

  const designerUserIds = new Set(
    (Array.isArray(groupMembers) ? groupMembers : [])
      .filter((member) => designerGroupIds.has(String(member?.group || "")))
      .map((member) => String(member?.user || ""))
      .filter(Boolean),
  );

  return (Array.isArray(users) ? users : []).filter((user) => designerUserIds.has(String(user?.id || user?.user_id || "")));
}

export const superboardApi = {
  auth: {
    getToken: () => getStoredToken(),
    setToken: (token) => setStoredToken(token),
    clearToken: () => {
      setStoredToken("");
      setStoredUser(null);
    },
    register: async (payload) => {
      const response = await httpRequest("/api/auth/register/", {
        method: "POST",
        body: JSON.stringify(payload),
        skipAuth: true,
      });
      const token = readTokenFromResponse(response);
      if (token) setStoredToken(token);
      setStoredUser(response);
      return response;
    },
    login: async (payload) => {
      const response = await httpRequest("/api/auth/login/", {
        method: "POST",
        body: JSON.stringify(payload),
        skipAuth: true,
      });
      const token = readTokenFromResponse(response);
      if (token) setStoredToken(token);
      setStoredUser(response);
      return response;
    },
    logout: async (token) => {
      const activeToken = token || getStoredToken();
      const response = await httpRequest("/api/auth/logout/", {
        method: "POST",
        headers: authHeaderFromToken(activeToken),
      });
      setStoredToken("");
      setStoredUser(null);
      return response;
    },
    me: (token) => {
      const activeToken = token || getStoredToken();
      return httpRequest("/api/auth/me/", {
        headers: authHeaderFromToken(activeToken),
      }).then((response) => {
        setStoredUser(response);
        return response;
      });
    },
    updateProfile: (payload) =>
      httpRequest("/api/auth/me/", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }).then((response) => {
        setStoredUser(response);
        return response;
      }),
    changePassword: (payload) =>
      httpRequest("/api/auth/change-password/", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    requestPasswordReset: (payload) =>
      httpRequest("/api/auth/password-reset/request/", {
        method: "POST",
        body: JSON.stringify(payload),
        skipAuth: true,
      }),
    resetPassword: (payload) =>
      httpRequest("/api/auth/password-reset/confirm/", {
        method: "POST",
        body: JSON.stringify(payload),
        skipAuth: true,
      }),
  },
  users: usersCrud,
  employees: employeesCrud,
  groups: groupsCrud,
  groupMembers: groupMembersCrud,
  designers: {
    listAll: listDesignerUsers,
  },
  brands: brandsCrud,
  serviceCategories: serviceCategoriesCrud,
  typeOfWork: typeOfWorkCrud,
  negativeRemarks: negativeRemarksCrud,
  negativeRemarksOnTask: negativeRemarksOnTaskCrud,
  taskStages: taskStagesCrud,
  taskOnStages: taskOnStagesCrud,
  clients: clientsCrud,
  clientAttachments: clientAttachmentsCrud,
  clientMonthlyAmounts: clientMonthlyAmountsCrud,
  taskAttachments: taskAttachmentsCrud,
  scopeOfWork: scopeOfWorkCrud,
  tasks: {
    ...tasksCrud,
    designerKpi: ({ designerId, month }) =>
      httpRequest(`/api/tasks/designer-kpi/?${new URLSearchParams({
        ...(designerId ? { designer_id: designerId } : {}),
        ...(month ? { month } : {}),
      }).toString()}`),
    designerKpiYears: ({ designerId } = {}) =>
      httpRequest(`/api/tasks/designer-kpi-years/?${new URLSearchParams({
        ...(designerId ? { designer_id: designerId } : {}),
      }).toString()}`),
    originals: (query = {}) =>
      httpRequest(`/api/tasks/originals/?${new URLSearchParams(query).toString()}`),
    originalsAll: (query = {}) => listAllPages("/api/tasks/originals/", query),
    onlyRevisions: (query = {}) =>
      httpRequest(`/api/tasks/only_revisions/?${new URLSearchParams(query).toString()}`),
    onlyRevisionsAll: (query = {}) => listAllPages("/api/tasks/only_revisions/", query),
    revisions: (taskId) => httpRequest(`/api/tasks/${taskId}/revisions/`),
    onlyRedos: (query = {}) =>
      httpRequest(`/api/tasks/only_redos/?${new URLSearchParams(query).toString()}`),
    onlyRedosAll: (query = {}) => listAllPages("/api/tasks/only_redos/", query),
    redos: (taskId) => httpRequest(`/api/tasks/${taskId}/redos/`),
  },
};

export { API_BASE_URL };
