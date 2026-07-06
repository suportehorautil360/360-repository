import { useEffect, useState } from "react";
import { toast } from "sonner";
import { whatsappApi, type WhatsAppStatus } from "@/lib/api/whatsapp";
import { useWhatsappOverview } from "@/components/admin/whatsapp/use-whatsapp-overview";
import { WhatsappHubHeader } from "@/components/admin/whatsapp/WhatsappHubHeader";
import { WhatsappStats } from "@/components/admin/whatsapp/WhatsappStats";
import { WhatsappConnectionCard } from "@/components/admin/whatsapp/WhatsappConnectionCard";
import { WhatsappStatusCard } from "@/components/admin/whatsapp/WhatsappStatusCard";
import { WhatsappQrSheet } from "@/components/admin/whatsapp/WhatsappQrSheet";

export function WhatsappSection() {
  const { data, carregando, erro, recarregar } = useWhatsappOverview();
  const [sheetAberto, setSheetAberto] = useState(false);
  const [sessaoConexao, setSessaoConexao] = useState<{
    status?: WhatsAppStatus;
    qrImagem?: string;
  }>({});

  async function conectar() {
    setSheetAberto(true);
    setSessaoConexao({ status: "conectando" });
    try {
      const resp = await whatsappApi.conectar();
      setSessaoConexao(resp);
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao conectar.");
      setSessaoConexao({});
      setSheetAberto(false);
    }
  }

  const statusExibicao = sessaoConexao.status ?? data?.status;
  const qrExibicao = sessaoConexao.qrImagem ?? data?.qrImagem;

  // Enquanto o QR está aberto, poll leve (/status) — não bate no Firestore como /overview.
  useEffect(() => {
    if (!sheetAberto) return;

    let ativo = true;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const s = await whatsappApi.status();
        if (!ativo) return;
        setSessaoConexao((prev) => ({
          status: s.status,
          qrImagem: s.qrImagem ?? prev.qrImagem,
        }));
      } catch (e) {
        if (!ativo) return;
        toast.error(e instanceof Error ? e.message : "Falha ao consultar status.");
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), 5000);
    return () => {
      ativo = false;
      window.clearInterval(id);
    };
  }, [sheetAberto]);

  return (
    <section className="flex flex-col gap-6 pb-10">
      <WhatsappHubHeader status={data?.status} carregando={carregando} />

      {erro && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          Não foi possível atualizar agora — exibindo os últimos dados
          conhecidos.
        </div>
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

      <WhatsappQrSheet
        aberto={sheetAberto}
        onAbertoChange={(aberto) => {
          setSheetAberto(aberto);
          if (!aberto) setSessaoConexao({});
        }}
        status={statusExibicao}
        qrImagem={qrExibicao}
        onConectado={() => {
          toast.success("WhatsApp conectado.");
          setSessaoConexao({});
          void recarregar();
        }}
      />
    </section>
  );
}
