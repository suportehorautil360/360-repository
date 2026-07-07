import { useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
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
import {
  whatsappApi,
  type WhatsappOverview,
  type WhatsAppIntegracao,
} from "@/lib/api/whatsapp";
import { PhoneInput } from "@/components/ui/phone-input";
import { isValidPhoneNumber } from "react-phone-number-input";
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
  onConectar: () => void;
  onMudou: () => void;
}) {
  const status = data?.status;
  const conectado = status === "conectado";
  const integracao: WhatsAppIntegracao = data?.integracao ?? "baileys";
  const modoEvolution = integracao === "evolution";
  const managerUrl = data?.evolutionManagerUrl?.trim() || null;

  const [numeroTeste, setNumeroTeste] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [ultimoTeste, setUltimoTeste] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const propsTeste = {
    numeroTeste,
    setNumeroTeste,
    enviando,
    enviarTeste: () => void enviarTeste(),
    ultimoTeste,
  };

  async function enviarTeste() {
    const num = numeroTeste.trim();
    if (!num || !isValidPhoneNumber(num)) {
      toast.error("Informe um número válido com DDI e DDD.");
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

  async function atualizarStatus() {
    setAtualizando(true);
    try {
      await onMudou();
      toast.success("Status atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setAtualizando(false);
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

  if (modoEvolution) {
    return (
      <HubCard className="flex flex-col gap-5">
        <EvolutionInfo conectado={conectado} managerUrl={managerUrl} />

        {conectado ? (
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <Campo rotulo="Número" valor={data?.sessao.numeroConectado ?? "—"} />
            <Campo rotulo="Sessão" valor={data?.sessao.nomeSessao ?? "—"} />
            <Campo
              rotulo="Instância"
              valor={data?.sessao.versaoSessao ?? "Evolution API"}
            />
            <Campo rotulo="Ambiente" valor={data?.sessao.ambiente ?? "—"} />
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            A sessão não está conectada na Evolution. Abra o Manager, selecione a
            instância configurada (ex.: <strong className="text-slate-300">hora-util</strong>
            ) e escaneie o QR Code no celular responsável.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {managerUrl && (
            <Button
              asChild
              className="bg-[#f97316] text-[#1a1205] hover:bg-[#f97316]/90"
            >
              <a href={managerUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir painel Evolution
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            disabled={atualizando}
            onClick={() => void atualizarStatus()}
            className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${atualizando ? "animate-spin" : ""}`}
            />
            {atualizando ? "Atualizando…" : "Atualizar status"}
          </Button>
        </div>

        {conectado && <TesteEnvio {...propsTeste} />}
      </HubCard>
    );
  }

  if (!conectado) {
    return (
      <HubCard className="flex flex-col gap-4">
        <div>
          <div className="text-base font-semibold text-slate-100">
            WhatsApp Desconectado
          </div>
          <div className="mt-1 text-sm text-slate-400">
            Nenhuma sessão ativa encontrada. Sem uma sessão ativa, as empresas da
            plataforma não conseguirão enviar notificações automáticas.
          </div>
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
        <div className="text-base font-semibold text-slate-100">
          WhatsApp Conectado
        </div>
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

      <TesteEnvio {...propsTeste} />
    </HubCard>
  );
}

function EvolutionInfo({
  conectado,
  managerUrl,
}: {
  conectado: boolean;
  managerUrl: string | null;
}) {
  return (
    <div>
      <div className="text-base font-semibold text-slate-100">
        {conectado ? "WhatsApp Conectado (Evolution)" : "WhatsApp Desconectado"}
      </div>
      <div className="mt-2 rounded-lg border border-sky-400/20 bg-sky-400/5 px-3 py-2 text-sm text-sky-100/90">
        A sessão é gerenciada pela{" "}
        <strong className="font-medium">Evolution API</strong> no Railway — não
        pelo Hub. Para parear ou reconectar, use o painel Evolution
        {managerUrl ? (
          <>
            {" "}
            (<span className="font-mono text-xs">{managerUrl}</span>)
          </>
        ) : (
          "."
        )}
      </div>
    </div>
  );
}

function TesteEnvio({
  numeroTeste,
  setNumeroTeste,
  enviando,
  enviarTeste,
  ultimoTeste,
}: {
  numeroTeste: string;
  setNumeroTeste: (v: string) => void;
  enviando: boolean;
  enviarTeste: () => void;
  ultimoTeste: string | null;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        Enviar mensagem de teste
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <PhoneInput
          value={numeroTeste || undefined}
          onChange={(v) => setNumeroTeste(v ?? "")}
          placeholder="Número com DDI"
          disabled={enviando}
          className="flex-1"
        />
        <Button
          onClick={enviarTeste}
          disabled={enviando}
          className="bg-[#f97316] text-[#1a1205] hover:bg-[#f97316]/90"
        >
          {enviando ? "Enviando…" : "Enviar teste"}
        </Button>
      </div>
      {ultimoTeste && (
        <div className="mt-2 text-xs text-slate-500">
          Última enviada {tempoRelativo(ultimoTeste)}.
        </div>
      )}
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {rotulo}
      </div>
      <div className="text-sm font-medium text-slate-200">{valor}</div>
    </div>
  );
}

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
