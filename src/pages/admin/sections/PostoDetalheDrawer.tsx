import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Copy, Fuel, KeyRound, Loader2, Trash2, UserPlus } from "lucide-react";
import { db } from "../../../lib/firebase/firebase";
import { useAccess } from "../hooks/access/use-access";
import type { UsuarioFirestore } from "../hooks/access/types";
import type { PostoParceiroApi } from "../../../lib/api/parceiros";
import { userPostoApi } from "../../../lib/api/user-posto";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import "./parceiros.css";

type Msg = { tone: "ok" | "err"; text: string } | null;

type PostoDocDetalhe = {
  nomeFantasia?: string;
  razaoSocial?: string;
  cnpj?: string;
  telefonePrincipal?: string;
  emailComercial?: string;
  cidadeUf?: string;
  endereco?: string;
  bandeira?: string;
  combustiveis?: string[];
  servicos?: string[];
  condicaoPagamento?: string;
  limiteCredito?: number;
  descontoComercial?: string;
  observacoesFaturamento?: string;
  status?: string;
};

type CredencialExibida = {
  nome: string;
  usuario: string;
  email?: string;
  senha: string;
};

function iniciais(nome: string, usuario: string): string {
  const base = (nome || usuario).trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function copiar(texto: string) {
  void navigator.clipboard?.writeText(texto);
}

export function PostoDetalheDrawer({
  posto,
  open,
  onClose,
}: {
  posto: PostoParceiroApi | null;
  open: boolean;
  onClose: () => void;
}) {
  const { listarUsuarios, adicionarUsuario, resetarSenha, removerUsuario } =
    useAccess();
  const [prefeituraId, setPrefeituraId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<PostoDocDetalhe | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [acessos, setAcessos] = useState<UsuarioFirestore[]>([]);
  const [nome, setNome] = useState("");
  const [usuario, setUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [salvando, setSalvando] = useState(false);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [credencialNova, setCredencialNova] = useState<CredencialExibida | null>(
    null,
  );

  const recarregar = useCallback(
    async (postoId: string) => {
      setAcessos(await listarUsuarios({ postoId }));
    },
    [listarUsuarios],
  );

  useEffect(() => {
    if (!open || !posto) return;
    let ativo = true;
    setMsg(null);
    setCredencialNova(null);
    setNome("");
    setUsuario("");
    setEmail("");
    setSenha("");
    setCarregando(true);
    void (async () => {
      try {
        const snap = await getDoc(doc(db, "postos", posto.id));
        const data = snap.exists()
          ? (snap.data() as Record<string, unknown>)
          : {};
        if (!ativo) return;
        setPrefeituraId(
          typeof data.prefeituraId === "string" ? data.prefeituraId : null,
        );
        setDetalhe({
          nomeFantasia:
            typeof data.nomeFantasia === "string" ? data.nomeFantasia : "",
          razaoSocial:
            typeof data.razaoSocial === "string" ? data.razaoSocial : "",
          cnpj: typeof data.cnpj === "string" ? data.cnpj : "",
          telefonePrincipal:
            typeof data.telefonePrincipal === "string"
              ? data.telefonePrincipal
              : "",
          emailComercial:
            typeof data.emailComercial === "string" ? data.emailComercial : "",
          cidadeUf: typeof data.cidadeUf === "string" ? data.cidadeUf : "",
          endereco: typeof data.endereco === "string" ? data.endereco : "",
          bandeira: typeof data.bandeira === "string" ? data.bandeira : "",
          combustiveis: Array.isArray(data.combustiveis)
            ? data.combustiveis.filter((v): v is string => typeof v === "string")
            : [],
          servicos: Array.isArray(data.servicos)
            ? data.servicos.filter((v): v is string => typeof v === "string")
            : [],
          condicaoPagamento:
            typeof data.condicaoPagamento === "string"
              ? data.condicaoPagamento
              : "",
          limiteCredito:
            typeof data.limiteCredito === "number" ? data.limiteCredito : 0,
          descontoComercial:
            typeof data.descontoComercial === "string"
              ? data.descontoComercial
              : "",
          observacoesFaturamento:
            typeof data.observacoesFaturamento === "string"
              ? data.observacoesFaturamento
              : "",
          status: typeof data.status === "string" ? data.status : "",
        });
        await recarregar(posto.id);
      } catch {
        if (ativo) setMsg({ tone: "err", text: "Falha ao carregar o posto." });
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [open, posto, recarregar]);

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!posto) return;
    if (!prefeituraId) {
      setMsg({
        tone: "err",
        text: "Cliente vinculado não identificado para este posto.",
      });
      return;
    }
    setSalvando(true);
    setMsg(null);
    setCredencialNova(null);
    const emailNorm = email.trim().toLowerCase();
    const r = await adicionarUsuario({
      nome,
      usuario,
      email: emailNorm || undefined,
      senha,
      perfil: "gestor",
      vinculo: "posto",
      postoId: posto.id,
      prefeituraId,
    });
    if (r.ok) {
      if (emailNorm) {
        void userPostoApi.enviarBoasVindas({
          email: emailNorm,
          nome: nome.trim(),
          usuario: usuario.trim(),
          postoNome: posto.nome,
          senhaTemporaria: senha,
        });
      }
      setCredencialNova({
        nome: nome.trim(),
        usuario: usuario.trim(),
        email: emailNorm || undefined,
        senha,
      });
      setNome("");
      setUsuario("");
      setEmail("");
      setSenha("");
      await recarregar(posto.id);
      setMsg({ tone: "ok", text: "Acesso criado. Anote as credenciais abaixo." });
    } else {
      setMsg({ tone: "err", text: r.message });
    }
    setSalvando(false);
  }

  async function handleReset(id: string, login: string) {
    const nova = window.prompt(`Nova senha para "${login}" (mín. 4):`);
    if (nova == null || !nova.trim()) return;
    setOcupadoId(id);
    setCredencialNova(null);
    const r = await resetarSenha(id, nova.trim());
    if (r.ok) {
      setCredencialNova({
        nome: login,
        usuario: login,
        senha: nova.trim(),
      });
      setMsg({
        tone: "ok",
        text: `Senha redefinida para "${login}". Anote a nova senha abaixo.`,
      });
    } else {
      setMsg({ tone: "err", text: r.message });
    }
    setOcupadoId(null);
  }

  async function handleRemover(id: string, login: string) {
    if (!posto) return;
    if (!window.confirm(`Remover o acesso "${login}"?`)) return;
    setOcupadoId(id);
    const r = await removerUsuario(id);
    if (r.ok) {
      setAcessos((prev) => prev.filter((a) => a.id !== id));
      setMsg({ tone: "ok", text: "Acesso removido." });
      await recarregar(posto.id);
    } else {
      setMsg({ tone: "err", text: r.message });
    }
    setOcupadoId(null);
  }

  const subtitulo = [
    posto?.cidadeUf || detalhe?.cidadeUf,
    posto?.bandeira || detalhe?.bandeira,
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
            <Fuel size={22} aria-hidden />
          </div>
          <SheetHeader className="space-y-1 text-left">
            <SheetTitle className="text-lg text-slate-50">
              {posto?.nome ?? "Posto"}
            </SheetTitle>
            <SheetDescription className="text-slate-400">
              {subtitulo || "Detalhes, logins e portal do posto"}
            </SheetDescription>
          </SheetHeader>
          <Badge
            variant={posto?.ativo ? "posto" : "local"}
            className="parc-drawer__status"
          >
            {posto?.ativo ? "Ativo" : "Suspenso"}
          </Badge>
        </div>

        <div className="parc-drawer__body">
          <section className="parc-drawer__card">
            <h3 className="parc-drawer__card-title">Dados do posto</h3>
            <dl className="parc-drawer__dl">
              <Campo rotulo="Nome fantasia" valor={detalhe?.nomeFantasia} />
              <Campo rotulo="Razão social" valor={detalhe?.razaoSocial || posto?.razaoSocial} />
              <Campo rotulo="CNPJ" valor={detalhe?.cnpj} />
              <Campo rotulo="Telefone" valor={detalhe?.telefonePrincipal} />
              <Campo rotulo="E-mail comercial" valor={detalhe?.emailComercial} />
              <Campo rotulo="Endereço" valor={detalhe?.endereco} />
              <Campo rotulo="Cidade / UF" valor={detalhe?.cidadeUf || posto?.cidadeUf} />
              <Campo rotulo="Bandeira" valor={detalhe?.bandeira || posto?.bandeira} />
              <Campo
                rotulo="Combustíveis"
                valor={detalhe?.combustiveis?.join(", ")}
              />
              <Campo rotulo="Serviços" valor={detalhe?.servicos?.join(", ")} />
              <Campo
                rotulo="Condição pagamento"
                valor={detalhe?.condicaoPagamento || posto?.condicaoPagamento}
              />
              <Campo
                rotulo="Limite crédito"
                valor={
                  detalhe?.limiteCredito
                    ? moeda(detalhe.limiteCredito)
                    : posto?.limiteCredito
                      ? moeda(posto.limiteCredito)
                      : undefined
                }
              />
              {detalhe?.descontoComercial ? (
                <Campo rotulo="Desconto" valor={detalhe.descontoComercial} />
              ) : null}
            </dl>
          </section>

          {credencialNova ? (
            <section className="parc-login-gerado__card">
              <h3 className="parc-drawer__card-title" style={{ color: "#86efac" }}>
                Credenciais do acesso
              </h3>
              <CredencialLinha rotulo="Usuário" valor={credencialNova.usuario} />
              {credencialNova.email ? (
                <CredencialLinha rotulo="E-mail" valor={credencialNova.email} />
              ) : null}
              <CredencialLinha rotulo="Senha" valor={credencialNova.senha} />
              <p className="parc-login-gerado__hint">
                A senha não fica visível depois — copie agora. Portal:{" "}
                <code>/login-operacional?destino=posto</code>
              </p>
            </section>
          ) : null}

          <section className="parc-drawer__card">
            <div className="parc-drawer__card-head">
              <h3 className="parc-drawer__card-title">
                <KeyRound size={16} aria-hidden />
                Logins ({acessos.length})
              </h3>
            </div>
            <p className="parc-drawer__form-note">
              E-mail e senha aparecem na criação ou ao resetar. Depois disso, a
              senha fica criptografada no servidor.
            </p>

            {carregando ? (
              <div className="parc-drawer__loading">
                <Loader2 className="size-5 animate-spin" aria-hidden />
                Carregando logins…
              </div>
            ) : acessos.length === 0 ? (
              <p className="parc-drawer__empty">
                Nenhum login cadastrado para este posto.
              </p>
            ) : (
              <ul className="parc-drawer__logins">
                {acessos.map((a) => (
                  <li key={a.id} className="parc-drawer__login-row">
                    <div className="parc-drawer__avatar" aria-hidden>
                      {iniciais(a.nome, a.usuario)}
                    </div>
                    <div className="parc-drawer__login-info">
                      <strong>{a.usuario}</strong>
                      <span>{a.nome}</span>
                      {a.email ? (
                        <span style={{ color: "#cbd5e1" }}>{a.email}</span>
                      ) : (
                        <span style={{ fontStyle: "italic" }}>
                          Sem e-mail cadastrado
                        </span>
                      )}
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
              Novo login
            </h3>
            <form onSubmit={handleCriar} className="parc-drawer__form">
              <label className="parc-drawer__field">
                <span>Nome completo</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex.: Operador caixa"
                  required
                />
              </label>
              <label className="parc-drawer__field">
                <span>Usuário (login)</span>
                <input
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ex.: posto.caixa1"
                  autoComplete="off"
                  required
                />
              </label>
              <label className="parc-drawer__field">
                <span>E-mail (login e recuperação de senha)</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@posto.com.br"
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
                <code>/login-operacional?destino=posto</code>
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

function Campo({ rotulo, valor }: { rotulo: string; valor?: string }) {
  if (!valor?.trim()) return null;
  return (
    <div>
      <dt>{rotulo}</dt>
      <dd>{valor}</dd>
    </div>
  );
}

function CredencialLinha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="parc-login-gerado__row">
      <span>{rotulo}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <code>{valor}</code>
        <button
          type="button"
          className="parc-row__btn"
          style={{ padding: "4px 8px" }}
          onClick={() => copiar(valor)}
          title={`Copiar ${rotulo.toLowerCase()}`}
        >
          <Copy size={12} aria-hidden />
        </button>
      </span>
    </div>
  );
}
