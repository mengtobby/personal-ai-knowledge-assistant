import { FileList } from "../components/FileList";
import { UploadArea } from "../components/UploadArea";
import type { FileEntry } from "../types";

interface FilesPageProps {
  files: FileEntry[];
  uploadError: string | null;
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function FilesPage({ files, uploadError, onUpload, onDelete }: FilesPageProps) {
  const indexedCount = files.filter((file) => file.status === "indexed").length;

  return (
    <main className="page">
      <header className="page-header">
        <h2>Your files</h2>
        <p className="muted">
          {files.length === 0
            ? "Upload documents to start chatting with them."
            : `${indexedCount} of ${files.length} ready to chat with.`}
        </p>
      </header>
      <UploadArea onUpload={onUpload} />
      {uploadError && <div className="error-banner">{uploadError}</div>}
      <FileList files={files} onDelete={onDelete} />
    </main>
  );
}
