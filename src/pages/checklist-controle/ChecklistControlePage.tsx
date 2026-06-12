import {
  type FormEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { ListaChecklistHistoricoLocal } from "../../components/checklistHistorico/ChecklistHistoricoLista";
import { db } from "../../lib/firebase/firebase";
import seedData from "../../data/hu360OperadorSeed.json";
import "./checklist-controle.css";
import { type OperadorSession, useOperadorSession } from "./useOperadorSession";
import {
  comprimirAteOrcamento,
  esperarAckComTimeout,
  salvarHistoricoLocal,
  tamanhoDocBytes,
} from "./salvar-offline";
import { registroDoOperador } from "./registro-operador";
import { obterLocalizacao } from "./geolocalizacao";
import { itensDaCategoria } from "../../features/checklist/domain/itens";
import {
  inferirDefinition,
  itensDaDefinition,
  type ItemOperador,
} from "../../features/checklist/domain/definitions-resolver";
import { useChecklistDefinitions } from "../../features/checklist/hooks/useChecklistDefinitions";
import { usePontoAtivo } from "../../lib/api/feature-flags";
import { usePwaInstallPrompt } from "./usePwaInstallPrompt";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { PontosFolha } from "./PontosFolha";
import { uploadChecklistFotos } from "../../features/checklist/api/uploads-api";
import { enviarWorkflowComFila } from "../../features/checklist/api/workflow-fila";
import { useWorkflowSync } from "./useWorkflowSync";
import { usePrefetchEscopo } from "./usePrefetchEscopo";
import { useSyncPendencias } from "./useSyncPendencias";
import { marcarPendente, removerPendente } from "./sync-pendencias";
import { marcarTrabalhoEmAndamento } from "../../components/Pwa/atualizacao-segura";
import { emergenciasApi } from "../../features/emergencia/api/emergencias-api";
import {
  type ChecklistDocumentoItem,
  dataLongaPtBr,
  inferirCategoriaChecklist,
  isSameLocalDay,
  normalizeChassis,
  startOfLocalDayIso,
} from "../../features/checklist";

type Aba =
  | "dashboard"
  | "checklist"
  | "auditoria"
  | "emergencia"
  | "pontos";

type ItemChecklist =
  | (typeof seedData.itens_checklist)[number]
  | ChecklistDocumentoItem
  | ItemOperador;

/** True se o item é classificado como `impeditivo` no seed (default = não). */
function itemImpeditivo(it: ItemChecklist): boolean {
  return (it as { Severidade?: string }).Severidade === "impeditivo";
}

/** Resposta por item: «Não» exige foto ao vivo + descrição do problema; N/A não entra no cálculo. */
type ChecklistAnswerValue =
  | { v: "sim" }
  | { v: "nao"; foto: string; problema: string }
  | { v: "na" };

function checklistRespostaCompleta(
  a: ChecklistAnswerValue | undefined,
): boolean {
  if (!a) return false;
  if (a.v === "sim") return true;
  if (a.v === "na") return true;
  // Foto pode ser data URL (capturada agora) ou URL do Supabase (já subida).
  return Boolean(
    (a.foto.startsWith("data:image") || a.foto.startsWith("http")) &&
      a.problema.trim(),
  );
}

/** Equipamento retornado do Firestore na busca por chassi. */
type EquipFirestore = {
  id: string;
  prefeituraId: string;
  label: string;
  chassis: string;
  modelo: string;
  linha: string;
  tipo: string;
};

/** Senha do modo demonstração / operadores (inclui login administrativo jefferson). */
const OPERADOR_SENHA = "1234";
const EMERG_STORAGE_KEY = "hu360-emergencias-local";
const CHECKLIST_HIST_KEY = "hu360-checklist-history-local";

const TIPOS_FALHA_EMERGENCIA = [
  { value: "hidraulica", label: "Hidráulica" },
  { value: "eletrica", label: "Elétrica" },
  { value: "motor", label: "Motor" },
  { value: "transmissao", label: "Transmissão" },
  { value: "freio", label: "Freio" },
  { value: "pneus", label: "Pneus" },
  { value: "parabrisas", label: "Parabrisas" },
  { value: "outros", label: "Outros" },
] as const;

function montarTipoFalhaParaRegistro(
  categoria: string,
  outrosDetalhe: string,
): string {
  const det = outrosDetalhe.trim();
  if (categoria === "outros") return det ? `Outros: ${det}` : "";
  const hit = TIPOS_FALHA_EMERGENCIA.find((t) => t.value === categoria);
  return hit ? hit.label : "";
}

/** Quantidade de fotos obrigatórias (câmera ao vivo) no registro de emergência. */
const EMERG_NUM_FOTOS = 6;

// Orçamentos por foto (chars do data URL ≈ bytes no doc). Os registros vão
// inteiros num único documento do Firestore, que tem limite rígido de 1 MiB —
// acima disso a escrita feita offline é rejeitada em silêncio ao sincronizar.
// Emergência carrega 6 fotos por doc; checklist carrega horímetro + uma foto
// por item reprovado.
const ORCAMENTO_FOTO_EMERGENCIA = 140_000;
const ORCAMENTO_FOTO_ITEM_NAO = 180_000;
const ORCAMENTO_FOTO_HORIMETRO = 400_000;
/** Teto do doc no Firestore (1 MiB) com folga para os campos de texto. */
const MAX_DOC_FIRESTORE_BYTES = 950_000;

function jpegDataUrlFromVideo(
  video: HTMLVideoElement,
  orcamentoBytes: number,
): string | null {
  if (!video || video.readyState < 2) return null;
  const w0 = video.videoWidth;
  const h0 = video.videoHeight;
  if (!w0 || !h0) return null;
  const maxSide = 900;
  let tw = w0;
  let th = h0;
  if (Math.max(w0, h0) > maxSide) {
    const r = maxSide / Math.max(w0, h0);
    tw = Math.round(w0 * r);
    th = Math.round(h0 * r);
  }
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, tw, th);
  return comprimirAteOrcamento(
    (q) => canvas.toDataURL("image/jpeg", q),
    orcamentoBytes,
    [0.74, 0.58, 0.45, 0.35],
  );
}

/**
 * Reabre um data URL já capturado e recomprime até caber no orçamento.
 * Usado como último recurso quando o documento inteiro passa do limite.
 */
async function recomprimirDataUrl(
  dataUrl: string,
  orcamentoBytes: number,
): Promise<string | null> {
  if (!dataUrl.startsWith("data:image") || dataUrl.length <= orcamentoBytes) {
    return dataUrl;
  }
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("imagem inválida"));
    img.src = dataUrl;
  });
  const maxSide = 720;
  const r = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * r));
  canvas.height = Math.max(1, Math.round(img.height * r));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return comprimirAteOrcamento(
    (q) => canvas.toDataURL("image/jpeg", q),
    orcamentoBytes,
    [0.6, 0.45, 0.32],
  );
}

function parseOperadores(lista: string): string[] {
  return lista
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveSessionForUsuario(usuario: string): OperadorSession | null {
  const u = usuario.trim().toLowerCase();
  if (!u) return null;
  for (const loc of seedData.locacoes_ativas) {
    const names = parseOperadores(loc.Lista_Operadores);
    const hit =
      names.find((n) => n.toLowerCase() === u) ??
      names.find((n) => {
        const first = n.toLowerCase().split(/\s+/)[0] ?? "";
        return first === u && first.length > 0;
      });
    if (hit) {
      return {
        nome: hit,
        idMaquina: loc.ID_Maquina,
        idCliente: loc.ID_Cliente,
        empresa: loc.Nome_Empresa,
      };
    }
  }
  return null;
}

/** Login curto do gestor → mesmo vínculo do operador na planilha (Jefferson Lima / VIVO). */
function resolveLoginToSession(usuarioRaw: string): OperadorSession | null {
  const u = usuarioRaw.trim().toLowerCase();
  if (u === "jefferson" || u === "jeff") {
    return resolveSessionForUsuario("Jefferson Lima");
  }
  return resolveSessionForUsuario(usuarioRaw);
}

function loadEmergencias(): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(EMERG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEmergencias(rows: Record<string, unknown>[]) {
  salvarHistoricoLocal(EMERG_STORAGE_KEY, rows);
}

function loadChecklistHistory(): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(CHECKLIST_HIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveChecklistHistory(rows: Record<string, unknown>[]) {
  salvarHistoricoLocal(CHECKLIST_HIST_KEY, rows);
}

const ABAS: {
  id: Aba;
  label: string;
  shortLabel: string;
  icon: "dash" | "check" | "audit" | "alert" | "clock";
}[] = [
  { id: "dashboard", label: "Dashboard", shortLabel: "Início", icon: "dash" },
  { id: "checklist", label: "Checklist", shortLabel: "Checklist", icon: "check" },
  {
    id: "auditoria",
    label: "Auditoria de checklists",
    shortLabel: "Auditoria",
    icon: "audit",
  },
  {
    id: "emergencia",
    label: "Emergências",
    shortLabel: "Emergência",
    icon: "alert",
  },
  { id: "pontos", label: "Pontos", shortLabel: "Pontos", icon: "clock" },
];

function parseRespostasChecklist(row: Record<string, unknown>): {
  total: number;
  sim: number;
} {
  const raw = row.Respostas_JSON;
  if (typeof raw === "string" && raw.length > 0) {
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      let sim = 0;
      let total = 0;
      for (const val of Object.values(o)) {
        if (val === "sim") {
          total += 1;
          sim += 1;
        } else if (val === "nao") {
          total += 1;
        } else if (val && typeof val === "object" && "v" in val) {
          const vv = (val as { v?: string }).v;
          if (vv === "na") continue;
          total += 1;
          if (vv === "sim") sim += 1;
        }
      }
      return { total, sim };
    } catch {
      /* fall through */
    }
  }
  const status = row.Status_Ok_Nao;
  if (typeof status === "string") {
    const m = /^(\d+)\/(\d+)/.exec(status);
    if (m) {
      return { sim: parseInt(m[1], 10), total: parseInt(m[2], 10) };
    }
  }
  return { total: 0, sim: 0 };
}

/** Mapeia um documento do Firestore (checklistsRegistros) para o formato legado usado pelo componente de lista. */
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
    Status_Ok_Nao:
      typeof data.totalNa === "number" && data.totalNa > 0
        ? `${data.totalSim ?? 0}/${data.totalAplicaveis ?? data.totalItens ?? 0} OK · ${data.totalNa} N/A`
        : `${data.totalSim ?? 0}/${data.totalAplicaveis ?? data.totalItens ?? 0} OK`,
    Respostas_JSON: respostasJson,
    Horimetro_Final: data.horimetro ?? "",
    Assinatura_Operador: data.assinaturaOperador ?? "",
    Pontuacao: data.pontuacao ?? 0,
    ID_Cliente: data.idOperadorSession ?? "",
    prefeituraId: data.prefeituraId ?? "",
    Localizacao_GPS: data.localizacaoGps ?? null,
    Obs: data.obs ?? null,
  };
}

