import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase/firebase";
import { useAccess } from "../hooks/access/use-access";
import type { UsuarioFirestore } from "../hooks/access/types";
import type { PostoParceiroApi } from "../../../lib/api/parceiros";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../../../components/ui/sheet";
import { Button } from "../../../components/ui/button";

type Msg = { tone: "ok" | "err"; text: string } | null;

const inputCls =
  "w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[#f97316]/60";

export function PostoDetalheDrawer({
  posto,
  open,
  onClose,
}: {
  posto: PostoParceiroApi | null;
  open: boolean;
  onClose: () => void;
}) {
  const { listarUsuarios, adicionarUsuario, resetarSenha, removerUsuario } = useAccess();
  const [prefeituraId, setPrefeituraId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [acessos, setAcessos] = useState<UsuarioFirestore[]>([]);
  const [nome, setNome] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [salvando, setSalvando] = useState(false);

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
    setNome("");
    setUsuario("");
    setSenha("");
    setCarregando(true);
    void (async () => {
      try {
        const snap = await getDoc(doc(db, "postos", posto.id));
        const pref = snap.exists()
          ? (snap.data().prefeituraId as string | undefined)
          : undefined;
        if (!ativo) return;
        setPrefeituraId(pref ?? null);
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
      setMsg({ tone: "err", text: "Cliente vinculado não identificado para este posto." });
      return;
    }
    setSalvando(true);
    const r = await adicionarUsuario({
      nome,
      usuario,
      senha,
      perfil: "gestor",
      vinculo: "posto",
      postoId: posto.id,
      prefeituraId,
    });
    setMsg({ tone: r.ok ? "ok" : "err", text: r.message });
    if (r.ok) {
      setNome("");
      setUsuario("");
      setSenha("");
      await recarregar(posto.id);
    }
    setSalvando(false);
  }

  async function handleReset(id: string, login: string) {
    const nova = window.prompt(`Nova senha para "${login}" (mín. 4):`);
    if (nova == null) return;
    const r = await resetarSenha(id, nova);
    setMsg({ tone: r.ok ? "ok" : "err", text: r.message });
  }

  async function handleRemover(id: string, login: string) {
    if (!posto) return;
    if (!window.confirm(`Remover o acesso "${login}"?`)) return;
    const r = await removerUsuario(id);
    setMsg({ tone: r.ok ? "ok" : "err", text: r.message });
    if (r.ok) await recarregar(posto.id);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto border-white/10 bg-[#0e1424] text-slate-100 sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="text-slate-100">{posto?.nome ?? "Posto"}</SheetTitle>
          <SheetDescription className="text-slate-400">
            {[posto?.cidadeUf, posto?.bandeira].filter(Boolean).join(" · ") ||
              "Detalhes e acessos"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <Linha rotulo="Razão social" valor={posto?.razaoSocial} />
            <Linha rotulo="Cidade/UF" valor={posto?.cidadeUf} />
            <Linha rotulo="Bandeira" valor={posto?.bandeira} />
            <Linha rotulo="Status" valor={posto?.ativo ? "Ativo" : "Suspenso"} />
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Acessos do posto
            </h3>
            {carregando ? (
              <p className="text-sm text-slate-400">Carregando…</p>
            ) : acessos.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum acesso ainda.</p>
            ) : (
              <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
                {acessos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.usuario}</p>
                      <p className="truncate text-xs text-slate-400">{a.nome}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => handleReset(a.id, a.usuario)}
                      >
                        Resetar senha
                      </Button>
                      <Button
                        size="xs"
                        variant="destructive"
                        onClick={() => handleRemover(a.id, a.usuario)}
                      >
                        Remover
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form onSubmit={handleCriar} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Novo acesso
            </h3>
            <input
              className={inputCls}
              placeholder="Nome do operador"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
            <input
              className={inputCls}
              placeholder="Usuário (login do caixa)"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
            />
            <input
              className={inputCls}
              type="password"
              placeholder="Senha (mín. 4)"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            {msg ? (
              <p
                className={`text-sm ${msg.tone === "ok" ? "text-emerald-400" : "text-red-400"}`}
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
              {salvando ? "Salvando…" : "Criar acesso"}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor?: string }) {
  if (!valor) return null;
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-slate-400">{rotulo}</span>
      <span className="text-right font-medium">{valor}</span>
    </div>
  );
}
