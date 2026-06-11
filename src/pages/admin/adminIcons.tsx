import type { SVGProps } from "react";
import { LayoutGrid } from "lucide-react";

const iconProps: SVGProps<SVGSVGElement> = {
  width: 20,
  height: 20,
  strokeWidth: 2,
  "aria-hidden": true,
};

/** Grid do Dashboard — monocromático, herda a cor (laranja quando ativo). */
export function AdminIconDashboard() {
  return <LayoutGrid {...iconProps} />;
}

/** Logo relógio da marca HORA ÚTIL 360. */
export function ClockLogo() {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="3" />
      <circle
        cx="24"
        cy="24"
        r="4"
        fill="var(--primary, #f97316)"
        stroke="var(--primary, #f97316)"
        strokeWidth="2"
      />
      <path
        d="M24 24V14"
        stroke="var(--primary, #f97316)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M24 24H32"
        stroke="var(--primary, #f97316)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
