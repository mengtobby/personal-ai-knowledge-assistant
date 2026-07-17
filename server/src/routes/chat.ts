import express, { type Router } from "express";
import { getAnthropic } from "../anthropic.js";
import { config } from "../config.js";
import { db, type MessageRow } from "../db.js";
import { retrieve, type RetrievedChunk } from "../retrieval.js";

export interface Citation {
  n: number;
  file: string;
  location: string | null;
}

const NOT_FOUND_REPLY =
  "I couldn't find anything relevant to that in your uploaded files, so I can't answer it. Try rephrasing, or upload a document that covers this topic.";
const NOT_IN_FILES_SENTINEL = "NOT_IN_FILES";
const HISTORY_LIMIT = 10;

const insertMessage = db.prepare(
  "INSERT INTO messages (role, content, citations) VALUES (?, ?, ?)"
);
const listMessages = db.prepare("SELECT * FROM messages ORDER BY id ASC");
const recentMessages = db.prepare(
  "SELECT * FROM messages ORDER BY id DESC LIMIT ?"
);
const clearMessages = db.prepare("DELETE FROM messages");

function buildSystemPrompt(chunks: RetrievedChunk[]): string {
  const context = chunks
    .map((chunk, i) => {
      const where = chunk.location ? `, ${chunk.location}` : "";
      return `[${i + 1}] (from "${chunk.fileName}"${where})\n${chunk.content}`;
    })
    .join("\n\n---\n\n");

  return `You are a personal knowledge assistant. You answer questions using ONLY the numbered excerpts below, which come from the user's uploaded files. Strict rules:
- Never use general knowledge or outside information; every claim must be supported by an excerpt.
- Cite excerpts inline with bracketed numbers like [1] or [2][3] after each claim they support.
- If the excerpts do not contain the information needed to answer, reply with exactly: ${NOT_IN_FILES_SENTINEL}
- Summaries and syntheses are fine as long as they only draw on the excerpts.

Excerpts:

${context}`;
}

function extractCitations(answer: string, chunks: RetrievedChunk[]): Citation[] {
  const cited = new Set<number>();
  for (const match of answer.matchAll(/\[(\d+)\]/g)) {
    const n = Number(match[1]);
    if (n >= 1 && n <= chunks.length) cited.add(n);
  }
  return [...cited].sort((a, b) => a - b).map((n) => ({
    n,
    file: chunks[n - 1].fileName,
    location: chunks[n - 1].location,
  }));
}

async function answerFromChunks(question: string, chunks: RetrievedChunk[]): Promise<{
  content: string;
  citations: Citation[];
}> {
  const history = (recentMessages.all(HISTORY_LIMIT) as MessageRow[])
    .reverse()
    .map((message) => ({ role: message.role, content: message.content }));

  const response = await getAnthropic().messages.create({
    model: config.chatModel,
    max_tokens: 2048,
    system: buildSystemPrompt(chunks),
    messages: [...history, { role: "user", content: question }],
  });

  const answer = response.content
    .filter((block): block is { type: "text"; text: string } & typeof block => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!answer || answer.includes(NOT_IN_FILES_SENTINEL)) {
    return { content: NOT_FOUND_REPLY, citations: [] };
  }
  return { content: answer, citations: extractCitations(answer, chunks) };
}

export function chatRouter(): Router {
  const router = express.Router();

  router.get("/history", (_req, res) => {
    const messages = (listMessages.all() as MessageRow[]).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      citations: message.citations ? (JSON.parse(message.citations) as Citation[]) : [],
      createdAt: message.created_at,
    }));
    res.json({ success: true, data: messages });
  });

  router.delete("/history", (_req, res) => {
    clearMessages.run();
    res.json({ success: true });
  });

  router.post("/", async (req, res) => {
    const question = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!question) {
      res.status(400).json({ success: false, error: "Message is required" });
      return;
    }
    if (question.length > 4000) {
      res.status(400).json({ success: false, error: "Message is too long (max 4000 characters)" });
      return;
    }

    try {
      const chunks = await retrieve(question);

      let reply: { content: string; citations: Citation[] };
      if (chunks.length === 0) {
        reply = { content: NOT_FOUND_REPLY, citations: [] };
      } else {
        reply = await answerFromChunks(question, chunks);
      }

      // Persist the exchange only after the answer succeeds, so a failed LLM
      // call doesn't leave a dangling user message in history.
      insertMessage.run("user", question, null);
      const result = insertMessage.run("assistant", reply.content, JSON.stringify(reply.citations));

      res.json({
        success: true,
        data: {
          id: Number(result.lastInsertRowid),
          role: "assistant",
          content: reply.content,
          citations: reply.citations,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[chat] Failed to answer:", message);
      res.status(502).json({ success: false, error: `Chat failed: ${message}` });
    }
  });

  return router;
}
