import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase/firebase";
import { useAccess } from "../../hooks/access/use-access";
import type { UsuarioFirestore } from "../../hooks/access/types";
import { userPostoApi } from "../../../../lib/api/user-posto";

export type PostoDocDetalhe = {
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
  ativo?: boolean;
};

export type CredencialExibida = {
  nome: string;
  email: string;
  senha: string;
};

export type PostoDetalheMsg = { tone: "ok" | "err"; text: string } | null;

function mapPostoDoc(data: Record<string, unknown>): PostoDocDetalhe {
  const status = typeof data.status === "string" ? data.status : "";
  return {
    nomeFantasia:
      typeof data.nomeFantasia === "string" ? data.nomeFantasia : "",
    razaoSocial: typeof data.razaoSocial === "string" ? data.razaoSocial : "",
    cnpj: typeof data.cnpj === "string" ? data.cnpj : "",
    telefonePrincipal:
      typeof data.telefonePrincipal === "string" ? data.telefonePrincipal : "",
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
      typeof data.condicaoPagamento === "string" ? data.condicaoPagamento : "",
    limiteCredito:
      typeof data.limiteCredito === "number" ? data.limiteCredito : 0,
    descontoComercial:
      typeof data.descontoComercial === "string" ? data.descontoComercial : "",
    observacoesFaturamento:
      typeof data.observacoesFaturamento === "string"
        ? data.observacoesFaturamento
        : "",
    status,
    ativo: status.toLowerCase().startsWith("ativ"),
  };
}

/** E-mail é o identificador de login no portal do posto. */
export function loginFromEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function usePostoDetalhe(postoId: string | undefined) {
  const { listarUsuarios, adicionarUsuario, resetarSenha, removerUsuario } =
    useAccess();

  const [prefeituraId, setPrefeituraId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<PostoDocDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [acessos, setAcessos] = useState<UsuarioFirestore[]>([]);
  const [msg, setMsg] = useState<PostoDetalheMsg>(null);
  const [salvando, setSalvando] = useState(false);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [credencialNova, setCredencialNova] = useState<CredencialExibida | null>(
    null,
  );

  const recarregarAcessos = useCallback(
    async (id: string) => {
      setAcessos(await listarUsuarios({ postoId: id }));
    },
    [listarUsuarios],
  );

  const recarregar = useCallback(async () => {
    if (!postoId) return;
    setCarregando(true);
    setErroCarregamento(null);
    try {
      const snap = await getDoc(doc(db, "postos", postoId));
      if (!snap.exists()) {
        setErroCarregamento("Posto não encontrado.");
        setDetalhe(null);
        setPrefeituraId(null);
        setAcessos([]);
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      setPrefeituraId(
        typeof data.prefeituraId === "string" ? data.prefeituraId : null,
      );
      setDetalhe(mapPostoDoc(data));
      await recarregarAcessos(postoId);
    } catch {
      setErroCarregamento("Não foi possível carregar os dados do posto.");
    } finally {
      setCarregando(false);
    }
  }, [postoId, recarregarAcessos]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const titulo =
    detalhe?.nomeFantasia?.trim() ||
    detalhe?.razaoSocial?.trim() ||
    "Posto";

  async function criarAcesso(input: {
    nome: string;
    email: string;
    senha: string;
  }) {
    if (!postoId) return { ok: false as const, message: "Posto inválido." };
    if (!prefeituraId) {
      return {
        ok: false as const,
        message: "Cliente vinculado não identificado para este posto.",
      };
    }

    const emailNorm = loginFromEmail(input.email);
    const r = await adicionarUsuario({
      nome: input.nome.trim(),
      usuario: emailNorm,
      email: emailNorm,
      senha: input.senha,
      perfil: "gestor",
      vinculo: "posto",
      postoId,
      prefeituraId,
    });

    if (!r.ok) return { ok: false as const, message: r.message };

    void userPostoApi.enviarBoasVindas({
      email: emailNorm,
      nome: input.nome.trim(),
      usuario: emailNorm,
      postoNome: titulo,
      senhaTemporaria: input.senha,
    });

    setCredencialNova({
      nome: input.nome.trim(),
      email: emailNorm,
      senha: input.senha,
    });
    await recarregarAcessos(postoId);
    return { ok: true as const, message: "Acesso criado com sucesso." };
  }

  async function redefinirSenha(id: string, novaSenha: string, rotulo: string) {
    setOcupadoId(id);
    setCredencialNova(null);
    const r = await resetarSenha(id, novaSenha);
    if (r.ok) {
      setCredencialNova({
        nome: rotulo,
        email: rotulo.includes("@") ? rotulo : "",
        senha: novaSenha,
      });
    }
    setOcupadoId(null);
    return r;
  }

  async function excluirAcesso(id: string) {
    if (!postoId) return { ok: false, message: "Posto inválido." };
    setOcupadoId(id);
    const r = await removerUsuario(id);
    if (r.ok) {
      setAcessos((prev) => prev.filter((a) => a.id !== id));
      await recarregarAcessos(postoId);
    }
    setOcupadoId(null);
    return r;
  }

  return {
    titulo,
    detalhe,
    prefeituraId,
    carregando,
    erroCarregamento,
    acessos,
    msg,
    setMsg,
    salvando,
    setSalvando,
    ocupadoId,
    credencialNova,
    setCredencialNova,
    criarAcesso,
    redefinirSenha,
    excluirAcesso,
    recarregar,
  };
}
