const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

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

async function httpRequest(path, options = {}) {
  const response = await fetch(resolveUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData?.detail) {
        message = errorData.detail;
      }
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

  while (nextUrl) {
    const response = await fetch(nextUrl);
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
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
    create: (payload) => httpRequest(path, { method: "POST", body: JSON.stringify(payload) }),
    update: (id, payload) => httpRequest(`${path}${id}/`, { method: "PUT", body: JSON.stringify(payload) }),
    patch: (id, payload) => httpRequest(`${path}${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
    remove: (id) => httpRequest(`${path}${id}/`, { method: "DELETE" }),
  };
}

const usersCrud = createCrud("/api/users/");
const brandsCrud = createCrud("/api/brands/");
const clientsCrud = createCrud("/api/clients/");
const scopeOfWorkCrud = createCrud("/api/scope-of-work/");
const tasksCrud = createCrud("/api/tasks/");

export const superboardApi = {
  auth: {
    login: (payload) => httpRequest("/api/auth/login/", { method: "POST", body: JSON.stringify(payload) }),
    logout: (token) =>
      httpRequest("/api/auth/logout/", {
        method: "POST",
        headers: token ? { Authorization: `Token ${token}` } : {},
      }),
    me: (token) =>
      httpRequest("/api/auth/me/", {
        headers: token ? { Authorization: `Token ${token}` } : {},
      }),
  },
  users: usersCrud,
  brands: brandsCrud,
  clients: clientsCrud,
  scopeOfWork: scopeOfWorkCrud,
  tasks: {
    ...tasksCrud,
    originals: (query = {}) =>
      httpRequest(`/api/tasks/originals/?${new URLSearchParams(query).toString()}`),
    originalsAll: (query = {}) => listAllPages("/api/tasks/originals/", query),
    onlyRevisions: (query = {}) =>
      httpRequest(`/api/tasks/only_revisions/?${new URLSearchParams(query).toString()}`),
    onlyRevisionsAll: (query = {}) => listAllPages("/api/tasks/only_revisions/", query),
    revisions: (taskId) => httpRequest(`/api/tasks/${taskId}/revisions/`),
  },
};

export { API_BASE_URL };
