import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../../lib/firebase/firebase";
import { useAccess } from "../../hooks/access/use-access";
import type { UsuarioFirestore } from "../../hooks/access/types";
import { loginFromEmail } from "../posto-detalhe/use-posto-detalhe";

export type OficinaDocDetalhe = {
  nomeFantasia?: string;
  razaoSocial?: string;
  cnpj?: string;
  telefonePrincipal?: string;
  emailComercial?: string;
  cidadeUf?: string;
  endereco?: string;
  linhasAtuacao?: string[];
  categoriasServico?: string[];
  especificacoes?: string;
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

export type OficinaDetalheMsg = { tone: "ok" | "err"; text: string } | null;

function mapOficinaDoc(data: Record<string, unknown>): OficinaDocDetalhe {
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
    linhasAtuacao: Array.isArray(data.linhasAtuacao)
      ? data.linhasAtuacao.filter((v): v is string => typeof v === "string")
      : [],
    categoriasServico: Array.isArray(data.categoriasServico)
      ? data.categoriasServico.filter((v): v is string => typeof v === "string")
      : [],
    especificacoes:
      typeof data.especificacoes === "string" ? data.especificacoes : "",
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

export function useOficinaDetalhe(oficinaId: string | undefined) {
  const { listarUsuarios, adicionarUsuario, resetarSenha, removerUsuario } =
    useAccess();

  const [prefeituraId, setPrefeituraId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<OficinaDocDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null);
  const [acessos, setAcessos] = useState<UsuarioFirestore[]>([]);
  const [msg, setMsg] = useState<OficinaDetalheMsg>(null);
  const [salvando, setSalvando] = useState(false);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [credencialNova, setCredencialNova] = useState<CredencialExibida | null>(
    null,
  );

  const recarregarAcessos = useCallback(
    async (id: string) => {
      setAcessos(await listarUsuarios({ officinaId: id }));
    },
    [listarUsuarios],
  );

  const recarregar = useCallback(async () => {
    if (!oficinaId) return;
    setCarregando(true);
    setErroCarregamento(null);
    try {
      const snap = await getDoc(doc(db, "oficinas", oficinaId));
      if (!snap.exists()) {
        setErroCarregamento("Oficina não encontrada.");
        setDetalhe(null);
        setPrefeituraId(null);
        setAcessos([]);
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      setPrefeituraId(
        typeof data.prefeituraId === "string" ? data.prefeituraId : null,
      );
      setDetalhe(mapOficinaDoc(data));
      await recarregarAcessos(oficinaId);
    } catch {
      setErroCarregamento("Não foi possível carregar os dados da oficina.");
    } finally {
      setCarregando(false);
    }
  }, [oficinaId, recarregarAcessos]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const titulo =
    detalhe?.nomeFantasia?.trim() ||
    detalhe?.razaoSocial?.trim() ||
    "Oficina";

  async function criarAcesso(input: {
    nome: string;
    email: string;
    senha: string;
  }) {
    if (!oficinaId) return { ok: false as const, message: "Oficina inválida." };
    if (!prefeituraId) {
      return {
        ok: false as const,
        message: "Cliente vinculado não identificado para esta oficina.",
      };
    }

    const emailNorm = loginFromEmail(input.email);
    const r = await adicionarUsuario({
      nome: input.nome.trim(),
      usuario: emailNorm,
      email: emailNorm,
      senha: input.senha,
      perfil: "gestor",
      vinculo: "oficina",
      officinaId: oficinaId,
      prefeituraId,
    });

    if (!r.ok) return { ok: false as const, message: r.message };

    setCredencialNova({
      nome: input.nome.trim(),
      email: emailNorm,
      senha: input.senha,
    });
    await recarregarAcessos(oficinaId);
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
    if (!oficinaId) return { ok: false, message: "Oficina inválida." };
    setOcupadoId(id);
    const r = await removerUsuario(id);
    if (r.ok) {
      setAcessos((prev) => prev.filter((a) => a.id !== id));
      await recarregarAcessos(oficinaId);
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
