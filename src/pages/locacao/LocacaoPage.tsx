import {
  type FormEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "@firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import { ListaChecklistHistoricoLocal } from "../../components/checklistHistorico/ChecklistHistoricoLista";
import { checklistAppToHistoricoRow } from "../../components/checklistHistorico/checklistAppToHistoricoRow";
import {
  type ChecklistApiRow,
  criarDadosDemo,
  type ChecklistApp,
  type DashboardGraficos,
  type TopOperador,
  sincronizarLocacaoComFirestore,
  useEmpresasTerceirasLocacao,
  useEquipamentosCadastro,
  useHU360,
  useHU360Auth,
} from "../../lib/hu360";
import { locDesenharDashboardGraficos } from "./locacaoCharts";
import { mergePrefeituraModuloLocacao } from "./locacaoMerge";
import {
  limparLocacaoPrefCtxHub,
  locPrefeituraIdParaUi,
} from "./locacaoPrefCtx";
import "./locacao.css";
import { useLogin } from "../login/hooks/use-login";

type LocacaoSecao =
  | "dash"
  | "auditoria"
  | "riscos"
  | "equipamentos"
  | "terceiros";

const COR_INFO = "#78716c";
const COR_ERRO = "#dc2626";

interface AuthMsg {
  texto: string;
  cor: string;
}

const AUTH_MSG_LIMPA: AuthMsg = { texto: "", cor: COR_INFO };

function checklistQrSintetico(row: ChecklistApiRow): ChecklistApp {
  const oleoOk = String(row.status_oleo || "").toLowerCase() === "ok";
  const filtOk = String(row.status_filtros || "").toLowerCase() === "ok";
  return {
    protocolo: `CHK-QR-${row.id}`,
    referenciaOs: "Inspeção registrada via QR",
    sincronizadoEm: row.criado_em,
    versaoApp: "horautil360",
    horimetroCampo: "—",
    secoes: [
      {
        titulo: "Campos da inspeção",
        itens: [
          { item: "Chassis (QR)", resposta: row.chassis_qr, conforme: true },
          {
            item: "Óleo",
            resposta: row.status_oleo,
            conforme: oleoOk,
          },
          {
            item: "Filtros",
            resposta: row.status_filtros,
            conforme: filtOk,
          },
        ],
      },
    ],
    observacoesCampo: row.observacoes || "",
    fotosResumo: "",
    assinaturaDigital: `Registro ID ${row.id} · horautil360`,
  };
}

function firestoreDocToHistRow(
  docId: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const respostasJson =
    data.respostas &&
    typeof data.respostas === "object" &&
    !Array.isArray(data.respostas)
      ? JSON.stringify(data.respostas)
      : typeof data.respostas === "string"
        ? data.respostas
        : "{}";
  return {
    ID_Registro: data.id ?? docId,
    Data_Hora: data.dataHoraIso ?? "",
    Operador: data.operador ?? "",
    Chassis: data.chassis ?? "",
    Categoria: data.categoria ?? "",
    Modelo: data.modelo ?? "",
    Linha: data.linha ?? "",
    Item_Verificado: `Checklist ${data.totalItens ?? "?"} itens`,
    Status_Ok_Nao: `${data.totalSim ?? 0}/${data.totalItens ?? 0} OK`,
    Respostas_JSON: respostasJson,
    Horimetro_Final: data.horimetro ?? "",
    Pontuacao: data.pontuacao ?? 0,
    ID_Cliente: data.idOperadorSession ?? "",
    prefeituraId: data.prefeituraId ?? "",
    Obs: data.obs ?? null,
  };
}

function normalizeChassis(s: string): string {
  return s.toUpperCase().replace(/[\s\-]/g, "");
}

export function LocacaoPage() {
  const { login, logout } = useHU360Auth();
  const { user, setUser } = useLogin();
  const { id: paramId } = useParams<{ id: string }>();

  const navigate = useNavigate();
  const { obterDadosPrefeitura, prefeituraLabel, prefeituras } = useHU360();
  const [prefCtxGen, setPrefCtxGen] = useState(0);
  const bumpPrefCtx = () => setPrefCtxGen((g) => g + 1);
  const prevUsuarioRef = useRef<string | undefined>(undefined);
  const canvasChRef = useRef<HTMLCanvasElement>(null);
  const canvasOpRef = useRef<HTMLCanvasElement>(null);

  const isAdmin = user?.type === "admin";

  useEffect(() => {
    if (!user?.usuario) {
      prevUsuarioRef.current = undefined;
      return;
    }
    if (prevUsuarioRef.current && prevUsuarioRef.current !== user.usuario) {
      limparLocacaoPrefCtxHub();
      bumpPrefCtx();
    }
    prevUsuarioRef.current = user.usuario;
  }, [user?.usuario]);

  const prefeituraIdEff = useMemo(() => {
    if (!user) return null;
    if (paramId) return paramId;
    return locPrefeituraIdParaUi(user, prefeituras);
  }, [user, prefeituras, prefCtxGen, paramId]);

  const dados = useMemo(
    () => (prefeituraIdEff ? obterDadosPrefeitura(prefeituraIdEff) : null),
    [prefeituraIdEff, obterDadosPrefeitura],
  );

  const pmMerged = useMemo(() => {
    if (!prefeituraIdEff) return null;
    return mergePrefeituraModuloLocacao(
      prefeituraIdEff,
      obterDadosPrefeitura,
      criarDadosDemo,
    );
  }, [prefeituraIdEff, obterDadosPrefeitura]);

  const checklistsCampo = useMemo(
    () => dados?.prefeituraModulo?.checklistsCampo ?? [],
    [dados],
  );

  console.log("Dados prefeitura locação:", user);

  const audBase = useMemo(
    () =>
      prefeituraIdEff ? (criarDadosDemo(prefeituraIdEff).auditoria ?? []) : [],
    [prefeituraIdEff],
  );
  const audLista = dados?.auditoria?.length ? dados.auditoria : audBase;

  //@ts-ignore
  const auditoriaHistoricoRows = useMemo(() => {
    const out: Record<string, unknown>[] = [];
    audLista.forEach((row, idx) => {
      const merged = { ...audBase[idx], ...row };
      const c = merged.checklistApp;
      if (!c) return;
      const id = `loc-aud-app-${idx}`;
      const statusResumo = `${merged.indice} · ${merged.fotos} fotos${merged.alerta ? " · alerta" : ""}`;
      out.push(
        checklistAppToHistoricoRow(id, c, {
          dataHora: merged.hora,
          operador: merged.operador,
          equipamento: merged.equipamento,
          chassis: merged.chassis?.trim() || undefined,
          statusResumo,
        }),
      );
    });
    checklistsCampo.forEach((r) => {
      const c = checklistQrSintetico(r);
      const oleo = String(r.status_oleo || "").toLowerCase();
      const filt = String(r.status_filtros || "").toLowerCase();
      const alerta = oleo === "critico" || filt === "critico";
      const indice = alerta
        ? "Crítico"
        : oleo === "ok" && filt === "ok"
          ? "Alto"
          : "Médio";
      const id = `loc-aud-qr-${r.id}`;
      out.push(
        checklistAppToHistoricoRow(id, c, {
          dataHora: r.criado_em,
          operador: "QR / campo",
          equipamento: r.chassis_qr || "—",
          chassis: r.chassis_qr || "—",
          statusResumo: `${indice} · inspeção servidor`,
        }),
      );
    });
    out.sort((a, b) =>
      String(b.Data_Hora ?? "").localeCompare(
        String(a.Data_Hora ?? ""),
        undefined,
        {
          numeric: true,
        },
      ),
    );
    return out;
  }, [audLista, audBase, checklistsCampo]);

  const [locModuloRefresh, setLocModuloRefresh] = useState(0);
  const [syncLocacaoLoading, setSyncLocacaoLoading] = useState(false);
  const [syncLocacaoMsg, setSyncLocacaoMsg] = useState<string | null>(null);

  //@ts-ignore
  const [dashCarregando, setDashCarregando] = useState(false);
  //@ts-ignore
  const [dashTick, setDashTick] = useState(0);
  const [dashEquipCount, setDashEquipCount] = useState<number | null>(null);
  const [dashChecklistTotal, setDashChecklistTotal] = useState<number | null>(
    null,
  );
  const [dashManuCount, setDashManuCount] = useState<number | null>(null);
  const [dashGraficos, setDashGraficos] = useState<DashboardGraficos | null>(
    null,
  );

  const equip = useEquipamentosCadastro(
    prefeituraIdEff ?? undefined,
    locModuloRefresh,
  );
  //@ts-ignore
  const terceiras = useEmpresasTerceirasLocacao(
    prefeituraIdEff ?? undefined,
    locModuloRefresh,
  );

  // Estado de login
  //@ts-ignore
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  //@ts-ignore
  const [authMsg, setAuthMsg] = useState<AuthMsg>({ texto: "", cor: COR_INFO });

  // Navegação
  const [secaoAtiva, setSecaoAtiva] = useState<LocacaoSecao>("dash");

  const [auditoriaExpandidoId, setAuditoriaExpandidoId] = useState<
    string | null
  >(null);
  const [audFirestoreRows, setAudFirestoreRows] = useState<
    Record<string, unknown>[]
  >([]);
  const [audCarregando, setAudCarregando] = useState(false);
  const [audTick, setAudTick] = useState(0);
  const [audFiltroData, setAudFiltroData] = useState("");
  const [audFiltroChassis, setAudFiltroChassis] = useState("");
  const [audFiltroOperador, setAudFiltroOperador] = useState("");

  const [equipFirestoreRows, setEquipFirestoreRows] = useState<
    Record<string, unknown>[]
  >([]);
  const [equipCarregando, setEquipCarregando] = useState(false);
  //@ts-ignore
  const [equipTick, setEquipTick] = useState(0);

  interface TercRow {
    id: string;
    nome: string;
    cnpj?: string;
    contato?: string;
    observacoes?: string;
    criadoEm: string;
  }
  const [tercFirestoreRows, setTercFirestoreRows] = useState<TercRow[]>([]);
  const [tercCarregando, setTercCarregando] = useState(false);
  const [tercTick, setTercTick] = useState(0);
  //@ts-ignore
  const [tercSalvando, setTercSalvando] = useState(false);

  //@ts-ignore
  const empresaLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of tercFirestoreRows) {
      m.set(e.id, e.nome);
    }
    return m;
  }, [tercFirestoreRows]);

  const [tercNome, setTercNome] = useState("");
  const [tercCnpj, setTercCnpj] = useState("");
  const [tercContato, setTercContato] = useState("");
  const [tercObs, setTercObs] = useState("");
  const [tercMsg, setTercMsg] = useState<{
    tone: "ok" | "err";
    text: string;
  } | null>(null);

  interface RiscoRow {
    id: string;
    nivel: "Alto" | "Médio" | "Baixo";
    categoria: string;
    operador: string;
    defeito: string;
    acaoSugerida: string;
  }

  function parseTituloItemNao(titulo: string): {
    defeito: string;
    acaoSugerida: string;
  } {
    // Remove prefixo de resposta caso existente: "Sim/Não: ", "Não: ", "Sim: "
    const cleaned = titulo.replace(/^(Sim\/N[ãa]o|N[ãa]o|Sim):\s*/i, "");
    const idx = cleaned.indexOf(": ");
    if (idx === -1) return { defeito: cleaned.trim(), acaoSugerida: "—" };
    return {
      defeito: cleaned.slice(0, idx).trim(),
      acaoSugerida: cleaned.slice(idx + 2).trim(),
    };
  }
  const [riscoFirestoreRows, setRiscoFirestoreRows] = useState<RiscoRow[]>([]);
  const [riscoCarregando, setRiscoCarregando] = useState(false);
  const [riscoTick, setRiscoTick] = useState(0);

  useEffect(() => {
    document.body.classList.add("locacao-root");
    return () => {
      document.body.classList.remove("locacao-root");
    };
  }, []);

  useLayoutEffect(() => {
    if (secaoAtiva !== "dash" || !pmMerged?.dashboardGraficos) return;
    const id = requestAnimationFrame(() => {
      locDesenharDashboardGraficos(
        canvasChRef.current,
        canvasOpRef.current,
        dashGraficos ?? pmMerged?.dashboardGraficos,
      );
    });
    return () => cancelAnimationFrame(id);
  }, [secaoAtiva, pmMerged, prefeituraIdEff, dashGraficos]);

  useEffect(() => {
    if (secaoAtiva !== "dash") return;
    const ro = new ResizeObserver(() => {
      if (pmMerged?.dashboardGraficos) {
        locDesenharDashboardGraficos(
          canvasChRef.current,
          canvasOpRef.current,
          dashGraficos ?? pmMerged?.dashboardGraficos,
        );
      }
    });
    const el1 = canvasChRef.current?.parentElement;
    const el2 = canvasOpRef.current?.parentElement;
    if (el1) ro.observe(el1);
    if (el2 && el2 !== el1) ro.observe(el2);
    return () => ro.disconnect();
  }, [secaoAtiva, pmMerged]);

  function navegar(secao: LocacaoSecao) {
    setSecaoAtiva(secao);
  }

  useEffect(() => {
    if (secaoAtiva !== "auditoria") setAuditoriaExpandidoId(null);
  }, [secaoAtiva]);

  useEffect(() => {
    if (secaoAtiva !== "dash" || !prefeituraIdEff) return;
    setDashCarregando(true);
    const now = new Date();
    const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    Promise.all([
      getDocs(
        query(
          collection(db, "equipamentos"),
          where("prefeituraId", "==", prefeituraIdEff),
        ),
      ),
      getDocs(
        query(
          collection(db, "checklistsRegistros"),
          where("prefeituraId", "==", prefeituraIdEff),
        ),
      ),
      getDocs(
        query(
          collection(db, "emergenciasRegistros"),
          where("prefeituraId", "==", prefeituraIdEff),
          where("statusAtendimento", "==", "aberto"),
        ),
      ),
    ])
      .then(([snapEquip, snapChk, snapEmerg]) => {
        setDashEquipCount(snapEquip.size);
        setDashManuCount(snapEmerg.size);
        const chkRows = snapChk.docs.map(
          (d) => d.data() as Record<string, unknown>,
        );
        setDashChecklistTotal(chkRows.length);
        // Agrupamento por semana do mês atual
        const semanas = [0, 0, 0, 0];
        chkRows.forEach((r) => {
          const dataStr = String(r.dataHoraIso ?? "");
          if (!dataStr.startsWith(mesAtual)) return;
          const dia = parseInt(dataStr.slice(8, 10), 10);
          const sem = dia <= 7 ? 0 : dia <= 14 ? 1 : dia <= 21 ? 2 : 3;
          semanas[sem]++;
        });
        // Top 5 operadores por quantidade de checklists
        const opCount = new Map<string, number>();
        chkRows.forEach((r) => {
          const op = String(r.operador ?? "").trim();
          if (op) opCount.set(op, (opCount.get(op) ?? 0) + 1);
        });
        const topOps: TopOperador[] = [...opCount.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([nome, count]) => ({
            nome,
            bemFeitos: count,
            indice: `${count} insp.`,
          }));
        const mesLabel = now.toLocaleString("pt-BR", {
          month: "long",
          year: "numeric",
        });
        setDashGraficos({
          gastosLabels: [],
          gastosReais: [],
          checklistLabels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
          checklistRecebidos: semanas,
          topOperadores: topOps,
          tituloPeriodo: `${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)} — ${prefeituraLabel(prefeituraIdEff)}`,
        });
      })
      .catch((err) => {
        console.error("[Loc Dash] Erro ao carregar dashboard:", err);
      })
      .finally(() => setDashCarregando(false));
  }, [secaoAtiva, prefeituraIdEff, dashTick]);

  useEffect(() => {
    if (secaoAtiva !== "auditoria" || !prefeituraIdEff) return;
    setAudCarregando(true);
    getDocs(
      query(
        collection(db, "checklistsRegistros"),
        where("prefeituraId", "==", prefeituraIdEff),
      ),
    )
      .then((snap) => {
        const rows = snap.docs.map((d) =>
          firestoreDocToHistRow(d.id, d.data() as Record<string, unknown>),
        );
        rows.sort((a, b) =>
          String(b.Data_Hora ?? "").localeCompare(String(a.Data_Hora ?? "")),
        );
        setAudFirestoreRows(rows);
      })
      .catch((err) => {
        console.error("[Loc Auditoria] Erro ao carregar checklists:", err);
      })
      .finally(() => setAudCarregando(false));
  }, [secaoAtiva, prefeituraIdEff, audTick]);

  useEffect(() => {
    if (secaoAtiva !== "equipamentos" || !prefeituraIdEff) return;
    setEquipCarregando(true);
    getDocs(
      query(
        collection(db, "equipamentos"),
        where("prefeituraId", "==", prefeituraIdEff),
      ),
    )
      .then((snap) => {
        const rows = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        }));
        rows.sort((a, b) =>
          //@ts-ignore
          String(a.label ?? a.modelo ?? "").localeCompare(
            //@ts-ignore
            String(b.label ?? b.modelo ?? ""),
          ),
        );
        setEquipFirestoreRows(rows);
      })
      .catch((err) => {
        console.error("[Loc Equipamentos] Erro ao carregar equipamentos:", err);
      })
      .finally(() => setEquipCarregando(false));
  }, [secaoAtiva, prefeituraIdEff, equipTick]);

  useEffect(() => {
    if (secaoAtiva !== "riscos" || !prefeituraIdEff) return;
    setRiscoCarregando(true);
    getDocs(
      query(
        collection(db, "checklistsRegistros"),
        where("prefeituraId", "==", prefeituraIdEff),
      ),
    )
      .then((snap) => {
        const rows: RiscoRow[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const totalSim = Number(data.totalSim ?? 0);
          const totalItens = Number(data.totalItens ?? 0);
          const totalNao = Math.max(0, totalItens - totalSim);
          const nivel: RiscoRow["nivel"] =
            totalNao >= 2 ? "Alto" : totalNao === 1 ? "Médio" : "Baixo";
          const itensNao = Array.isArray(data.itensNao) ? data.itensNao : [];
          const primeiroNao = itensNao[0] as { titulo?: string } | undefined;
          const { defeito, acaoSugerida } = primeiroNao?.titulo
            ? parseTituloItemNao(String(primeiroNao.titulo))
            : { defeito: "—", acaoSugerida: "—" };
          return {
            id: d.id,
            nivel,
            categoria: String(data.categoria ?? "—"),
            operador: String(data.operador ?? "—"),
            defeito,
            acaoSugerida,
          };
        });
        const ordemNivel: Record<RiscoRow["nivel"], number> = {
          Alto: 0,
          Médio: 1,
          Baixo: 2,
        };
        rows.sort((a, b) => ordemNivel[a.nivel] - ordemNivel[b.nivel]);
        setRiscoFirestoreRows(rows);
      })
      .catch((err) => {
        console.error("[Loc Riscos] Erro ao carregar riscos:", err);
      })
      .finally(() => setRiscoCarregando(false));
  }, [secaoAtiva, prefeituraIdEff, riscoTick]);

  useEffect(() => {
    if (secaoAtiva !== "terceiros" || !prefeituraIdEff) return;
    setTercCarregando(true);
    getDocs(
      query(
        collection(db, "empresas_terceiras_locacao"),
        where("prefeituraId", "==", prefeituraIdEff),
      ),
    )
      .then((snap) => {
        const rows: TercRow[] = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            nome: String(data.nome ?? ""),
            cnpj: data.cnpj ? String(data.cnpj) : undefined,
            contato: data.contato ? String(data.contato) : undefined,
            observacoes: data.observacoes
              ? String(data.observacoes)
              : undefined,
            criadoEm: String(data.criadoEm ?? ""),
          };
        });
        rows.sort((a, b) => a.nome.localeCompare(b.nome));
        setTercFirestoreRows(rows);
      })
      .catch((err) => {
        console.error("[Loc Terceiras] Erro ao carregar empresas:", err);
      })
      .finally(() => setTercCarregando(false));
  }, [secaoAtiva, prefeituraIdEff, tercTick]);

  const audFiltrados = useMemo(() => {
    return audFirestoreRows.filter((row) => {
      if (
        audFiltroData &&
        !String(row.Data_Hora ?? "").startsWith(audFiltroData)
      )
        return false;
      if (
        audFiltroChassis.trim() &&
        !normalizeChassis(String(row.Chassis ?? "")).includes(
          normalizeChassis(audFiltroChassis),
        )
      )
        return false;
      if (
        audFiltroOperador.trim() &&
        !String(row.Operador ?? "")
          .toLowerCase()
          .includes(audFiltroOperador.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [audFirestoreRows, audFiltroData, audFiltroChassis, audFiltroOperador]);

  function abrirChecklistCard() {
    setSecaoAtiva("auditoria");
  }

  async function handleLogout() {
    limparLocacaoPrefCtxHub();
    bumpPrefCtx();
    if (isAdmin) {
      navigate("/admin/portal-locacao", { replace: true });
      return;
    }
    await logout();
    setUser({ id: "", usuario: "", type: "locacao" });
    navigate("/login-operacional?destino=locacao", { replace: true });
  }

  //@ts-ignore
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthMsg({ texto: "Autenticando...", cor: COR_INFO });
    const res = await login(usuario.trim(), senha);
    if (!res.ok) {
      setAuthMsg({
        texto: res.msg ?? "Login ou senha inválidos.",
        cor: COR_ERRO,
      });
      return;
    }
    setAuthMsg(AUTH_MSG_LIMPA);
    setSenha("");
    bumpPrefCtx();
  }

  function limparCtxHubModulo() {
    limparLocacaoPrefCtxHub();
    bumpPrefCtx();
  }

  async function handleCadastroEmpresaTerceira(e: FormEvent) {
    e.preventDefault();
    setTercMsg(null);
    if (!prefeituraIdEff) {
      setTercMsg({ tone: "err", text: "Cliente não selecionado." });
      return;
    }
    const nome = tercNome.trim();
    if (!nome) {
      setTercMsg({ tone: "err", text: "Informe o nome da empresa." });
      return;
    }
    const dupe = tercFirestoreRows.some(
      (x) => x.nome.trim().toLowerCase() === nome.toLowerCase(),
    );
    if (dupe) {
      setTercMsg({ tone: "err", text: "Já existe uma empresa com esse nome." });
      return;
    }
    setTercSalvando(true);
    try {
      const id = crypto.randomUUID();
      const criadoEm = new Date().toISOString().slice(0, 16).replace("T", " ");
      await setDoc(doc(db, "empresas_terceiras_locacao", id), {
        prefeituraId: prefeituraIdEff,
        nome,
        cnpj: tercCnpj.trim() || "",
        contato: tercContato.trim() || "",
        observacoes: tercObs.trim() || "",
        criadoEm,
      });
      setTercMsg({ tone: "ok", text: "Empresa cadastrada." });
      setTercNome("");
      setTercCnpj("");
      setTercContato("");
      setTercObs("");
      setTercTick((t) => t + 1);
    } catch (err) {
      console.error("[Loc Terceiras] Erro ao salvar empresa:", err);
      setTercMsg({ tone: "err", text: "Erro ao salvar. Tente novamente." });
    } finally {
      setTercSalvando(false);
    }
  }

  async function handleRemoverEmpresaTerceira(id: string) {
    if (
      !window.confirm(
        "Remover esta empresa? Os equipamentos direcionados a ela voltarão para «Locadora».",
      )
    ) {
      return;
    }
    try {
      await deleteDoc(doc(db, "empresas_terceiras_locacao", id));
      setTercTick((t) => t + 1);
    } catch (err) {
      console.error("[Loc Terceiras] Erro ao remover empresa:", err);
      alert("Erro ao remover empresa. Tente novamente.");
    }
  }

  async function handleSincronizarLocacaoFirestore() {
    if (!prefeituraIdEff) return;
    setSyncLocacaoLoading(true);
    setSyncLocacaoMsg(null);
    const r = await sincronizarLocacaoComFirestore(prefeituraIdEff);
    setSyncLocacaoLoading(false);
    setSyncLocacaoMsg(r.msg);
    if (r.ok) setLocModuloRefresh((x) => x + 1);
  }

  if (!user || !dados) {
    return <Navigate to="/login-operacional?destino=locacao" replace />;
  }

  const labelPrefLogin = prefeituraLabel(user.prefeituraId ?? "");
  const labelEff = prefeituraIdEff
    ? prefeituraLabel(prefeituraIdEff)
    : labelPrefLogin;
  const usuarioLogadoTexto = `Conectado: ${user.usuario} · ${labelPrefLogin}`;
  const mostrarBannerCtx =
    !!prefeituraIdEff && prefeituraIdEff !== user.prefeituraId;

  const h = dados.hubDashboard;
  const ccDash = checklistsCampo;
  const totalChecklists = (Number(h.checklists) || 0) + ccDash.length;

  return (
    <>
      <div id="appShell">
        <div id="sidebar">
          <div className="logo">
            <h2 style={{ margin: 0, color: "var(--main-orange)" }}>
              horautil360
            </h2>
            <p
              id="locCtxNome"
              style={{
                fontSize: "0.75rem",
                color: "var(--main-orange)",
                marginTop: 8,
                fontWeight: 600,
              }}
            >
              {labelEff} · Locação
            </p>
            <p
              style={{
                fontSize: "0.72rem",
                color: "var(--text-gray)",
                marginTop: 4,
              }}
            >
              Gestão da frota em locação
            </p>
          </div>

          {(
            [
              { id: "dash", label: "📊 Dashboard geral" },
              { id: "auditoria", label: "📋 Auditoria de checklists" },
              { id: "riscos", label: "⚠️ Triagem de risco" },
              { id: "equipamentos", label: "🛠️ Equipamentos" },
              { id: "terceiros", label: "🏢 Empresas terceiras" },
            ] as Array<{ id: LocacaoSecao; label: string }>
          ).map((it) => (
            <div
              key={it.id}
              className={`nav-item ${secaoAtiva === it.id ? "active" : ""}`}
              onClick={() => navegar(it.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navegar(it.id);
                }
              }}
            >
              {it.label}
            </div>
          ))}
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
                className="btn btn-outline loc-btn-sair"
                style={{
                  width: "auto",
                  margin: 0,
                  padding: "10px 16px",
                }}
                onClick={handleLogout}
              >
                Sair
              </button>
            </div>
          </div>
          <div
            id="loc-banner-hub-ctx"
            className={`loc-hub-ctx-banner ${mostrarBannerCtx ? "" : "hidden"}`}
            role="status"
          >
            {mostrarBannerCtx ? (
              <>
                <span style={{ flex: 1 }}>
                  Você está visualizando a base <strong>{labelEff}</strong>{" "}
                  (mesmos dados da prefeitura de referência).
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{
                    width: "auto",
                    margin: 0,
                    padding: "8px 14px",
                    textTransform: "none",
                    fontSize: "0.82rem",
                  }}
                  onClick={limparCtxHubModulo}
                >
                  Usar base do meu login
                </button>
              </>
            ) : null}
          </div>

          <div
            id="dash"
            className={`tab-content ${secaoAtiva === "dash" ? "active" : ""}`}
          >
            <h1>Dashboard geral</h1>
            <p className="loc-intro">
              Indicadores da <strong>sua base de frota</strong> (equipamentos
              sob gestão de locação) e inspeções recebidas. Os gráficos usam o
              mesmo conjunto de dados do módulo municipal, com textos adaptados
              para operação de locação.
            </p>
            <div className="card-grid">
              <div className="card">
                <h3>Equipamentos na base</h3>
                <p id="loc-d-ativos">{dashEquipCount ?? h.ativos} und.</p>
              </div>
              <div
                className="card card-clickable"
                onClick={abrirChecklistCard}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    abrirChecklistCard();
                  }
                }}
              >
                <h3>Checklists / inspeções (período)</h3>
                <p id="loc-d-checklists">
                  {dashChecklistTotal ?? totalChecklists}
                </p>
              </div>
              <div className="card">
                <h3>Em manutenção</h3>
                <p id="loc-d-manut">
                  {String(dashManuCount ?? h.manutencao).padStart(2, "0")}
                </p>
              </div>
            </div>
            <p
              id="loc-dash-graficos-periodo"
              className="loc-intro"
              style={{ marginTop: 0 }}
            >
              {(dashGraficos ?? pmMerged?.dashboardGraficos)?.tituloPeriodo ??
                `Período corrente — ${labelEff}`}
            </p>
            <div className="dash-graficos-grid">
              <div className="card chart-wrap">
                <h3>Inspeções recebidas</h3>
                <p className="chart-sub">Volume no mês por semana</p>
                <canvas ref={canvasChRef} id="loc-chart-checklists" />
              </div>
              <div className="card chart-wrap wide">
                <h3>Top 5 operadores — inspeções com alta confiabilidade</h3>
                <p className="chart-sub">
                  Ranking por quantidade de checklists com qualidade alta no
                  período
                </p>
                <canvas ref={canvasOpRef} id="loc-chart-operadores" />
              </div>
            </div>
          </div>

          <div
            id="auditoria"
            className={`tab-content ${secaoAtiva === "auditoria" ? "active" : ""}`}
          >
            <h1>Auditoria de checklists</h1>
            <p className="loc-intro">
              Checklists registrados no servidor para este cliente, filtrados
              por <strong>prefeituraId</strong>. Expanda cada registro para ver
              horímetro, observações e itens Sim/Não.
            </p>

            <div className="card" style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "12px",
                  alignItems: "end",
                }}
              >
                <div>
                  <label
                    htmlFor="loc-aud-filtro-data"
                    style={{
                      display: "block",
                      marginBottom: 4,
                      fontSize: "0.82rem",
                      color: "var(--text-gray)",
                    }}
                  >
                    Data
                  </label>
                  <input
                    id="loc-aud-filtro-data"
                    type="date"
                    value={audFiltroData}
                    onChange={(e) => setAudFiltroData(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="loc-aud-filtro-chassis"
                    style={{
                      display: "block",
                      marginBottom: 4,
                      fontSize: "0.82rem",
                      color: "var(--text-gray)",
                    }}
                  >
                    Chassi
                  </label>
                  <input
                    id="loc-aud-filtro-chassis"
                    type="text"
                    placeholder="Filtrar por chassi..."
                    value={audFiltroChassis}
                    onChange={(e) => setAudFiltroChassis(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="loc-aud-filtro-operador"
                    style={{
                      display: "block",
                      marginBottom: 4,
                      fontSize: "0.82rem",
                      color: "var(--text-gray)",
                    }}
                  >
                    Operador
                  </label>
                  <input
                    id="loc-aud-filtro-operador"
                    type="text"
                    placeholder="Filtrar por operador..."
                    value={audFiltroOperador}
                    onChange={(e) => setAudFiltroOperador(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, paddingBottom: 1 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ flex: 1, margin: 0 }}
                    disabled={audCarregando}
                    onClick={() => setAudTick((t) => t + 1)}
                  >
                    {audCarregando ? "Carregando..." : "Atualizar"}
                  </button>
                  {(audFiltroData || audFiltroChassis || audFiltroOperador) && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ flex: 1, margin: 0 }}
                      onClick={() => {
                        setAudFiltroData("");
                        setAudFiltroChassis("");
                        setAudFiltroOperador("");
                      }}
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 0 }}>
              <div
                className="hu360-dash-checklists-panel"
                style={{ marginTop: 0, maxWidth: "100%" }}
              >
                <div className="hu360-dash-checklists-panel__head">
                  <h3 className="hu360-dash-checklists-panel__title">
                    {audCarregando
                      ? "Carregando..."
                      : `${audFiltrados.length} registro${
                          audFiltrados.length !== 1 ? "s" : ""
                        }${audFiltroData || audFiltroChassis || audFiltroOperador ? " (filtrado)" : ""}`}
                  </h3>
                </div>
                {audCarregando ? (
                  <p
                    style={{
                      margin: 0,
                      color: "var(--text-gray)",
                      fontSize: "0.92rem",
                    }}
                  >
                    Buscando registros no servidor...
                  </p>
                ) : (
                  <ListaChecklistHistoricoLocal
                    rows={audFiltrados}
                    expandidoId={auditoriaExpandidoId}
                    setExpandidoId={setAuditoriaExpandidoId}
                    mensagemVazia="Nenhum checklist encontrado para os filtros aplicados."
                  />
                )}
              </div>
            </div>
          </div>

          <div
            id="riscos"
            className={`tab-content ${secaoAtiva === "riscos" ? "active" : ""}`}
          >
            <h1>Triagem de risco</h1>
            <p className="loc-intro">
              Priorize registros por <strong>nível de risco</strong> com base
              nos checklists recebidos. Risco calculado pela quantidade de
              respostas <strong>Não</strong> por inspeção.
            </p>
            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ margin: 0 }}
                disabled={riscoCarregando}
                onClick={() => setRiscoTick((t) => t + 1)}
              >
                {riscoCarregando ? "Carregando..." : "Atualizar"}
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Risco</th>
                  <th>Equipamento</th>
                  <th>Defeito</th>
                  <th>Operador</th>
                  <th>Ação sugerida</th>
                </tr>
              </thead>
              <tbody id="loc-tbody-riscos">
                {riscoCarregando ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ textAlign: "center", color: "var(--text-gray)" }}
                    >
                      Carregando...
                    </td>
                  </tr>
                ) : riscoFirestoreRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ textAlign: "center", color: "var(--text-gray)" }}
                    >
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : (
                  riscoFirestoreRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span
                          style={{
                            color:
                              row.nivel === "Alto"
                                ? "#fca5a5"
                                : row.nivel === "Médio"
                                  ? "#fde68a"
                                  : "#86efac",
                            fontWeight: 600,
                          }}
                        >
                          {row.nivel}
                        </span>
                      </td>
                      <td>{row.categoria}</td>
                      <td>{row.defeito}</td>
                      <td>{row.operador}</td>
                      <td>{row.acaoSugerida}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div
            id="equipamentos"
            className={`tab-content ${secaoAtiva === "equipamentos" ? "active" : ""}`}
          >
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--text-gray)",
                margin: "0 0 14px",
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: "#cbd5e1" }}>Clientes</span>
              &nbsp;/&nbsp;
              <strong
                id="loc-eq-bc-cliente"
                style={{ color: "var(--main-orange)" }}
              >
                {labelEff}
              </strong>
              &nbsp;/&nbsp;
              <span style={{ color: "#e2e8f0" }}>Equipamentos</span>
            </p>
            <h1>Equipamentos em locação</h1>
            <p className="loc-intro" style={{ marginTop: 0 }}>
              Visualização da frota cadastrada para o cliente (mesma base da
              prefeitura vinculada ao login). O{" "}
              <strong>tomador / empresa terceira</strong> por equipamento é
              definido na aba <strong>Empresas terceiras</strong>. Inclusão e
              importação de equipamentos ficam no{" "}
              <Link
                to="/admin/equipamentos-locacao"
                style={{ color: "var(--main-orange)" }}
              >
                Hub administrativo
              </Link>{" "}
              (aba Equipamentos locação).
            </p>

            <div className="card">
              <h3>Equipamentos cadastrados</h3>
              <table style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Tipo / descrição</th>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>Chassis</th>
                    <th>Tomador / terceiro</th>
                    <th>Linha</th>
                    <th>Obra</th>
                  </tr>
                </thead>
                <tbody id="loc-eq-tbody">
                  {equipFirestoreRows.map((eq) => (
                    <tr key={String(eq.id ?? "")}>
                      <td>
                        <strong>
                          {String(eq.label || eq.modelo || "Equipamento")}
                        </strong>
                      </td>
                      <td>{String(eq.marca ?? "—")}</td>
                      <td>{String(eq.modelo ?? "—")}</td>
                      <td style={{ fontSize: "0.82rem" }}>
                        {String(eq.chassis ?? "—")}
                      </td>
                      <td style={{ fontSize: "0.82rem", maxWidth: 200 }}>
                        {String(eq.empresaTerceiraId ?? "Locadora")}
                      </td>
                      <td style={{ fontSize: "0.82rem" }}>
                        {String(eq.linha || "—")}
                      </td>
                      <td style={{ fontSize: "0.82rem" }}>
                        {String(eq.obra ?? "").trim() ? String(eq.obra) : "—"}
                      </td>
                    </tr>
                  ))}
                  {equipCarregando ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          color: "var(--text-gray)",
                        }}
                      >
                        Carregando...
                      </td>
                    </tr>
                  ) : equipFirestoreRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          color: "var(--text-gray)",
                        }}
                      >
                        Nenhum equipamento cadastrado ainda.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div
            id="terceiros"
            className={`tab-content ${secaoAtiva === "terceiros" ? "active" : ""}`}
          >
            <p
              style={{
                fontSize: "0.82rem",
                color: "var(--text-gray)",
                margin: "0 0 14px",
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: "#cbd5e1" }}>Clientes</span>
              &nbsp;/&nbsp;
              <strong style={{ color: "var(--main-orange)" }}>
                {labelEff}
              </strong>
              &nbsp;/&nbsp;
              <span style={{ color: "#e2e8f0" }}>Empresas terceiras</span>
            </p>
            <h1>Empresas terceiras (tomadores)</h1>
            <p className="loc-intro" style={{ marginTop: 0 }}>
              Cadastre <strong>empresas às quais a locadora direciona</strong> o
              uso do equipamento (sublocação / obra de terceiro). Depois associe
              cada máquina pelo chassi na tabela abaixo. Equipamentos sem
              associação permanecem como <strong>Locadora</strong>.
            </p>

            <div
              className="card"
              style={{
                marginBottom: 16,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
                justifyContent: "space-between",
              }}
            >
              <div style={{ flex: "1 1 220px" }}>
                <h3 style={{ margin: "0 0 6px" }}>
                  Sincronizar com o servidor
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.86rem",
                    color: "var(--text-gray)",
                  }}
                >
                  Envia empresas terceiras e vínculos por chassi ao Firestore e
                  reimporta a base (inclui equipamentos cadastrados só no Hub).
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline"
                style={{ margin: 0, flexShrink: 0 }}
                disabled={syncLocacaoLoading || !prefeituraIdEff}
                onClick={() => void handleSincronizarLocacaoFirestore()}
              >
                {syncLocacaoLoading ? "Sincronizando…" : "Sincronizar agora"}
              </button>
              {syncLocacaoMsg ? (
                <p
                  style={{
                    width: "100%",
                    margin: 0,
                    fontSize: "0.86rem",
                    color: syncLocacaoMsg.includes("Falha")
                      ? "#fca5a5"
                      : "#86efac",
                  }}
                >
                  {syncLocacaoMsg}
                </p>
              ) : null}
            </div>

            <div className="card">
              <h3>Nova empresa terceira</h3>
              <form
                onSubmit={handleCadastroEmpresaTerceira}
                style={{ marginTop: 12, maxWidth: 480 }}
              >
                <label htmlFor="loc-terc-nome">Nome da empresa</label>
                <input
                  id="loc-terc-nome"
                  value={tercNome}
                  onChange={(e) => setTercNome(e.target.value)}
                  placeholder="Ex.: Construtora Horizonte Ltda."
                  autoComplete="organization"
                />
                <label htmlFor="loc-terc-cnpj" style={{ marginTop: 12 }}>
                  CNPJ (opcional)
                </label>
                <input
                  id="loc-terc-cnpj"
                  value={tercCnpj}
                  onChange={(e) => setTercCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  autoComplete="off"
                />
                <label htmlFor="loc-terc-contato" style={{ marginTop: 12 }}>
                  Contato (opcional)
                </label>
                <input
                  id="loc-terc-contato"
                  value={tercContato}
                  onChange={(e) => setTercContato(e.target.value)}
                  placeholder="E-mail ou telefone"
                  autoComplete="off"
                />
                <label htmlFor="loc-terc-obs" style={{ marginTop: 12 }}>
                  Observações (opcional)
                </label>
                <textarea
                  id="loc-terc-obs"
                  value={tercObs}
                  onChange={(e) => setTercObs(e.target.value)}
                  rows={2}
                  placeholder="Obra, contrato, período da sublocação…"
                />
                <div style={{ marginTop: 16 }}>
                  <button
                    type="submit"
                    className="btn btn-outline"
                    style={{ margin: 0 }}
                  >
                    Salvar empresa
                  </button>
                </div>
                {tercMsg ? (
                  <p
                    style={{
                      marginTop: 12,
                      marginBottom: 0,
                      fontSize: "0.88rem",
                      color: tercMsg.tone === "ok" ? "#86efac" : "#fca5a5",
                    }}
                  >
                    {tercMsg.text}
                  </p>
                ) : null}
              </form>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <h3>Empresas cadastradas</h3>
              {tercCarregando ? (
                <p
                  style={{
                    color: "var(--text-gray)",
                    marginTop: 12,
                    marginBottom: 0,
                  }}
                >
                  Carregando...
                </p>
              ) : tercFirestoreRows.length === 0 ? (
                <p
                  style={{
                    color: "var(--text-gray)",
                    marginTop: 12,
                    marginBottom: 0,
                  }}
                >
                  Nenhuma empresa terceira ainda. Cadastre acima para poder
                  direcionar equipamentos.
                </p>
              ) : (
                <table style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>CNPJ</th>
                      <th>Contato</th>
                      <th>Cadastro</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tercFirestoreRows.map((em) => (
                      <tr key={em.id}>
                        <td>
                          <strong>{em.nome}</strong>
                          {em.observacoes ? (
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--text-gray)",
                                marginTop: 4,
                                maxWidth: 280,
                              }}
                            >
                              {em.observacoes}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ fontSize: "0.82rem" }}>
                          {em.cnpj?.trim() ? em.cnpj : "—"}
                        </td>
                        <td style={{ fontSize: "0.82rem" }}>
                          {em.contato?.trim() ? em.contato : "—"}
                        </td>
                        <td style={{ fontSize: "0.82rem" }}>{em.criadoEm}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{
                              margin: 0,
                              padding: "6px 12px",
                              fontSize: "0.82rem",
                            }}
                            onClick={() => handleRemoverEmpresaTerceira(em.id)}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <h3>Direcionar máquinas (por chassi)</h3>
              <p
                style={{
                  color: "var(--text-gray)",
                  fontSize: "0.88rem",
                  marginTop: 0,
                }}
              >
                Escolha o tomador de cada equipamento já cadastrado na base
                deste cliente.
              </p>
              {equip.lista.length === 0 ? (
                <p style={{ color: "var(--text-gray)", marginBottom: 0 }}>
                  Não há equipamentos na base. Cadastre frota no Hub
                  administrativo.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ marginTop: 12, minWidth: 560 }}>
                    <thead>
                      <tr>
                        <th>Equipamento</th>
                        <th>Chassis</th>
                        <th>Tomador</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equip.lista.map((eq) => (
                        <tr key={eq.id}>
                          <td>
                            <strong>
                              {eq.descricao || eq.modelo || "Equipamento"}
                            </strong>
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--text-gray)",
                              }}
                            >
                              {eq.marca} {eq.modelo}
                            </div>
                          </td>
                          <td
                            style={{
                              fontSize: "0.82rem",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {eq.chassis}
                          </td>
                          <td>
                            <select
                              aria-label={`Tomador para ${eq.chassis}`}
                              value={eq.empresaTerceiraId ?? ""}
                              onChange={(e) =>
                                equip.definirEmpresaTerceira(
                                  eq.id,
                                  e.target.value || undefined,
                                )
                              }
                              style={{
                                maxWidth: 260,
                                fontSize: "0.86rem",
                                padding: "8px 10px",
                                borderRadius: 8,
                              }}
                            >
                              <option value="">Locadora (sem terceiro)</option>
                              {tercFirestoreRows.map((em) => (
                                <option key={em.id} value={em.id}>
                                  {em.nome}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
