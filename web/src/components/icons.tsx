import type { SVGProps } from "react";

const BASE_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M4 4.5h16v11H9l-3.5 3.5V15.5H4v-11Z" />
    </svg>
  );
}

export function FilesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M6 2.5h7l5 5v14H6z" />
      <path d="M13 2.5v5h5" />
    </svg>
  );
}
