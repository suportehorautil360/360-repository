import { useCallback, useEffect, useRef, useState } from "react";
import { whatsappApi, type WhatsappOverview } from "@/lib/api/whatsapp";

const INTERVALO_RAPIDO = 2500; // aguardando_qr / conectando
const INTERVALO_LENTO = 20000; // conectado / desconectado

export interface UseWhatsappOverview {
  data: WhatsappOverview | null;
  carregando: boolean;
  erro: boolean;
  recarregar: () => Promise<void>;
}

export function useWhatsappOverview(): UseWhatsappOverview {
  const [data, setData] = useState<WhatsappOverview | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const timer = useRef<number | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const ov = await whatsappApi.overview();
      setData(ov);
      setErro(false);
    } catch {
      setErro(true); // mantém o último dado bom
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // Polling adaptativo conforme o status atual.
  useEffect(() => {
    const status = data?.status;
    const intervalo =
      status === "aguardando_qr" || status === "conectando"
        ? INTERVALO_RAPIDO
        : INTERVALO_LENTO;
    timer.current = window.setInterval(() => void recarregar(), intervalo);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [data?.status, recarregar]);

  return { data, carregando, erro, recarregar };
}
