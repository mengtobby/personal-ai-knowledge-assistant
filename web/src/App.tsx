import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { ChatPanel } from "./components/ChatPanel";
import { FileList } from "./components/FileList";
import { Login } from "./components/Login";
import { UploadArea } from "./components/UploadArea";
import { LiquidLogo } from "./liquid-logo/LiquidLogo";
import type { FileEntry } from "./types";

const POLL_MS = 2500;

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    void api.me().then(setAuthed);
  }, []);

  const refreshFiles = useCallback(async () => {
    try {
      setFiles(await api.listFiles());
    } catch (err) {
      if ((err as { status?: number }).status === 401) setAuthed(false);
    }
  }, []);

  useEffect(() => {
    if (authed) void refreshFiles();
  }, [authed, refreshFiles]);

  // Poll while any file is still processing so statuses update live.
  useEffect(() => {
    if (!authed || !files.some((file) => file.status === "processing")) return;
    const timer = setInterval(() => void refreshFiles(), POLL_MS);
    return () => clearInterval(timer);
  }, [authed, files, refreshFiles]);

  const handleUpload = useCallback(
    async (selected: File[]) => {
      setUploadError(null);
      for (const file of selected) {
        try {
          await api.uploadFile(file);
        } catch (err) {
          setUploadError(`${file.name}: ${(err as Error).message}`);
        }
      }
      await refreshFiles();
    },
    [refreshFiles]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await api.deleteFile(id);
      } catch (err) {
        setUploadError((err as Error).message);
      }
      await refreshFiles();
    },
    [refreshFiles]
  );

  if (authed === null) return <div className="centered">Loading…</div>;
  if (!authed) return <Login onSuccess={() => setAuthed(true)} />;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <LiquidLogo size={32} mark="K" />
          <h1 className="app-title">Knowledge Assistant</h1>
        </div>
        <UploadArea onUpload={handleUpload} />
        {uploadError && <div className="error-banner">{uploadError}</div>}
        <FileList files={files} onDelete={handleDelete} />
      </aside>
      <main className="main">
        <ChatPanel hasIndexedFiles={files.some((file) => file.status === "indexed")} />
      </main>
    </div>
  );
}
