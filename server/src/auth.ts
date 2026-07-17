import crypto from "node:crypto";
import type { NextFunction, Request, Response, Router } from "express";
import express from "express";
import { config } from "./config.js";
import { db } from "./db.js";

const COOKIE_NAME = "ka_session";
const insertSession = db.prepare("INSERT INTO sessions (token) VALUES (?)");
const findSession = db.prepare("SELECT token FROM sessions WHERE token = ?");
const deleteSession = db.prepare("DELETE FROM sessions WHERE token = ?");

function timingSafeEquals(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (typeof token === "string" && findSession.get(token)) {
    next();
    return;
  }
  res.status(401).json({ success: false, error: "Not authenticated" });
}

export function authRouter(): Router {
  const router = express.Router();

  router.post("/login", (req, res) => {
    const password = req.body?.password;
    if (typeof password !== "string" || !timingSafeEquals(password, config.appPassword)) {
      res.status(401).json({ success: false, error: "Wrong password" });
      return;
    }
    const token = crypto.randomBytes(32).toString("hex");
    insertSession.run(token);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });
    res.json({ success: true });
  });

  router.post("/logout", (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (typeof token === "string") deleteSession.run(token);
    res.clearCookie(COOKIE_NAME);
    res.json({ success: true });
  });

  router.get("/me", (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    const authed = typeof token === "string" && Boolean(findSession.get(token));
    res.json({ success: true, authenticated: authed });
  });

  return router;
}
