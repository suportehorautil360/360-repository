import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "@firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import { useHU360 } from "../../lib/hu360";
import { useLogin } from "../login/hooks/use-login";
import "./oficina.css";

function gerarProtocolo(): string {
  const ano = new Date().getFullYear();
  const seq = String(Math.floor(Date.now() / 1000) % 1000).padStart(3, "0");
  return `${ano}-${seq}`;
}

interface SolicitacaoOS {
  id: string;
  protocolo: string;
  prefeituraId: string;
  equipamento: string;
  linha: string;
  operador: string;
  horimetro: string;
  relato: string;
  oficinas: string[];
  oficinasIds?: string[];
  oficinasResponderam?: string[];
  status: string;
  criadoEm: { seconds: number } | null;
}

type OficinaSecao = "novas-os" | "orcamentos" | "checklist-dev" | "faturamento";

interface OrdemServico {
  id: string;
  protocolo: string;
  prefeituraId: string;
  solicitacaoOsId: string | null;
  equipamento: string;
  defeito: string;
  oficinaNome: string;
  oficinaId: string;
  itens: { descricao: string; valor: number }[];
  valorTotal: number;
  status: string;
  criadoEm: { seconds: number } | null;
}

interface ItemOrcamento {
  descricao: string;
  valor: string;
}

function novoItemOrcamento(): ItemOrcamento {
  return { descricao: "", valor: "" };
}

