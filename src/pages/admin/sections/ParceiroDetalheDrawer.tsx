import { useCallback, useEffect, useState } from "react";
import {
  Fuel,
  KeyRound,
  Loader2,
  Trash2,
  UserPlus,
  Wrench,
} from "lucide-react";
import {
  parceirosApi,
  type OficinaParceiroApi,
  type ParceiroLoginApi,
  type PostoParceiroApi,
  type TipoParceiroApi,
} from "../../../lib/api/parceiros";
import { ApiError } from "../../../lib/api/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import "./parceiros.css";

export type ParceiroSelecionado =
  | { tipo: "posto"; parceiro: PostoParceiroApi }
  | { tipo: "oficina"; parceiro: OficinaParceiroApi };

type Msg = { tone: "ok" | "err"; text: string } | null;

function destinoLogin(tipo: TipoParceiroApi): string {
  return tipo === "posto" ? "posto" : "oficina";
}

function iniciais(nome: string, usuario: string): string {
  const base = (nome || usuario).trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

export function ParceiroDetalheDrawer({
  selecionado,
  open,
  onClose,
}: {
  selecionado: ParceiroSelecionado | null;
  open: boolean;
  onClose: () => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [logins, setLogins] = useState<ParceiroLoginApi[]>([]);
  const [nome, setNome] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [salvando, setSalvando] = useState(false);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  const parceiro = selecionado?.parceiro ?? null;
  const tipo = selecionado?.tipo ?? "posto";
  const Icon = tipo === "posto" ? Fuel : Wrench;

  const recarregar = useCallback(async () => {
    if (!parceiro || !selecionado) return;
    setLogins(await parceirosApi.listarLogins(selecionado.tipo, parceiro.id));
  }, [parceiro, selecionado]);

  useEffect(() => {
    if (!open || !parceiro || !selecionado) return;
    let ativo = true;
    setMsg(null);
    setNome("");
    setUsuario("");
    setSenha("");
    setCarregando(true);
    void parceirosApi
      .listarLogins(selecionado.tipo, parceiro.id)
      .then((lista) => {
        if (ativo) setLogins(lista);
      })
      .catch((err) => {
        if (ativo) {
          setLogins([]);
          setMsg({
            tone: "err",
            text:
              err instanceof ApiError
                ? err.message
                : "Falha ao carregar logins.",
          });
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [open, parceiro, selecionado]);

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!parceiro || !selecionado) return;
    setSalvando(true);
    setMsg(null);
    try {
      await parceirosApi.criarLogin(selecionado.tipo, parceiro.id, {
        nome: nome.trim(),
        usuario: usuario.trim(),
        senha,
        perfil: "gestor",
      });
      setMsg({ tone: "ok", text: "Login criado com sucesso." });
      setNome("");
      setUsuario("");
      setSenha("");
      await recarregar();
    } catch (err) {
      setMsg({
        tone: "err",
        text:
          err instanceof ApiError ? err.message : "Não foi possível criar.",
      });
    } finally {
      setSalvando(false);
    }
  }

  async function handleReset(id: string, login: string) {
    const nova = window.prompt(`Nova senha para "${login}" (mín. 4):`);
    if (nova == null) return;
    setOcupadoId(id);
    try {
      await parceirosApi.resetarLoginSenha(id, nova);
      setMsg({ tone: "ok", text: "Senha redefinida." });
    } catch (err) {
      setMsg({
        tone: "err",
        text:
          err instanceof ApiError ? err.message : "Não foi possível resetar.",
      });
    } finally {
      setOcupadoId(null);
    }
  }

  async function handleRemover(id: string, login: string) {
    if (!window.confirm(`Remover o login "${login}"?`)) return;
    setOcupadoId(id);
    try {
      await parceirosApi.removerLogin(id);
      setMsg({ tone: "ok", text: "Login removido." });
      await recarregar();
    } catch (err) {
      setMsg({
        tone: "err",
        text:
          err instanceof ApiError ? err.message : "Não foi possível remover.",
      });
    } finally {
      setOcupadoId(null);
    }
  }

  const subtitulo =
    tipo === "posto"
      ? [parceiro?.cidadeUf, (parceiro as PostoParceiroApi | null)?.bandeira]
          .filter(Boolean)
          .join(" · ")
      : [
          parceiro?.cidadeUf,
          (parceiro as OficinaParceiroApi | null)?.especialidade,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="parc-drawer w-full gap-0 overflow-x-hidden overflow-y-auto border-white/10 bg-[#0a1020] p-0 text-slate-100 sm:max-w-lg"
      >
        <div className="parc-drawer__hero">
          <div className="parc-drawer__hero-icon">
            <Icon size={22} aria-hidden />
          </div>
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle className="text-lg text-slate-50">
              {parceiro?.nome ?? "Parceiro"}
            </SheetTitle>
            <SheetDescription className="text-slate-400">
              {subtitulo || "Detalhes e logins operacionais"}
            </SheetDescription>
          </SheetHeader>
          <Badge
            variant={parceiro?.ativo ? "posto" : "local"}
            className="parc-drawer__status"
          >
            {parceiro?.ativo ? "Ativo" : "Suspenso"}
          </Badge>
        </div>

        <div className="parc-drawer__body">
          <section className="parc-drawer__card">
            <h3 className="parc-drawer__card-title">Dados do parceiro</h3>
            <dl className="parc-drawer__dl">
              <div>
                <dt>Tipo</dt>
                <dd>{tipo === "posto" ? "Posto" : "Oficina"}</dd>
              </div>
              <div>
                <dt>Razão social</dt>
                <dd>{parceiro?.razaoSocial || "—"}</dd>
              </div>
              <div>
                <dt>Cidade / UF</dt>
                <dd>{parceiro?.cidadeUf || "—"}</dd>
              </div>
              {tipo === "posto" ? (
                <div>
                  <dt>Bandeira</dt>
                  <dd>
                    {(parceiro as PostoParceiroApi | null)?.bandeira || "—"}
                  </dd>
                </div>
              ) : (
                <div>
                  <dt>Especialidade</dt>
                  <dd>
                    {(parceiro as OficinaParceiroApi | null)?.especialidade ||
                      "—"}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="parc-drawer__card">
            <div className="parc-drawer__card-head">
              <h3 className="parc-drawer__card-title">
                <KeyRound size={16} aria-hidden />
                Logins ({logins.length})
              </h3>
            </div>

            {carregando ? (
              <div className="parc-drawer__loading">
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Carregando logins…
              </div>
            ) : logins.length === 0 ? (
              <p className="parc-drawer__empty">
                Nenhum login cadastrado para este parceiro.
              </p>
            ) : (
              <ul className="parc-drawer__logins">
                {logins.map((a) => (
                  <li key={a.id} className="parc-drawer__login-row">
                    <div className="parc-drawer__avatar" aria-hidden>
                      {iniciais(a.nome, a.usuario)}
                    </div>
                    <div className="parc-drawer__login-info">
                      <strong>{a.usuario}</strong>
                      <span>{a.nome}</span>
                    </div>
                    <div className="parc-drawer__login-actions">
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        disabled={ocupadoId === a.id}
                        onClick={() => void handleReset(a.id, a.usuario)}
                      >
                        Resetar
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        variant="destructive"
                        disabled={ocupadoId === a.id}
                        onClick={() => void handleRemover(a.id, a.usuario)}
                      >
                        <Trash2 size={14} aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="parc-drawer__card parc-drawer__card--form">
            <h3 className="parc-drawer__card-title">
              <UserPlus size={16} aria-hidden />
              Login adicional
            </h3>
            <p className="parc-drawer__form-note">
              O login principal é criado automaticamente no cadastro do parceiro.
              Use este formulário para incluir outros operadores.
            </p>
            <form onSubmit={handleCriar} className="parc-drawer__form">
              <label className="parc-drawer__field">
                <span>Nome completo</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: João Mecânico"
                  required
                />
              </label>
              <label className="parc-drawer__field">
                <span>Usuário (login)</span>
                <input
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ex.: joao.oficina"
                  autoComplete="off"
                  required
                />
              </label>
              <label className="parc-drawer__field">
                <span>Senha inicial</span>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  autoComplete="new-password"
                  required
                />
              </label>

              <div className="parc-drawer__hint">
                Entrada pelo portal operacional:{" "}
                <code>/login-operacional?destino={destinoLogin(tipo)}</code>
              </div>

              {msg ? (
                <p
                  className={`parc-drawer__msg parc-drawer__msg--${msg.tone}`}
                  role="status"
                >
                  {msg.text}
                </p>
              ) : null}

              <Button
                type="submit"
                className="w-full bg-[#f97316] text-black hover:bg-[#f97316]/90"
                disabled={salvando}
              >
                {salvando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Salvando…
                  </>
                ) : (
                  "Criar login"
                )}
              </Button>
            </form>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
