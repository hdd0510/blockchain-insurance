import axios from "axios";
import { clearAuth, getToken } from "./auth-storage";

// Dynamic base URL: uses the same hostname the frontend is loaded from.
// This makes the app work whether accessed via localhost OR network IP.
// Override with REACT_APP_API_URL only if pointing to a different host.
function resolveApiBaseUrl() {
  if (process.env.REACT_APP_API_URL && !process.env.REACT_APP_API_URL.includes("localhost")) {
    return process.env.REACT_APP_API_URL;
  }
  if (typeof window !== "undefined" && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3001/api`;
  }
  return "http://localhost:3001/api";
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token from this tab's sessionStorage to every request
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid — clear this tab's session only
      clearAuth();
    }
    return Promise.reject(error);
  }
);

export default api;
