import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { whatsappApi, type WhatsappOverview } from "@/lib/api/whatsapp";
import { HubCard, Skeleton } from "./ui";
import { formatarDataHora, tempoRelativo } from "./format";

export function WhatsappConnectionCard({
  data,
  carregando,
  onConectar,
  onMudou,
}: {
  data: WhatsappOverview | null;
  carregando: boolean;
  onConectar: () => void; // abre o Sheet e dispara o connect
  onMudou: () => void; // recarrega o overview
}) {
  const status = data?.status;
  const conectado = status === "conectado";
  const [numeroTeste, setNumeroTeste] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [ultimoTeste, setUltimoTeste] = useState<string | null>(null);

  async function enviarTeste() {
    const num = numeroTeste.trim();
    if (num.replace(/\D/g, "").length < 10) {
      toast.error("Informe um número válido com DDD.");
      return;
    }
    setEnviando(true);
    try {
      await whatsappApi.enviarTeste(num);
      setUltimoTeste(new Date().toISOString());
      toast.success("Mensagem de teste enviada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar o teste.");
    } finally {
      setEnviando(false);
    }
  }

  async function desconectar() {
    setDesconectando(true);
    try {
      await whatsappApi.desconectar();
      toast.success("WhatsApp desconectado.");
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao desconectar.");
    } finally {
      setDesconectando(false);
    }
  }

  if (carregando) {
    return (
      <HubCard>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-4 h-10 w-40" />
      </HubCard>
    );
  }

  if (!conectado) {
    return (
      <HubCard className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            WhatsApp Desconectado
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Nenhuma sessão ativa encontrada. Sem uma sessão ativa, as empresas da
            plataforma não conseguirão enviar notificações automáticas.
          </p>
        </div>
        <Button
          onClick={onConectar}
          className="w-fit bg-[#f97316] text-[#1a1205] hover:bg-[#f97316]/90"
        >
          Conectar WhatsApp
        </Button>
      </HubCard>
    );
  }

  return (
    <HubCard className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">
          WhatsApp Conectado
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <Campo rotulo="Número" valor={data?.sessao.numeroConectado ?? "—"} />
          <Campo rotulo="Sessão" valor={data?.sessao.nomeSessao ?? "—"} />
          <Campo
            rotulo="Conectado desde"
            valor={formatarDataHora(data?.sessao.conectadoDesde ?? null)}
          />
          <Campo
            rotulo="Última atividade"
            valor={tempoRelativo(data?.sessao.ultimaAtividade ?? null)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={onConectar}
          className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
        >
          Reconectar
        </Button>
        <Dialog>
          <DialogTriggerButton desconectando={desconectando} />
          <DialogContent className="border-white/10 bg-[#0e1424] text-slate-100">
            <DialogHeader>
              <DialogTitle className="text-slate-100">
                Desconectar WhatsApp?
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                As empresas param de receber notificações automáticas até uma
                nova conexão. Tem certeza?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  variant="outline"
                  className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                >
                  Cancelar
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="destructive"
                  disabled={desconectando}
                  onClick={() => void desconectar()}
                >
                  Desconectar
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Enviar mensagem de teste
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="tel"
            inputMode="tel"
            placeholder="Número com DDD (ex.: 67 99999-9999)"
            value={numeroTeste}
            onChange={(e) => setNumeroTeste(e.target.value)}
            className="flex-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#f97316] focus:outline-none"
          />
          <Button
            onClick={() => void enviarTeste()}
            disabled={enviando}
            className="bg-[#f97316] text-[#1a1205] hover:bg-[#f97316]/90"
          >
            {enviando ? "Enviando…" : "Enviar teste"}
          </Button>
        </div>
        {ultimoTeste && (
          <p className="mt-2 text-xs text-slate-500">
            Última enviada {tempoRelativo(ultimoTeste)}.
          </p>
        )}
      </div>
    </HubCard>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className="text-sm font-medium text-slate-200">{valor}</p>
    </div>
  );
}

// Botão que dispara o Dialog (precisa de asChild no DialogTrigger).
function DialogTriggerButton({ desconectando }: { desconectando: boolean }) {
  return (
    <DialogTrigger asChild>
      <Button
        variant="outline"
        disabled={desconectando}
        className="border-red-400/40 bg-transparent text-red-300 hover:bg-red-400/10"
      >
        Desconectar
      </Button>
    </DialogTrigger>
  );
}
