import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Login } from "./components/Login";
import { NavRail } from "./components/NavRail";
import { ChatPage } from "./pages/ChatPage";
import { FilesPage } from "./pages/FilesPage";
import { useRoute } from "./router";
import type { FileEntry } from "./types";

const POLL_MS = 2500;

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const route = useRoute();

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
    <div className="app-shell">
      <NavRail route={route} fileCount={files.length} />
      {route === "/files" ? (
        <FilesPage files={files} uploadError={uploadError} onUpload={handleUpload} onDelete={handleDelete} />
      ) : (
        <ChatPage hasIndexedFiles={files.some((file) => file.status === "indexed")} />
      )}
    </div>
  );
}
