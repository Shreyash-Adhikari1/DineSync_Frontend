const normalizeBaseUrl = (value, name) => {
  if (!value) {
    throw new Error(`${name} is required. Set it in dinesync_frontend/.env.local.`);
  }
  return value.replace(/\/+$/, "");
};

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_URL,
  "VITE_API_URL",
);

export const SOCKET_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_SOCKET_URL,
  "VITE_SOCKET_URL",
);

export const uploadsUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}/uploads/menu-item/${path}`;
};
