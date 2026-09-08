import { LiquidLogo } from "../liquid-logo/LiquidLogo";
import { Link } from "../router";
import { ChatIcon, FilesIcon } from "./icons";

interface NavRailProps {
  route: string;
  fileCount: number;
}

export function NavRail({ route, fileCount }: NavRailProps) {
  return (
    <nav className="nav-rail">
      <Link to="/" className="brand">
        <LiquidLogo size={32} mark="K" />
        <h1 className="app-title">Knowledge Assistant</h1>
      </Link>

      <Link to="/" className={`nav-link${route === "/" ? " active" : ""}`}>
        <ChatIcon className="nav-icon" />
        Chat
      </Link>
      <Link to="/files" className={`nav-link${route === "/files" ? " active" : ""}`}>
        <FilesIcon className="nav-icon" />
        Files
        {fileCount > 0 && <span className="nav-badge">{fileCount}</span>}
      </Link>
    </nav>
  );
}
