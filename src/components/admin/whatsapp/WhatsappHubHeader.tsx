import type { WhatsAppStatus } from "@/lib/api/whatsapp";
import { StatusBadge } from "./ui";

export function WhatsappHubHeader({
  status,
  carregando,
  modoEvolution = false,
}: {
  status: WhatsAppStatus | undefined;
  carregando: boolean;
  modoEvolution?: boolean;
}) {
  const online = status === "conectado";
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="text-xl font-semibold text-slate-100">
          Hub Mestre WhatsApp
        </div>
        <div className="mt-1 max-w-2xl text-sm text-slate-400">
          Canal central de comunicação responsável pelo envio de notificações,
          alertas e mensagens automáticas da plataforma.
          {modoEvolution && (
            <span className="mt-1 block text-sky-300/80">
              Sessão gerenciada pela Evolution API — pareamento no painel
              Evolution, não neste Hub.
            </span>
          )}
        </div>
      </div>
      {!carregando && (
        <StatusBadge tom={online ? "ok" : "off"}>
          {online ? "Online" : "Desconectado"}
        </StatusBadge>
      )}
    </header>
  );
}
