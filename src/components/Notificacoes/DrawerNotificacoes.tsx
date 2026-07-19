import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck } from "lucide-react";
import {
  notificacoesApi,
  type Notificacao,
} from "../../lib/api/notificacoes";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import "./drawer-notificacoes.css";

const REFERENCIA_ORCAMENTO = "orcamento";
const EVENTO_NOTIFICACOES = "hu360:notificacoes-atualizadas";

interface Props {
  /** prefeituraId — destinatário RH. */
  prefeituraId: string;
  /** Escuro = sidebar; claro = header de páginas claras. */
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

function emitirAtualizacao(prefeituraId: string) {
  window.dispatchEvent(
    new CustomEvent(EVENTO_NOTIFICACOES, {
      detail: { prefeituraId },
    }),
  );
}

export function DrawerNotificacoes({
  prefeituraId,
  variant = "escuro",
}: Props) {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Notificacao[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setCarregando(true);
    try {
      const r = await notificacoesApi.listar("rh", prefeituraId);
      setLista(r.filter((n) => n.referenciaTipo === REFERENCIA_ORCAMENTO));
    } catch {
      // silencioso — endpoint pode estar indisponível
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
    const id = setInterval(() => void carregar(), 60_000);
    return () => clearInterval(id);
  }, [carregar]);

  const naoLidas = useMemo(() => lista.filter((n) => !n.lida).length, [lista]);

  async function marcar(n: Notificacao) {
    if (n.lida) return;
    try {
      await notificacoesApi.marcarLida(n.id);
      setLista((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)),
      );
      emitirAtualizacao(prefeituraId);
    } catch {
      /* mantém visual mesmo se backend falhar */
    }
  }

  async function marcarTodas() {
    if (naoLidas === 0) return;
    try {
      await notificacoesApi.marcarTodasLidas("rh", prefeituraId);
      setLista((prev) => prev.map((x) => ({ ...x, lida: true })));
      emitirAtualizacao(prefeituraId);
    } catch {
      /* ignora */
    }
  }

  async function abrirNotificacao(n: Notificacao) {
    await marcar(n);
    setAberto(false);
    const orcamentoId = n.referenciaId?.trim();
    navigate(
      orcamentoId
        ? `/prefeitura/${prefeituraId}/orcamentos?orcamento=${encodeURIComponent(orcamentoId)}`
        : `/prefeitura/${prefeituraId}/orcamentos`,
    );
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <button
        type="button"
        className={`drawer-notif__btn drawer-notif__btn--${variant}`}
        aria-label={
          naoLidas > 0
            ? `Notificações (${naoLidas} não lidas)`
            : "Notificações"
        }
        onClick={() => setAberto(true)}
      >
        <Bell size={16} aria-hidden="true" />
        {naoLidas > 0 && (
          <span className="drawer-notif__badge" aria-hidden="true">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      <SheetContent
        side="right"
        className="drawer-notif__sheet"
        showCloseButton
      >
        <SheetHeader className="drawer-notif__head">
          <div className="drawer-notif__head-row">
            <SheetTitle>Notificações</SheetTitle>
            <button
              type="button"
              className="drawer-notif__marcar-todas"
              disabled={naoLidas === 0}
              onClick={() => void marcarTodas()}
              title="Marcar todas como lidas"
            >
              <CheckCheck size={13} aria-hidden="true" /> Marcar tudo
            </button>
          </div>
          <SheetDescription>
            Orçamentos recebidos das oficinas
          </SheetDescription>
        </SheetHeader>

        <ul className="drawer-notif__lista">
          {carregando ? (
            <li className="drawer-notif__vazio">Carregando…</li>
          ) : lista.length === 0 ? (
            <li className="drawer-notif__vazio">
              Nenhuma notificação de orçamento por aqui.
            </li>
          ) : (
            lista.slice(0, 40).map((n) => (
              <li
                key={n.id}
                className={`drawer-notif__item ${n.lida ? "is-lida" : ""}`}
              >
                <button
                  type="button"
                  className="drawer-notif__item-btn"
                  onClick={() => void abrirNotificacao(n)}
                >
                  <strong>{n.titulo}</strong>
                  <span>{n.mensagem}</span>
                  <time>{tempoRelativo(n.createdAt)}</time>
                </button>
                {!n.lida && (
                  <button
                    type="button"
                    className="drawer-notif__item-acao"
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
      </SheetContent>
    </Sheet>
  );
}

export { EVENTO_NOTIFICACOES };
