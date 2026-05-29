import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import {
  notificacoesApi,
  type DestinatarioTipo,
  type Notificacao,
} from "../../lib/api/notificacoes";
import "./sino.css";

interface Props {
  destinatarioTipo: DestinatarioTipo;
  /** CPF (limpo) se funcionario, prefeituraId se rh. */
  destinatarioId: string;
  /** Estilo do botão (escuro = painel /prefeitura; claro = checklist). */
  variant?: "escuro" | "claro";
}

function tempoRelativo(iso: string): string {
  const agora = Date.now();
  const t = new Date(iso).getTime();
  const diffMin = Math.floor((agora - t) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `há ${diffD} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function SinoNotificacoes({
  destinatarioTipo,
  destinatarioId,
  variant = "escuro",
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const carregar = useCallback(async () => {
    if (!destinatarioId) return;
    setCarregando(true);
    try {
      const r = await notificacoesApi.listar(destinatarioTipo, destinatarioId);
      setLista(r);
    } catch {
      // silencioso — endpoint pode estar indisponível
    } finally {
      setCarregando(false);
    }
  }, [destinatarioTipo, destinatarioId]);

  // Carrega ao montar e a cada 60s (polling leve).
  useEffect(() => {
    void carregar();
    const id = setInterval(() => void carregar(), 60_000);
    return () => clearInterval(id);
  }, [carregar]);

  // Fechar ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [aberto]);

  const naoLidas = useMemo(() => lista.filter((n) => !n.lida).length, [lista]);

  async function marcar(n: Notificacao) {
    if (n.lida) return;
    try {
      await notificacoesApi.marcarLida(n.id);
      setLista((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)),
      );
    } catch {
      /* mantém visual mesmo se backend falhar */
    }
  }

  async function marcarTodas() {
    if (naoLidas === 0) return;
    try {
      await notificacoesApi.marcarTodasLidas(destinatarioTipo, destinatarioId);
      setLista((prev) => prev.map((x) => ({ ...x, lida: true })));
    } catch {
      /* ignora */
    }
  }

  return (
    <div ref={containerRef} className={`sino sino--${variant}`}>
      <button
        type="button"
        className="sino__btn"
        aria-label={
          naoLidas > 0
            ? `Notificações (${naoLidas} não lidas)`
            : "Notificações"
        }
        onClick={() => setAberto((v) => !v)}
      >
        <Bell size={16} aria-hidden="true" />
        {naoLidas > 0 && (
          <span className="sino__badge" aria-hidden="true">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div className="sino__painel" role="dialog" aria-label="Notificações">
          <header className="sino__head">
            <strong>Notificações</strong>
            <button
              type="button"
              className="sino__head-acao"
              disabled={naoLidas === 0}
              onClick={() => void marcarTodas()}
              title="Marcar todas como lidas"
            >
              <CheckCheck size={13} aria-hidden="true" /> Marcar tudo
            </button>
          </header>
          <ul className="sino__lista">
            {carregando ? (
              <li className="sino__vazio">Carregando…</li>
            ) : lista.length === 0 ? (
              <li className="sino__vazio">Nenhuma notificação por aqui.</li>
            ) : (
              lista.slice(0, 20).map((n) => (
                <li
                  key={n.id}
                  className={`sino__item sino__item--${n.tipo} ${n.lida ? "is-lida" : ""}`}
                >
                  <div className="sino__item-corpo">
                    <strong>{n.titulo}</strong>
                    <span>{n.mensagem}</span>
                    <time>{tempoRelativo(n.createdAt)}</time>
                  </div>
                  {!n.lida && (
                    <button
                      type="button"
                      className="sino__item-acao"
                      title="Marcar como lida"
                      onClick={() => void marcar(n)}
                    >
                      <Check size={13} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
