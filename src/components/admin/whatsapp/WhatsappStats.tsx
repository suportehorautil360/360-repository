import type { WhatsappOverview } from "@/lib/api/whatsapp";
import { Kpi } from "./ui";

const STATUS_TXT: Record<string, string> = {
  conectado: "Online",
  aguardando_qr: "Aguardando QR",
  conectando: "Conectando",
  desconectado: "Offline",
};

export function WhatsappStats({
  data,
  carregando,
}: {
  data: WhatsappOverview | null;
  carregando: boolean;
}) {
  const k = data?.kpis;
  const disp = k?.disponibilidade;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Kpi
        rotulo="Empresas utilizando"
        valor={k?.empresasUtilizando ?? 0}
        legenda="Com notificação ativa"
        carregando={carregando}
      />
      <Kpi
        rotulo="Mensagens hoje"
        valor={k?.mensagensHoje ?? 0}
        legenda={`${k?.mensagens30d ?? 0} nos últimos 30 dias`}
        carregando={carregando}
      />
      <Kpi
        rotulo="Status da sessão"
        valor={STATUS_TXT[data?.status ?? "desconectado"] ?? "—"}
        legenda="Conexão do remetente"
        carregando={carregando}
      />
      <Kpi
        rotulo="Disponibilidade"
        valor={disp ? `${disp.percentual}%` : "—"}
        legenda={
          disp?.janelaCompleta
            ? "Últimos 30 dias"
            : "Desde o início do registro"
        }
        carregando={carregando}
      />
    </div>
  );
}
