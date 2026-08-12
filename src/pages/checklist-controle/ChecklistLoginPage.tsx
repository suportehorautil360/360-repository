import { type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { getDoc, doc as firestoreDoc } from "firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { funcionariosApi } from "../../lib/funcionarios/funcionarios";
import { formatarCpf, limparCpf } from "../../lib/funcionarios/cpf";
import type { OperadorSession } from "./useOperadorSession";
import { useOperadorSession } from "./useOperadorSession";
import {
  autenticarOffline,
  removerCredencialOffline,
  salvarCredencialOffline,
} from "./credenciais-offline";
import { NomeOperadorDialog } from "./NomeOperadorDialog";

const THEME_KEY = "hu360-checklist-theme";
const LAST_TAB_KEY = "hu360-checklist-last-tab";

const MOTIVO_MSG: Record<string, string> = {
  "nao-encontrado": "CPF ou login não encontrado. Verifique com o gestor.",
  "sem-senha": "Funcionário sem senha cadastrada. Procure o gestor.",
  "senha-invalida": "Identificador ou senha incorretos.",
  inativo: "Acesso inativo. Procure o gestor da prefeitura.",
};

const MOTIVO_CHASSI: Record<
  "nao-encontrado" | "conflito" | "sem-conexao" | "erro" | "nao-habilita",
  string
> = {
  "nao-encontrado": "Chassi não encontrado. Confirme o número com o gestor.",
  conflito: "Chassi vinculado a mais de uma empresa. Contate o suporte.",
  "nao-habilita": "Esse chassi não permite login direto. Use CPF/senha.",
  "sem-conexao":
    "Sem conexão. Esse aparelho não conhece esse chassi. Conecte à internet ou peça pra alguém logar online primeiro.",
  erro: "Não foi possível validar o chassi. Tente novamente.",
};

export function ChecklistLoginPage() {
  const navigate = useNavigate();
  const { setSession } = useOperadorSession();

  // ── Tema isolado (dark/light só nessa página) ──────────────────────────────
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved =
      typeof localStorage !== "undefined" && localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // ── Última aba usada ───────────────────────────────────────────────────────
  const [tab, setTab] = useState<"chassi" | "cpf">(() => {
    const saved =
      typeof localStorage !== "undefined" && localStorage.getItem(LAST_TAB_KEY);
    return saved === "chassi" || saved === "cpf" ? saved : "cpf";
  });

  useEffect(() => {
    localStorage.setItem(LAST_TAB_KEY, tab);
  }, [tab]);

  // ── Estado CPF/senha ───────────────────────────────────────────────────────
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [loadingCpf, setLoadingCpf] = useState(false);
  const [erroCpf, setErroCpf] = useState("");

  /** Detecta CPF: se a entrada tem ≥ 11 dígitos, formata como CPF. */
  const ehCpf = limparCpf(identificador).length === 11;
  const valorExibido = ehCpf ? formatarCpf(identificador) : identificador;

  // ── Estado Chassi ──────────────────────────────────────────────────────────
  const [chassi, setChassi] = useState("");
  const [loadingChassi, setLoadingChassi] = useState(false);
  const [erroChassi, setErroChassi] = useState("");
  const [modalNomeAberto, setModalNomeAberto] = useState(false);
  const [resolvido, setResolvido] = useState<{
    empresaId: string;
    empresaNome: string;
    idMaquina: string;
    chassi: string;
  } | null>(null);

  // ── Fluxo CPF/senha ────────────────────────────────────────────────────────
  async function handleSubmitCpf(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ident = identificador.trim();
    if (!ident) {
      setErroCpf("Informe seu CPF ou login.");
      return;
    }
    if (!senha) {
      setErroCpf("Informe a senha.");
      return;
    }

    setErroCpf("");
    setLoadingCpf(true);

    function entrar(
      f: {
        nome: string;
        prefeituraId: string;
        id: string;
        cpf?: string;
        tipo?: OperadorSession["tipo"];
      },
      empresaNome: string,
    ) {
      const sess: OperadorSession = {
        nome: f.nome,
        idCliente: f.prefeituraId,
        empresa: empresaNome,
        funcionarioId: f.id,
        cpf: f.cpf,
        tipo: f.tipo,
        modoLogin: "cpf-senha",
      };
      setSession(sess);
      navigate("/checklist-controle", { replace: true });
    }

    // Sem rede, a credencial guardada no aparelho (último login online,
    // válida por 7 dias) permite entrar offline.
    async function tentarOffline(): Promise<boolean> {
      const off = await autenticarOffline(ident, senha).catch(() => null);
      if (!off) return false;
      entrar(off.funcionario, off.empresa);
      return true;
    }

    try {
      const r = await funcionariosApi.autenticar(ident, senha);
      if (!r.ok) {
        // Offline, a consulta pode resolver "vazia" pelo cache do Firestore
        // — antes de negar, tenta a credencial offline. Se também não der,
        // a mensagem explica a regra do offline (dizer "não encontrado"
        // faria o operador achar que o cadastro sumiu).
        if (!navigator.onLine) {
          if (await tentarOffline()) return;
          setErroCpf(
            "Sem conexão. Para entrar offline é preciso já ter feito login neste aparelho nos últimos 7 dias.",
          );
          setLoadingCpf(false);
          return;
        }
        // O servidor negou de verdade: a credencial local não vale mais.
        if (r.motivo === "senha-invalida" || r.motivo === "inativo") {
          removerCredencialOffline(ident);
        }
        setErroCpf(MOTIVO_MSG[r.motivo] ?? "Não foi possível entrar.");
        setLoadingCpf(false);
        return;
      }

      const f = r.funcionario;

      // Nome legível da prefeitura (fallback no próprio id).
      let empresaNome = f.prefeituraId || "Prefeitura";
      if (f.prefeituraId) {
        try {
          const cli = await getDoc(
            firestoreDoc(db, "clientes", f.prefeituraId),
          );
          const nome = cli.exists() ? String(cli.data().nome ?? "").trim() : "";
          if (nome) empresaNome = nome;
        } catch {
          /* usa fallback */
        }
      }

      // Guarda a credencial para os próximos logins sem rede (best-effort).
      try {
        await salvarCredencialOffline({ funcionario: f, empresa: empresaNome, senha });
      } catch {
        /* sem espaço — login offline fica indisponível, login normal segue */
      }

      entrar(f, empresaNome);
    } catch {
      if (await tentarOffline()) return;
      if (!navigator.onLine) {
        setErroCpf(
          "Sem conexão. Para entrar offline é preciso já ter feito login neste aparelho nos últimos 7 dias.",
        );
      } else {
        setErroCpf("Erro ao consultar o banco de dados. Tente novamente.");
      }
      setLoadingCpf(false);
    }
  }

  // ── Fluxo Chassi ──────────────────────────────────────────────────────────
  async function handleSubmitChassi(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const chassiNorm = chassi.trim().toUpperCase();
    if (!chassiNorm) {
      setErroChassi("Informe o chassi do veículo.");
      return;
    }

    setErroChassi("");
    setLoadingChassi(true);

    try {
      const r = await funcionariosApi.autenticarPorChassi(chassiNorm);
      if (!r.ok) {
        setErroChassi(
          MOTIVO_CHASSI[r.motivo] ?? "Não foi possível validar o chassi.",
        );
        setLoadingChassi(false);
        return;
      }
      setResolvido({
        empresaId: r.empresaId,
        empresaNome: r.empresaNome,
        idMaquina: r.idMaquina,
        chassi: r.chassi,
      });
      setModalNomeAberto(true);
    } catch {
      setErroChassi("Não foi possível validar o chassi. Tente novamente.");
    } finally {
      setLoadingChassi(false);
    }
  }

  function onConfirmarNome(nome: string) {
    if (!resolvido) return;
    setSession({
      nome,
      idCliente: resolvido.empresaId,
      empresa: resolvido.empresaNome,
      idMaquina: resolvido.idMaquina,
      chassis: resolvido.chassi,
      modoLogin: "chassi",
      nomeInformado: nome,
    });
    navigate("/checklist-controle", { replace: true });
  }

  function onCancelarNome() {
    setModalNomeAberto(false);
    setResolvido(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <div className="min-h-screen bg-white text-slate-900 dark:bg-[#090f1f] dark:text-slate-100">
        {/* Header com toggle dark/light */}
        <header className="flex justify-end p-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            onClick={() =>
              setTheme(theme === "dark" ? "light" : "dark")
            }
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
        </header>

        {/* Layout split desktop */}
        <main className="grid min-h-[calc(100vh-64px)] lg:grid-cols-2">
          {/* Coluna esquerda — formulário */}
          <section
            className="flex items-center justify-center p-6 lg:p-12"
            aria-labelledby="checklist-login-title"
          >
            <Card className="w-full max-w-md border-slate-200 bg-white shadow-lg dark:border-white/10 dark:bg-white/[0.03]">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1">
                  <h1
                    id="checklist-login-title"
                    className="text-2xl font-semibold tracking-tight"
                  >
                    Controle Checklist
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Entre para começar suas inspeções de campo.
                  </p>
                </div>

                <Tabs
                  value={tab}
                  onValueChange={(v) => setTab(v as "chassi" | "cpf")}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="chassi" className="flex-1">
                      Chassi
                    </TabsTrigger>
                    <TabsTrigger value="cpf" className="flex-1">
                      CPF / Login
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Aba Chassi ───────────────────────────────────────── */}
                  <TabsContent value="chassi" className="space-y-4 pt-2">
                    <form
                      onSubmit={handleSubmitChassi}
                      className="space-y-3"
                      noValidate
                    >
                      <div className="space-y-1">
                        <label
                          htmlFor="checklist-chassi"
                          className="text-sm font-medium text-slate-700 dark:text-slate-300"
                        >
                          Chassi do veículo
                        </label>
                        <Input
                          id="checklist-chassi"
                          placeholder="Ex.: 9BWZZZ377VT004251"
                          autoComplete="off"
                          autoCapitalize="characters"
                          value={chassi.toUpperCase()}
                          onChange={(e) => {
                            setChassi(e.target.value.toUpperCase());
                            setErroChassi("");
                          }}
                        />
                      </div>

                      {erroChassi && (
                        <p
                          role="alert"
                          className="text-sm text-red-500 dark:text-red-400"
                        >
                          {erroChassi}
                        </p>
                      )}

                      <Button
                        type="submit"
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white dark:bg-orange-500 dark:hover:bg-orange-600"
                        disabled={loadingChassi}
                      >
                        {loadingChassi ? "Verificando..." : "Entrar"}
                      </Button>
                    </form>
                  </TabsContent>

                  {/* ── Aba CPF/senha ────────────────────────────────────── */}
                  <TabsContent value="cpf" className="space-y-4 pt-2">
                    <form
                      onSubmit={handleSubmitCpf}
                      className="space-y-3"
                      noValidate
                    >
                      <div className="space-y-1">
                        <label
                          htmlFor="checklist-id"
                          className="text-sm font-medium text-slate-700 dark:text-slate-300"
                        >
                          CPF ou Login
                        </label>
                        <Input
                          id="checklist-id"
                          inputMode={ehCpf ? "numeric" : "text"}
                          autoComplete="username"
                          placeholder="CPF (000.000.000-00) ou login (joao123)"
                          value={valorExibido}
                          onChange={(e) => {
                            setIdentificador(e.target.value);
                            setErroCpf("");
                          }}
                        />
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="checklist-senha"
                          className="text-sm font-medium text-slate-700 dark:text-slate-300"
                        >
                          Senha
                        </label>
                        <Input
                          id="checklist-senha"
                          type="password"
                          autoComplete="current-password"
                          placeholder="Sua senha"
                          value={senha}
                          onChange={(e) => {
                            setSenha(e.target.value);
                            setErroCpf("");
                          }}
                        />
                      </div>

                      {erroCpf && (
                        <p
                          role="alert"
                          className="text-sm text-red-500 dark:text-red-400"
                        >
                          {erroCpf}
                        </p>
                      )}

                      <Button
                        type="submit"
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white dark:bg-orange-500 dark:hover:bg-orange-600"
                        disabled={loadingCpf}
                      >
                        {loadingCpf ? "Verificando..." : "Entrar"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>

          {/* Coluna direita — painel visual (oculto em mobile) */}
          <aside
            aria-hidden
            className="hidden lg:flex items-center justify-center bg-gradient-to-br from-orange-500 via-orange-600 to-orange-900"
          >
            <div className="text-center text-white/90 px-12 space-y-4">
              <div className="text-6xl font-bold tracking-tight opacity-20 select-none">
                360°
              </div>
              <p className="text-lg font-medium opacity-70">
                Hora Útil 360 — Controle de Campo
              </p>
            </div>
          </aside>
        </main>

        {/* Modal de nome (fluxo chassi) */}
        <NomeOperadorDialog
          open={modalNomeAberto}
          onConfirmar={onConfirmarNome}
          onCancelar={onCancelarNome}
        />
      </div>
    </div>
  );
}
