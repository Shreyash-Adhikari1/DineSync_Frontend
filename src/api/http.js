import axios from "axios";
import { API_BASE_URL } from "../config";

export const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem("dinesync_business_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function getErrorMessage(error, fallback = "Something went wrong") {
  return error?.response?.data?.message || error?.message || fallback;
}
