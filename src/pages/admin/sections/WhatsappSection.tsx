import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  whatsappApi,
  type WhatsAppStatus,
  type WhatsAppStatusResp,
} from "../../../lib/api/whatsapp";
import "./whatsapp-admin.css";

const LABEL: Record<WhatsAppStatus, { txt: string; cls: string }> = {
  conectado: { txt: "Conectado", cls: "ok" },
  aguardando_qr: { txt: "Aguardando leitura do QR", cls: "warn" },
  conectando: { txt: "Conectando…", cls: "warn" },
  desconectado: { txt: "Desconectado", cls: "off" },
};

export function WhatsappSection() {
  const [info, setInfo] = useState<WhatsAppStatusResp>({
    status: "desconectado",
  });
  const [carregando, setCarregando] = useState(true);
  const [conectando, setConectando] = useState(false);
  const [numeroTeste, setNumeroTeste] = useState("");
  const timer = useRef<number | null>(null);

  const atualizar = useCallback(async () => {
    try {
      setInfo(await whatsappApi.status());
    } catch {
      setInfo({ status: "desconectado" });
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void atualizar();
  }, [atualizar]);

  // Atualiza periodicamente enquanto aguarda o QR / conecta.
  useEffect(() => {
    if (info.status !== "aguardando_qr" && info.status !== "conectando") return;
    timer.current = window.setInterval(() => void atualizar(), 2500);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [info.status, atualizar]);

  async function conectar() {
    setConectando(true);
    try {
      await whatsappApi.conectar();
      await atualizar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao conectar.");
    } finally {
      setConectando(false);
    }
  }

  async function desconectar() {
    try {
      await whatsappApi.desconectar();
      await atualizar();
      toast.success("WhatsApp desconectado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao desconectar.");
    }
  }

  async function enviarTeste() {
    if (!numeroTeste.trim()) return toast.error("Informe um número.");
    try {
      await whatsappApi.enviarTeste(numeroTeste.trim());
      toast.success("Mensagem de teste enviada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar o teste.");
    }
  }

  const st = LABEL[info.status] ?? LABEL.desconectado;

  return (
    <div className="wa-admin">
      <header className="wa-admin__head">
        <h1>Conexão WhatsApp</h1>
        <p>
          Conecte o número <strong>remetente</strong> que envia as notificações
          de emergência. Cada empresa cadastra o número de destino e ativa o
          aviso nas Configurações dela.
        </p>
      </header>

      <div className="wa-admin__card">
        <div className="wa-admin__status">
          <span className={`wa-admin__dot wa-admin__dot--${st.cls}`} />
          {carregando ? "Carregando…" : st.txt}
        </div>

        {info.status === "aguardando_qr" && info.qrImagem && (
          <div className="wa-admin__qr">
            <img src={info.qrImagem} alt="QR code do WhatsApp" />
            <p>
              No celular: WhatsApp → <strong>Aparelhos conectados</strong> →
              Conectar aparelho → escaneie este código.
            </p>
          </div>
        )}

        <div className="wa-admin__acoes">
          {info.status === "conectado" ? (
            <button
              type="button"
              className="wa-admin__btn wa-admin__btn--off"
              onClick={() => void desconectar()}
            >
              Desconectar
            </button>
          ) : (
            <button
              type="button"
              className="wa-admin__btn wa-admin__btn--primary"
              disabled={conectando}
              onClick={() => void conectar()}
            >
              {conectando ? "Conectando…" : "Conectar / gerar QR"}
            </button>
          )}
        </div>

        {info.status === "conectado" && (
          <div className="wa-admin__teste">
            <input
              type="tel"
              placeholder="Número para teste (com DDD)"
              value={numeroTeste}
              onChange={(e) => setNumeroTeste(e.target.value)}
            />
            <button
              type="button"
              className="wa-admin__btn"
              onClick={() => void enviarTeste()}
            >
              Enviar teste
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
