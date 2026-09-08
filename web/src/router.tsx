/**
 * Minimal pushState router. The app only has a couple of static top-level
 * pages with no params or nesting, so a small hand-rolled router is simpler
 * than pulling in a routing library. The server already falls back to
 * index.html for any non-/api path (see server/src/index.ts), and Vite's dev
 * server does the same by default, so real, bookmarkable URLs work in both.
 */
import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();

function currentPath(): string {
  return window.location.pathname;
}

export function navigate(path: string): void {
  if (currentPath() === path) return;
  window.history.pushState(null, "", path);
  listeners.forEach((listener) => listener());
}

window.addEventListener("popstate", () => listeners.forEach((listener) => listener()));

/** The current pathname; re-renders on navigation and browser back/forward. */
export function useRoute(): string {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const listener = () => setPath(currentPath());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return path;
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: ReactNode;
}

/** A normal anchor that navigates client-side on a plain left-click. */
export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
