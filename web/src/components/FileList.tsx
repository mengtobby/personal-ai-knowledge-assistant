import type { FileEntry } from "../types";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** The server stores UTC timestamps without a zone marker; add one so Date parses it as UTC, not local time. */
function formatRelativeTime(createdAt: string): string {
  const date = new Date(`${createdAt.replace(" ", "T")}Z`);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const STATUS_LABEL: Record<FileEntry["status"], string> = {
  processing: "Indexing…",
  indexed: "Ready",
  error: "Failed",
};

export function FileList({
  files,
  onDelete,
}: {
  files: FileEntry[];
  onDelete: (id: string) => Promise<void>;
}) {
  if (files.length === 0) {
    return <p className="muted small">No files yet. Upload something to get started.</p>;
  }

  return (
    <ul className="file-list">
      {files.map((file) => (
        <li key={file.id} className="file-item">
          <div className="file-info">
            <span className="file-name" title={file.name}>
              {file.name}
            </span>
            <span className="muted small">
              {formatRelativeTime(file.createdAt)} · {formatSize(file.size)}
              {file.status === "indexed" && ` · ${file.chunkCount} chunks`}
              {file.pageCount ? ` · ${file.pageCount} pages` : ""}
            </span>
            {file.status === "error" && file.error && (
              <span className="error-text small" title={file.error}>
                {file.error}
              </span>
            )}
          </div>
          <span className={`status-chip status-${file.status}`}>{STATUS_LABEL[file.status]}</span>
          <button
            className="icon-button"
            title="Delete file"
            aria-label={`Delete ${file.name}`}
            onClick={() => {
              if (window.confirm(`Delete "${file.name}" and its index?`)) void onDelete(file.id);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  );
}
