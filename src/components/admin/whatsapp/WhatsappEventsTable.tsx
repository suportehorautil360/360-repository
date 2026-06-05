import type { EventoWhats, WhatsappOverview } from "@/lib/api/whatsapp";
import { HubCard, Skeleton, StatusDot } from "./ui";
import { formatarDataHora } from "./format";

const EVENTO_TXT: Record<EventoWhats["tipo"], string> = {
  sessao_iniciada: "Sessão iniciada",
  qr_gerado: "QR gerado",
  conectado: "Conectado",
  queda: "Queda de conexão",
  sessao_encerrada: "Sessão encerrada",
};
const STATUS_TOM: Record<EventoWhats["status"], "ok" | "warn" | "off"> = {
  sucesso: "ok",
  aviso: "warn",
  erro: "off",
};
const STATUS_TXT: Record<EventoWhats["status"], string> = {
  sucesso: "Sucesso",
  aviso: "Aviso",
  erro: "Erro",
};

export function WhatsappEventsTable({
  data,
  carregando,
}: {
  data: WhatsappOverview | null;
  carregando: boolean;
}) {
  const eventos = data?.eventos ?? [];
  return (
    <HubCard className="p-0">
      <h3 className="px-5 pt-5 text-sm font-semibold text-slate-200">
        Histórico de eventos
      </h3>
      {carregando ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : eventos.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          Nenhum evento registrado ainda.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2 font-medium">Data</th>
                <th className="px-5 py-2 font-medium">Evento</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3 text-slate-400">
                    {formatarDataHora(e.timestamp)}
                  </td>
                  <td className="px-5 py-3 text-slate-200">
                    {EVENTO_TXT[e.tipo] ?? e.tipo}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2 text-slate-300">
                      <StatusDot tom={STATUS_TOM[e.status]} />
                      {STATUS_TXT[e.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HubCard>
  );
}
