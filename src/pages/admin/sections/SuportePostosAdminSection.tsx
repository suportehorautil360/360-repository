import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  suporteAdminApi,
  CANAL_LABEL,
  notificarInboxSuporteAdminAtualizado,
  type MensagemSuporte,
  type SuporteChannel,
  type SuporteThread,
} from "../../../lib/api/suporte-admin";
import { parceirosApi } from "../../../lib/api/parceiros";

type FiltroCanal = "todos" | SuporteChannel;

function fmtHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const data = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data}, ${hora}`;
}

function prefixoPreview(sender: SuporteThread["lastSender"]): string {
  if (sender === "user") return "Operador";
  return "Resposta";
}

function CanalChip({ channel }: { channel: SuporteChannel }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide",
        channel === "financeiro"
          ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
          : "border-sky-400/35 bg-sky-500/15 text-sky-200",
      )}
    >
      {CANAL_LABEL[channel]}
    </span>
  );
}

function ThreadItem({
  thread,
  nome,
  ativo,
  onSelect,
}: {
  thread: SuporteThread;
  nome: string;
  ativo: boolean;
  onSelect: () => void;
}) {
  const pendente = thread.unreadUserCount > 0;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "group flex w-full border-b border-white/8 px-3 py-3 text-left transition-colors",
          "border-l-[3px] pl-[calc(0.75rem-3px)]",
          ativo
            ? "border-l-orange-500 bg-orange-500/12"
            : pendente
              ? "border-l-amber-400 bg-amber-500/[0.07] hover:bg-amber-500/10"
              : "border-l-transparent hover:bg-white/[0.05]",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <span
              className={cn(
                "truncate text-[0.9375rem] leading-snug text-white",
                pendente && "font-semibold",
                !pendente && "font-medium",
              )}
            >
              {nome}
            </span>
            <time className="shrink-0 pt-0.5 text-[0.6875rem] font-medium tabular-nums text-slate-300">
              {fmtDataHora(thread.lastMessageAt)}
            </time>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <CanalChip channel={thread.channel} />
            {pendente ? (
              <span
                className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-[0.625rem] font-bold leading-none text-slate-950"
                aria-label={`${thread.unreadUserCount} não lida(s)`}
              >
                {thread.unreadUserCount}
              </span>
            ) : null}
          </div>

          <p className="mt-2 line-clamp-2 text-[0.8125rem] leading-relaxed text-slate-300">
            <span className="font-medium text-slate-100">
              {prefixoPreview(thread.lastSender)}:{" "}
            </span>
            {thread.lastMessage}
          </p>
        </div>
      </button>
    </li>
  );
}

export function SuportePostosAdminSection() {
  const [threads, setThreads] = useState<SuporteThread[]>([]);
  const [postoNomes, setPostoNomes] = useState<Map<string, string>>(new Map());
  const [selecionado, setSelecionado] = useState<SuporteThread | null>(null);
  const [mensagens, setMensagens] = useState<MensagemSuporte[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoChat, setCarregandoChat] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<FiltroCanal>("todos");
  const fimRef = useRef<HTMLDivElement>(null);

  const postoMap = postoNomes;

  const carregarInbox = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const [inbox, overview] = await Promise.all([
        suporteAdminApi.listarInbox(filtro === "todos" ? undefined : filtro),
        parceirosApi.overview().catch(() => ({ postos: [], oficinas: [] })),
      ]);
      setThreads(inbox);
      setPostoNomes(new Map(overview.postos.map((p) => [p.id, p.nome])));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [filtro]);

  useEffect(() => {
    void carregarInbox();
  }, [carregarInbox]);

  const abrirThread = useCallback(async (thread: SuporteThread) => {
    setSelecionado(thread);
    setCarregandoChat(true);
    setErro("");
    try {
      const msgs = await suporteAdminApi.listarMensagens(
        thread.postoId,
        thread.channel,
      );
      setMensagens(msgs);
      await suporteAdminApi.marcarLidasAdmin(thread.postoId, thread.channel);
      setThreads((prev) =>
        prev.map((t) =>
          t.postoId === thread.postoId && t.channel === thread.channel
            ? { ...t, unreadUserCount: 0 }
            : t,
        ),
      );
      notificarInboxSuporteAdminAtualizado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao abrir conversa.");
    } finally {
      setCarregandoChat(false);
    }
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, carregandoChat]);

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!selecionado || !texto.trim()) return;
    setEnviando(true);
    setErro("");
    try {
      const msg = await suporteAdminApi.responder(
        selecionado.postoId,
        selecionado.channel,
        texto.trim(),
      );
      setMensagens((prev) => [...prev, msg]);
      setTexto("");
      setThreads((prev) =>
        prev.map((t) =>
          t.postoId === selecionado.postoId && t.channel === selecionado.channel
            ? {
                ...t,
                lastMessage: msg.text,
                lastMessageAt: msg.createdAt,
                lastSender: "support",
              }
            : t,
        ),
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao enviar.");
    } finally {
      setEnviando(false);
    }
  }

  const totalPendentes = threads.reduce((s, t) => s + t.unreadUserCount, 0);

  return (
    <section className="flex flex-col gap-5 pb-10">
      <header>
        <div className="text-2xl font-semibold text-slate-100">
          Suporte dos Postos
        </div>
        <div className="mt-1 text-sm text-slate-400">
          Mensagens enviadas pelos operadores no portal do posto — atendimento
          Hora Útil 360.
          {totalPendentes > 0 ? (
            <span className="ml-2 text-amber-300">
              {totalPendentes} pendente{totalPendentes > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      </header>

      {erro ? (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-200">
          {erro}
        </div>
      ) : null}

      <Tabs
        value={filtro}
        onValueChange={(v) => setFiltro(v as FiltroCanal)}
      >
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="ti">TI / Suporte</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid min-h-[480px] grid-cols-1 gap-4 lg:grid-cols-[minmax(240px,320px)_1fr]">
        <Card className="overflow-hidden border-white/10 bg-[#0f172a]/80">
          <div className="border-b border-white/10 bg-white/[0.02] px-4 py-3 text-sm font-semibold text-white">
            Conversas
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {carregando ? (
              <p className="flex items-center gap-2 p-4 text-sm text-slate-300">
                <Loader2 className="size-4 animate-spin" /> Carregando…
              </p>
            ) : threads.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">
                Nenhuma mensagem dos postos ainda.
              </p>
            ) : (
              <ul>
                {threads.map((t) => {
                  const ativo =
                    selecionado?.postoId === t.postoId &&
                    selecionado.channel === t.channel;
                  const nome =
                    postoMap.get(t.postoId) ?? `Posto ${t.postoId.slice(0, 8)}`;
                  return (
                    <ThreadItem
                      key={`${t.postoId}:${t.channel}`}
                      thread={t}
                      nome={nome}
                      ativo={ativo}
                      onSelect={() => void abrirThread(t)}
                    />
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        <Card className="flex min-h-[480px] flex-col overflow-hidden border-white/10 bg-[#0f172a]/80">
          {!selecionado ? (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
              Selecione uma conversa para responder.
            </div>
          ) : (
            <>
              <div className="border-b border-white/10 bg-white/[0.02] px-4 py-3">
                <p className="font-semibold text-white">
                  {postoMap.get(selecionado.postoId) ??
                    `Posto ${selecionado.postoId.slice(0, 8)}`}
                </p>
                <div className="mt-1.5">
                  <CanalChip channel={selecionado.channel} />
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-[#0b1220]/50 p-4">
                {carregandoChat ? (
                  <p className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-400">
                    <Loader2 className="size-4 animate-spin" /> Carregando…
                  </p>
                ) : (
                  <>
                    {mensagens.map((m) => (
                      <Bolha key={m.id} msg={m} channel={selecionado.channel} />
                    ))}
                    <div ref={fimRef} />
                  </>
                )}
              </div>

              <form
                onSubmit={handleEnviar}
                className="flex gap-2 border-t border-white/10 p-3"
              >
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Escreva a resposta…"
                  maxLength={2000}
                  disabled={enviando}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#f97316] focus:outline-none"
                />
                <Button
                  type="submit"
                  disabled={enviando || !texto.trim()}
                  className="bg-[#c2410c] text-white hover:bg-[#c2410c]/90"
                >
                  {enviando ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Enviar
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </section>
  );
}

function Bolha({
  msg,
  channel,
}: {
  msg: MensagemSuporte;
  channel: SuporteChannel;
}) {
  const ehOperador = msg.sender === "user";
  const label = ehOperador ? "OPERADOR" : "HORA ÚTIL";

  if (ehOperador) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-1">
          <p className="text-right text-[0.65rem] font-medium uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <div className="rounded-2xl rounded-br-md border border-orange-400/25 bg-orange-500/20 px-3 py-2">
            <p className="text-sm leading-relaxed text-white">{msg.text}</p>
            <p className="mt-1 text-right text-[0.65rem] text-slate-300">
              {fmtHora(msg.createdAt)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-1">
        <p className="text-[0.65rem] font-medium uppercase tracking-wider text-slate-400">
          {label}
          {msg.autoReply ? (
            <span className="ml-1 normal-case text-sky-300">· automática</span>
          ) : null}
        </p>
        <div className="rounded-2xl rounded-bl-md border border-white/10 bg-slate-800/80 px-3 py-2">
          <p className="text-sm leading-relaxed text-slate-100">{msg.text}</p>
          <p className="mt-1 text-right text-[0.65rem] text-slate-400">
            {fmtHora(msg.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
