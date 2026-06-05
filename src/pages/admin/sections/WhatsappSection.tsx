import { useState } from "react";
import { toast } from "sonner";
import { whatsappApi } from "@/lib/api/whatsapp";
import { useWhatsappOverview } from "@/components/admin/whatsapp/use-whatsapp-overview";
import { WhatsappHubHeader } from "@/components/admin/whatsapp/WhatsappHubHeader";
import { WhatsappStats } from "@/components/admin/whatsapp/WhatsappStats";
import { WhatsappConnectionCard } from "@/components/admin/whatsapp/WhatsappConnectionCard";
import { WhatsappStatusCard } from "@/components/admin/whatsapp/WhatsappStatusCard";
import { WhatsappEventsTable } from "@/components/admin/whatsapp/WhatsappEventsTable";
import { WhatsappQrSheet } from "@/components/admin/whatsapp/WhatsappQrSheet";

export function WhatsappSection() {
  const { data, carregando, erro, recarregar } = useWhatsappOverview();
  const [sheetAberto, setSheetAberto] = useState(false);

  async function conectar() {
    setSheetAberto(true);
    try {
      await whatsappApi.conectar();
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao conectar.");
      setSheetAberto(false);
    }
  }

  return (
    <section className="flex flex-col gap-6 pb-10">
      <WhatsappHubHeader status={data?.status} carregando={carregando} />

      {erro && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          Não foi possível atualizar agora — exibindo os últimos dados
          conhecidos.
        </p>
      )}

      <WhatsappStats data={data} carregando={carregando} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <WhatsappConnectionCard
          data={data}
          carregando={carregando}
          onConectar={() => void conectar()}
          onMudou={() => void recarregar()}
        />
        <WhatsappStatusCard data={data} carregando={carregando} />
      </div>

      <WhatsappEventsTable data={data} carregando={carregando} />

      <WhatsappQrSheet
        aberto={sheetAberto}
        onAbertoChange={setSheetAberto}
        status={data?.status}
        qrImagem={data?.qrImagem}
        onConectado={() => {
          toast.success("WhatsApp conectado.");
          void recarregar();
        }}
      />
    </section>
  );
}