export function OficinaPage() {
  const { user, setUser } = useLogin();
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { obterDadosPrefeitura, prefeituraLabel } = useHU360();

  const isAdmin = user?.type === "admin";
  const efetivoPrefeituraId = isAdmin
    ? (paramId ?? "")
    : (user?.prefeituraId ?? "");

  const [secaoAtiva, setSecaoAtiva] = useState<OficinaSecao>("novas-os");
  const [protocolo, setProtocolo] = useState(() => gerarProtocolo());
  const [itensOrcamento, setItensOrcamento] = useState<ItemOrcamento[]>(() => [
    novoItemOrcamento(),
  ]);
  const [osErro, setOsErro] = useState("");
  const [osSaving, setOsSaving] = useState(false);
  const [osSucesso, setOsSucesso] = useState("");

  // Solicitações de O.S. abertas pela prefeitura
  const [osList, setOsList] = useState<SolicitacaoOS[]>([]);
  const [osListLoading, setOsListLoading] = useState(false);
  const [osExpandidaId, setOsExpandidaId] = useState<string | null>(null);
  // Doc ID da oficina resolvido a partir da coleção oficinas
  const [oficinaDocId, setOficinaDocId] = useState<string>("");

  // Orçamentos enviados por esta oficina
  const [meusOrcamentos, setMeusOrcamentos] = useState<OrdemServico[]>([]);
  const [orcamentosLoading, setOrcamentosLoading] = useState(false);

  // Checklist devolução
  const [checklistOsId, setChecklistOsId] = useState("");
  const [checklistEquipamento, setChecklistEquipamento] = useState("");
  const [checklistRelatorio, setChecklistRelatorio] = useState("");
  const [checklistFotoNova, setChecklistFotoNova] = useState<File | null>(null);
  const [checklistFotoVelha, setChecklistFotoVelha] = useState<File | null>(
    null,
  );
  const [checklistFotoPronto, setChecklistFotoPronto] = useState<File | null>(
    null,
  );
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [checklistErro, setChecklistErro] = useState("");
  const [checklistSucesso, setChecklistSucesso] = useState("");

  const loadOsList = useCallback(async () => {
    if (!efetivoPrefeituraId) return;
    setOsListLoading(true);
    try {
      // Passo 1: busca todas as oficinas do município pelo prefeituraId da página
      const oficinasSnap = await getDocs(
        query(
          collection(db, "oficinas"),
          where("prefeituraId", "==", efetivoPrefeituraId),
        ),
      );
      const docIds = oficinasSnap.docs.map((d) => d.id);
      if (docIds.length === 0) {
        setOsList([]);
        return;
      }

      // Passo 2: para usuário da oficina filtra apenas o ID dela; admin vê todas
      const idsParaBuscar = isAdmin
        ? docIds
        : docIds.filter((id) => id === (user?.officinaId ?? ""));

      if (idsParaBuscar.length === 0) {
        setOsList([]);
        return;
      }

      // Armazena o doc ID resolvido para uso ao responder
      if (!isAdmin) setOficinaDocId(idsParaBuscar[0]);

      console.log("idsParaBuscar:", idsParaBuscar);

      // Passo 3: busca OS onde oficinasIds contém algum dos IDs encontrados
      const snap = await getDocs(
        query(
          collection(db, "solicitacoesOS"),
          where("oficinasIds", "array-contains-any", idsParaBuscar),
          where("status", "==", "aguardando_orcamento"),
        ),
      );

      // Usa a variável local (não o estado, que ainda pode estar desatualizado)
      const idFiltro = isAdmin ? null : (idsParaBuscar[0] ?? "");
      setOsList(
        snap.docs
          .filter((d) => {
            if (!idFiltro) return true;
            const responderam: string[] =
              (d.data().oficinasResponderam as string[] | undefined) ?? [];
            return !responderam.includes(idFiltro);
          })
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<SolicitacaoOS, "id">),
          })),
      );
    } catch {
      // silently fail — list stays empty
    } finally {
      setOsListLoading(false);
    }
  }, [efetivoPrefeituraId, isAdmin, user?.officinaId]);

  const loadMeusOrcamentos = useCallback(async () => {
    if (!efetivoPrefeituraId) return;
    setOrcamentosLoading(true);
    try {
      const myId = isAdmin ? null : oficinaDocId || (user?.officinaId ?? "");
      const q = myId
        ? query(collection(db, "ordensServico"), where("oficinaId", "==", myId))
        : query(
            collection(db, "ordensServico"),
            where("prefeituraId", "==", efetivoPrefeituraId),
          );
      const snap = await getDocs(q);
      setMeusOrcamentos(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<OrdemServico, "id">),
        })),
      );
    } catch {
      // silently fail
    } finally {
      setOrcamentosLoading(false);
    }
  }, [efetivoPrefeituraId, isAdmin, oficinaDocId, user?.officinaId]);

  useEffect(() => {
    document.body.classList.add("oficina-root");
    return () => {
      document.body.classList.remove("oficina-root");
    };
  }, []);

  useEffect(() => {
    void loadOsList();
  }, [loadOsList]);

  useEffect(() => {
    if (secaoAtiva === "orcamentos") {
      void loadMeusOrcamentos();
    }
    if (secaoAtiva === "checklist-dev") {
      void loadMeusOrcamentos();
    }
  }, [secaoAtiva, loadMeusOrcamentos]);

  async function handleEnviarChecklist() {
    setChecklistErro("");
    setChecklistSucesso("");
    if (!checklistRelatorio.trim()) {
      setChecklistErro("Preencha o relatório do serviço realizado.");
      return;
    }
    if (!checklistEquipamento.trim()) {
      setChecklistErro("Informe o equipamento.");
      return;
    }
    setChecklistSaving(true);
    try {
      const myId = isAdmin
        ? (paramId ?? "")
        : oficinaDocId || (user?.officinaId ?? "");
      const checklistId = crypto.randomUUID();

      // Redimensiona e comprime a imagem via canvas para caber no limite do Firestore (1 MB por doc)
      function comprimirFoto(
        file: File,
        maxWidth = 800,
        quality = 0.7,
      ): Promise<string> {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error);
          reader.onload = () => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
              const scale = Math.min(1, maxWidth / img.width);
              const canvas = document.createElement("canvas");
              canvas.width = Math.round(img.width * scale);
              canvas.height = Math.round(img.height * scale);
              const ctx = canvas.getContext("2d")!;
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL("image/jpeg", quality));
            };
            img.src = reader.result as string;
          };
          reader.readAsDataURL(file);
        });
      }

      const [fotoNovaUrl, fotoVelhaUrl, fotoProntoUrl] = await Promise.all([
        checklistFotoNova
          ? comprimirFoto(checklistFotoNova)
          : Promise.resolve(""),
        checklistFotoVelha
          ? comprimirFoto(checklistFotoVelha)
          : Promise.resolve(""),
        checklistFotoPronto
          ? comprimirFoto(checklistFotoPronto)
          : Promise.resolve(""),
      ]);

      await setDoc(doc(db, "checklistsDevolucao", checklistId), {
        id: checklistId,
        prefeituraId: efetivoPrefeituraId,
        oficinaId: myId,
        oficinaNome: user?.usuario ?? "",
        equipamento: checklistEquipamento.trim(),
        relatorio: checklistRelatorio.trim(),
        ordemServicoId: checklistOsId || null,
        fotoNovaUrl,
        fotoVelhaUrl,
        fotoProntoUrl,
        criadoEm: serverTimestamp(),
      });

      setChecklistSucesso("Checklist enviado com sucesso!");
      setChecklistRelatorio("");
      setChecklistEquipamento("");
      setChecklistOsId("");
      setChecklistFotoNova(null);
      setChecklistFotoVelha(null);
      setChecklistFotoPronto(null);
    } catch (error) {
      console.log(
        "Erro ao enviar checklist:",

        error,
      );

      setChecklistErro("Erro ao enviar checklist. Tente novamente.");
    } finally {
      setChecklistSaving(false);
    }
  }

  const dados = useMemo(
    () =>
      efetivoPrefeituraId ? obterDadosPrefeitura(efetivoPrefeituraId) : null,
    [efetivoPrefeituraId, obterDadosPrefeitura],
  );

  function navegar(secao: OficinaSecao) {
    setSecaoAtiva(secao);
  }

  function adicionarItemOrcamento() {
    setItensOrcamento((prev) => [...prev, novoItemOrcamento()]);
  }

  function removerItemOrcamento(idx: number) {
    setItensOrcamento((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
    );
  }

  function atualizarItemOrcamento(
    idx: number,
    campo: keyof ItemOrcamento,
    valor: string,
  ) {
    setItensOrcamento((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item)),
    );
  }

  async function handleEnviarOrcamento() {
    const osSel = osList.find((o) => o.id === osExpandidaId);

    console.log("Enviando orçamento para O.S.:", osSel);
    setOsErro("");
    setOsSucesso("");

    if (!protocolo.trim()) {
      setOsErro("Informe o protocolo da O.S.");
      return;
    }

    const itensSemDescricao = itensOrcamento.filter(
      (it) => !it.descricao.trim(),
    );
    const itensSemValor = itensOrcamento.filter((it) => !it.valor.trim());

    if (itensSemDescricao.length > 0 || itensSemValor.length > 0) {
      const msgs: string[] = [];
      if (itensSemDescricao.length > 0)
        msgs.push(`${itensSemDescricao.length} item(ns) sem descrição`);
      if (itensSemValor.length > 0)
        msgs.push(`${itensSemValor.length} item(ns) sem valor`);
      setOsErro(`Para salvar, preencha todos os campos: ${msgs.join(" e ")}.`);
      return;
    }

    setOsSaving(true);
    try {
      // Busca o ID desta oficina diretamente dentro do array oficinasIds da OS selecionada
      // Assim usamos exatamente o mesmo ID que a prefeitura gravou ao abrir a OS
      const myDocId = isAdmin
        ? (paramId ?? "")
        : oficinaDocId || (user?.officinaId ?? "");
      const oficinaId =
        osSel?.oficinasIds?.find((id) => id === myDocId) ?? myDocId;
      const oficinaNome = user?.usuario ?? "";

      await addDoc(collection(db, "ordensServico"), {
        protocolo: protocolo.trim(),
        prefeituraId: efetivoPrefeituraId,
        solicitacaoOsId: osExpandidaId ?? null,
        operador: oficinaNome,
        oficinaNome,
        oficinaId,
        equipamento: osSel?.equipamento ?? om.equipLabel,
        defeito: osSel?.relato ?? om.defeito,
        itens: itensOrcamento.map((it) => ({
          descricao: it.descricao.trim(),
          valor: parseFloat(it.valor.replace(",", ".")) || 0,
        })),
        valorTotal: itensOrcamento.reduce(
          (acc, it) => acc + (parseFloat(it.valor.replace(",", ".")) || 0),
          0,
        ),
        status: "aguardando_aprovacao",
        criadoEm: serverTimestamp(),
      });

      // Marca esta oficina como respondida na solicitação original
      if (osExpandidaId) {
        const jaResponderam = osSel?.oficinasResponderam ?? [];
        const totalConvidadas = osSel?.oficinasIds?.length ?? 0;
        const todasResponderam =
          totalConvidadas > 0 &&
          jaResponderam.filter((id) => id !== oficinaId).length + 1 >=
            totalConvidadas;

        await updateDoc(doc(db, "solicitacoesOS", osExpandidaId), {
          oficinasResponderam: arrayUnion(oficinaId),
          // Quando todas as oficinas enviaram orçamento, avança o status
          ...(todasResponderam ? { status: "aguardando_aprovacao" } : {}),
        });
      }

      setOsSucesso(
        `Orçamento enviado com sucesso! Protocolo: ${protocolo.trim()}`,
      );
      setItensOrcamento([novoItemOrcamento()]);
      setProtocolo(gerarProtocolo());
      setOsExpandidaId(null);
      void loadOsList();
    } catch {
      setOsErro("Erro ao enviar orçamento. Tente novamente.");
    } finally {
      setOsSaving(false);
    }
  }

  async function handleLogout() {
    if (isAdmin) {
      navigate("/admin/portal-oficina", { replace: true });
      return;
    }
    setUser({ id: "", usuario: "", type: "oficina" });
    navigate("/login-operacional?destino=oficina", { replace: true });
  }

  if (!user?.id || !dados) {
    return <Navigate to="/login-operacional?destino=oficina" replace />;
  }

  const om = dados.oficinaModulo;
  const labelPref = prefeituraLabel(efetivoPrefeituraId);
  const nomeUsuario = user.usuario;
  const usuarioLogadoTexto = `Conectado: ${nomeUsuario} (·) · ${labelPref}`;

  return (
    <div id="appShell">
      <div id="sidebar">
        <div className="logo-area">
          <h2 style={{ color: "var(--hu360-primary)", margin: 0 }}>
            horautil360
          </h2>
          <small>Portal da oficina</small>
          <p
            id="of-ctx-pref"
            style={{
              margin: "10px 0 0",
              fontSize: "0.75rem",
              color: "var(--main-orange)",
              fontWeight: 600,
            }}
          >
            {labelPref}
          </p>
        </div>
        <div
          className={`nav-item ${secaoAtiva === "novas-os" ? "active" : ""}`}
          onClick={() => navegar("novas-os")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navegar("novas-os");
            }
          }}
        >
          📥 NOVAS O.S. RECEBIDAS
        </div>
        <div
          className={`nav-item ${secaoAtiva === "orcamentos" ? "active" : ""}`}
          onClick={() => navegar("orcamentos")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navegar("orcamentos");
            }
          }}
        >
          📊 MEUS ORÇAMENTOS
        </div>
        <div
          className={`nav-item ${
            secaoAtiva === "checklist-dev" ? "active" : ""
          }`}
          onClick={() => navegar("checklist-dev")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navegar("checklist-dev");
            }
          }}
        >
          📋 CHECKLIST DEVOLUÇÃO
        </div>
        <div
          className={`nav-item ${secaoAtiva === "faturamento" ? "active" : ""}`}
          onClick={() => navegar("faturamento")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navegar("faturamento");
            }
          }}
        >
          💰 NOTA FISCAL / NF-e
        </div>
      </div>

      <div id="main">
        <div className="app-topbar">
          <Link to="/admin/dashboard" className="hub-link">
            ← Hub Mestre
          </Link>
          <div className="app-topbar-actions">
            <span id="usuarioLogado">{usuarioLogadoTexto}</span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                width: "auto",
                margin: 0,
                padding: "10px 16px",
                textTransform: "none",
              }}
              onClick={handleLogout}
            >
              Sair
            </button>
          </div>
        </div>
        <p
          style={{
            fontSize: "0.85rem",
            color: "#555",
            margin: "0 0 18px",
            lineHeight: 1.4,
          }}
        >
          Para <strong>cadastrar ou remover</strong> usuários (prefeitura,
          oficina ou posto), use o Hub:{" "}
          <strong>Controle → Acessos e logins</strong>.
        </p>

        <div
          id="novas-os"
          className={`tab-content ${secaoAtiva === "novas-os" ? "active" : ""}`}
        >
          <h1>O.S. recebidas da prefeitura</h1>
          <p
            style={{
              color: "#555",
              fontSize: "0.95rem",
              maxWidth: 820,
              lineHeight: 1.5,
            }}
          >
            A prefeitura pode disparar a mesma demanda para{" "}
            <strong>três oficinas credenciadas</strong> para classificação do
            equipamento e cotação. Aqui você lança seu orçamento; na prefeitura
            o gestor compara as três propostas e aprova uma.
          </p>

          {/* Lista de O.S. abertas pela prefeitura */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: "auto", padding: "8px 16px", margin: 0 }}
              onClick={() => {
                void loadOsList();
              }}
              disabled={osListLoading}
            >
              {osListLoading ? "Carregando..." : "↻ Recarregar"}
            </button>
            <span style={{ fontSize: "0.85rem", color: "#888" }}>
              {osList.length} O.S. aguardando orçamento
            </span>
          </div>

          {osListLoading ? (
            <p style={{ color: "#888" }}>Buscando ordens de serviço...</p>
          ) : osList.length === 0 ? (
            <div
              className="card"
              style={{ color: "#888", textAlign: "center", padding: 32 }}
            >
              Nenhuma O.S. aguardando orçamento no momento.
            </div>
          ) : (
            osList.map((os) => {
              const isExpanded = osExpandidaId === os.id;
              const dataStr = os.criadoEm
                ? new Date(os.criadoEm.seconds * 1000).toLocaleDateString(
                    "pt-BR",
                  )
                : "—";
              return (
                <div
                  key={os.id}
                  className="card"
                  style={{
                    marginBottom: 16,
                    borderLeftColor: isExpanded
                      ? "var(--main-orange)"
                      : undefined,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div>
                      <h3 style={{ margin: "0 0 6px" }}>
                        {os.protocolo}
                        <span
                          style={{
                            marginLeft: 10,
                            fontSize: "0.75rem",
                            fontWeight: 400,
                            background: "#fef3c7",
                            color: "#92400e",
                            padding: "2px 8px",
                            borderRadius: 4,
                          }}
                        >
                          AGUARDANDO ORÇAMENTO
                        </span>
                      </h3>
                      <p style={{ margin: "2px 0", fontSize: "0.9rem" }}>
                        <strong>Equipamento:</strong> {os.equipamento}
                      </p>
                      <p style={{ margin: "2px 0", fontSize: "0.9rem" }}>
                        <strong>Linha:</strong> {os.linha} &nbsp;·&nbsp;{" "}
                        <strong>Operador:</strong> {os.operador} &nbsp;·&nbsp;{" "}
                        <strong>Data:</strong> {dataStr}
                      </p>
                      <p
                        style={{
                          margin: "6px 0 0",
                          fontSize: "0.88rem",
                          color: "#555",
                        }}
                      >
                        <strong>Relato:</strong> {os.relato}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-orange"
                      style={{ width: "auto", padding: "10px 18px", margin: 0 }}
                      onClick={() => {
                        if (isExpanded) {
                          setOsExpandidaId(null);
                        } else {
                          setOsExpandidaId(os.id);
                          setProtocolo(gerarProtocolo());
                          setItensOrcamento([novoItemOrcamento()]);
                          setOsErro("");
                          setOsSucesso("");
                        }
                      }}
                    >
                      {isExpanded ? "Fechar" : "Responder com Orçamento"}
                    </button>
                  </div>

                  {isExpanded ? (
                    <div
                      style={{
                        marginTop: 20,
                        borderTop: "1px solid #e5e7eb",
                        paddingTop: 16,
                      }}
                    >
                      <h4 style={{ marginTop: 0 }}>
                        Lançar Orçamento — {os.protocolo}
                      </h4>
                      <div style={{ marginBottom: 16 }}>
                        <label
                          htmlFor="of-protocolo"
                          style={{
                            display: "block",
                            marginBottom: 4,
                            fontWeight: 600,
                          }}
                        >
                          Protocolo do Orçamento
                        </label>
                        <input
                          id="of-protocolo"
                          type="text"
                          value={protocolo}
                          onChange={(e) => setProtocolo(e.target.value)}
                          placeholder="Ex: 2026-048"
                          style={{ maxWidth: 200 }}
                        />
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: "0.8rem",
                            color: "#888",
                          }}
                        >
                          Formato: AAAA-NNN. Gerado automaticamente, mas pode
                          ser editado.
                        </p>
                      </div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {itensOrcamento.map((item, idx) => {
                          const podeRemover = itensOrcamento.length > 1;
                          const semDescricao =
                            !!osErro && !item.descricao.trim();
                          const semValor = !!osErro && !item.valor.trim();
                          return (
                            <div key={idx} style={{ display: "grid", gap: 4 }}>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "2fr 1fr 40px",
                                  gap: 12,
                                  alignItems: "flex-start",
                                }}
                              >
                                <div>
                                  <input
                                    type="text"
                                    placeholder={`Descrição da Peça / Serviço${
                                      itensOrcamento.length > 1
                                        ? ` (${idx + 1})`
                                        : ""
                                    }`}
                                    value={item.descricao}
                                    style={
                                      semDescricao
                                        ? { borderColor: "#dc2626" }
                                        : undefined
                                    }
                                    onChange={(e) => {
                                      atualizarItemOrcamento(
                                        idx,
                                        "descricao",
                                        e.target.value,
                                      );
                                      setOsErro("");
                                    }}
                                  />
                                  {semDescricao ? (
                                    <span
                                      style={{
                                        color: "#dc2626",
                                        fontSize: "0.78rem",
                                      }}
                                    >
                                      Descrição obrigatória
                                    </span>
                                  ) : null}
                                </div>
                                <div>
                                  <input
                                    type="number"
                                    placeholder="Valor R$"
                                    value={item.valor}
                                    style={
                                      semValor
                                        ? { borderColor: "#dc2626" }
                                        : undefined
                                    }
                                    onChange={(e) => {
                                      atualizarItemOrcamento(
                                        idx,
                                        "valor",
                                        e.target.value,
                                      );
                                      setOsErro("");
                                    }}
                                  />
                                  {semValor ? (
                                    <span
                                      style={{
                                        color: "#dc2626",
                                        fontSize: "0.78rem",
                                      }}
                                    >
                                      Valor obrigatório
                                    </span>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removerItemOrcamento(idx)}
                                  disabled={!podeRemover}
                                  aria-label="Remover item"
                                  title={
                                    podeRemover
                                      ? "Remover item"
                                      : "É necessário ao menos 1 item"
                                  }
                                  style={{
                                    marginTop: 6,
                                    padding: "10px 0",
                                    background: "transparent",
                                    border: "1px solid #d1d5db",
                                    borderRadius: 5,
                                    color: podeRemover ? "#dc2626" : "#cbd5e1",
                                    cursor: podeRemover
                                      ? "pointer"
                                      : "not-allowed",
                                    fontWeight: 700,
                                    fontSize: "1.15rem",
                                    lineHeight: 1,
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        className="btn btn-orange"
                        style={{ marginTop: 15 }}
                        onClick={adicionarItemOrcamento}
                      >
                        ADICIONAR ITEM
                      </button>
                      {osErro ? (
                        <p
                          style={{
                            color: "#dc2626",
                            fontWeight: 600,
                            marginTop: 14,
                            fontSize: "0.9rem",
                            border: "1px solid #fca5a5",
                            background: "#fef2f2",
                            padding: "10px 14px",
                            borderRadius: 6,
                          }}
                        >
                          {osErro}
                        </p>
                      ) : null}
                      {osSucesso ? (
                        <p
                          style={{
                            color: "#15803d",
                            fontWeight: 600,
                            marginTop: 14,
                            fontSize: "0.9rem",
                            border: "1px solid #86efac",
                            background: "#f0fdf4",
                            padding: "10px 14px",
                            borderRadius: 6,
                          }}
                        >
                          {osSucesso}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-orange"
                        style={{
                          width: "100%",
                          marginTop: 20,
                          background: "var(--primary-black)",
                          opacity: osSaving ? 0.7 : 1,
                          cursor: osSaving ? "not-allowed" : "pointer",
                        }}
                        onClick={() => {
                          void handleEnviarOrcamento();
                        }}
                        disabled={osSaving}
                      >
                        {osSaving
                          ? "ENVIANDO..."
                          : "ENVIAR ORÇAMENTO PARA PREFEITURA"}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div
          id="orcamentos"
          className={`tab-content ${secaoAtiva === "orcamentos" ? "active" : ""}`}
        >
          <h1>Meus Orçamentos Enviados</h1>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              style={{ width: "auto", padding: "8px 16px", margin: 0 }}
              onClick={() => {
                void loadMeusOrcamentos();
              }}
              disabled={orcamentosLoading}
            >
              {orcamentosLoading ? "Carregando..." : "↻ Recarregar"}
            </button>
            <span style={{ fontSize: "0.85rem", color: "#888" }}>
              {meusOrcamentos.length} orçamento(s) enviado(s)
            </span>
          </div>

          {orcamentosLoading ? (
            <p style={{ color: "#888" }}>Buscando orçamentos...</p>
          ) : meusOrcamentos.length === 0 ? (
            <div
              className="card"
              style={{ color: "#888", textAlign: "center", padding: 32 }}
            >
              Nenhum orçamento enviado ainda.
            </div>
          ) : (
            meusOrcamentos.map((orc) => {
              const dataStr = orc.criadoEm
                ? new Date(orc.criadoEm.seconds * 1000).toLocaleDateString(
                    "pt-BR",
                  )
                : "—";
              const statusLabel =
                orc.status === "aguardando_aprovacao"
                  ? "AGUARDANDO APROVAÇÃO"
                  : orc.status === "aprovado"
                    ? "APROVADO"
                    : orc.status === "recusado"
                      ? "RECUSADO"
                      : orc.status.toUpperCase();
              const statusColor =
                orc.status === "aprovado"
                  ? "#15803d"
                  : orc.status === "recusado"
                    ? "#dc2626"
                    : "#92400e";
              const statusBg =
                orc.status === "aprovado"
                  ? "#f0fdf4"
                  : orc.status === "recusado"
                    ? "#fef2f2"
                    : "#fef3c7";
              return (
                <div key={orc.id} className="card" style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div>
                      <h3 style={{ margin: "0 0 6px" }}>
                        {orc.protocolo}
                        <span
                          style={{
                            marginLeft: 10,
                            fontSize: "0.75rem",
                            fontWeight: 400,
                            background: statusBg,
                            color: statusColor,
                            padding: "2px 8px",
                            borderRadius: 4,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </h3>
                      <p style={{ margin: "2px 0", fontSize: "0.9rem" }}>
                        <strong>Equipamento:</strong> {orc.equipamento}
                      </p>
                      {orc.defeito ? (
                        <p style={{ margin: "2px 0", fontSize: "0.9rem" }}>
                          <strong>Defeito:</strong> {orc.defeito}
                        </p>
                      ) : null}
                      <p style={{ margin: "2px 0", fontSize: "0.9rem" }}>
                        <strong>Data:</strong> {dataStr}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "1.2rem",
                          fontWeight: 700,
                          color: "var(--main-orange)",
                        }}
                      >
                        R$ {(orc.valorTotal ?? 0).toFixed(2).replace(".", ",")}
                      </p>
                      <p
                        style={{
                          margin: "2px 0",
                          fontSize: "0.8rem",
                          color: "#888",
                        }}
                      >
                        Valor total
                      </p>
                    </div>
                  </div>
                  {orc.itens?.length > 0 ? (
                    <div style={{ marginTop: 12 }}>
                      <table style={{ width: "100%", fontSize: "0.88rem" }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: "left", paddingBottom: 4 }}>
                              Item
                            </th>
                            <th
                              style={{ textAlign: "right", paddingBottom: 4 }}
                            >
                              Valor
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {orc.itens.map((it, i) => (
                            <tr key={i}>
                              <td>{it.descricao}</td>
                              <td style={{ textAlign: "right" }}>
                                R$ {it.valor.toFixed(2).replace(".", ",")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div
          id="checklist-dev"
          className={`tab-content ${
            secaoAtiva === "checklist-dev" ? "active" : ""
          }`}
        >
          <h1>Checklist de Devolução do Equipamento</h1>
          <p
            style={{
              color: "#555",
              fontSize: "0.95rem",
              maxWidth: 820,
              lineHeight: 1.5,
            }}
          >
            Preencha o relatório do serviço realizado e anexe as fotos de
            evidência antes de devolver o equipamento à prefeitura.
          </p>
          <div className="card">
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="ck-os"
                style={{ display: "block", marginBottom: 4, fontWeight: 600 }}
              >
                Vincular a um orçamento aprovado (opcional)
              </label>
              <select
                id="ck-os"
                value={checklistOsId}
                onChange={(e) => {
                  const sel = meusOrcamentos.find(
                    (o) => o.id === e.target.value,
                  );
                  setChecklistOsId(e.target.value);
                  if (sel) setChecklistEquipamento(sel.equipamento ?? "");
                }}
                style={{ maxWidth: 480 }}
              >
                <option value="">— Selecione (opcional) —</option>
                {meusOrcamentos
                  .filter((o) => o.status === "aprovado")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.protocolo} — {o.equipamento}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="ck-equip"
                style={{ display: "block", marginBottom: 4, fontWeight: 600 }}
              >
                Equipamento *
              </label>
              <input
                id="ck-equip"
                type="text"
                placeholder="Nome / modelo do equipamento"
                value={checklistEquipamento}
                onChange={(e) => {
                  setChecklistEquipamento(e.target.value);
                  setChecklistErro("");
                }}
                style={
                  checklistErro && !checklistEquipamento.trim()
                    ? { borderColor: "#dc2626" }
                    : undefined
                }
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="ck-relatorio"
                style={{ display: "block", marginBottom: 4, fontWeight: 600 }}
              >
                Relatório do Serviço Realizado *
              </label>
              <textarea
                id="ck-relatorio"
                placeholder="Descreva detalhadamente tudo que foi feito, peças substituídas, testes realizados..."
                value={checklistRelatorio}
                rows={5}
                onChange={(e) => {
                  setChecklistRelatorio(e.target.value);
                  setChecklistErro("");
                }}
                style={
                  checklistErro && !checklistRelatorio.trim()
                    ? { borderColor: "#dc2626" }
                    : undefined
                }
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
                marginBottom: 20,
              }}
            >
              <div>
                <label
                  htmlFor="ck-foto-nova"
                  style={{ display: "block", marginBottom: 4, fontWeight: 600 }}
                >
                  📸 Foto Peça Nova Instalada
                </label>
                <input
                  id="ck-foto-nova"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setChecklistFotoNova(e.target.files?.[0] ?? null)
                  }
                />
                {checklistFotoNova ? (
                  <span style={{ fontSize: "0.78rem", color: "#15803d" }}>
                    ✔ {checklistFotoNova.name}
                  </span>
                ) : null}
              </div>
              <div>
                <label
                  htmlFor="ck-foto-velha"
                  style={{ display: "block", marginBottom: 4, fontWeight: 600 }}
                >
                  📸 Foto Peça Velha Substituída
                </label>
                <input
                  id="ck-foto-velha"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setChecklistFotoVelha(e.target.files?.[0] ?? null)
                  }
                />
                {checklistFotoVelha ? (
                  <span style={{ fontSize: "0.78rem", color: "#15803d" }}>
                    ✔ {checklistFotoVelha.name}
                  </span>
                ) : null}
              </div>
              <div>
                <label
                  htmlFor="ck-foto-pronto"
                  style={{ display: "block", marginBottom: 4, fontWeight: 600 }}
                >
                  📸 Foto do Equipamento Pronto
                </label>
                <input
                  id="ck-foto-pronto"
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setChecklistFotoPronto(e.target.files?.[0] ?? null)
                  }
                />
                {checklistFotoPronto ? (
                  <span style={{ fontSize: "0.78rem", color: "#15803d" }}>
                    ✔ {checklistFotoPronto.name}
                  </span>
                ) : null}
              </div>
            </div>

            {checklistErro ? (
              <p
                style={{
                  color: "#dc2626",
                  fontWeight: 600,
                  marginTop: 14,
                  fontSize: "0.9rem",
                  border: "1px solid #fca5a5",
                  background: "#fef2f2",
                  padding: "10px 14px",
                  borderRadius: 6,
                }}
              >
                {checklistErro}
              </p>
            ) : null}
            {checklistSucesso ? (
              <p
                style={{
                  color: "#15803d",
                  fontWeight: 600,
                  marginTop: 14,
                  fontSize: "0.9rem",
                  border: "1px solid #86efac",
                  background: "#f0fdf4",
                  padding: "10px 14px",
                  borderRadius: 6,
                }}
              >
                {checklistSucesso}
              </p>
            ) : null}

            <button
              type="button"
              className="btn btn-orange"
              style={{
                width: "100%",
                marginTop: 20,
                opacity: checklistSaving ? 0.7 : 1,
                cursor: checklistSaving ? "not-allowed" : "pointer",
              }}
              onClick={() => {
                void handleEnviarChecklist();
              }}
              disabled={checklistSaving}
            >
              {checklistSaving
                ? "ENVIANDO..."
                : "FINALIZAR SERVIÇO E ENVIAR CHECKLIST"}
            </button>
          </div>
        </div>

        <div
          id="faturamento"
          className={`tab-content ${
            secaoAtiva === "faturamento" ? "active" : ""
          }`}
        >
          <h1>Anexar Nota Fiscal para Pagamento</h1>
          <div className="card">
            <h3 id="of-nf-titulo">O.S. {om.osReq} - Serviço Concluído</h3>
            <p>
              Valor a Faturar:
              <strong id="of-nf-valor">{om.orcamentoValor}</strong>
            </p>
            <label htmlFor="of-nf-input">Número da Nota Fiscal (NF-e)</label>
            <input
              id="of-nf-input"
              type="text"
              placeholder={om.nfPlaceholder}
            />
            <label htmlFor="of-nf-arquivo">
              Anexar Arquivo da Nota (PDF / XML)
            </label>
            <input id="of-nf-arquivo" type="file" />
            <button
              type="button"
              className="btn btn-orange"
              style={{ width: "100%", marginTop: 20 }}
            >
              Enviar nota para horautil360
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
