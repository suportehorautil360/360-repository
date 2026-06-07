import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Cartão base do hub (superfície dark translúcida). */
export function HubCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.03] p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Card de KPI: rótulo, valor grande e legenda. */
export function Kpi({
  rotulo,
  valor,
  legenda,
  carregando,
}: {
  rotulo: string;
  valor: ReactNode;
  legenda?: string;
  carregando?: boolean;
}) {
  return (
    <HubCard>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {rotulo}
      </div>
      {carregando ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <div className="mt-1 text-2xl font-semibold text-slate-100">{valor}</div>
      )}
      {legenda && !carregando && (
        <div className="mt-1 text-xs text-slate-500">{legenda}</div>
      )}
    </HubCard>
  );
}

type Tom = "ok" | "warn" | "off";

const TOM_DOT: Record<Tom, string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  off: "bg-red-400",
};
const TOM_TEXTO: Record<Tom, string> = {
  ok: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  warn: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  off: "text-red-300 border-red-400/30 bg-red-400/10",
};

export function StatusDot({ tom }: { tom: Tom }) {
  return (
    <span className={cn("inline-block h-2.5 w-2.5 rounded-full", TOM_DOT[tom])} />
  );
}

export function StatusBadge({
  tom,
  children,
}: {
  tom: Tom;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
        TOM_TEXTO[tom],
      )}
    >
      <StatusDot tom={tom} />
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-white/10", className)}
      aria-hidden
    />
  );
}
