import { cn } from "@/lib/utils";
import type { MensagemSuporte, SuporteChannel } from "@/lib/api/suporte";
import { CANAL_LABEL } from "@/lib/api/suporte";

export type SuporteOrigem = "posto" | "oficina";

export const SUPORTE_ORIGEM_CONFIG: Record<
  SuporteOrigem,
  {
    titulo: string;
    subtitulo: string;
    appLabel: string;
    remetenteLabel: string;
    remetenteAbrev: string;
    icone: string;
    listaVazia: string;
    selecionarConversa: string;
  }
> = {
  posto: {
    titulo: "Postos de combustível",
    subtitulo: "Mensagens do portal do posto — operador do abastecimento",
    appLabel: "Portal do posto",
    remetenteLabel: "Operador do posto",
    remetenteAbrev: "POSTO",
    icone: "⛽",
    listaVazia: "Nenhuma mensagem dos postos ainda.",
    selecionarConversa: "Selecione um posto para responder.",
  },
  oficina: {
    titulo: "Oficinas mecânicas",
    subtitulo: "Mensagens do app de oficina — OS, orçamentos e repasses",
    appLabel: "App de oficina",
    remetenteLabel: "Equipe da oficina",
    remetenteAbrev: "OFICINA",
    icone: "🔧",
    listaVazia: "Nenhuma mensagem das oficinas ainda.",
    selecionarConversa: "Selecione uma oficina para responder.",
  },
};

export function fmtHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const data = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data}, ${hora}`;
}

export function CanalChip({ channel }: { channel: SuporteChannel }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide",
        channel === "financeiro"
          ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
          : "border-sky-400/35 bg-sky-500/15 text-sky-200",
      )}
    >
      {CANAL_LABEL[channel]}
    </span>
  );
}

export function OrigemBadge({
  origem,
  size = "sm",
}: {
  origem: SuporteOrigem;
  size?: "sm" | "md";
}) {
  const cfg = SUPORTE_ORIGEM_CONFIG[origem];
  const md = size === "md";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-semibold",
        md ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[0.6875rem]",
        origem === "posto"
          ? "border-violet-400/35 bg-violet-500/15 text-violet-100"
          : "border-cyan-400/35 bg-cyan-500/15 text-cyan-100",
      )}
    >
      <span aria-hidden>{cfg.icone}</span>
      {cfg.appLabel}
    </span>
  );
}

/** Explica de onde vêm as mensagens e o que cada cor/rótulo significa. */
export function SuporteLegendaTipos() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
      <p className="font-medium text-slate-100">Como ler as conversas</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <li className="flex items-start gap-2">
          <OrigemBadge origem="posto" />
          <span className="text-[0.8125rem] leading-snug text-slate-400">
            Operador no portal de abastecimento
          </span>
        </li>
        <li className="flex items-start gap-2">
          <OrigemBadge origem="oficina" />
          <span className="text-[0.8125rem] leading-snug text-slate-400">
            Mecânica / gestor no app de oficina
          </span>
        </li>
        <li className="flex items-start gap-2 sm:col-span-2 lg:col-span-1">
          <span className="inline-flex shrink-0 items-center rounded-md border border-orange-400/35 bg-orange-500/15 px-2 py-0.5 text-[0.6875rem] font-semibold text-orange-100">
            Hora Útil
          </span>
          <span className="text-[0.8125rem] leading-snug text-slate-400">
            Sua resposta ou confirmação automática ao receber
          </span>
        </li>
      </ul>
    </div>
  );
}

export function BolhaMensagem({
  msg,
  origem,
}: {
  msg: MensagemSuporte;
  origem: SuporteOrigem;
}) {
  const cfg = SUPORTE_ORIGEM_CONFIG[origem];
  const ehParceiro = msg.sender === "user";

  if (ehParceiro) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] space-y-1">
          <div className="flex">
            <OrigemBadge origem={origem} />
          </div>
          <p className="text-[0.65rem] font-medium uppercase tracking-wider text-slate-400">
            {cfg.remetenteLabel}
          </p>
          <div
            className={cn(
              "rounded-2xl rounded-bl-md border px-3 py-2",
              origem === "posto"
                ? "border-violet-400/30 bg-violet-500/20"
                : "border-cyan-400/30 bg-cyan-500/20",
            )}
          >
            <p className="text-sm leading-relaxed text-white">{msg.text}</p>
            <p className="mt-1 text-[0.65rem] text-slate-300">
              {fmtHora(msg.createdAt)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] space-y-1">
        <p className="text-right text-[0.65rem] font-medium uppercase tracking-wider text-slate-400">
          Hora Útil
          {msg.autoReply ? (
            <span className="ml-1.5 inline-flex rounded border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 normal-case text-sky-200">
              resposta automática
            </span>
          ) : (
            <span className="ml-1.5 inline-flex rounded border border-orange-400/30 bg-orange-500/10 px-1.5 py-0.5 normal-case text-orange-200">
              resposta da equipe
            </span>
          )}
        </p>
        <div className="rounded-2xl rounded-br-md border border-orange-400/25 bg-orange-500/20 px-3 py-2">
          <p className="text-sm leading-relaxed text-white">{msg.text}</p>
          <p className="mt-1 text-right text-[0.65rem] text-slate-300">
            {fmtHora(msg.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
