import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api";
import type { ChatMessage } from "../types";

export function ChatPanel({ hasIndexedFiles }: { hasIndexedFiles: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.chatHistory().then(setMessages).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;

    setInput("");
    setError(null);
    setBusy(true);
    const pending: ChatMessage = { id: -1, role: "user", content: question, citations: [] };
    setMessages((current) => [...current, pending]);

    try {
      const reply = await api.sendMessage(question);
      setMessages((current) => [...current, reply]);
    } catch (err) {
      setError((err as Error).message);
      // Server only persists successful exchanges; drop the optimistic message.
      setMessages((current) => current.filter((message) => message !== pending));
      setInput(question);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!window.confirm("Clear the entire chat history?")) return;
    await api.clearChat();
    setMessages([]);
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h2>Chat with your files</h2>
        {messages.length > 0 && (
          <button className="ghost-button" onClick={() => void clear()}>
            Clear history
          </button>
        )}
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p className="muted centered-text">
            {hasIndexedFiles
              ? "Ask anything about your uploaded files."
              : "Upload a file first, then ask questions about it here."}
          </p>
        )}
        {messages.map((message, index) => (
          <div key={`${message.id}-${index}`} className={`message message-${message.role}`}>
            <div className="message-content">{message.content}</div>
            {message.citations.length > 0 && (
              <div className="citations">
                {message.citations.map((citation) => (
                  <span key={citation.n} className="citation-chip" title={citation.file}>
                    [{citation.n}] {citation.file}
                    {citation.location ? ` · ${citation.location}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="message message-assistant muted">Thinking…</div>}
        <div ref={bottomRef} />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <form className="chat-input" onSubmit={send}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a question about your files… "
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send  
        </button>
      </form>
    </div>
  );
}
