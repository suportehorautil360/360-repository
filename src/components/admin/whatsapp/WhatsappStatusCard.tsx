import type { WhatsappOverview } from "@/lib/api/whatsapp";
import { HubCard, Skeleton } from "./ui";
import { formatarDataHora, formatarDuracao, tempoRelativo } from "./format";

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2.5 last:border-0">
      <span className="text-xs uppercase tracking-wide text-slate-500">
        {rotulo}
      </span>
      <span className="text-right text-sm font-medium text-slate-200">
        {valor}
      </span>
    </div>
  );
}

export function WhatsappStatusCard({
  data,
  carregando,
}: {
  data: WhatsappOverview | null;
  carregando: boolean;
}) {
  const s = data?.sessao;
  return (
    <HubCard>
      <h3 className="text-sm font-semibold text-slate-200">Status da sessão</h3>
      {carregando ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <Linha rotulo="Número" valor={s?.numeroConectado ?? "—"} />
          <Linha rotulo="Sessão" valor={s?.nomeSessao ?? "—"} />
          <Linha
            rotulo="Conectado desde"
            valor={formatarDataHora(s?.conectadoDesde ?? null)}
          />
          <Linha
            rotulo="Último ping"
            valor={tempoRelativo(s?.ultimaAtividade ?? null)}
          />
          <Linha
            rotulo="Tempo de sessão"
            valor={formatarDuracao(s?.conectadoDesde ?? null)}
          />
          <Linha rotulo="Versão" valor={s?.versaoSessao ?? "—"} />
          <Linha rotulo="Ambiente" valor={s?.ambiente ?? "—"} />
        </div>
      )}
    </HubCard>
  );
}
