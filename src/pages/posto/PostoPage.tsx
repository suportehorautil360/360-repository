import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "@firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import { useHU360 } from "../../lib/hu360";
import { useLogin } from "../login/hooks/use-login";
import { esc } from "../../portal/postoPortalFormat";
import {
  postoExportarFaturamentoCsvFromSnapshot,
  postoExportarFaturamentoPdfFromSnapshot,
} from "../../portal/postoPortalFaturamento";
import { mesesOptions } from "../../portal/postoPortalHu360Data";
import type {
  FatUltimoSnapshot,
  PortalSessao,
  PostoUsuarioPortal,
} from "../../portal/postoPortalTypes";
import type { PostoFirestore } from "../admin/hooks/postos/types";
import "./posto.css";

type PostoSecao = "inicio" | "abs" | "fat" | "novoabs";

const COR_INFO = "#78716c";
const COR_ERRO = "#dc2626";

interface AuthMsg {
  texto: string;
  cor: string;
}

const SECRETARIAS_OPCOES = [
  "__todas__",
  "Secretaria de Infraestrutura",
  "Secretaria de Transportes",
  "Secretaria de Administração",
] as const;

function parseValorBR(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(
    v
      .replace(/[^0-9,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) ? n : 0;
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isAdminPrefeitura(user: { type: string } | null): boolean {
  if (!user) return false;
  return user.type === "admin";
}

export function PostoPage() {
  const { user, setUser } = useLogin();
  const navigate = useNavigate();
  const { prefeituras, prefeituraLabel } = useHU360();

  console.log("Render PostoPage", { user });

  useEffect(() => {
    document.body.classList.add("posto-root");
    return () => {
      document.body.classList.remove("posto-root");
    };
  }, []);

  const [secaoAtiva, setSecaoAtiva] = useState<PostoSecao>("inicio");

  const [selPrefId, setSelPrefId] = useState<string>("");
  const [selPostoId, setSelPostoId] = useState<string>("");
  const [selMsg, setSelMsg] = useState<AuthMsg>({ texto: "", cor: COR_INFO });
  const [controleConfirmado, setControleConfirmado] = useState(false);

  const mesAbsChoices = useMemo(() => mesesOptions(18), []);
  const fatMesChoices = useMemo(() => mesesOptions(24), []);
  const [mesAbs, setMesAbs] = useState(() => mesAbsChoices[0]?.value ?? "");
  const [fatMes, setFatMes] = useState(() => fatMesChoices[0]?.value ?? "");
  const [fatSecretaria, setFatSecretaria] = useState<string>("__todas__");

  const adminMode = isAdminPrefeitura(user);

  useEffect(() => {
    if (!adminMode) return;
    if (!selPrefId && prefeituras.length > 0) {
      setSelPrefId(user?.prefeituraId || prefeituras[0].id);
    }
  }, [adminMode, selPrefId, prefeituras, user]);

  // Postos do município (admin) — Firestore
  const [postosDoMunicipio, setPostosDoMunicipio] = useState<PostoFirestore[]>(
    [],
  );

  useEffect(() => {
    if (!adminMode || !selPrefId) {
      setPostosDoMunicipio([]);
      return;
    }
    getDocs(
      query(collection(db, "postos"), where("prefeituraId", "==", selPrefId)),
    )
      .then((snap) => {
        setPostosDoMunicipio(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PostoFirestore),
        );
      })
      .catch(() => setPostosDoMunicipio([]));
  }, [adminMode, selPrefId]);

  useEffect(() => {
    if (!adminMode) return;
    if (postosDoMunicipio.length === 0) {
      setSelPostoId("");
      return;
    }
    if (!postosDoMunicipio.some((p) => p.id === selPostoId)) {
      setSelPostoId(postosDoMunicipio[0].id);
    }
  }, [adminMode, postosDoMunicipio, selPostoId]);

  const portal: PortalSessao = useMemo(() => {
    if (!user) return null;
    if (user.type === "posto" && user.postoId) {
      return {
        rowUser: {
          usuario: user.usuario,
          postoId: user.postoId,
          prefeituraId: user.prefeituraId,
        } as PostoUsuarioPortal,
        prefeituraId: user.prefeituraId || "",
        postoId: String(user.postoId),
        controle: false,
      };
    }
    if (adminMode && controleConfirmado && selPrefId && selPostoId) {
      return {
        rowUser: {
          usuario: user.usuario,
          prefeituraId: selPrefId,
        } as PostoUsuarioPortal,
        prefeituraId: selPrefId,
        postoId: selPostoId,
        controle: true,
      };
    }
    return null;
  }, [user, adminMode, controleConfirmado, selPrefId, selPostoId]);

  // ===== Dados do Firestore =====
  interface AbsRow {
    id?: string;
    postoId?: string;
    prefeituraId?: string;
    data?: string;
    hora?: string;
    veiculo?: string;
    motorista?: string;
    combustivel?: string;
    litros?: number;
    valorTotal?: string;
    km?: number;
    cupomFiscal?: string;
    secretaria?: string;
  }

  const [todasAbs, setTodasAbs] = useState<AbsRow[]>([]);
  const [postoInfo, setPostoInfo] = useState<PostoFirestore | null>(null);
  const [absLoading, setAbsLoading] = useState(false);

  const loadDadosPosto = useCallback(async () => {
    if (!portal || !("postoId" in portal) || !portal.postoId) return;
    setAbsLoading(true);
    try {
      const constraints = [
        where("postoId", "==", portal.postoId),
        where("prefeituraId", "==", portal.prefeituraId),
      ];
      const [absSnap, postoSnap] = await Promise.all([
        getDocs(query(collection(db, "abastecimentos"), ...constraints)),
        getDocs(
          query(
            collection(db, "postos"),
            where("prefeituraId", "==", portal.prefeituraId),
          ),
        ),
      ]);
      const lista = absSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as AbsRow[];
      lista.sort((a, b) => ((a.data ?? "") < (b.data ?? "") ? 1 : -1));
      setTodasAbs(lista);
      const posto =
        postoSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as PostoFirestore)
          .find((p) => p.id === portal.postoId) ?? null;
      setPostoInfo(posto);
    } catch {
      // silently fail
    } finally {
      setAbsLoading(false);
    }
  }, [portal]);

  useEffect(() => {
    void loadDadosPosto();
  }, [loadDadosPosto]);

  // ===== Novo abastecimento form =====
  const [veiculosForm, setVeiculosForm] = useState<string[]>([]);
  const [novoData, setNovoData] = useState("");
  const [novoHora, setNovoHora] = useState("");
  const [novoVeic, setNovoVeic] = useState("");
  const [novoMotor, setNovoMotor] = useState("");
  const [novoSec, setNovoSec] = useState("Secretaria de Infraestrutura");
  const [novoComb, setNovoComb] = useState("Diesel S10");
  const [novoLitros, setNovoLitros] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [novoKm, setNovoKm] = useState("");
  const [novoCupom, setNovoCupom] = useState("");
  const [salvandoForm, setSalvandoForm] = useState(false);
  const [msgForm, setMsgForm] = useState<{
    tone: "none" | "ok" | "err";
    text: string;
  }>({ tone: "none", text: "" });

  useEffect(() => {
    if (
      secaoAtiva !== "novoabs" ||
      !portal ||
      !("prefeituraId" in portal) ||
      !portal.prefeituraId
    )
      return;
    getDocs(
      query(
        collection(db, "equipamentos"),
        where("prefeituraId", "==", portal.prefeituraId),
      ),
    )
      .then((snap) => {
        const veics = snap.docs
          .map((d) => {
            const dt = d.data();
            return [
              dt.label ?? dt.descricao ?? "",
              dt.marca ?? "",
              dt.modelo ?? "",
            ]
              .filter(Boolean)
              .join(" · ");
          })
          .filter(Boolean);
        setVeiculosForm(Array.from(new Set(veics)));
      })
      .catch(() => {});
  }, [secaoAtiva, portal]);

  async function handleSalvarNovoAbs() {
    setMsgForm({ tone: "none", text: "" });
    const litrosNum = Number(novoLitros);
    const valorNum = parseValorBR(novoValor);
    if (!novoData || !novoVeic || !novoMotor) {
      setMsgForm({ tone: "err", text: "Preencha data, veículo e motorista." });
      return;
    }
    if (!Number.isFinite(litrosNum) || litrosNum <= 0) {
      setMsgForm({ tone: "err", text: "Litros inválidos." });
      return;
    }
    if (valorNum <= 0) {
      setMsgForm({ tone: "err", text: "Valor inválido." });
      return;
    }
    if (!portal || !("postoId" in portal)) {
      setMsgForm({ tone: "err", text: "Sessão inválida." });
      return;
    }
    setSalvandoForm(true);
    try {
      await addDoc(collection(db, "abastecimentos"), {
        id: `abs-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`,
        prefeituraId: portal.prefeituraId,
        postoId: portal.postoId,
        data: novoData,
        hora: novoHora,
        veiculo: novoVeic,
        placa: "",
        motorista: novoMotor,
        secretaria: novoSec,
        litros: litrosNum,
        valorTotal: novoValor,
        km: Number(novoKm) || 0,
        combustivel: novoComb,
        cupomFiscal: novoCupom,
        criadoEm: serverTimestamp(),
      });
      setMsgForm({ tone: "ok", text: "Abastecimento registrado com sucesso." });
      setNovoData("");
      setNovoHora("");
      setNovoVeic("");
      setNovoMotor("");
      setNovoLitros("");
      setNovoValor("");
      setNovoKm("");
      setNovoCupom("");
    } catch {
      setMsgForm({ tone: "err", text: "Erro ao salvar. Tente novamente." });
    } finally {
      setSalvandoForm(false);
    }
  }

  // KPIs calculados do Firestore
  const kpis = useMemo(() => {
    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth() + 1;
    const absMesArr = todasAbs.filter((r) => {
      if (!r.data) return false;
      const m = /^(\d{4})-(\d{2})/.exec(r.data);
      if (!m) return false;
      return Number(m[1]) === anoAtual && Number(m[2]) === mesAtual;
    });
    const litrosMes = absMesArr.reduce(
      (s, a) => s + (Number(a.litros) || 0),
      0,
    );
    const valorMes = absMesArr.reduce(
      (s, a) => s + parseValorBR(a.valorTotal),
      0,
    );
    return {
      absMes: absMesArr.length,
      litrosMes:
        litrosMes.toLocaleString("pt-BR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }) + " L",
      valorMes: fmtBRL(valorMes),
      totalGeralAbs: todasAbs.length,
    };
  }, [todasAbs]);

  // Abastecimentos filtrados por mês
  const absRows = useMemo(() => {
    if (!mesAbs) return todasAbs;
    const [ano, mes] = mesAbs.split("-").map(Number);
    return todasAbs.filter((r) => {
      if (!r.data) return false;
      const m = /^(\d{4})-(\d{2})/.exec(r.data);
      if (!m) return false;
      return Number(m[1]) === ano && Number(m[2]) === mes;
    });
  }, [todasAbs, mesAbs]);

  // Faturamento snapshot calculado do Firestore
  const fatSnapshot = useMemo((): FatUltimoSnapshot | null => {
    if (!portal || !("postoId" in portal) || !fatMes) return null;
    const [ano, mes] = fatMes.split("-").map(Number);
    const filtered = todasAbs.filter((r) => {
      if (!r.data) return false;
      const m = /^(\d{4})-(\d{2})/.exec(r.data);
      if (!m) return false;
      if (Number(m[1]) !== ano || Number(m[2]) !== mes) return false;
      if (fatSecretaria !== "__todas__" && r.secretaria !== fatSecretaria)
        return false;
      return true;
    });
    const map: Record<string, { equip: string; qtd: number; litros: number }> =
      {};
    for (const a of filtered) {
      const eq = (a.veiculo ?? "—").trim() || "—";
      if (!map[eq]) map[eq] = { equip: eq, qtd: 0, litros: 0 };
      map[eq].qtd++;
      map[eq].litros += Number(a.litros) || 0;
    }
    // valor unitário do edital: 0 quando não configurado
    const vEdital = 0;
    const rows = Object.values(map)
      .sort((a, b) => a.equip.localeCompare(b.equip))
      .map((r) => ({ ...r, valorFaturar: r.litros * vEdital }));
    const totalLitros = rows.reduce((s, r) => s + r.litros, 0);
    const postoLabel =
      postoInfo?.nomeFantasia || postoInfo?.razaoSocial || portal.postoId;
    return {
      agg: {
        rows,
        totalLitros,
        totalFaturar: totalLitros * vEdital,
        valorUnitarioEdital: vEdital,
      },
      ano,
      mes,
      municipio: prefeituraLabel(portal.prefeituraId),
      secretariaFiltro: fatSecretaria,
      postoLabel,
      postoId: portal.postoId,
    };
  }, [portal, todasAbs, fatMes, fatSecretaria, postoInfo, prefeituraLabel]);

  const labelPrefSel = selPrefId ? prefeituraLabel(selPrefId) : "—";

  async function handleLogout() {
    setUser({ id: "", usuario: "", type: "posto" });
    navigate("/login-operacional?destino=posto", { replace: true });
  }

  function handleControleEntrar() {
    if (!selPrefId) {
      setSelMsg({
        texto: "Selecione uma prefeitura.",
        cor: COR_ERRO,
      });
      return;
    }
    if (!selPostoId) {
      setSelMsg({
        texto: "Selecione um posto credenciado.",
        cor: COR_ERRO,
      });
      return;
    }
    setSelMsg({ texto: "", cor: COR_INFO });
    setControleConfirmado(true);
    setSecaoAtiva("inicio");
  }

  function trocarPosto() {
    setControleConfirmado(false);
    setSelMsg({ texto: "", cor: COR_INFO });
  }

  // ===== Sem sessão válida =====
  if (!user?.id) {
    return <Navigate to="/login-operacional?destino=posto" replace />;
  }

  // ===== Admin precisa escolher prefeitura/posto =====
  if (!portal) {
    return (
      <section id="authScreen" className="auth-screen">
        <div className="auth-card">
          <h1>Gestão do posto</h1>
          <div id="posto-auth-controle">
            <p className="sub" style={{ marginTop: 0 }}>
              Você está conectado ao <strong>Hub (controle)</strong>. Escolha a
              prefeitura e o <strong>posto credenciado</strong> para abrir este
              portal.
            </p>
            <p
              className="sub"
              id="posto-controle-hint-pref"
              style={{ fontSize: "0.85rem", marginBottom: 8 }}
            >
              Em foco:{" "}
              <strong style={{ color: "var(--fuel, #f97316)" }}>
                {labelPrefSel}
              </strong>
            </p>
            <label htmlFor="posto-controle-sel-pref">Prefeitura</label>
            <select
              id="posto-controle-sel-pref"
              value={selPrefId}
              onChange={(e) => setSelPrefId(e.target.value)}
            >
              {prefeituras.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.uf})
                </option>
              ))}
            </select>
            <label htmlFor="posto-controle-sel-posto">Posto credenciado</label>
            <select
              id="posto-controle-sel-posto"
              value={selPostoId}
              onChange={(e) => setSelPostoId(e.target.value)}
            >
              {postosDoMunicipio.length === 0 ? (
                <option value="">— sem postos cadastrados —</option>
              ) : null}
              {postosDoMunicipio.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nomeFantasia || p.razaoSocial || p.id}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              id="posto-controle-entrar"
              style={{ width: "100%", marginTop: 14 }}
              onClick={handleControleEntrar}
            >
              Entrar no portal do posto
            </button>
            <div
              id="posto-controle-msg"
              className="auth-msg"
              role="alert"
              style={{ color: selMsg.cor }}
            >
              {selMsg.texto}
            </div>
          </div>
          <Link
            to="/admin/dashboard"
            style={{
              display: "block",
              marginTop: 16,
              textAlign: "center",
              color: "var(--fuel, #f97316)",
              fontSize: "0.9rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Voltar ao Hub Mestre
          </Link>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleLogout}
            style={{
              width: "100%",
              marginTop: 8,
              background: "transparent",
              color: "#78716c",
              border: "1px dashed #d6d3d1",
            }}
          >
            Trocar de usuário
          </button>
        </div>
      </section>
    );
  }

  // ===== Portal ativo =====
  const labelPref = portal
    ? prefeituraLabel((portal as { prefeituraId?: string }).prefeituraId ?? "")
    : "";
  const nomeUsuario = user.usuario;
  const postoNome =
    postoInfo?.nomeFantasia ||
    postoInfo?.razaoSocial ||
    (portal && "postoId" in portal ? portal.postoId : "") ||
    "Posto";
  const usuarioLogadoTexto =
    portal && "controle" in portal && portal.controle
      ? `Conectado (controle Hub): ${nomeUsuario} · ${labelPref} · ${postoNome}`
      : `Conectado: ${nomeUsuario} · ${labelPref} · Posto credenciado`;

  return (
    <div id="appShell">
      <div id="sidebar">
        <div className="logo-area">
          <h2>horautil360</h2>
          <small>Portal do posto credenciado</small>
          <p id="posto-ctx-pref" style={{ margin: "10px 0 0" }}>
            {labelPref}
          </p>
          <p
            id="posto-nome-banner"
            style={{
              margin: "10px 0 0",
              fontSize: "0.85rem",
              color: "#fafaf9",
              fontWeight: 700,
            }}
          >
            {postoNome}
          </p>
        </div>
        <div
          className={`nav-item ${secaoAtiva === "inicio" ? "active" : ""}`}
          onClick={() => setSecaoAtiva("inicio")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSecaoAtiva("inicio");
            }
          }}
        >
          🏠 Início
        </div>
        <div
          className={`nav-item ${secaoAtiva === "abs" ? "active" : ""}`}
          onClick={() => setSecaoAtiva("abs")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSecaoAtiva("abs");
            }
          }}
        >
          ⛽ Abastecimentos no posto
        </div>
        <div
          className={`nav-item ${secaoAtiva === "fat" ? "active" : ""}`}
          onClick={() => setSecaoAtiva("fat")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSecaoAtiva("fat");
            }
          }}
        >
          💰 Faturamento &amp; NF mensal
        </div>
        <div
          className={`nav-item ${secaoAtiva === "novoabs" ? "active" : ""}`}
          onClick={() => setSecaoAtiva("novoabs")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSecaoAtiva("novoabs");
            }
          }}
        >
          ➕ Novo Abastecimento
        </div>
      </div>

      <div id="main">
        <div className="app-topbar">
          <Link to="/admin/dashboard" className="hub-link">
            ← Hub Mestre
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              id="usuarioLogado"
              style={{ fontSize: "0.88rem", color: "#57534e" }}
            >
              {usuarioLogadoTexto}
            </span>
            {portal && "controle" in portal && portal.controle ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{
                  width: "auto",
                  margin: 0,
                  padding: "10px 16px",
                  textTransform: "none",
                }}
                onClick={trocarPosto}
              >
                Trocar posto
              </button>
            ) : null}
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

        <p className="intro">
          Este portal mostra apenas os abastecimentos registrados na prefeitura
          em que o seu posto aparece como <strong>posto credenciado</strong>.
          Cadastro de postos e usuários continua no{" "}
          <strong>Hub → Controle</strong>.
        </p>

        <div
          id="posto-inicio"
          className={`tab-content ${secaoAtiva === "inicio" ? "active" : ""}`}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: "1.35rem" }}>
            Resumo operacional
          </h1>
          <p
            style={{
              color: "#78716c",
              fontSize: "0.88rem",
              margin: "0 0 20px",
            }}
          >
            Indicadores do mês corrente para o seu posto.
          </p>
          <div className="kpi-grid">
            <div className="kpi">
              <p>Abastecimentos (mês)</p>
              <h3 id="posto-kpi-abs-mes">{absLoading ? "—" : kpis.absMes}</h3>
            </div>
            <div className="kpi" style={{ borderLeftColor: "#0284c7" }}>
              <p>Litros (mês)</p>
              <h3 id="posto-kpi-litros-mes">
                {absLoading ? "—" : kpis.litrosMes}
              </h3>
            </div>
            <div className="kpi" style={{ borderLeftColor: "#16a34a" }}>
              <p>Valor cupons (mês)</p>
              <h3 id="posto-kpi-valor-mes">
                {absLoading ? "—" : kpis.valorMes}
              </h3>
            </div>
            <div className="kpi" style={{ borderLeftColor: "#9333ea" }}>
              <p>Total histórico no portal</p>
              <h3 id="posto-kpi-total-geral">
                {absLoading ? "—" : kpis.totalGeralAbs}
              </h3>
            </div>
          </div>
          <div className="card">
            <h3>O que você vê aqui</h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                color: "#57534e",
                lineHeight: 1.6,
                fontSize: "0.9rem",
              }}
            >
              <li>
                Lista filtrada pelo{" "}
                <code
                  style={{
                    background: "#f5f5f4",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  postoId
                </code>{" "}
                do seu login.
              </li>
              <li>
                Dados gravados no mesmo armazenamento da prefeitura
                (demonstração no navegador).
              </li>
              <li>
                Para novos postos e logins, use o Hub:{" "}
                <strong>Gestão → Parceiros e postos</strong> e{" "}
                <strong>Controle → Acessos e logins</strong>.
              </li>
            </ul>
          </div>
        </div>

        <div
          id="posto-fat"
          className={`tab-content ${secaoAtiva === "fat" ? "active" : ""}`}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: "1.35rem" }}>
            Faturamento e relatório mensal
          </h1>
          <p className="intro">
            Consolidação por <strong>equipamento / veículo</strong> no mês para
            conferência e <strong>anexo à nota fiscal</strong>. O valor a
            faturar usa o <strong>preço unitário do edital</strong> (R$/L) ×
            total de litros.{" "}
            <strong>Apenas abastecimentos registrados no seu posto</strong>{" "}
            entram neste relatório.
          </p>

          <div className="posto-fat-zone">
            <div className="posto-fat-filters">
              <div>
                <label htmlFor="posto-fat-mes">Mês de referência</label>
                <select
                  id="posto-fat-mes"
                  value={fatMes}
                  onChange={(e) => setFatMes(e.target.value)}
                >
                  {fatMesChoices.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="posto-fat-secretaria">
                  Secretaria / departamento
                </label>
                <select
                  id="posto-fat-secretaria"
                  value={fatSecretaria}
                  onChange={(e) => setFatSecretaria(e.target.value)}
                >
                  {SECRETARIAS_OPCOES.map((s) => (
                    <option key={s} value={s}>
                      {s === "__todas__" ? "Todas" : s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="posto-fat-kpi-grid">
              <div className="posto-fat-kpi kpi-blue">
                <p>Total de litros (mês)</p>
                <h3 id="posto-fat-kpi-litros">
                  {fatSnapshot
                    ? fatSnapshot.agg.totalLitros.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }) + " L"
                    : "—"}
                </h3>
              </div>
              <div className="posto-fat-kpi kpi-green">
                <p>Valor unitário (edital)</p>
                <h3 id="posto-fat-kpi-edital">
                  {fatSnapshot
                    ? fatSnapshot.agg.valorUnitarioEdital.toLocaleString(
                        "pt-BR",
                        { style: "currency", currency: "BRL" },
                      ) + " / L"
                    : "—"}
                </h3>
              </div>
              <div className="posto-fat-kpi kpi-orange">
                <p>Total a faturar (prefeitura)</p>
                <h3 id="posto-fat-kpi-total">
                  {fatSnapshot
                    ? fatSnapshot.agg.totalFaturar.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })
                    : "—"}
                </h3>
              </div>
            </div>

            <div
              className="card"
              style={{
                marginBottom: 0,
                padding: 0,
                overflow: "hidden",
                borderLeftColor: "#0284c7",
              }}
            >
              <div className="posto-fat-table-head">
                <h4>Detalhamento por equipamento / veículo</h4>
                <div className="posto-fat-table-tools">
                  <button
                    type="button"
                    className="btn btn-outline-posto"
                    style={{
                      width: "auto",
                      margin: 0,
                      padding: "10px 14px",
                    }}
                    disabled={!fatSnapshot || fatSnapshot.agg.rows.length === 0}
                    onClick={() =>
                      fatSnapshot &&
                      postoExportarFaturamentoCsvFromSnapshot(fatSnapshot)
                    }
                  >
                    Exportar Excel (CSV)
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{
                      width: "auto",
                      margin: 0,
                      padding: "10px 14px",
                    }}
                    disabled={!fatSnapshot || fatSnapshot.agg.rows.length === 0}
                    onClick={() =>
                      fatSnapshot &&
                      postoExportarFaturamentoPdfFromSnapshot(fatSnapshot)
                    }
                  >
                    Exportar PDF (imprimir)
                  </button>
                </div>
              </div>
              <table style={{ margin: 0, borderRadius: 0 }}>
                <thead>
                  <tr>
                    <th>Equipamento</th>
                    <th>Qtd abastecimentos</th>
                    <th>Total litros</th>
                    <th>Valor total (R$) — edital</th>
                  </tr>
                </thead>
                <tbody id="posto-tbody-fat">
                  {fatSnapshot?.agg.rows.map((r) => (
                    <tr key={r.equip}>
                      <td>{r.equip}</td>
                      <td>{r.qtd}</td>
                      <td>
                        {r.litros.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        L
                      </td>
                      <td>
                        <strong>
                          {r.valorFaturar.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!fatSnapshot || fatSnapshot.agg.rows.length === 0 ? (
                <p
                  id="posto-fat-sem-dados"
                  style={{
                    padding: 16,
                    color: "#78716c",
                    fontSize: "0.88rem",
                    margin: 0,
                  }}
                >
                  Nenhum abastecimento no período com os filtros selecionados.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div
          id="posto-novo-abs"
          className={`tab-content ${secaoAtiva === "novoabs" ? "active" : ""}`}
        >
          <h1 style={{ margin: "0 0 4px", fontSize: "1.35rem" }}>
            Novo abastecimento{" "}
            <span
              style={{ fontWeight: 400, color: "#78716c", fontSize: "0.9rem" }}
            >
              (consome crédito semanal)
            </span>
          </h1>
          <p
            style={{ color: "#78716c", fontSize: "0.8rem", margin: "0 0 20px" }}
          >
            O valor do cupom será debitado do saldo. Posto registrado
            automaticamente:{" "}
            <strong>
              {portal && "postoId" in portal ? portal.postoId : "—"}
            </strong>
            .
          </p>
          <div className="card">
            <div className="posto-form-grid">
              <div>
                <label htmlFor="ps-abs-data">Data</label>
                <input
                  type="date"
                  id="ps-abs-data"
                  value={novoData}
                  onChange={(e) => setNovoData(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ps-abs-hora">Hora</label>
                <input
                  type="time"
                  id="ps-abs-hora"
                  value={novoHora}
                  onChange={(e) => setNovoHora(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ps-abs-sel-veiculo">
                  Veículo / equipamento
                </label>
                <select
                  id="ps-abs-sel-veiculo"
                  value={novoVeic}
                  onChange={(e) => setNovoVeic(e.target.value)}
                >
                  <option value="">— selecione —</option>
                  {veiculosForm.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ps-abs-motorista">Motorista</label>
                <input
                  type="text"
                  id="ps-abs-motorista"
                  placeholder="Nome completo"
                  value={novoMotor}
                  onChange={(e) => setNovoMotor(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ps-abs-secretaria">
                  Secretaria / departamento
                </label>
                <select
                  id="ps-abs-secretaria"
                  value={novoSec}
                  onChange={(e) => setNovoSec(e.target.value)}
                >
                  <option value="Secretaria de Infraestrutura">
                    Secretaria de Infraestrutura
                  </option>
                  <option value="Secretaria de Transportes">
                    Secretaria de Transportes
                  </option>
                  <option value="Secretaria de Administração">
                    Secretaria de Administração
                  </option>
                </select>
              </div>
              <div>
                <label htmlFor="ps-abs-combustivel">Combustível</label>
                <select
                  id="ps-abs-combustivel"
                  value={novoComb}
                  onChange={(e) => setNovoComb(e.target.value)}
                >
                  <option value="Diesel S10">Diesel S10</option>
                  <option value="Gasolina comum">Gasolina comum</option>
                  <option value="Etanol">Etanol</option>
                </select>
              </div>
              <div>
                <label htmlFor="ps-abs-litros">Litros</label>
                <input
                  type="number"
                  id="ps-abs-litros"
                  min={1}
                  step={1}
                  placeholder="120"
                  value={novoLitros}
                  onChange={(e) => setNovoLitros(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ps-abs-valor">Valor total (R$)</label>
                <input
                  type="text"
                  id="ps-abs-valor"
                  placeholder="850,00"
                  value={novoValor}
                  onChange={(e) => setNovoValor(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ps-abs-km">Km / horímetro</label>
                <input
                  type="number"
                  id="ps-abs-km"
                  min={0}
                  step={1}
                  placeholder="45210"
                  value={novoKm}
                  onChange={(e) => setNovoKm(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ps-abs-cupom">Cupom / NF</label>
                <input
                  type="text"
                  id="ps-abs-cupom"
                  placeholder="Número"
                  value={novoCupom}
                  onChange={(e) => setNovoCupom(e.target.value)}
                />
              </div>
            </div>
            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="btn btn-success"
                onClick={() => {
                  void handleSalvarNovoAbs();
                }}
                disabled={salvandoForm}
              >
                {salvandoForm ? "Salvando…" : "Registrar abastecimento"}
              </button>
              {msgForm.text && (
                <span
                  style={{
                    fontSize: "0.88rem",
                    color:
                      msgForm.tone === "ok"
                        ? "#16a34a"
                        : msgForm.tone === "err"
                          ? "#dc2626"
                          : "#78716c",
                  }}
                >
                  {msgForm.text}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          id="posto-abs"
          className={`tab-content ${secaoAtiva === "abs" ? "active" : ""}`}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: "1.35rem" }}>
            Abastecimentos realizados no seu posto
          </h1>
          <p
            style={{
              color: "#78716c",
              fontSize: "0.88rem",
              margin: "0 0 16px",
            }}
          >
            Filtre por mês de referência (data do cupom).
          </p>
          <div className="card" style={{ borderLeftColor: "#0284c7" }}>
            <label htmlFor="posto-sel-mes-abs">
              <strong>Mês de referência</strong>
            </label>
            <select
              id="posto-sel-mes-abs"
              aria-label="Filtrar por mês"
              value={mesAbs}
              onChange={(e) => setMesAbs(e.target.value)}
            >
              {mesAbsChoices.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="card">
            <h3>Detalhamento</h3>
            <table>
              <thead>
                <tr>
                  <th>Data / hora</th>
                  <th>Veículo</th>
                  <th>Motorista</th>
                  <th>Combustível</th>
                  <th>Litros</th>
                  <th>Valor</th>
                  <th>Cupom/NF</th>
                </tr>
              </thead>
              <tbody id="posto-tbody-abs">
                {absLoading ? (
                  <tr>
                    <td colSpan={7} style={{ color: "#78716c" }}>
                      Carregando…
                    </td>
                  </tr>
                ) : absRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ color: "#78716c" }}>
                      Nenhum abastecimento neste período.
                    </td>
                  </tr>
                ) : (
                  absRows.map((a, i) => (
                    <tr key={`${a.cupomFiscal ?? "cup"}-${i}`}>
                      <td>
                        {esc(a.data)} {esc(a.hora || "")}
                      </td>
                      <td>{esc(a.veiculo)}</td>
                      <td>{esc(a.motorista || "—")}</td>
                      <td>{esc(a.combustivel || "—")}</td>
                      <td>{esc(a.litros != null ? String(a.litros) : "—")}</td>
                      <td>{esc(a.valorTotal || "—")}</td>
                      <td>{esc(a.cupomFiscal || "—")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {absRows.length === 0 ? (
              <p id="posto-sem-abs">
                Nenhum abastecimento neste período para este posto.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
