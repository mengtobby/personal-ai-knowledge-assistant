import { useState, type FormEvent } from "react";
import { api } from "../api";
import { LiquidLogo } from "../liquid-logo/LiquidLogo";

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="centered">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">
          <LiquidLogo size={40} mark="K" />
          <h1 className="app-title">Knowledge Assistant</h1>
        </div>
        <p className="muted">Enter your password to continue.</p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoFocus
        />
        {error && <div className="error-banner">{error}</div>}
        <button type="submit" disabled={busy || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
