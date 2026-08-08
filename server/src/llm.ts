import { config } from "./config.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface OllamaChatResponse {
  message?: { role: string; content: string };
}

function unreachableError(err: unknown): Error {
  return new Error(
    `Ollama is unreachable at ${config.ollamaUrl}. Start it with "ollama serve" and make sure "${config.ollamaChatModel}" is pulled (ollama pull ${config.ollamaChatModel}).`,
    { cause: err }
  );
}

/** Ask the local Ollama server for a chat completion. */
export async function chatComplete(system: string, messages: ChatMessage[]): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaChatModel,
        stream: false,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    });
  } catch (err) {
    throw unreachableError(err);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Ollama chat request failed with status ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  const body = (await response.json()) as OllamaChatResponse;
  return (body.message?.content ?? "").trim();
}

/** Whether the local Ollama server is reachable right now. */
export async function ollamaHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${config.ollamaUrl}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}
