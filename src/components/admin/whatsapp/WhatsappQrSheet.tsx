import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { WhatsAppStatus } from "@/lib/api/whatsapp";
import { Skeleton } from "./ui";

export function WhatsappQrSheet({
  aberto,
  onAbertoChange,
  status,
  qrImagem,
  onConectado,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  status: WhatsAppStatus | undefined;
  qrImagem: string | undefined;
  onConectado: () => void;
}) {
  // Fecha sozinho ao conectar.
  useEffect(() => {
    if (aberto && status === "conectado") {
      onConectado();
      onAbertoChange(false);
    }
  }, [aberto, status, onConectado, onAbertoChange]);

  return (
    <Sheet open={aberto} onOpenChange={onAbertoChange}>
      <SheetContent
        side="right"
        className="border-white/10 bg-[#0e1424] text-slate-100"
      >
        <SheetHeader>
          <SheetTitle className="text-slate-100">Conectar WhatsApp</SheetTitle>
          <SheetDescription className="text-slate-400">
            Escaneie o QR Code utilizando o WhatsApp Business responsável pela
            operação da plataforma.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          {status === "aguardando_qr" && qrImagem ? (
            <>
              <img
                src={qrImagem}
                alt="QR code do WhatsApp"
                className="h-60 w-60 rounded-lg bg-white p-2"
              />
              <p className="text-sm text-slate-400">Expira em ~60 segundos</p>
              <p className="text-xs text-slate-500">
                No celular: WhatsApp → Aparelhos conectados → desconecte sessões
                antigas antes de escanear.
              </p>
              <p className="text-xs text-slate-500">Aguardando leitura…</p>
            </>
          ) : status === "conectando" || status === "aguardando_qr" ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Gerando QR…</p>
            </div>
          ) : status === "conectado" ? (
            <p className="text-sm text-emerald-300">Conectado com sucesso!</p>
          ) : (
            <Skeleton className="h-60 w-60" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
