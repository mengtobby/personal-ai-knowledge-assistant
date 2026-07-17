import type { ChatMessage, FileEntry } from "./types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  let body: ApiResponse<T>;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error(`Request failed (${response.status})`);
  }
  if (!response.ok || !body.success) {
    const error = new Error(body.error ?? `Request failed (${response.status})`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return body.data as T;
}

export const api = {
  login: (password: string) =>
    request<void>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }),

  me: async (): Promise<boolean> => {
    const response = await fetch("/api/auth/me");
    const body = (await response.json()) as { authenticated?: boolean };
    return Boolean(body.authenticated);
  },

  listFiles: () => request<FileEntry[]>("/api/files"),

  uploadFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<FileEntry>("/api/files", { method: "POST", body: form });
  },

  deleteFile: (id: string) => request<void>(`/api/files/${id}`, { method: "DELETE" }),

  chatHistory: () => request<ChatMessage[]>("/api/chat/history"),

  clearChat: () => request<void>("/api/chat/history", { method: "DELETE" }),

  sendMessage: (message: string) =>
    request<ChatMessage>("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }),
};
