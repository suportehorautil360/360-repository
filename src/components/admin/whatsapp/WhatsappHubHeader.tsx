import type { WhatsAppStatus } from "@/lib/api/whatsapp";
import { StatusBadge } from "./ui";

export function WhatsappHubHeader({
  status,
  carregando,
}: {
  status: WhatsAppStatus | undefined;
  carregando: boolean;
}) {
  const online = status === "conectado";
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">
          Hub Mestre WhatsApp
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Canal central de comunicação responsável pelo envio de notificações,
          alertas e mensagens automáticas da plataforma.
        </p>
      </div>
      {!carregando && (
        <StatusBadge tom={online ? "ok" : "off"}>
          {online ? "Online" : "Desconectado"}
        </StatusBadge>
      )}
    </header>
  );
}
