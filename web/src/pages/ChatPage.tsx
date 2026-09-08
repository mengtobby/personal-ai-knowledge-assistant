import { ChatPanel } from "../components/ChatPanel";

export function ChatPage({ hasIndexedFiles }: { hasIndexedFiles: boolean }) {
  return (
    <main className="main">
      <ChatPanel hasIndexedFiles={hasIndexedFiles} />
    </main>
  );
}