function Hu360NavIcon({
  kind,
}: {
  kind: "dash" | "check" | "audit" | "alert" | "clock";
}) {
  const s = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "dash") {
    return (
      <svg {...s} aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (kind === "check") {
    return (
      <svg {...s} aria-hidden>
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }
  if (kind === "alert") {
    return (
      <svg {...s} aria-hidden>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (kind === "audit") {
    return (
      <svg {...s} aria-hidden>
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6" />
        <path d="M9 5a2 2 0 0 1 2-2h2" />
        <circle cx="17.5" cy="17.5" r="3.5" />
        <path d="m21 21-2.3-2.3" />
      </svg>
    );
  }
  return (
    <svg {...s} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function iniciaisOperador(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function ChecklistControlePage() {
  const { session, setSession } = useOperadorSession();
  // Reenvia workflows de checklist enfileirados offline quando a rede volta.
  useWorkflowSync();
  // Aquece o cache offline com a frota/cliente do operador (busca de chassi e
  // emergência passam a funcionar sem rede).
  usePrefetchEscopo(session?.idCliente, session?.empresa);
  // Quantos checklists/emergências salvos no aparelho ainda não confirmaram
  // no servidor (badge de sincronização).
  const { pendentes: pendentesSync } = useSyncPendencias();
  const { estado: pwaEstado, instalar: instalarApp } = usePwaInstallPrompt();
  const [pwaInstrucoesAberto, setPwaInstrucoesAberto] = useState(false);

  async function aoClicarInstalar() {
    if (pwaEstado === "instalado") {
      toast.info("O app já está instalado neste dispositivo.");
      return;
    }
    if (pwaEstado === "nativo") {
      const disparou = await instalarApp();
      if (!disparou) setPwaInstrucoesAberto(true);
      return;
    }
    setPwaInstrucoesAberto(true);
  }

  const pwaBotaoLabel =
    pwaEstado === "instalado" ? "App instalado ✓" : "Instalar app";
  const { ativo: pontoAtivo } = usePontoAtivo(session?.idCliente);
  const [aba, setAba] = useState<Aba>("dashboard");
  const [menuHeadAberto, setMenuHeadAberto] = useState(false);
  const menuHeadRef = useRef<HTMLDivElement>(null);
  const abasVisiveis = ABAS.filter((a) => a.id !== "pontos" || pontoAtivo);

  useEffect(() => {
    if (!menuHeadAberto) return;
    function fecharMenu(e: MouseEvent) {
      if (
        menuHeadRef.current &&
        !menuHeadRef.current.contains(e.target as Node)
      ) {
        setMenuHeadAberto(false);
      }
    }
    document.addEventListener("mousedown", fecharMenu);
    return () => document.removeEventListener("mousedown", fecharMenu);
  }, [menuHeadAberto]);

  useEffect(() => {
    setMenuHeadAberto(false);
  }, [aba]);

  // Auto-preenche GPS quando o operador abre a aba de emergência
  useEffect(() => {
    if (aba !== "emergencia") return;
    if (gpsEmerg) return; // já preenchido
    if (!navigator.geolocation) {
      setGpsErro("Geolocalização não suportada neste dispositivo.");
      return;
    }
    setGpsLoading(true);
    setGpsErro("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsEmerg(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setGpsLoading(false);
        if (accuracy > 100) {
          setGpsErro(
            `Precisão baixa (±${Math.round(accuracy)} m). Você pode corrigir abaixo.`,
          );
        }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsErro("Permissão de localização negada. Preencha manualmente.");
        } else {
          setGpsErro(
            "Não foi possível obter localização. Preencha manualmente.",
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [loginMsg, setLoginMsg] = useState<{
    tone: "ok" | "err";
    text: string;
  }>({ tone: "ok", text: "" });

  const [chassisChecklistDraft, setChassisChecklistDraft] = useState(
    () => session?.chassis ?? "",
  );
  const [chassisChecklistAtivo, setChassisChecklistAtivo] = useState("");
  const [equipamentoAtual, setEquipamentoAtual] =
    useState<EquipFirestore | null>(null);
  const [buscandoChassis, setBuscandoChassis] = useState(false);
  // Candidatos quando a busca por chassi (parcial / últimos dígitos) casa mais
  // de um equipamento — o operador escolhe na lista.
  const [candidatosChassi, setCandidatosChassi] = useState<EquipFirestore[]>([]);
  // Frota carregada uma vez para o autocomplete (filtragem ao vivo, offline).
  const [frotaBusca, setFrotaBusca] = useState<EquipFirestore[]>([]);
  const [frotaBuscaCarregada, setFrotaBuscaCarregada] = useState(false);
  const [mostrarSugestoesChassi, setMostrarSugestoesChassi] = useState(false);
  const [salvandoChecklist, setSalvandoChecklist] = useState(false);
  const [checklistsFirestoreHoje, setChecklistsFirestoreHoje] = useState<
    Record<string, unknown>[]
  >([]);
  const [carregandoChecklistsHoje, setCarregandoChecklistsHoje] =
    useState(false);
  const [checklistsHojeTick, setChecklistsHojeTick] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ChecklistAnswerValue>>(
    {},
  );
  const [nomeOperadorChecklist, setNomeOperadorChecklist] = useState("");
  const [horimetro, setHorimetro] = useState("");
  const [fotoHorimetroDataUrl, setFotoHorimetroDataUrl] = useState("");
  const [assinaturaDataUrl, setAssinaturaDataUrl] = useState("");
  const [horimetroCameraUi, setHorimetroCameraUi] = useState(false);
  const [obsChecklist, setObsChecklist] = useState("");
  const [checkMsg, setCheckMsg] = useState("");
  const [painelChecklistsHojeAberto, setPainelChecklistsHojeAberto] =
    useState(false);
  const [painelChecklistExpandidoId, setPainelChecklistExpandidoId] = useState<
    string | null
  >(null);
  const [auditoriaChecklistExpandidoId, setAuditoriaChecklistExpandidoId] =
    useState<string | null>(null);
  const [checklistsFirestoreAuditoria, setChecklistsFirestoreAuditoria] =
    useState<Record<string, unknown>[]>([]);
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false);
  const [auditoriaTick, setAuditoriaTick] = useState(0);
  const [auditoriaFiltroData, setAuditoriaFiltroData] = useState("");
  const [auditoriaFiltroChassis, setAuditoriaFiltroChassis] = useState("");
  const [auditoriaFiltroOperador, setAuditoriaFiltroOperador] = useState("");

  const [tipoFalhaCategoria, setTipoFalhaCategoria] = useState("");
  const [tipoFalhaOutros, setTipoFalhaOutros] = useState("");
  const [nomeOperadorEmerg, setNomeOperadorEmerg] = useState("");
  const [descEmerg, setDescEmerg] = useState("");
  const [gpsEmerg, setGpsEmerg] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsErro, setGpsErro] = useState("");
  // Localização capturada ao abrir o checklist (salva no checklist e na
  // emergência automática do item impeditivo).
  const [gpsChecklist, setGpsChecklist] = useState("");

  // Captura a localização sempre que o operador abre um checklist por chassi
  // (recaptura ao trocar de equipamento).
  useEffect(() => {
    if (!equipamentoAtual) return;
    let ativo = true;
    void obterLocalizacao().then((r) => {
      if (ativo) setGpsChecklist(r.texto);
    });
    return () => {
      ativo = false;
    };
  }, [equipamentoAtual]);
  const [fotosEmergencia, setFotosEmergencia] = useState<string[]>([""]);
  const [emergCameraSlot, setEmergCameraSlot] = useState<number | null>(null);
  const [emergMsg, setEmergMsg] = useState("");
  const [emergRows, setEmergRows] = useState<Record<string, unknown>[]>(() =>
    loadEmergencias(),
  );
  const [salvandoEmerg, setSalvandoEmerg] = useState(false);
  const [emergFirestoreRows, setEmergFirestoreRows] = useState<
    Record<string, unknown>[]
  >([]);
  const [carregandoEmerg, setCarregandoEmerg] = useState(false);
  const [emergTick, setEmergTick] = useState(0);

  // Sinaliza ao PwaUpdatePrompt que há trabalho não salvo — o auto-update
  // pós-deploy espera o operador terminar antes de recarregar a página.
  const checklistEmPreenchimento = Boolean(
    Object.keys(answers).length > 0 ||
      horimetro.trim() ||
      fotoHorimetroDataUrl ||
      assinaturaDataUrl.startsWith("data:image") ||
      obsChecklist.trim(),
  );
  const emergenciaEmPreenchimento = Boolean(
    descEmerg.trim() || fotosEmergencia.some((f) => f),
  );
  useEffect(() => {
    marcarTrabalhoEmAndamento("checklist-form", checklistEmPreenchimento);
    return () => marcarTrabalhoEmAndamento("checklist-form", false);
  }, [checklistEmPreenchimento]);
  useEffect(() => {
    marcarTrabalhoEmAndamento("emergencia-form", emergenciaEmPreenchimento);
    return () => marcarTrabalhoEmAndamento("emergencia-form", false);
  }, [emergenciaEmPreenchimento]);

  const horimetroVideoRef = useRef<HTMLVideoElement>(null);
  const horimetroStreamRef = useRef<MediaStream | null>(null);
  const assinaturaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const assinaturaDesenhandoRef = useRef(false);
  const emergVideoRef = useRef<HTMLVideoElement>(null);
  const emergStreamRef = useRef<MediaStream | null>(null);
  const itemNaoVideoRef = useRef<HTMLVideoElement>(null);
  const itemNaoStreamRef = useRef<MediaStream | null>(null);
  const [itemNaoCameraKey, setItemNaoCameraKey] = useState<string | null>(null);

  const stopItemNaoCamera = useCallback(() => {
    itemNaoStreamRef.current?.getTracks().forEach((t) => t.stop());
    itemNaoStreamRef.current = null;
    const v = itemNaoVideoRef.current;
    if (v) v.srcObject = null;
    setItemNaoCameraKey(null);
  }, []);

  const stopHorimetroCamera = useCallback(() => {
    horimetroStreamRef.current?.getTracks().forEach((t) => t.stop());
    horimetroStreamRef.current = null;
    const v = horimetroVideoRef.current;
    if (v) v.srcObject = null;
    setHorimetroCameraUi(false);
  }, []);

  const abrirCameraHorimetro = useCallback(async () => {
    setCheckMsg("");
    stopItemNaoCamera();
    stopHorimetroCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setCheckMsg(
        "Não foi possível acessar a câmera neste navegador. Use HTTPS e um navegador atualizado (Chrome ou Safari).",
      );
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      horimetroStreamRef.current = stream;
      setHorimetroCameraUi(true);
    } catch (e) {
      const denied = e instanceof DOMException && e.name === "NotAllowedError";
      setCheckMsg(
        denied
          ? "Permissão da câmera negada. Autorize o acesso para tirar a foto na hora."
          : "Não foi possível iniciar a câmera. Verifique permissões e se outro app não está usando a câmera.",
      );
      stopHorimetroCamera();
    }
  }, [stopHorimetroCamera, stopItemNaoCamera]);

  const capturarFotoHorimetroAoVivo = useCallback(() => {
    const v = horimetroVideoRef.current;
    if (!v || v.readyState < 2) {
      setCheckMsg(
        "Aguarde a imagem da câmera aparecer e toque em Capturar de novo.",
      );
      return;
    }
    const w0 = v.videoWidth;
    const h0 = v.videoHeight;
    if (!w0 || !h0) {
      setCheckMsg("Sem imagem da câmera. Cancele e abra a câmera novamente.");
      return;
    }
    const maxSide = 1024;
    let tw = w0;
    let th = h0;
    if (Math.max(w0, h0) > maxSide) {
      const r = maxSide / Math.max(w0, h0);
      tw = Math.round(w0 * r);
      th = Math.round(h0 * r);
    }
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCheckMsg("Não foi possível processar a imagem.");
      return;
    }
    ctx.drawImage(v, 0, 0, tw, th);
    const dataUrl = comprimirAteOrcamento(
      (q) => canvas.toDataURL("image/jpeg", q),
      ORCAMENTO_FOTO_HORIMETRO,
      [0.86, 0.7, 0.55, 0.42],
    );
    if (!dataUrl) {
      setCheckMsg(
        "Imagem muito grande. Aproxime o horímetro ou melhore a luz e capture de novo.",
      );
      return;
    }
    setFotoHorimetroDataUrl(dataUrl);
    setCheckMsg("");
    stopHorimetroCamera();
  }, [stopHorimetroCamera]);

  const stopEmergenciaCamera = useCallback(() => {
    emergStreamRef.current?.getTracks().forEach((t) => t.stop());
    emergStreamRef.current = null;
    const v = emergVideoRef.current;
    if (v) v.srcObject = null;
    setEmergCameraSlot(null);
  }, []);

  const abrirCameraEmergencia = useCallback(
    async (slot: number) => {
      setEmergMsg("");
      stopItemNaoCamera();
      stopHorimetroCamera();
      stopEmergenciaCamera();
      if (!navigator.mediaDevices?.getUserMedia) {
        setEmergMsg(
          "Não foi possível acessar a câmera neste navegador. Use HTTPS e um navegador atualizado (Chrome ou Safari).",
        );
        return;
      }
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
        emergStreamRef.current = stream;
        setEmergCameraSlot(slot);
      } catch (e) {
        const denied =
          e instanceof DOMException && e.name === "NotAllowedError";
        setEmergMsg(
          denied
            ? "Permissão da câmera negada. Autorize o acesso para tirar as fotos na hora."
            : "Não foi possível iniciar a câmera. Verifique permissões e se outro app não está usando a câmera.",
        );
        stopEmergenciaCamera();
      }
    },
    [stopEmergenciaCamera, stopHorimetroCamera, stopItemNaoCamera],
  );

  const capturarFotoEmergenciaAoVivo = useCallback(() => {
    const slot = emergCameraSlot;
    if (slot == null) return;
    const v = emergVideoRef.current;
    const dataUrl = v ? jpegDataUrlFromVideo(v, ORCAMENTO_FOTO_EMERGENCIA) : null;
    if (!dataUrl) {
      setEmergMsg(
        "Não foi possível capturar a imagem. Aguarde o vídeo estabilizar, melhore a luz ou tente de novo.",
      );
      return;
    }
    setFotosEmergencia((prev) => {
      const next = [...prev];
      next[slot] = dataUrl;
      return next;
    });
    setEmergMsg("");
    stopEmergenciaCamera();
  }, [emergCameraSlot, stopEmergenciaCamera]);

  const abrirCameraItemNao = useCallback(
    async (itemKey: string) => {
      setCheckMsg("");
      stopItemNaoCamera();
      stopHorimetroCamera();
      if (!navigator.mediaDevices?.getUserMedia) {
        setCheckMsg(
          "Não foi possível acessar a câmera neste navegador. Use HTTPS e um navegador atualizado (Chrome ou Safari).",
        );
        return;
      }
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
        itemNaoStreamRef.current = stream;
        setItemNaoCameraKey(itemKey);
      } catch (e) {
        const denied =
          e instanceof DOMException && e.name === "NotAllowedError";
        setCheckMsg(
          denied
            ? "Permissão da câmera negada. Autorize para fotografar o problema."
            : "Não foi possível iniciar a câmera. Tente de novo.",
        );
        stopItemNaoCamera();
      }
    },
    [stopItemNaoCamera, stopHorimetroCamera],
  );

  const capturarFotoItemNao = useCallback(() => {
    const k = itemNaoCameraKey;
    if (!k) return;
    const v = itemNaoVideoRef.current;
    const dataUrl = v ? jpegDataUrlFromVideo(v, ORCAMENTO_FOTO_ITEM_NAO) : null;
    if (!dataUrl) {
      setCheckMsg(
        "Não foi possível capturar a foto do problema. Aguarde o vídeo ou melhore a luz e tente de novo.",
      );
      return;
    }
    setAnswers((prev) => {
      const cur = prev[k];
      if (!cur || cur.v !== "nao") return prev;
      return { ...prev, [k]: { ...cur, foto: dataUrl } };
    });
    setCheckMsg("");
    stopItemNaoCamera();
  }, [itemNaoCameraKey, stopItemNaoCamera]);

  const resetAssinaturaCanvas = useCallback(() => {
    const canvas = assinaturaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const pointFromPointer = useCallback(
    (ev: PointerEvent<HTMLCanvasElement>) => {
      const canvas = assinaturaCanvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const x = ((ev.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((ev.clientY - rect.top) / rect.height) * canvas.height;
      return { x, y };
    },
    [],
  );

  const handleAssinaturaPointerDown = useCallback(
    (ev: PointerEvent<HTMLCanvasElement>) => {
      ev.preventDefault();
      const canvas = assinaturaCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      const p = pointFromPointer(ev);
      if (!canvas || !ctx || !p) return;
      canvas.setPointerCapture(ev.pointerId);
      assinaturaDesenhandoRef.current = true;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    },
    [pointFromPointer],
  );

  const handleAssinaturaPointerMove = useCallback(
    (ev: PointerEvent<HTMLCanvasElement>) => {
      if (!assinaturaDesenhandoRef.current) return;
      ev.preventDefault();
      const canvas = assinaturaCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      const p = pointFromPointer(ev);
      if (!ctx || !p) return;
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    },
    [pointFromPointer],
  );

  const handleAssinaturaPointerUp = useCallback(
    (ev: PointerEvent<HTMLCanvasElement>) => {
      const canvas = assinaturaCanvasRef.current;
      if (!canvas) return;
      if (canvas.hasPointerCapture(ev.pointerId)) {
        canvas.releasePointerCapture(ev.pointerId);
      }
      if (!assinaturaDesenhandoRef.current) return;
      assinaturaDesenhandoRef.current = false;
      const ctx = canvas.getContext("2d");
      ctx?.closePath();
      setAssinaturaDataUrl(canvas.toDataURL("image/png"));
    },
    [],
  );

  const limparAssinatura = useCallback(() => {
    assinaturaDesenhandoRef.current = false;
    setAssinaturaDataUrl("");
    setCheckMsg("");
    resetAssinaturaCanvas();
  }, [resetAssinaturaCanvas]);

  const dashMetrics = useMemo(() => {
    if (!session) {
      return {
        checklistsHoje: 0,
        itensHoje: 0,
        emAberto: 0,
        aproveitamento: 0,
      };
    }
    // Usa dados do Firestore quando já carregados, senão fallback para localStorage
    const source =
      checklistsFirestoreHoje.length > 0 || !carregandoChecklistsHoje
        ? checklistsFirestoreHoje
        : (() => {
            const today = startOfLocalDayIso(new Date());
            const hist = loadChecklistHistory();
            return hist
              .filter((row) => {
                if (!isSameLocalDay(String(row.Data_Hora ?? ""), today))
                  return false;
                if (String(row.ID_Cliente ?? "") !== session.idCliente)
                  return false;
                if (String(row.ID_Maquina ?? "") !== session.idMaquina)
                  return false;
                return true;
              })
              .map((r) => r);
          })();
    let itensHoje = 0;
    let simHoje = 0;
    for (const row of source) {
      const { total, sim } = parseRespostasChecklist(row);
      itensHoje += total;
      simHoje += sim;
    }
    const emAberto = emergFirestoreRows.filter(
      (r) =>
        String(
          r["statusAtendimento"] ?? r["Status_Atendimento"] ?? "",
        ).toLowerCase() === "aberto",
    ).length;
    const aproveitamento =
      itensHoje > 0 ? Math.round((simHoje / itensHoje) * 100) : 0;
    return {
      checklistsHoje: source.length,
      itensHoje,
      emAberto,
      aproveitamento,
    };
  }, [
    session,
    emergFirestoreRows,
    checklistsFirestoreHoje,
    carregandoChecklistsHoje,
  ]);

  const checklistsHojeFiltrados = useMemo(() => {
    return checklistsFirestoreHoje;
  }, [checklistsFirestoreHoje]);

  const checklistsAuditoriaFiltrados = useMemo(() => {
    return checklistsFirestoreAuditoria.filter((row) => {
      if (auditoriaFiltroData) {
        const dh = String(row.Data_Hora ?? "");
        if (!dh.startsWith(auditoriaFiltroData)) return false;
      }
      if (auditoriaFiltroChassis.trim()) {
        const c = normalizeChassis(String(row.Chassis ?? ""));
        if (!c.includes(normalizeChassis(auditoriaFiltroChassis))) return false;
      }
      if (auditoriaFiltroOperador.trim()) {
        const op = String(row.Operador ?? "").toLowerCase();
        if (!op.includes(auditoriaFiltroOperador.trim().toLowerCase()))
          return false;
      }
      return true;
    });
  }, [
    checklistsFirestoreAuditoria,
    auditoriaFiltroData,
    auditoriaFiltroChassis,
    auditoriaFiltroOperador,
  ]);

  useEffect(() => {
    if (!session) {
      setChecklistsFirestoreHoje([]);
      return;
    }
    setCarregandoChecklistsHoje(true);
    const today = startOfLocalDayIso(new Date());
    getDocs(
      query(
        collection(db, "checklistsRegistros"),
        where("idOperadorSession", "==", session.idCliente),
      ),
    )
      .then((snap) => {
        const rows = snap.docs
          .filter((d) =>
            registroDoOperador(d.data() as Record<string, unknown>, session),
          )
          .map((d) =>
            firestoreDocToHistRow(d.id, d.data() as Record<string, unknown>),
          )
          .filter((r) => isSameLocalDay(String(r.Data_Hora ?? ""), today));
        rows.sort((a, b) =>
          String(b.Data_Hora ?? "").localeCompare(String(a.Data_Hora ?? "")),
        );
        setChecklistsFirestoreHoje(rows);
      })
      .catch((err) => {
        console.error(
          "[Checklist] Erro ao carregar checklists do Firestore:",
          err,
        );
      })
      .finally(() => setCarregandoChecklistsHoje(false));
  }, [session, checklistsHojeTick]);

  useEffect(() => {
    if (aba !== "auditoria" || !session) return;
    setCarregandoAuditoria(true);
    getDocs(
      query(
        collection(db, "checklistsRegistros"),
        where("idOperadorSession", "==", session.idCliente),
      ),
    )
      .then((snap) => {
        const rows = snap.docs
          .filter((d) =>
            registroDoOperador(d.data() as Record<string, unknown>, session),
          )
          .map((d) =>
            firestoreDocToHistRow(d.id, d.data() as Record<string, unknown>),
          );
        rows.sort((a, b) =>
          String(b.Data_Hora ?? "").localeCompare(String(a.Data_Hora ?? "")),
        );
        setChecklistsFirestoreAuditoria(rows);
      })
      .catch((err) => {
        console.error("[Auditoria] Erro ao carregar checklists:", err);
      })
      .finally(() => setCarregandoAuditoria(false));
  }, [aba, session, auditoriaTick]);

  useEffect(() => {
    if (aba !== "emergencia" || !session) return;
    setCarregandoEmerg(true);
    getDocs(
      query(
        collection(db, "emergenciasRegistros"),
        where("idOperadorSession", "==", session.idCliente),
      ),
    )
      .then((snap) => {
        const rows: Record<string, unknown>[] = snap.docs
          .filter((d) =>
            registroDoOperador(d.data() as Record<string, unknown>, session),
          )
          .map((d) => ({
            ...(d.data() as Record<string, unknown>),
            _docId: d.id,
          }));
        rows.sort((a, b) =>
          String(b["dataHoraIso"] ?? "").localeCompare(
            String(a["dataHoraIso"] ?? ""),
          ),
        );
        setEmergFirestoreRows(rows);
      })
      .catch((err) => {
        console.error("[Emerg] Erro ao carregar emergências:", err);
      })
      .finally(() => setCarregandoEmerg(false));
  }, [aba, session, emergTick]);

  useEffect(() => {
    document.body.classList.add("hu360-root");
    return () => {
      document.body.classList.remove("hu360-root");
    };
  }, []);

  useEffect(() => {
    if (aba !== "dashboard") {
      setPainelChecklistsHojeAberto(false);
      setPainelChecklistExpandidoId(null);
    }
    if (aba !== "auditoria") {
      setAuditoriaChecklistExpandidoId(null);
    }
  }, [aba]);

  useEffect(() => {
    if (!horimetroCameraUi) return;
    const v = horimetroVideoRef.current;
    const stream = horimetroStreamRef.current;
    if (!v || !stream) return;
    v.srcObject = stream;
    void v.play().catch(() => undefined);
  }, [horimetroCameraUi]);

  useEffect(() => {
    if (emergCameraSlot === null) return;
    const v = emergVideoRef.current;
    const stream = emergStreamRef.current;
    if (!v || !stream) return;
    v.srcObject = stream;
    void v.play().catch(() => undefined);
  }, [emergCameraSlot]);

  useEffect(() => {
    if (itemNaoCameraKey === null) return;
    const v = itemNaoVideoRef.current;
    const stream = itemNaoStreamRef.current;
    if (!v || !stream) return;
    v.srcObject = stream;
    void v.play().catch(() => undefined);
  }, [itemNaoCameraKey]);

  useEffect(() => {
    return () => {
      horimetroStreamRef.current?.getTracks().forEach((t) => t.stop());
      horimetroStreamRef.current = null;
      emergStreamRef.current?.getTracks().forEach((t) => t.stop());
      emergStreamRef.current = null;
      itemNaoStreamRef.current?.getTracks().forEach((t) => t.stop());
      itemNaoStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (aba !== "checklist") {
      stopHorimetroCamera();
      stopItemNaoCamera();
    }
    if (aba !== "emergencia") stopEmergenciaCamera();
  }, [aba, stopHorimetroCamera, stopEmergenciaCamera, stopItemNaoCamera]);

  useEffect(() => {
    if (!session?.idMaquina) return;
    const m = seedData.cadastro_frota.find((x) => x.ID === session.idMaquina);
    const chassisSessao = session.chassis?.trim();
    const chassisCadastro = m?.Chassis != null ? String(m.Chassis) : "";
    const chassisInicial = chassisSessao || chassisCadastro;
    if (chassisInicial) setChassisChecklistDraft(chassisInicial);
  }, [session?.chassis, session?.idMaquina]);

  useEffect(() => {
    const canvas = assinaturaCanvasRef.current;
    if (!canvas) return;
    resetAssinaturaCanvas();
    if (!assinaturaDataUrl.startsWith("data:image")) return;
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = assinaturaDataUrl;
  }, [assinaturaDataUrl, resetAssinaturaCanvas]);

  useEffect(() => {
    if (!chassisChecklistAtivo) return;
    if (normalizeChassis(chassisChecklistDraft) !== chassisChecklistAtivo) {
      setChassisChecklistAtivo("");
      setEquipamentoAtual(null);
      setAnswers({});
      setNomeOperadorChecklist("");
      setHorimetro("");
      setFotoHorimetroDataUrl("");
      setAssinaturaDataUrl("");
      stopHorimetroCamera();
      stopItemNaoCamera();
    }
  }, [
    chassisChecklistDraft,
    chassisChecklistAtivo,
    stopHorimetroCamera,
    stopItemNaoCamera,
  ]);

  // Carrega a frota uma vez ao entrar na aba de checklist, para o autocomplete
  // filtrar ao vivo (instantâneo e disponível offline via cache do Firestore).
  useEffect(() => {
    if (aba !== "checklist" || frotaBuscaCarregada) return;
    let ativo = true;
    void (async () => {
      try {
        const snap = await getDocs(collection(db, "equipamentos"));
        if (!ativo) return;
        setFrotaBusca(snap.docs.map((d) => montarEquip(d.id, d.data())));
        setFrotaBuscaCarregada(true);
      } catch (err) {
        console.error("[Checklist] Erro ao carregar frota para busca:", err);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [aba, frotaBuscaCarregada]);

  // Sugestões filtradas ao vivo pelo trecho digitado (chassi ou modelo/nome).
  // Comparação só por letras/números (ignora pontos, hífens, espaços) para
  // casar "203040" mesmo que o chassi esteja cadastrado como "20-30-40".
  const sugestoesChassi = useMemo(() => {
    const alnum = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const q = alnum(chassisChecklistDraft);
    if (q.length < 2) return [];
    return frotaBusca
      .filter((e) => {
        const c = alnum(e.chassis);
        const txt = alnum(`${e.chassis}${e.label}${e.modelo}`);
        return c.includes(q) || txt.includes(q);
      })
      .sort((a, b) => {
        const ta = alnum(a.chassis).endsWith(q) ? 0 : 1;
        const tb = alnum(b.chassis).endsWith(q) ? 0 : 1;
        return ta - tb;
      })
      .slice(0, 8);
  }, [chassisChecklistDraft, frotaBusca]);

  const checklistItensLiberados = useMemo(
    () => Boolean(chassisChecklistAtivo && equipamentoAtual),
    [chassisChecklistAtivo, equipamentoAtual],
  );

  useEffect(() => {
    if (!checklistItensLiberados) {
      setAnswers((prev) => (Object.keys(prev).length === 0 ? prev : {}));
    }
  }, [checklistItensLiberados]);

  const maquinaDaSessao = useMemo(() => {
    if (!session?.idMaquina) return null;
    return (
      seedData.cadastro_frota.find((m) => m.ID === session.idMaquina) ?? null
    );
  }, [session?.idMaquina]);

  // Catálogo de definições do backend, com fallback offline no seed embutido.
  const { definitions: checklistDefinitions } = useChecklistDefinitions();

  // Definição casada por palavra-chave (nome/modelo do equipamento).
  const definicaoAtual = useMemo(() => {
    if (!equipamentoAtual) return null;
    return inferirDefinition(
      checklistDefinitions,
      equipamentoAtual.label,
      equipamentoAtual.modelo,
      `${equipamentoAtual.tipo} ${equipamentoAtual.linha}`,
    );
  }, [checklistDefinitions, equipamentoAtual]);

  const itensFiltrados: ItemChecklist[] = useMemo(() => {
    if (!equipamentoAtual) return [];
    // Itens da definição: deduplicados e renumerados 1..N (o `Nº` é a chave de
    // `answers`). Sem definição casada, cai no comportamento legado (seed).
    if (definicaoAtual) return itensDaDefinition(definicaoAtual);
    const cat = inferirCategoriaChecklist(
      equipamentoAtual.label,
      equipamentoAtual.modelo,
      `${equipamentoAtual.tipo} ${equipamentoAtual.linha}`,
    );
    return itensDaCategoria(cat);
  }, [equipamentoAtual, definicaoAtual]);

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginMsg({ tone: "ok", text: "" });
    const u = usuario.trim();
    const pass = senha.trim();
    if (!u || !pass) {
      setLoginMsg({ tone: "err", text: "Preencha usuário e senha." });
      return;
    }
    if (pass !== OPERADOR_SENHA) {
      setLoginMsg({
        tone: "err",
        text: `Senha incorreta. Use: ${OPERADOR_SENHA}`,
      });
      return;
    }

    let sess: OperadorSession | null = resolveLoginToSession(u);
    if (!sess && u.toLowerCase() === "admin") {
      const loc = seedData.locacoes_ativas[0];
      if (loc) {
        const primeiro = parseOperadores(loc.Lista_Operadores)[0];
        sess = {
          nome: primeiro ?? "Admin",
          idMaquina: loc.ID_Maquina,
          idCliente: loc.ID_Cliente,
          empresa: loc.Nome_Empresa,
        };
      }
    }

    if (!sess) {
      setLoginMsg({
        tone: "err",
        text: "Usuário não encontrado. Use jefferson, admin ou o nome completo de um operador da planilha.",
      });
      return;
    }

    const saved = setSession(sess);
    const m0 = seedData.cadastro_frota.find((x) => x.ID === sess.idMaquina);
    setChassisChecklistDraft(
      sess.chassis ?? (m0?.Chassis != null ? String(m0.Chassis) : ""),
    );
    setChassisChecklistAtivo("");
    setAnswers({});
    setNomeOperadorChecklist("");
    setHorimetro("");
    setFotoHorimetroDataUrl("");
    setAssinaturaDataUrl("");
    stopHorimetroCamera();
    stopItemNaoCamera();
    setLoginMsg({
      tone: "ok",
      text: saved
        ? "Sessão iniciada."
        : "Sessão iniciada. Se ao atualizar a página pedir login de novo, verifique se o armazenamento do navegador não está bloqueado para este site.",
    });
    setSenha("");
    setAba("dashboard");
    setPainelChecklistsHojeAberto(false);
    setPainelChecklistExpandidoId(null);
  }

  function handleLogout() {
    setSession(null);
    setUsuario("");
    setSenha("");
    setAnswers({});
    setChassisChecklistDraft("");
    setChassisChecklistAtivo("");
    setNomeOperadorChecklist("");
    setHorimetro("");
    setFotoHorimetroDataUrl("");
    setAssinaturaDataUrl("");
    stopHorimetroCamera();
    stopItemNaoCamera();
    setNomeOperadorEmerg("");
    setTipoFalhaCategoria("");
    setTipoFalhaOutros("");
    setDescEmerg("");
    setGpsEmerg("");
    setFotosEmergencia([""]);
    stopEmergenciaCamera();
    setPainelChecklistsHojeAberto(false);
    setPainelChecklistExpandidoId(null);
    setAba("dashboard");
  }

  function montarEquip(
    id: string,
    data: Record<string, unknown>,
  ): EquipFirestore {
    return {
      id,
      prefeituraId: String(data.prefeituraId ?? ""),
      label: String(data.label ?? data.descricao ?? ""),
      chassis: String(data.chassis ?? ""),
      modelo: String(data.modelo ?? ""),
      linha: String(data.linha ?? ""),
      tipo: String(data.tipo ?? ""),
    };
  }

  // Abre o checklist para o equipamento escolhido. Preenche o campo com o chassi
  // COMPLETO (mesmo numa busca por dígitos), senão o efeito que sincroniza
  // draft × chassi ativo zera tudo logo em seguida.
  function abrirParaEquip(equip: EquipFirestore) {
    setCandidatosChassi([]);
    setEquipamentoAtual(equip);
    setChassisChecklistDraft(equip.chassis);
    setChassisChecklistAtivo(normalizeChassis(equip.chassis));
    // Login identifica a pessoa; o equipamento da sessão é definido aqui.
    // Mantém os fluxos que leem session.idMaquina/chassis consistentes.
    if (session) {
      setSession({ ...session, idMaquina: equip.id, chassis: equip.chassis });
    }
    setAnswers({});
    setNomeOperadorChecklist(session?.nome ?? "");
    setHorimetro("");
    setFotoHorimetroDataUrl("");
    setAssinaturaDataUrl("");
    stopHorimetroCamera();
    stopItemNaoCamera();
    setCheckMsg("Lista de verificação aberta para este chassi.");
  }

  async function handleAbrirListaPorChassi() {
    setCheckMsg("");
    setCandidatosChassi([]);
    const draft = chassisChecklistDraft.trim();
    const normalizado = normalizeChassis(chassisChecklistDraft);
    if (!normalizado) {
      setCheckMsg("Informe o chassi antes de abrir a lista.");
      return;
    }
    setBuscandoChassis(true);
    try {
      // 1) Match exato (rápido): normalizado e, em fallback, o valor digitado.
      let snap = await getDocs(
        query(
          collection(db, "equipamentos"),
          where("chassis", "==", normalizado),
        ),
      );
      if (snap.empty) {
        snap = await getDocs(
          query(collection(db, "equipamentos"), where("chassis", "==", draft)),
        );
      }
      if (!snap.empty) {
        abrirParaEquip(montarEquip(snap.docs[0].id, snap.docs[0].data()));
        return;
      }

      // 2) Busca parcial pelos últimos dígitos, dentro da frota do cliente.
      if (normalizado.length < 3) {
        setCheckMsg(
          "Chassi não encontrado. Digite ao menos 3 caracteres para busca parcial.",
        );
        setChassisChecklistAtivo("");
        setEquipamentoAtual(null);
        return;
      }
      const prefId = session?.idCliente ?? "";
      const frotaSnap = prefId
        ? await getDocs(
            query(
              collection(db, "equipamentos"),
              where("prefeituraId", "==", prefId),
            ),
          )
        : await getDocs(collection(db, "equipamentos"));
      const matches = frotaSnap.docs
        .map((d) => montarEquip(d.id, d.data()))
        .filter((e) => normalizeChassis(e.chassis).includes(normalizado));

      if (matches.length === 0) {
        setCheckMsg("Chassi não encontrado no cadastro de equipamentos.");
        setChassisChecklistAtivo("");
        setEquipamentoAtual(null);
      } else if (matches.length === 1) {
        abrirParaEquip(matches[0]);
      } else {
        // Quem termina com o trecho (últimos dígitos) vai pro topo da lista.
        matches.sort((a, b) => {
          const ta = normalizeChassis(a.chassis).endsWith(normalizado) ? 0 : 1;
          const tb = normalizeChassis(b.chassis).endsWith(normalizado) ? 0 : 1;
          return ta - tb;
        });
        setCandidatosChassi(matches.slice(0, 12));
        setCheckMsg(
          `Vários equipamentos correspondem a "${draft}". Selecione abaixo:`,
        );
        setChassisChecklistAtivo("");
        setEquipamentoAtual(null);
      }
    } catch (err) {
      console.error("[Checklist] Erro ao buscar equipamento:", err);
      setCheckMsg("Erro ao buscar equipamento. Tente novamente.");
      setChassisChecklistAtivo("");
      setEquipamentoAtual(null);
    } finally {
      setBuscandoChassis(false);
    }
  }

  const setAnswer = useCallback(
    (numKey: string, v: "sim" | "nao" | "na") => {
      if (v === "sim") {
        if (itemNaoCameraKey === numKey) stopItemNaoCamera();
        setAnswers((prev) => ({ ...prev, [numKey]: { v: "sim" } }));
        return;
      }
      if (v === "na") {
        if (itemNaoCameraKey === numKey) stopItemNaoCamera();
        setAnswers((prev) => ({ ...prev, [numKey]: { v: "na" } }));
        return;
      }
      stopItemNaoCamera();
      setAnswers((prev) => ({
        ...prev,
        [numKey]: { v: "nao", foto: "", problema: "" },
      }));
    },
    [itemNaoCameraKey, stopItemNaoCamera],
  );

  function checklistItemTitulo(it: ItemChecklist): string {
    // `Tipo` só existe nos itens de documento (schema antigo). Os itens
    // operacionais novos usam `Categoria Origem` / `Aplica A` e dispensam
    // o prefixo.
    const tipo = (it as { Tipo?: string }).Tipo;
    return tipo
      ? `${tipo}: ${it["Item de Verificação"]}`
      : String(it["Item de Verificação"]);
  }

  async function handleSalvarChecklist(e: FormEvent) {
    e.preventDefault();
    setCheckMsg("");
    if (!session) {
      setCheckMsg("Faça login para registrar o checklist.");
      return;
    }
    if (!equipamentoAtual) {
      setCheckMsg(
        "Informe o chassi e clique em «Abrir lista de verificação» para carregar o checklist.",
      );
      return;
    }
    if (!nomeOperadorChecklist.trim()) {
      setCheckMsg("Informe o nome do operador antes de salvar.");
      return;
    }
    if (!horimetro.trim()) {
      setCheckMsg("Informe o horímetro antes de salvar.");
      return;
    }
    if (!fotoHorimetroDataUrl) {
      setCheckMsg(
        "Tire a foto do horímetro na hora com a câmera (botão abaixo) antes de marcar os itens e salvar.",
      );
      return;
    }
    if (!assinaturaDataUrl.startsWith("data:image")) {
      setCheckMsg("Assine no campo de assinatura antes de salvar o checklist.");
      return;
    }
    const keys = itensFiltrados.map((it) => String(it["Nº"]));
    const incompleto = keys.find((k) => !checklistRespostaCompleta(answers[k]));
    if (incompleto !== undefined) {
      const a = answers[incompleto];
      if (a?.v === "nao") {
        setCheckMsg(
          `No item ${incompleto}: em «Não» use a câmera para fotografar o problema e descreva o que foi encontrado.`,
        );
      } else {
        setCheckMsg(
          `Responda Sim/Não/N/A em todos os itens (pendente: ${incompleto}).`,
        );
      }
      return;
    }

    // Avisa quando algum item IMPEDITIVO foi marcado como "Não": esses
    // itens, pela tabela oficial, deveriam barrar a operação do veículo.
    // Não bloqueia em definitivo (o gestor decide via auditoria), mas pede
    // confirmação dupla pra evitar registro descuidado.
    // Itens impeditivos marcados como "Não" → abrem um ticket de emergência
    // automático ao salvar (sem perguntar). Calculado aqui, criado após o save.
    const impeditivosViolados = itensFiltrados.filter(
      (it) => itemImpeditivo(it) && answers[String(it["Nº"])]?.v === "nao",
    );

    const numSim = keys.filter((k) => answers[k]?.v === "sim").length;
    const numNa = keys.filter((k) => answers[k]?.v === "na").length;
    const totalAplicaveis = keys.length - numNa;
    const numNao = keys.filter((k) => answers[k]?.v === "nao").length;
    const pontos = numSim * 2;
    const itensNao = itensFiltrados
      .filter((it) => answers[String(it["Nº"])]?.v === "nao")
      .map((it) => {
        const num = String(it["Nº"]);
        const titulo = checklistItemTitulo(it);
        const resposta = answers[num];
        return {
          numero: num,
          titulo,
          problema: resposta?.v === "nao" ? resposta.problema : "",
        };
      });
    const id = crypto.randomUUID();
    const dataHora = new Date().toISOString();

    const reg = {
      ID_Registro: id,
      Data_Hora: dataHora,
      Operador: nomeOperadorChecklist.trim(),
      Chassis: equipamentoAtual.chassis || chassisChecklistAtivo,
      ID_Maquina: equipamentoAtual.id,
      Categoria:
        definicaoAtual?.categoria ??
        inferirCategoriaChecklist(
          equipamentoAtual.label,
          equipamentoAtual.modelo,
          `${equipamentoAtual.tipo} ${equipamentoAtual.linha}`,
        ),
      Modelo: equipamentoAtual.label,
      Linha: equipamentoAtual.linha,
      Item_Verificado: `Checklist ${itensFiltrados.length} itens`,
      Status_Ok_Nao:
        numNa > 0
          ? `${numSim}/${totalAplicaveis} OK · ${numNa} N/A`
          : `${numSim}/${totalAplicaveis} OK`,
      Respostas_JSON: JSON.stringify(answers),
      Horimetro_Final: horimetro.trim(),
      Foto_Horimetro: fotoHorimetroDataUrl,
      Assinatura_Operador: assinaturaDataUrl,
      Obs: obsChecklist || null,
      Pontuacao: pontos,
      ID_Cliente: session.idCliente,
    };

    // Salva no histórico local (para auditoria offline)
    const hist = loadChecklistHistory();
    hist.unshift(reg);
    saveChecklistHistory(hist);

    // prefeituraId do registro: o do equipamento e, se vazio, o da sessão do
    // operador. Sem isso, checklist/emergência ficam com prefeituraId "" e
    // somem das telas da prefeitura (Auditoria/Triagem/Emergências, que
    // filtram por prefeituraId). Mesmo fallback do fluxo de emergência manual.
    const prefeituraIdChecklist =
      equipamentoAtual.prefeituraId || session.idCliente;

    // Salva no Firestore
    setSalvandoChecklist(true);
    try {
      // O doc precisa caber no limite de 1 MiB do Firestore. Acima disso a
      // escrita feita offline é rejeitada em silêncio na sincronização (o
      // operador vê "salvo" e o registro nunca chega à auditoria). Se as
      // fotos passarem do orçamento, recomprime; se mesmo assim não couber,
      // pede nova captura em vez de fingir sucesso.
      let fotoHorimetroDoc = fotoHorimetroDataUrl;
      let answersDoc = answers;
      const montarPayload = () => ({
        id,
        prefeituraId: prefeituraIdChecklist,
        equipamentoId: equipamentoAtual.id,
        chassis: equipamentoAtual.chassis || chassisChecklistAtivo,
        modelo: equipamentoAtual.label,
        linha: equipamentoAtual.linha,
        categoria:
          definicaoAtual?.categoria ??
          inferirCategoriaChecklist(
            equipamentoAtual.label,
            equipamentoAtual.modelo,
            `${equipamentoAtual.tipo} ${equipamentoAtual.linha}`,
          ),
        operador: nomeOperadorChecklist.trim(),
        idOperadorSession: session.idCliente,
        funcionarioId: session.funcionarioId ?? "",
        funcionarioCpf: session.cpf ?? "",
        localizacaoGps: gpsChecklist.trim() || null,
        horimetro: horimetro.trim(),
        fotoHorimetro: fotoHorimetroDoc,
        assinaturaOperador: assinaturaDataUrl,
        totalItens: keys.length,
        totalAplicaveis,
        totalSim: numSim,
        totalNao: numNao,
        totalNa: numNa,
        itensNao,
        pontuacao: pontos,
        respostas: answersDoc,
        obs: obsChecklist || null,
        criadoEm: serverTimestamp(),
        dataHoraIso: dataHora,
      });
      // Online, tira as fotos do doc subindo para o Supabase Storage via
      // backend (viram URLs). Falhou ou offline → mantém base64, que o
      // orçamento abaixo garante caber no doc.
      if (navigator.onLine) {
        try {
          const fotosParaSubir: { nome: string; dataUrl: string }[] = [];
          if (fotoHorimetroDoc.startsWith("data:image")) {
            fotosParaSubir.push({
              nome: "horimetro",
              dataUrl: fotoHorimetroDoc,
            });
          }
          for (const [k, resp] of Object.entries(answersDoc)) {
            if (resp?.v === "nao" && resp.foto.startsWith("data:image")) {
              fotosParaSubir.push({ nome: `item-${k}`, dataUrl: resp.foto });
            }
          }
          if (fotosParaSubir.length > 0) {
            const urls = await uploadChecklistFotos(id, fotosParaSubir);
            const porNome = new Map(
              fotosParaSubir.map((f, i) => [f.nome, urls[i]]),
            );
            const urlHorimetro = porNome.get("horimetro");
            if (urlHorimetro) fotoHorimetroDoc = urlHorimetro;
            answersDoc = Object.fromEntries(
              Object.entries(answersDoc).map(([k, resp]) => {
                const url = porNome.get(`item-${k}`);
                return [
                  k,
                  resp?.v === "nao" && url ? { ...resp, foto: url } : resp,
                ];
              }),
            );
          }
        } catch (e) {
          console.warn(
            "[Checklist] Upload de fotos indisponível; mantendo base64 no doc:",
            e,
          );
        }
      }

      let payload = montarPayload();
      if (tamanhoDocBytes(payload) > MAX_DOC_FIRESTORE_BYTES) {
        const fotoMenor = await recomprimirDataUrl(
          fotoHorimetroDoc,
          Math.round(ORCAMENTO_FOTO_HORIMETRO / 2),
        ).catch(() => null);
        if (fotoMenor) fotoHorimetroDoc = fotoMenor;
        const entradas = await Promise.all(
          Object.entries(answersDoc).map(async ([k, resp]) => {
            if (resp?.v !== "nao" || !resp.foto.startsWith("data:image")) {
              return [k, resp] as const;
            }
            const menor = await recomprimirDataUrl(
              resp.foto,
              Math.round(ORCAMENTO_FOTO_ITEM_NAO / 2),
            ).catch(() => null);
            return [k, menor ? { ...resp, foto: menor } : resp] as const;
          }),
        );
        answersDoc = Object.fromEntries(entradas);
        payload = montarPayload();
      }
      if (tamanhoDocBytes(payload) > MAX_DOC_FIRESTORE_BYTES) {
        setCheckMsg(
          "As fotos deste checklist ficaram grandes demais para enviar. Capture de novo a foto do horímetro e as fotos dos itens reprovados e salve outra vez.",
        );
        return;
      }

      // Offline, a promise do Firestore só resolve quando o servidor
      // confirmar — pode levar horas. A mutação já fica persistida no
      // IndexedDB e sincroniza sozinha, então não seguramos a UI: offline
      // avisa "salvo no aparelho" na hora; online espera o ack por até 15s.
      // Conta como pendente até o servidor confirmar (badge "aguardando
      // sincronização"). A escrita confirmada remove a pendência — mesmo que
      // demore horas com o app aberto.
      marcarPendente(id, "checklist");
      const escrita = addDoc(collection(db, "checklistsRegistros"), payload);
      escrita.then(
        () => removerPendente(id),
        (e) =>
          console.error("[Checklist] Sincronização com o servidor falhou:", e),
      );
      const ack = await esperarAckComTimeout(escrita, navigator.onLine, 15_000);
      // Workflow NestJS dos itens "Não": online envia agora; offline/erro de
      // rede entra na fila local e reenvia quando a conexão voltar.
      await sincronizarRespostasPendentesWorkflow(id, answersDoc);
      if (ack === "sincronizado") {
        setCheckMsg("✅ Checklist salvo com sucesso!");
      } else {
        setCheckMsg(
          "📴 Sem internet agora: checklist salvo no aparelho. Ele sincroniza sozinho quando a conexão voltar — não apague o app nem limpe o navegador.",
        );
      }
      setChecklistsHojeTick((t) => t + 1);
      setAuditoriaTick((t) => t + 1);

      // Item impeditivo reprovado ("Não") → abre ticket de emergência automático.
      if (impeditivosViolados.length > 0) {
        try {
          const fotosImped = impeditivosViolados
            .map((it) => {
              const r = answers[String(it["Nº"])];
              return r?.v === "nao" ? r.foto : "";
            })
            .filter((u) => u.startsWith("data:image"));
          const descImped = impeditivosViolados
            .map((it) => {
              const r = answers[String(it["Nº"])];
              const prob = r?.v === "nao" && r.problema ? ` — ${r.problema}` : "";
              return `• ${it["Item de Verificação"]}${prob}`;
            })
            .join("\n");
          const emergPayload = {
            prefeituraId: prefeituraIdChecklist,
            source: "checklist_auto" as const,
            severity: "blocking" as const,
            equipamentoId: equipamentoAtual.id,
            chassis: equipamentoAtual.chassis || chassisChecklistAtivo,
            operadorNome: nomeOperadorChecklist.trim() || session.nome,
            tipoFalha: "Item impeditivo reprovado no checklist",
            descricao: `Itens impeditivos marcados como "Não":\n${descImped}`,
            localizacaoGps: gpsChecklist.trim() || null,
            fotos: fotosImped,
            checklistId: id,
          };
          // Grava só no Firestore `emergenciasRegistros`. O backend NestJS
          // de emergências usa ESSA MESMA coleção, então a tela da prefeitura
          // (emergenciasApi.listar) já enxerga este doc — não chamar
          // emergenciasApi.criar evita o ticket duplicado. E o addDoc carrega
          // idOperadorSession/funcionarioId (que o create do backend não seta),
          // necessários para a tela do operador.
          // Mesmo padrão do checklist: offline a promise só resolve com ack
          // do servidor, então não seguramos a UI — a mutação fica na fila
          // local do Firestore e sincroniza sozinha.
          const emergId = crypto.randomUUID();
          marcarPendente(emergId, "emergencia");
          const escritaEmerg = addDoc(collection(db, "emergenciasRegistros"), {
            id: emergId,
            ...emergPayload,
            idOperadorSession: session.idCliente,
            funcionarioId: session.funcionarioId ?? "",
            funcionarioCpf: session.cpf ?? "",
            idMaquina: equipamentoAtual.id,
            modelo: equipamentoAtual.label,
            operador: emergPayload.operadorNome,
            statusAtendimento: "ABERTO",
            qtdFotos: fotosImped.length,
            criadoEm: serverTimestamp(),
            dataHoraIso: dataHora,
          });
          escritaEmerg.then(
            () => removerPendente(emergId),
            (e) =>
              console.error(
                "[Checklist] Sincronização da emergência automática falhou:",
                e,
              ),
          );
          const ackEmerg = await esperarAckComTimeout(
            escritaEmerg,
            navigator.onLine,
            15_000,
          );
          setEmergTick((t) => t + 1);
          toast.warning(
            "🚨 Ticket de emergência criado — item impeditivo reprovado.",
          );
          // A emergência foi gravada direto no Firestore (não passou pelo
          // create do backend), então disparamos a notificação de WhatsApp à
          // parte. Best-effort: nunca atrapalha o checklist. Offline não tem
          // como notificar (sem rede); o ticket sincroniza junto com o resto.
          if (ackEmerg === "sincronizado") {
            try {
              await emergenciasApi.notificarWhatsApp({
                prefeituraId: prefeituraIdChecklist,
                severity: emergPayload.severity,
                chassis: emergPayload.chassis,
                idMaquina: equipamentoAtual.id,
                tipoFalha: emergPayload.tipoFalha,
                descricao: emergPayload.descricao,
                operadorNome: emergPayload.operadorNome,
                localizacaoGps: emergPayload.localizacaoGps,
                dataHoraIso: dataHora,
                fotos: fotosImped,
              });
            } catch (e) {
              console.warn("[Checklist] WhatsApp não disparado:", e);
            }
          }
        } catch (e) {
          console.error("[Checklist] Falha ao criar emergência automática:", e);
          toast.error(
            "Checklist salvo, mas falhou ao abrir o ticket de emergência.",
          );
        }
      }
    } catch (err) {
      console.error("[Checklist] Erro ao salvar no Firestore:", err);
      setCheckMsg(
        "⚠️ Salvo localmente, mas falhou no servidor. Verifique a conexão.",
      );
    } finally {
      setSalvandoChecklist(false);
    }

    setAba("dashboard");
    setPainelChecklistsHojeAberto(false);
    setPainelChecklistExpandidoId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setAnswers({});
    setNomeOperadorChecklist("");
    setHorimetro("");
    setFotoHorimetroDataUrl("");
    setAssinaturaDataUrl("");
    stopHorimetroCamera();
    stopItemNaoCamera();
    setObsChecklist("");
  }

  async function sincronizarRespostasPendentesWorkflow(
    checklistId: string,
    respostasFinais: typeof answers,
  ) {
    if (!equipamentoAtual || !nomeOperadorChecklist.trim()) return;
    const itensNao = itensFiltrados
      .map((item) => ({
        item,
        key: String(item["Nº"]),
        resposta: respostasFinais[String(item["Nº"])],
      }))
      .filter(
        (
          row,
        ): row is {
          item: ItemChecklist;
          key: string;
          resposta: { v: "nao"; foto: string; problema: string };
        } =>
          row.resposta?.v === "nao" && checklistRespostaCompleta(row.resposta),
      );
    if (itensNao.length === 0) return;

    const categoria =
      definicaoAtual?.categoria ??
      inferirCategoriaChecklist(
        equipamentoAtual.label,
        equipamentoAtual.modelo,
        `${equipamentoAtual.tipo} ${equipamentoAtual.linha}`,
      );
    // Sem rede (ou erro de rede) o workflow entra na fila local e é
    // reenviado quando a conexão volta (useWorkflowSync).
    const sincronizado = await enviarWorkflowComFila({
      checklistId,
      run: {
        prefeituraId: equipamentoAtual.prefeituraId || session?.idCliente || "",
        definitionId: definicaoAtual?.id ?? `seed:${categoria}`,
        definitionVersion: definicaoAtual?.version ?? 1,
        equipamentoId: equipamentoAtual.id,
        chassis: equipamentoAtual.chassis || chassisChecklistAtivo,
        operadorNome: nomeOperadorChecklist.trim(),
        categoria,
      },
      respostas: itensNao.map((row) => ({
        questionId: row.key,
        questionLabel: checklistItemTitulo(row.item),
        value: row.resposta,
        problemDescription: row.resposta.problema,
        photoUrls: row.resposta.foto ? [row.resposta.foto] : [],
      })),
    });
    if (sincronizado) setEmergTick((t) => t + 1);
  }

  async function handleEmergencia(e: FormEvent) {
    e.preventDefault();
    setEmergMsg("");
    if (!session) {
      setEmergMsg("Faça login para registrar emergência.");
      return;
    }
    const tipoResolvido = montarTipoFalhaParaRegistro(
      tipoFalhaCategoria,
      tipoFalhaOutros,
    );
    if (!tipoFalhaCategoria) {
      setEmergMsg("Selecione o tipo de falha na lista.");
      return;
    }
    if (tipoFalhaCategoria === "outros" && !tipoFalhaOutros.trim()) {
      setEmergMsg("Em «Outros», descreva qual é o tipo de falha.");
      return;
    }
    if (!tipoResolvido || !descEmerg.trim()) {
      setEmergMsg("Preencha tipo de falha e descrição.");
      return;
    }

    const fotosPreenchidas = fotosEmergencia.filter((u) =>
      u.startsWith("data:image"),
    );
    if (fotosPreenchidas.length === 0) {
      setEmergMsg("Tire ao menos 1 foto com a câmera do aparelho.");
      return;
    }

    const id = crypto.randomUUID();
    const dataHora = new Date().toISOString();
    const mid = session.idMaquina;

    const row = {
      ID_Emergencia: id,
      Data_Hora: dataHora,
      ID_Maquina: mid,
      Operador: session.nome,
      ID_Cliente: session.idCliente,
      Tipo_Falha: tipoResolvido,
      Descricao_Curta: descEmerg.trim(),
      Localizacao_GPS: gpsEmerg.trim() || null,
      Status_Atendimento: "Aberto",
      Foto_Evidencia: null,
      Fotos_Evidencia_JSON: JSON.stringify(
        fotosEmergencia.filter((u) => u.startsWith("data:image")),
      ),
      Qtd_Fotos_Evidencia: fotosEmergencia.filter((u) =>
        u.startsWith("data:image"),
      ).length,
    };

    // Salva localmente (fallback offline)
    const next = [row, ...emergRows];
    try {
      saveEmergencias(next);
    } catch {
      setEmergMsg(
        "Não foi possível salvar (armazenamento cheio ou bloqueado). Tente fechar outras abas ou reduzir o zoom na câmera e capture de novo.",
      );
      return;
    }
    setEmergRows(next);

    // Busca prefeituraId pelo chassi da máquina da sessão
    setSalvandoEmerg(true);
    try {
      let prefeituraId = "";
      if (maquinaDaSessao?.Chassis) {
        const chassisNorm = normalizeChassis(String(maquinaDaSessao.Chassis));
        let eqSnap = await getDocs(
          query(
            collection(db, "equipamentos"),
            where("chassis", "==", chassisNorm),
          ),
        );
        if (eqSnap.empty) {
          eqSnap = await getDocs(
            query(
              collection(db, "equipamentos"),
              where("chassis", "==", String(maquinaDaSessao.Chassis)),
            ),
          );
        }
        if (!eqSnap.empty) {
          prefeituraId = String(eqSnap.docs[0].data().prefeituraId ?? "");
        }
      }

      const fotos = fotosEmergencia.filter((u) => u.startsWith("data:image"));
      const payload = {
        prefeituraId: prefeituraId || session.idCliente,
        source: "manual" as const,
        severity: "critical" as const,
        equipamentoId: mid,
        chassis: String(session.chassis ?? maquinaDaSessao?.Chassis ?? ""),
        operadorNome: nomeOperadorEmerg.trim() || session.nome,
        tipoFalha: tipoResolvido,
        descricao: descEmerg.trim(),
        localizacaoGps: gpsEmerg.trim() || null,
        fotos,
      };
      try {
        await emergenciasApi.criar(payload);
        setEmergMsg("✅ Emergência registrada e enviada ao servidor.");
      } catch {
        // Backend indisponível/offline → grava no Firestore (fila offline do
        // SDK). Offline a escrita só confirma com o servidor, então NÃO a
        // aguardamos até o ack (senão "Salvando..." trava); marcamos pendente
        // e a confirmação remove o badge.
        marcarPendente(id, "emergencia");
        const escrita = addDoc(collection(db, "emergenciasRegistros"), {
          id,
          ...payload,
          idOperadorSession: session.idCliente,
          funcionarioId: session.funcionarioId ?? "",
          funcionarioCpf: session.cpf ?? "",
          idMaquina: mid,
          modelo: maquinaDaSessao
            ? `${String(maquinaDaSessao.Marca ?? "")} ${String(maquinaDaSessao.Modelo ?? "")}`.trim()
            : "",
          operador: payload.operadorNome,
          statusAtendimento: "ABERTO",
          qtdFotos: fotos.length,
          criadoEm: serverTimestamp(),
          dataHoraIso: dataHora,
        });
        escrita.then(
          () => removerPendente(id),
          (e) => console.error("[Emerg] Sincronização com o servidor falhou:", e),
        );
        const ack = await esperarAckComTimeout(escrita, navigator.onLine, 15_000);
        setEmergMsg(
          ack === "sincronizado"
            ? "✅ Emergência registrada e enviada ao servidor."
            : "📴 Sem internet: emergência salva no aparelho. Sincroniza sozinho quando a conexão voltar.",
        );
      }
      setEmergTick((t) => t + 1);
    } catch (err) {
      console.error("[Emerg] Erro ao salvar no Firestore:", err);
      setEmergMsg(
        "⚠️ Salvo localmente, mas falhou no servidor. Verifique a conexão.",
      );
    } finally {
      setSalvandoEmerg(false);
    }

    setNomeOperadorEmerg("");
    setTipoFalhaCategoria("");
    setTipoFalhaOutros("");
    setDescEmerg("");
    setGpsEmerg("");
    setGpsErro("");
    setFotosEmergencia([""]);
    stopEmergenciaCamera();
  }

  if (!session) {
    return (
      <div className="hu360-auth-screen">
        <div className="hu360-auth-card hu360-card hu360-form">
          <h3 style={{ marginTop: 0 }}>Entrar</h3>
          <p
            style={{
              margin: "0 0 12px",
              color: "var(--hu-muted)",
              fontSize: "0.9rem",
            }}
          ></p>
          <form onSubmit={handleLogin}>
            <label htmlFor="hu360-usuario">Usuário</label>
            <input
              id="hu360-usuario"
              autoComplete="username"
              value={usuario}
              onChange={(ev) => setUsuario(ev.target.value)}
              placeholder="jefferson"
            />
            <label htmlFor="hu360-senha">Senha</label>
            <input
              id="hu360-senha"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(ev) => setSenha(ev.target.value)}
            />
            <div style={{ marginTop: 16 }}>
              <button type="submit" className="hu360-btn">
                Entrar
              </button>
            </div>
            {loginMsg.text ? (
              <div
                className={`hu360-msg ${loginMsg.tone === "ok" ? "ok" : "err"}`}
              >
                {loginMsg.text}
              </div>
            ) : null}
          </form>
          <p style={{ marginTop: 20, marginBottom: 0 }}>
            <Link to="/" style={{ color: "var(--hu-accent)", fontWeight: 600 }}>
              ← Portal inicial
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="hu360-shell hu360-shell--split">
      <aside className="hu360-sidebar hu360-sidebar--brand">
        <div className="hu360-brand" aria-label="Hora Útil 360">
          <span className="hu360-brand__gear" aria-hidden>
            ⚙
          </span>
          <div className="hu360-brand__text">
            <span className="hu360-brand__line1">HORA</span>
            <span className="hu360-brand__line2">
              {" "}
              ÚTIL <em>360</em>
            </span>
          </div>
        </div>
        <nav className="hu360-nav" aria-label="Menu principal">
          {abasVisiveis.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`hu360-nav-btn ${aba === t.id ? "hu360-nav-btn--active" : ""}`}
              onClick={() => setAba(t.id)}
            >
              <span className="hu360-nav-btn__ico" aria-hidden>
                <Hu360NavIcon kind={t.icon} />
              </span>
              <span className="hu360-nav-btn__lab hu360-nav-btn__lab--full">
                {t.label}
              </span>
              <span className="hu360-nav-btn__lab hu360-nav-btn__lab--short">
                {t.shortLabel}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="hu360-main hu360-main--light">
        {pendentesSync > 0 && (
          <div className="hu360-sync-banner" role="status" aria-live="polite">
            <span className="hu360-sync-banner__dot" aria-hidden />
            {pendentesSync} registro{pendentesSync > 1 ? "s" : ""} aguardando
            sincronização — não apague o app.
          </div>
        )}
        <header className="hu360-app-head">
          <div className="hu360-app-head__bar">
            <div className="hu360-app-head__identity">
              <span className="hu360-app-head__avatar" aria-hidden>
                {iniciaisOperador(session.nome)}
              </span>
              <div className="hu360-app-head__who">
                <p className="hu360-app-head__name">{session.nome}</p>
                <p className="hu360-app-head__org">{session.empresa}</p>
                <p className="hu360-app-head__date-mobile">
                  {dataLongaPtBr(new Date())}
                </p>
              </div>
            </div>

            <div className="hu360-app-head__menu-wrap" ref={menuHeadRef}>
              <button
                type="button"
                className="hu360-app-head__menu-btn"
                aria-label="Menu da conta"
                aria-expanded={menuHeadAberto}
                aria-haspopup="menu"
                onClick={() => setMenuHeadAberto((v) => !v)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              </button>
              {menuHeadAberto ? (
                <div className="hu360-app-head__menu" role="menu">
                  <Link
                    to="/"
                    className="hu360-app-head__menu-item"
                    role="menuitem"
                    onClick={() => setMenuHeadAberto(false)}
                  >
                    Portal inicial
                  </Link>
                  <button
                    type="button"
                    className="hu360-app-head__menu-item hu360-app-head__menu-item--danger"
                    role="menuitem"
                    onClick={() => {
                      setMenuHeadAberto(false);
                      handleLogout();
                    }}
                  >
                    Sair
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {(pontoAtivo || pwaEstado !== "instalado") && (
            <div className="hu360-app-head__quick">
              {pontoAtivo ? (
                <Link
                  to="/ponto"
                  className="hu360-app-head__quick-btn hu360-app-head__quick-btn--ponto"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  Bater ponto
                </Link>
              ) : null}
              {pwaEstado !== "instalado" ? (
                <button
                  type="button"
                  className="hu360-app-head__quick-btn hu360-app-head__quick-btn--install"
                  onClick={() => void aoClicarInstalar()}
                  title="Instalar o app na tela de início"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M12 3v12" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M5 21h14" />
                  </svg>
                  Instalar app
                </button>
              ) : null}
            </div>
          )}

          <div className="hu360-app-head__meta">
            <p className="hu360-app-head__date">{dataLongaPtBr(new Date())}</p>
            <h1 className="hu360-app-head__title">
              {ABAS.find((x) => x.id === aba)?.label ?? "Painel"}
            </h1>
          </div>

          <div className="hu360-app-head__actions">
            <span className="hu360-app-head__user-desktop">
              {session.nome} · {session.empresa}
            </span>
            {pontoAtivo ? (
              <Link
                to="/ponto"
                className="hu360-app-head__chip hu360-app-head__chip--primary"
              >
                Bater ponto
              </Link>
            ) : null}
            <button
              type="button"
              className="hu360-app-head__chip hu360-app-head__chip--primary"
              onClick={() => void aoClicarInstalar()}
              disabled={pwaEstado === "instalado"}
              title={
                pwaEstado === "instalado"
                  ? "O app já está instalado neste dispositivo"
                  : "Instalar o app na tela de início"
              }
            >
              {pwaBotaoLabel}
            </button>
            <Link to="/" className="hu360-app-head__chip">
              Portal inicial
            </Link>
            <button
              type="button"
              className="hu360-app-head__chip hu360-app-head__chip--ghost"
              onClick={handleLogout}
            >
              Sair
            </button>
          </div>
        </header>

        {aba === "dashboard" ? (
          <section className="hu360-dash">
            <div className="hu360-dash-kpis">
              <button
                type="button"
                className="hu360-dash-card hu360-dash-card--clickable"
                title="Ver checklists concluídos hoje nesta máquina"
                onClick={() => {
                  setPainelChecklistsHojeAberto(true);
                  setPainelChecklistExpandidoId(null);
                }}
                aria-expanded={painelChecklistsHojeAberto}
              >
                <div
                  className="hu360-dash-card__icon hu360-dash-card__icon--orange"
                  aria-hidden
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                    <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
                    <path d="M9 12h6" />
                    <path d="M9 16h6" />
                  </svg>
                </div>
                <div className="hu360-dash-card__body">
                  <div className="hu360-dash-card__val">
                    {dashMetrics.checklistsHoje}
                  </div>
                  <div className="hu360-dash-card__lbl">Checklists Hoje</div>
                </div>
              </button>
              <article className="hu360-dash-card">
                <div
                  className="hu360-dash-card__icon hu360-dash-card__icon--green"
                  aria-hidden
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <div className="hu360-dash-card__body">
                  <div className="hu360-dash-card__val">
                    {dashMetrics.itensHoje}
                  </div>
                  <div className="hu360-dash-card__lbl">Itens Verificados</div>
                </div>
              </article>
              <article className="hu360-dash-card">
                <div
                  className="hu360-dash-card__icon hu360-dash-card__icon--red"
                  aria-hidden
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <path d="M12 9v4" />
                    <path d="M12 17h.01" />
                  </svg>
                </div>
                <div className="hu360-dash-card__body">
                  <div className="hu360-dash-card__val">
                    {dashMetrics.emAberto}
                  </div>
                  <div className="hu360-dash-card__lbl">
                    Emergências Abertas
                  </div>
                </div>
              </article>
              <article className="hu360-dash-card">
                <div
                  className="hu360-dash-card__icon hu360-dash-card__icon--orange"
                  aria-hidden
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <div className="hu360-dash-card__body">
                  <div className="hu360-dash-card__val">
                    {dashMetrics.aproveitamento}%
                  </div>
                  <div className="hu360-dash-card__lbl">Aproveitamento</div>
                </div>
              </article>
            </div>

            {painelChecklistsHojeAberto ? (
              <div className="hu360-card hu360-dash-checklists-panel">
                <div className="hu360-dash-checklists-panel__head">
                  <h3 className="hu360-dash-checklists-panel__title">
                    Checklists concluídos hoje
                  </h3>
                  <button
                    type="button"
                    className="hu360-btn hu360-btn-ghost"
                    style={{ width: "auto", padding: "8px 14px" }}
                    onClick={() => {
                      setPainelChecklistsHojeAberto(false);
                      setPainelChecklistExpandidoId(null);
                    }}
                  >
                    Fechar
                  </button>
                </div>
                {carregandoChecklistsHoje ? (
                  <p
                    style={{
                      color: "var(--hu-muted)",
                      margin: 0,
                      fontSize: "0.92rem",
                    }}
                  >
                    Carregando...
                  </p>
                ) : (
                  <ListaChecklistHistoricoLocal
                    rows={checklistsHojeFiltrados}
                    expandidoId={painelChecklistExpandidoId}
                    setExpandidoId={setPainelChecklistExpandidoId}
                    mensagemVazia="Nenhum checklist registrado hoje."
                  />
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        {aba === "checklist" ? (
          <section className="hu360-page">
            <p className="hu360-page__lead">
              O checklist só abre após validar o{" "}
              <strong>número do chassi</strong> cadastrado na frota. Ele deve
              ser o da máquina vinculada à sua locação.
            </p>

            <div className="hu360-card hu360-form">
              <label htmlFor="hu360-chassis">Chassi da máquina</label>
              <div style={{ position: "relative" }}>
                <input
                  id="hu360-chassis"
                  autoComplete="off"
                  value={chassisChecklistDraft}
                  onChange={(ev) => {
                    setChassisChecklistDraft(ev.target.value);
                    setMostrarSugestoesChassi(true);
                  }}
                  onFocus={() => setMostrarSugestoesChassi(true)}
                  onBlur={() =>
                    window.setTimeout(
                      () => setMostrarSugestoesChassi(false),
                      150,
                    )
                  }
                  placeholder="Chassi completo ou os últimos dígitos"
                />
                {mostrarSugestoesChassi &&
                !chassisChecklistAtivo &&
                sugestoesChassi.length > 0 ? (
                  <ul
                    style={{
                      position: "absolute",
                      zIndex: 20,
                      left: 0,
                      right: 0,
                      top: "calc(100% + 4px)",
                      margin: 0,
                      padding: 4,
                      listStyle: "none",
                      background: "#fff",
                      border: "1px solid #d8dce6",
                      borderRadius: 10,
                      boxShadow: "0 8px 24px rgba(20,30,60,0.12)",
                      maxHeight: 280,
                      overflowY: "auto",
                    }}
                  >
                    {sugestoesChassi.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            abrirParaEquip(e);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "9px 12px",
                            borderRadius: 8,
                            border: "none",
                            background: "transparent",
                            color: "#1f2a44",
                            cursor: "pointer",
                          }}
                        >
                          <strong>{e.chassis}</strong>
                          {e.label ? ` · ${e.label}` : ""}
                          {e.tipo ? ` · ${e.tipo}` : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="hu360-btn"
                  onClick={handleAbrirListaPorChassi}
                  disabled={buscandoChassis}
                >
                  {buscandoChassis
                    ? "Buscando..."
                    : "Abrir lista de verificação"}
                </button>
              </div>

              {candidatosChassi.length > 0 ? (
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {candidatosChassi.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => abrirParaEquip(e)}
                      style={{
                        textAlign: "left",
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #d8dce6",
                        background: "#f7f8fb",
                        color: "#1f2a44",
                        cursor: "pointer",
                      }}
                    >
                      <strong>{e.chassis}</strong>
                      {e.label ? ` · ${e.label}` : ""}
                      {e.tipo ? ` · ${e.tipo}` : ""}
                    </button>
                  ))}
                </div>
              ) : null}

              {!chassisChecklistAtivo ? (
                <p
                  style={{
                    color: "var(--hu-muted)",
                    marginTop: 14,
                    marginBottom: 0,
                  }}
                >
                  Nenhum checklist carregado. Informe o chassi e confirme acima.
                </p>
              ) : null}

              {chassisChecklistAtivo && equipamentoAtual ? (
                <p
                  className="hu360-chassis-resumo"
                  style={{
                    marginTop: 14,
                    fontSize: "0.88rem",
                    color: "var(--hu-muted)",
                  }}
                >
                  <strong>{equipamentoAtual.label}</strong> ·{" "}
                  {equipamentoAtual.linha} · Chassi{" "}
                  <strong>{equipamentoAtual.chassis}</strong>
                </p>
              ) : null}

              {!equipamentoAtual && chassisChecklistAtivo ? (
                <p style={{ color: "#f87171", marginTop: 12 }}>
                  Não foi possível resolver o equipamento para o chassi
                  confirmado.
                </p>
              ) : null}

              {equipamentoAtual && itensFiltrados.length === 0 ? (
                <p style={{ color: "#f87171", marginTop: 12 }}>
                  Sem itens de checklist para a categoria &quot;
                  {inferirCategoriaChecklist(
                    equipamentoAtual.label,
                    equipamentoAtual.modelo,
                    `${equipamentoAtual.tipo} ${equipamentoAtual.linha}`,
                  )}
                  &quot; na planilha.
                </p>
              ) : null}

              {equipamentoAtual ? (
                <form
                  onSubmit={handleSalvarChecklist}
                  style={{ marginTop: 16 }}
                >
                  <label htmlFor="hu360-nome-operador-chk">
                    Nome <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    id="hu360-nome-operador-chk"
                    autoComplete="name"
                    required
                    readOnly
                    value={nomeOperadorChecklist}
                    aria-describedby="hu360-nome-operador-chk-hint"
                    placeholder="Operador da sessão"
                  />
                  <p
                    id="hu360-nome-operador-chk-hint"
                    style={{
                      margin: "4px 0 0",
                      fontSize: "0.8rem",
                      color: "#64748b",
                    }}
                  >
                    Operador vinculado ao login. Para trocar, encerre a sessão e
                    entre com outro usuário.
                  </p>

                  <label htmlFor="hu360-horimetro">
                    Horímetro <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    id="hu360-horimetro"
                    inputMode="decimal"
                    required
                    value={horimetro}
                    onChange={(ev) => setHorimetro(ev.target.value)}
                    placeholder="Leitura atual do horímetro"
                  />

                  <div className="hu360-foto-horimetro-block">
                    <span
                      id="hu360-foto-horimetro-title"
                      className="hu360-inline-label"
                    >
                      Foto do horímetro{" "}
                      <span style={{ color: "#dc2626" }}>*</span>
                    </span>
                    <p
                      style={{
                        margin: "6px 0 10px",
                        fontSize: "0.84rem",
                        color: "#64748b",
                      }}
                    >
                      A foto precisa ser tirada na hora com a câmera do
                      aparelho; não é possível enviar imagem da galeria.
                    </p>
                    {!fotoHorimetroDataUrl && horimetroCameraUi ? (
                      <div className="hu360-horimetro-camera-wrap">
                        <video
                          ref={horimetroVideoRef}
                          className="hu360-horimetro-camera"
                          autoPlay
                          playsInline
                          muted
                        />
                        <div className="hu360-horimetro-camera-actions">
                          <button
                            type="button"
                            className="hu360-btn"
                            style={{ width: "auto", padding: "10px 18px" }}
                            onClick={capturarFotoHorimetroAoVivo}
                          >
                            Capturar foto
                          </button>
                          <button
                            type="button"
                            className="hu360-btn hu360-btn-ghost"
                            style={{ width: "auto", padding: "10px 18px" }}
                            onClick={stopHorimetroCamera}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {!fotoHorimetroDataUrl && !horimetroCameraUi ? (
                      <button
                        type="button"
                        className="hu360-btn"
                        style={{
                          width: "auto",
                          marginTop: 4,
                          padding: "10px 18px",
                        }}
                        onClick={abrirCameraHorimetro}
                      >
                        Abrir câmera e fotografar horímetro
                      </button>
                    ) : null}
                    {fotoHorimetroDataUrl ? (
                      <div className="hu360-foto-preview">
                        <img
                          src={fotoHorimetroDataUrl}
                          alt="Foto capturada do horímetro"
                        />
                        <button
                          type="button"
                          className="hu360-btn hu360-btn-ghost"
                          style={{
                            width: "auto",
                            marginTop: 8,
                            padding: "6px 12px",
                          }}
                          onClick={() => {
                            setFotoHorimetroDataUrl("");
                            setCheckMsg("");
                            stopHorimetroCamera();
                          }}
                        >
                          Remover e tirar outra foto
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="hu360-assinatura-block">
                    <span className="hu360-inline-label">
                      Assinatura do operador{" "}
                      <span style={{ color: "#dc2626" }}>*</span>
                    </span>
                    <p className="hu360-assinatura-hint">
                      Assine com o dedo ou mouse no quadro abaixo.
                    </p>
                    <canvas
                      ref={assinaturaCanvasRef}
                      className="hu360-assinatura-canvas"
                      width={520}
                      height={180}
                      onPointerDown={handleAssinaturaPointerDown}
                      onPointerMove={handleAssinaturaPointerMove}
                      onPointerUp={handleAssinaturaPointerUp}
                      onPointerLeave={handleAssinaturaPointerUp}
                    />
                    <div className="hu360-assinatura-actions">
                      <button
                        type="button"
                        className="hu360-btn hu360-btn-ghost"
                        style={{ width: "auto", padding: "8px 14px" }}
                        onClick={limparAssinatura}
                      >
                        Limpar assinatura
                      </button>
                    </div>
                  </div>

                  {checklistItensLiberados &&
                  (!horimetro.trim() || !fotoHorimetroDataUrl) ? (
                    <p
                      className="hu360-checklist-bloqueio"
                      style={{
                        marginTop: 14,
                        padding: 12,
                        borderRadius: 10,
                        background: "#fff7ed",
                        border: "1px solid #fed7aa",
                        color: "#9a3412",
                        fontSize: "0.88rem",
                      }}
                    >
                      Preencha o <strong>horímetro</strong> e use a{" "}
                      <strong>câmera</strong> para fotografar o horímetro antes
                      de salvar.
                    </p>
                  ) : null}

                  <div
                    className={
                      checklistItensLiberados
                        ? ""
                        : "hu360-checklist-itens--bloqueado"
                    }
                    style={{ marginTop: 18 }}
                  >
                    {itensFiltrados.map((it, idx) => {
                      const key = String(it["Nº"]);
                      const cur = answers[key];
                      const bloq = !checklistItensLiberados;
                      const isSim = cur?.v === "sim";
                      const isNao = cur?.v === "nao";
                      const isNa = cur?.v === "na";
                      const impeditivo = itemImpeditivo(it);
                      const categoria =
                        (it as { "Categoria Origem"?: string })[
                          "Categoria Origem"
                        ] ??
                        (it as { Categoria?: string }).Categoria ??
                        "";
                      // Destaca em vermelho quando impeditivo foi marcado "Não".
                      const alertaImped = impeditivo && isNao;
                      return (
                        <div
                          key={key}
                          className={`hu360-check-block ${alertaImped ? "is-imped-violado" : ""}`}
                        >
                          <div className="hu360-check-row">
                            <span className="hu360-check-num">{idx + 1}</span>
                            <div style={{ flex: "1 1 220px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                <span>{it["Item de Verificação"]}</span>
                                {impeditivo && (
                                  <span
                                    className="hu360-imped-chip"
                                    title="Item impeditivo — não pode operar com este item marcado como Não"
                                  >
                                    IMPEDITIVO
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "var(--hu-muted)",
                                  marginTop: 2,
                                }}
                              >
                                {categoria || (it as { Tipo?: string }).Tipo}
                              </div>
                            </div>
                            <div className="hu360-toggle-group">
                              <button
                                type="button"
                                className={isSim ? "active-sim" : ""}
                                disabled={bloq}
                                onClick={() => setAnswer(key, "sim")}
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                className={isNao ? "active-nao" : ""}
                                disabled={bloq}
                                onClick={() => setAnswer(key, "nao")}
                              >
                                Não
                              </button>
                              <button
                                type="button"
                                className={isNa ? "active-na" : ""}
                                disabled={bloq}
                                onClick={() => setAnswer(key, "na")}
                              >
                                N/A
                              </button>
                            </div>
                          </div>
                          {isNao && !bloq ? (
                            <div className="hu360-nao-problema">
                              <p className="hu360-nao-problema__lead">
                                Este item está como <strong>Não</strong>.
                                Registre evidência e o problema.
                              </p>
                              <span className="hu360-nao-problema__lbl">
                                Foto do problema{" "}
                                <span style={{ color: "#dc2626" }}>*</span> (na
                                hora)
                              </span>
                              <p className="hu360-nao-problema__hint">
                                Só câmera ao vivo, como no horímetro.
                              </p>
                              {itemNaoCameraKey === key ? (
                                <div className="hu360-horimetro-camera-wrap">
                                  <video
                                    ref={itemNaoVideoRef}
                                    className="hu360-horimetro-camera"
                                    autoPlay
                                    playsInline
                                    muted
                                  />
                                  <div className="hu360-horimetro-camera-actions">
                                    <button
                                      type="button"
                                      className="hu360-btn"
                                      style={{
                                        width: "auto",
                                        padding: "10px 18px",
                                      }}
                                      onClick={capturarFotoItemNao}
                                    >
                                      Capturar foto
                                    </button>
                                    <button
                                      type="button"
                                      className="hu360-btn hu360-btn-ghost"
                                      style={{
                                        width: "auto",
                                        padding: "10px 18px",
                                      }}
                                      onClick={stopItemNaoCamera}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                              {isNao && cur.foto ? (
                                <div className="hu360-foto-preview">
                                  <img src={cur.foto} alt="" />
                                  <button
                                    type="button"
                                    className="hu360-btn hu360-btn-ghost"
                                    style={{
                                      width: "auto",
                                      marginTop: 8,
                                      padding: "6px 12px",
                                    }}
                                    onClick={() => {
                                      setAnswers((prev) => {
                                        const c = prev[key];
                                        if (!c || c.v !== "nao") return prev;
                                        return {
                                          ...prev,
                                          [key]: { ...c, foto: "" },
                                        };
                                      });
                                      setCheckMsg("");
                                    }}
                                  >
                                    Remover foto
                                  </button>
                                </div>
                              ) : null}
                              {isNao &&
                              !cur.foto &&
                              itemNaoCameraKey !== key ? (
                                <button
                                  type="button"
                                  className="hu360-btn"
                                  style={{
                                    width: "auto",
                                    padding: "10px 18px",
                                  }}
                                  onClick={() => abrirCameraItemNao(key)}
                                >
                                  Abrir câmera — foto do problema
                                </button>
                              ) : null}
                              <label
                                className="hu360-nao-problema__lbl"
                                htmlFor={`hu360-nao-txt-${key}`}
                              >
                                Descreva o problema{" "}
                                <span style={{ color: "#dc2626" }}>*</span>
                              </label>
                              <textarea
                                id={`hu360-nao-txt-${key}`}
                                className="hu360-nao-problema__textarea"
                                rows={3}
                                value={cur.problema}
                                onChange={(ev) => {
                                  const t = ev.target.value;
                                  setAnswers((prev) => {
                                    const c = prev[key];
                                    if (!c || c.v !== "nao") return prev;
                                    return {
                                      ...prev,
                                      [key]: { ...c, problema: t },
                                    };
                                  });
                                }}
                                placeholder="O que foi encontrado neste item?"
                              />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <label htmlFor="hu360-obs-chk">Observações</label>
                  <textarea
                    id="hu360-obs-chk"
                    value={obsChecklist}
                    onChange={(ev) => setObsChecklist(ev.target.value)}
                    placeholder="Irregularidades, fluidos, etc."
                  />

                  <div style={{ marginTop: 16 }}>
                    <button
                      type="submit"
                      className="hu360-btn"
                      disabled={salvandoChecklist}
                    >
                      {salvandoChecklist ? "Salvando..." : "Salvar checklist"}
                    </button>
                  </div>
                </form>
              ) : null}

              {checkMsg ? (
                <div
                  className={`hu360-msg ${
                    checkMsg.includes("registrado") ||
                    checkMsg.includes("Lista de verificação aberta")
                      ? "ok"
                      : "err"
                  }`}
                  style={{ marginTop: 14 }}
                >
                  {checkMsg}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {aba === "auditoria" ? (
          <section className="hu360-page">
            <p className="hu360-page__lead">
              Histórico completo de checklists salvos no servidor para a sua
              sessão. Use os filtros para localizar registros específicos.
            </p>
            <div className="hu360-card" style={{ marginBottom: 16 }}>
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
                    htmlFor="audit-filtro-data"
                    style={{
                      display: "block",
                      marginBottom: 4,
                      fontSize: "0.82rem",
                      color: "var(--hu-muted)",
                    }}
                  >
                    Data
                  </label>
                  <input
                    id="audit-filtro-data"
                    type="date"
                    value={auditoriaFiltroData}
                    onChange={(e) => setAuditoriaFiltroData(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="audit-filtro-chassis"
                    style={{
                      display: "block",
                      marginBottom: 4,
                      fontSize: "0.82rem",
                      color: "var(--hu-muted)",
                    }}
                  >
                    Chassi
                  </label>
                  <input
                    id="audit-filtro-chassis"
                    type="text"
                    placeholder="Filtrar por chassi..."
                    value={auditoriaFiltroChassis}
                    onChange={(e) => setAuditoriaFiltroChassis(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="audit-filtro-operador"
                    style={{
                      display: "block",
                      marginBottom: 4,
                      fontSize: "0.82rem",
                      color: "var(--hu-muted)",
                    }}
                  >
                    Operador
                  </label>
                  <input
                    id="audit-filtro-operador"
                    type="text"
                    placeholder="Filtrar por operador..."
                    value={auditoriaFiltroOperador}
                    onChange={(e) => setAuditoriaFiltroOperador(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, paddingBottom: 1 }}>
                  <button
                    type="button"
                    className="hu360-btn"
                    style={{ flex: 1 }}
                    disabled={carregandoAuditoria}
                    onClick={() => setAuditoriaTick((t) => t + 1)}
                  >
                    {carregandoAuditoria ? "Carregando..." : "Atualizar"}
                  </button>
                  {(auditoriaFiltroData ||
                    auditoriaFiltroChassis ||
                    auditoriaFiltroOperador) && (
                    <button
                      type="button"
                      className="hu360-btn hu360-btn-ghost"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setAuditoriaFiltroData("");
                        setAuditoriaFiltroChassis("");
                        setAuditoriaFiltroOperador("");
                      }}
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="hu360-card hu360-dash-checklists-panel">
              <div className="hu360-dash-checklists-panel__head">
                <h3 className="hu360-dash-checklists-panel__title">
                  {carregandoAuditoria
                    ? "Carregando..."
                    : `${checklistsAuditoriaFiltrados.length} registro${
                        checklistsAuditoriaFiltrados.length !== 1 ? "s" : ""
                      }${auditoriaFiltroData || auditoriaFiltroChassis || auditoriaFiltroOperador ? " (filtrado)" : ""}`}
                </h3>
              </div>
              {carregandoAuditoria ? (
                <p
                  style={{
                    margin: 0,
                    color: "var(--hu-muted)",
                    fontSize: "0.92rem",
                  }}
                >
                  Buscando registros no servidor...
                </p>
              ) : (
                <ListaChecklistHistoricoLocal
                  rows={checklistsAuditoriaFiltrados}
                  expandidoId={auditoriaChecklistExpandidoId}
                  setExpandidoId={setAuditoriaChecklistExpandidoId}
                  mensagemVazia="Nenhum checklist encontrado para os filtros aplicados."
                />
              )}
            </div>
          </section>
        ) : null}

        {aba === "emergencia" ? (
          <section className="hu360-page">
            <p className="hu360-page__lead">
              Registro local conforme a planilha{" "}
              <strong>LOG_EMERGENCIAS</strong>.
            </p>

            <div className="hu360-card hu360-form">
              <form onSubmit={handleEmergencia}>
                <div className="hu360-emerg-maquina-readonly">
                  <label>Máquina (sua locação)</label>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: "0.95rem",
                      color: "#334155",
                    }}
                  >
                    {session ? (
                      <>
                        <strong> ID: {session?.idMaquina}</strong>{" "}
                        <strong>
                          {String(maquinaDaSessao?.Categoria ?? "")}
                        </strong>
                        <br />
                        <span style={{ fontSize: "0.9rem", color: "#334155" }}>
                          {maquinaDaSessao?.Modelo}
                        </span>
                        <br />
                        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                          <strong>Chassi: </strong>
                          <strong>{String(session?.chassis ?? "—")}</strong>
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>

                <label htmlFor="hu360-nome-operador-emerg">Nome</label>
                <input
                  id="hu360-nome-operador-emerg"
                  value={nomeOperadorEmerg}
                  onChange={(ev) => setNomeOperadorEmerg(ev.target.value)}
                  placeholder="Nome de quem está reportando"
                  autoComplete="off"
                />

                <label htmlFor="hu360-tipo-falha">Tipo de falha</label>
                <select
                  id="hu360-tipo-falha"
                  value={tipoFalhaCategoria}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    setTipoFalhaCategoria(v);
                    if (v !== "outros") setTipoFalhaOutros("");
                  }}
                >
                  <option value="">Selecione…</option>
                  {TIPOS_FALHA_EMERGENCIA.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {tipoFalhaCategoria === "outros" ? (
                  <>
                    <label htmlFor="hu360-tipo-falha-outros">
                      Especifique o tipo (outros)
                    </label>
                    <input
                      id="hu360-tipo-falha-outros"
                      value={tipoFalhaOutros}
                      onChange={(ev) => setTipoFalhaOutros(ev.target.value)}
                      placeholder="Descreva qual é a falha"
                      autoComplete="off"
                    />
                  </>
                ) : null}

                <label>Descrição curta</label>
                <textarea
                  value={descEmerg}
                  onChange={(ev) => setDescEmerg(ev.target.value)}
                  placeholder="O que aconteceu e contexto imediato."
                />

                <label htmlFor="hu360-gps-emerg">
                  Localização (GPS)
                  {gpsLoading && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: "0.8rem",
                        color: "#64748b",
                      }}
                    >
                      ⏳ Obtendo localização…
                    </span>
                  )}
                </label>
                <input
                  id="hu360-gps-emerg"
                  value={gpsEmerg}
                  onChange={(ev) => setGpsEmerg(ev.target.value)}
                  placeholder="-20.xxxxxx, -54.xxxxxx"
                  readOnly={gpsLoading}
                />
                {gpsErro && (
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "0.82rem",
                      color: "#dc2626",
                    }}
                  >
                    {gpsErro}
                  </p>
                )}
                {!gpsLoading && (
                  <button
                    type="button"
                    className="hu360-btn hu360-btn-ghost"
                    style={{
                      marginTop: 6,
                      width: "auto",
                      padding: "6px 14px",
                      fontSize: "0.82rem",
                    }}
                    onClick={() => {
                      if (!navigator.geolocation) return;
                      setGpsLoading(true);
                      setGpsErro("");
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          const { latitude, longitude, accuracy } = pos.coords;
                          setGpsEmerg(
                            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                          );
                          setGpsLoading(false);
                          if (accuracy > 100)
                            setGpsErro(
                              `Precisão baixa (±${Math.round(accuracy)} m). Você pode corrigir.`,
                            );
                          else setGpsErro("");
                        },
                        (err) => {
                          setGpsLoading(false);
                          setGpsErro(
                            err.code === err.PERMISSION_DENIED
                              ? "Permissão negada. Preencha manualmente."
                              : "Erro ao obter localização.",
                          );
                        },
                        {
                          enableHighAccuracy: true,
                          timeout: 10000,
                          maximumAge: 0,
                        },
                      );
                    }}
                  >
                    📍 Atualizar localização
                  </button>
                )}

                <div className="hu360-inline-label" style={{ marginTop: 16 }}>
                  Fotos da emergência{" "}
                  <span style={{ color: "#dc2626" }}>*</span> (mínimo 1, máximo{" "}
                  {EMERG_NUM_FOTOS})
                </div>
                <p
                  style={{
                    margin: "6px 0 12px",
                    fontSize: "0.84rem",
                    color: "#64748b",
                  }}
                >
                  Tire ao menos 1 foto com a câmera do aparelho, ao vivo (sem
                  galeria). Você pode adicionar até {EMERG_NUM_FOTOS} fotos.
                </p>

                <div className="hu360-emerg-fotos-grid">
                  {fotosEmergencia.map((src, i) => (
                    <div key={i} className="hu360-emerg-foto-slot">
                      <span className="hu360-emerg-foto-slot__n">
                        Foto {i + 1}
                      </span>
                      {src ? (
                        <img
                          src={src}
                          alt=""
                          className="hu360-emerg-foto-slot__thumb"
                        />
                      ) : (
                        <div className="hu360-emerg-foto-slot__ph" aria-hidden>
                          —
                        </div>
                      )}
                      <div className="hu360-emerg-foto-slot__acts">
                        <button
                          type="button"
                          className="hu360-btn"
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            fontSize: "0.85rem",
                          }}
                          onClick={() => abrirCameraEmergencia(i)}
                        >
                          {src ? "Refazer" : "Tirar foto"}
                        </button>
                        {fotosEmergencia.length > 1 ? (
                          <button
                            type="button"
                            className="hu360-btn hu360-btn-ghost"
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              fontSize: "0.85rem",
                            }}
                            onClick={() =>
                              setFotosEmergencia((prev) =>
                                prev.filter((_, idx) => idx !== i),
                              )
                            }
                          >
                            Remover
                          </button>
                        ) : src ? (
                          <button
                            type="button"
                            className="hu360-btn hu360-btn-ghost"
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              fontSize: "0.85rem",
                            }}
                            onClick={() => setFotosEmergencia([""])}
                          >
                            Remover
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {fotosEmergencia.length < EMERG_NUM_FOTOS ? (
                  <button
                    type="button"
                    className="hu360-btn"
                    style={{
                      marginTop: 12,
                      width: "auto",
                      padding: "8px 20px",
                      background: "var(--hu-orange, #f97316)",
                      color: "#fff",
                      border: "none",
                    }}
                    onClick={() => setFotosEmergencia((prev) => [...prev, ""])}
                  >
                    + Adicionar outra foto
                  </button>
                ) : null}

                {emergCameraSlot !== null ? (
                  <div className="hu360-emerg-camera-panel">
                    <p
                      style={{
                        margin: "14px 0 8px",
                        fontWeight: 600,
                        color: "#334155",
                      }}
                    >
                      Câmera — foto {emergCameraSlot + 1} de{" "}
                      {fotosEmergencia.length}
                    </p>
                    <video
                      ref={emergVideoRef}
                      className="hu360-horimetro-camera"
                      autoPlay
                      playsInline
                      muted
                    />
                    <div className="hu360-horimetro-camera-actions">
                      <button
                        type="button"
                        className="hu360-btn"
                        style={{ width: "auto", padding: "10px 18px" }}
                        onClick={capturarFotoEmergenciaAoVivo}
                      >
                        Capturar
                      </button>
                      <button
                        type="button"
                        className="hu360-btn hu360-btn-ghost"
                        style={{ width: "auto", padding: "10px 18px" }}
                        onClick={stopEmergenciaCamera}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="hu360-btn hu360-btn-danger"
                  disabled={salvandoEmerg}
                >
                  {salvandoEmerg ? "Enviando..." : "Acionar emergência"}
                </button>
                {emergMsg ? (
                  <div
                    className={`hu360-msg ${emergMsg.includes("Emergência registrada") ? "ok" : "err"}`}
                  >
                    {emergMsg}
                  </div>
                ) : null}
              </form>
            </div>

            <div className="hu360-card">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0 }}>
                  {carregandoEmerg
                    ? "Carregando..."
                    : `${emergFirestoreRows.length} registro${
                        emergFirestoreRows.length !== 1 ? "s" : ""
                      } no servidor`}
                </h3>
                <button
                  type="button"
                  className="hu360-btn"
                  style={{ width: "auto", padding: "8px 14px" }}
                  disabled={carregandoEmerg}
                  onClick={() => setEmergTick((t) => t + 1)}
                >
                  {carregandoEmerg ? "Carregando..." : "Atualizar"}
                </button>
              </div>
              <div className="hu360-table-wrap hu360-table-wrap--light">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Chassi</th>
                      <th>Operador</th>
                      <th>Tipo</th>
                      <th>Fotos</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emergFirestoreRows.slice(0, 15).map((row, idx) => (
                      <tr key={String(row.id ?? row._docId ?? idx)}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {String(row.dataHoraIso ?? row.Data_Hora ?? "")
                            .slice(0, 19)
                            .replace("T", " ")}
                        </td>
                        <td>{String(row.chassis ?? row.ID_Maquina ?? "")}</td>
                        <td>{String(row.operador ?? row.Operador ?? "")}</td>
                        <td>{String(row.tipoFalha ?? row.Tipo_Falha ?? "")}</td>
                        <td>
                          {Number(row.qtdFotos ?? row.Qtd_Fotos_Evidencia ?? 0)}
                        </td>
                        <td>
                          {String(
                            row.statusAtendimento ??
                              row.Status_Atendimento ??
                              "",
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!carregandoEmerg && emergFirestoreRows.length === 0 ? (
                <p style={{ color: "var(--hu-muted)", margin: "12px 0 0" }}>
                  Nenhuma emergência encontrada no servidor.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {aba === "pontos" ? (
          <section className="hu360-page">
            <p className="hu360-page__lead">
              Folha de ponto do dia — entrada, almoço, volta e saída. Cada
              batida registra uma selfie; o horário pode ser corrigido.
            </p>
            <PontosFolha
              prefeituraId={session.idCliente}
              nomePadrao={session.nome}
            />
          </section>
        ) : null}
      </main>

      <Dialog open={pwaInstrucoesAberto} onOpenChange={setPwaInstrucoesAberto}>
        <DialogContent>
          <DialogTitle>Como instalar o app</DialogTitle>
          <DialogDescription asChild>
            {pwaEstado === "manual-ios" ? (
              <div>
                <p>No Safari do iPhone/iPad:</p>
                <ol
                  style={{ paddingLeft: 20, margin: "8px 0", lineHeight: 1.6 }}
                >
                  <li>
                    Toque no botão <strong>Compartilhar</strong> (□↑) na barra
                    inferior.
                  </li>
                  <li>
                    Role e toque em <strong>Adicionar à Tela de Início</strong>.
                  </li>
                  <li>
                    Toque em <strong>Adicionar</strong>. O app vai aparecer como
                    ícone na tela inicial.
                  </li>
                </ol>
              </div>
            ) : (
              <div>
                <p>
                  Abra o menu do navegador (⋮ ou ⋯) e procure por uma das
                  opções:
                </p>
                <ul
                  style={{ paddingLeft: 20, margin: "8px 0", lineHeight: 1.6 }}
                >
                  <li>
                    <strong>Instalar app</strong>
                  </li>
                  <li>
                    <strong>Adicionar à tela inicial</strong>
                  </li>
                  <li>
                    <strong>Criar atalho</strong>
                  </li>
                </ul>
                <p style={{ marginTop: 12, fontSize: "0.85rem", opacity: 0.8 }}>
                  Se nenhuma opção aparecer, abra o site em outro navegador
                  (Chrome/Edge) ou aguarde — o sistema sugere quando a
                  instalação ficar disponível.
                </p>
              </div>
            )}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
}
