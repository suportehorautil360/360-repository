import {
  type FormEvent,
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
} from "@firebase/firestore";
import { ListaChecklistHistoricoLocal } from "../../components/checklistHistorico/ChecklistHistoricoLista";
import { db } from "../../lib/firebase/firebase";
import seedData from "../../data/hu360OperadorSeed.json";
import "./checklist-controle.css";
import { type OperadorSession, useOperadorSession } from "./useOperadorSession";

type Aba =
  | "dashboard"
  | "checklist"
  | "auditoria"
  | "emergencia"
  | "treinamentos";

type ItemChecklist = (typeof seedData.itens_checklist)[number];

/** Resposta por item: «Não» exige foto ao vivo + descrição do problema. */
type ChecklistAnswerValue =
  | { v: "sim" }
  | { v: "nao"; foto: string; problema: string };

function checklistRespostaCompleta(
  a: ChecklistAnswerValue | undefined,
): boolean {
  if (!a) return false;
  if (a.v === "sim") return true;
  return Boolean(a.foto.startsWith("data:image") && a.problema.trim());
}

/** Equipamento retornado do Firestore na busca por chassi. */
type EquipFirestore = {
  id: string;
  prefeituraId: string;
  label: string;
  chassis: string;
  modelo: string;
  linha: string;
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

const MAX_JPEG_DATA_URL_LEN_EMERG = 2_800_000;

function jpegDataUrlFromVideoEmergencia(
  video: HTMLVideoElement,
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
  let dataUrl = canvas.toDataURL("image/jpeg", 0.74);
  if (dataUrl.length > MAX_JPEG_DATA_URL_LEN_EMERG) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.58);
  }
  if (dataUrl.length > MAX_JPEG_DATA_URL_LEN_EMERG) return null;
  return dataUrl;
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

function checklistCategoriaFromMaquina(catMaquina: string): string {
  if (catMaquina.startsWith("Caminhão")) return "Caminhões";
  return catMaquina;
}

/**
 * Infere a categoria do checklist a partir do label/modelo do equipamento do Firestore,
 * pois o campo `linha` guarda a linha de produto (ex: "Linha Amarela"), não o tipo de máquina.
 */
function inferirCategoriaChecklist(label: string, modelo: string): string {
  const s = `${label} ${modelo}`.toLowerCase();
  if (s.includes("motoniveladora")) return "Motoniveladora";
  if (s.includes("escavadeira")) return "Escavadeira";
  if (
    s.includes("trator de esteira") ||
    (s.includes("trator") && s.includes("esteira"))
  )
    return "Trator de Esteira";
  if (s.includes("caminhão") || s.includes("caminhao")) return "Caminhões";
  if (s.includes("retroescavadeira") || s.includes("retroescavadeira"))
    return "Retroescavadeira";
  if (
    s.includes("pa carregadeira") ||
    s.includes("pá carregadeira") ||
    s.includes("carregadeira")
  )
    return "Pá Carregadeira";
  if (s.includes("rolo compactador") || s.includes("compactador"))
    return "Rolo Compactador";
  if (s.includes("trator")) return "Trator";
  // fallback: tenta pelo campo linha (caso seja o próprio nome da categoria)
  return label || modelo;
}

type FrotaRow = (typeof seedData.cadastro_frota)[number];

function normalizeChassis(s: string): string {
  return s.replace(/\s+/g, "").toUpperCase();
}

function normalizeModelo(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

type TreinoVideoRow = (typeof seedData.treinamentos_video)[number];

type TreinoVideoExtra = TreinoVideoRow & {
  Maquinas?: unknown;
  Chassis_Lista?: unknown;
  Modelos_Lista?: unknown;
  Chassis?: unknown;
  Modelo?: unknown;
};

function parChassisModeloIgualMaquina(
  maquina: FrotaRow,
  chassis: string,
  modelo: string,
): boolean {
  return (
    normalizeChassis(String(maquina.Chassis ?? "")) ===
      normalizeChassis(chassis) &&
    normalizeModelo(String(maquina.Modelo ?? "")) === normalizeModelo(modelo)
  );
}

function paresImplicitosFrotaPorCategoriaTreino(
  categoriaTreino: string,
): { ch: string; mod: string }[] {
  return seedData.cadastro_frota
    .filter(
      (m) => checklistCategoriaFromMaquina(m.Categoria) === categoriaTreino,
    )
    .map((m) => ({
      ch: normalizeChassis(String(m.Chassis ?? "")),
      mod: normalizeModelo(String(m.Modelo ?? "")),
    }))
    .filter((p) => p.ch.length > 0 && p.mod.length > 0);
}

/**
 * Vídeo vale para a máquina da sessão por combinação chassi + modelo:
 * - `Maquinas`: [{ Chassis, Modelo }, ...] — bate se algum par for igual ao da máquina.
 * - `Chassis` + `Modelo` no mesmo registro — um par fixo.
 * - `Chassis_Lista` + `Modelos_Lista` — chassi da máquina na lista E modelo na lista.
 * - Só listas parciais — regra da lista preenchida.
 * - Só `Categoria` (sem listas/pares no JSON) — qualquer equipamento da frota com essa categoria
 *   de checklist (mesmo par chassi+modelo cadastrado).
 */
function treinoAplicaAMaquina(t: TreinoVideoRow, maquina: FrotaRow): boolean {
  const ext = t as TreinoVideoExtra;

  const maquinas = ext.Maquinas;
  if (Array.isArray(maquinas) && maquinas.length > 0) {
    return maquinas.some((row) => {
      if (!row || typeof row !== "object") return false;
      const o = row as Record<string, unknown>;
      const c = String(o.Chassis ?? "");
      const m = String(o.Modelo ?? "");
      if (!c.trim() || !m.trim()) return false;
      return parChassisModeloIgualMaquina(maquina, c, m);
    });
  }

  const sc = typeof ext.Chassis === "string" ? ext.Chassis : "";
  const sm = typeof ext.Modelo === "string" ? ext.Modelo : "";
  if (sc.trim() && sm.trim()) {
    return parChassisModeloIgualMaquina(maquina, sc, sm);
  }

  const cl = ext.Chassis_Lista;
  const ml = ext.Modelos_Lista;
  const hasCl = Array.isArray(cl) && cl.length > 0;
  const hasMl = Array.isArray(ml) && ml.length > 0;
  if (hasCl && hasMl) {
    const chOk = cl.some(
      (c) =>
        normalizeChassis(String(c)) ===
        normalizeChassis(String(maquina.Chassis ?? "")),
    );
    const moOk = ml.some(
      (m) =>
        normalizeModelo(String(m)) ===
        normalizeModelo(String(maquina.Modelo ?? "")),
    );
    return chOk && moOk;
  }
  if (hasCl && !hasMl) {
    return cl.some(
      (c) =>
        normalizeChassis(String(c)) ===
        normalizeChassis(String(maquina.Chassis ?? "")),
    );
  }
  if (!hasCl && hasMl) {
    return ml.some(
      (m) =>
        normalizeModelo(String(m)) ===
        normalizeModelo(String(maquina.Modelo ?? "")),
    );
  }

  const catT = String(t.Categoria ?? "");
  if (!catT) return false;
  return paresImplicitosFrotaPorCategoriaTreino(catT).some(
    (p) =>
      normalizeChassis(String(maquina.Chassis ?? "")) === p.ch &&
      normalizeModelo(String(maquina.Modelo ?? "")) === p.mod,
  );
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
  localStorage.setItem(EMERG_STORAGE_KEY, JSON.stringify(rows));
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
  localStorage.setItem(CHECKLIST_HIST_KEY, JSON.stringify(rows));
}

const ABAS: {
  id: Aba;
  label: string;
  icon: "dash" | "check" | "audit" | "alert" | "play";
}[] = [
  { id: "dashboard", label: "Dashboard", icon: "dash" },
  { id: "checklist", label: "Checklist", icon: "check" },
  { id: "auditoria", label: "Auditoria de checklists", icon: "audit" },
  { id: "emergencia", label: "Emergências", icon: "alert" },
  { id: "treinamentos", label: "Treinamentos", icon: "play" },
];

function startOfLocalDayIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameLocalDay(iso: string, dayStamp: string): boolean {
  if (!iso) return false;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return false;
  return startOfLocalDayIso(t) === dayStamp;
}

function dataLongaPtBr(d: Date): string {
  const raw = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

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
        total += 1;
        if (val === "sim") {
          sim += 1;
        } else if (val && typeof val === "object" && "v" in val) {
          const vv = (val as { v?: string }).v;
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
    Status_Ok_Nao: `${data.totalSim ?? 0}/${data.totalItens ?? 0} OK`,
    Respostas_JSON: respostasJson,
    Horimetro_Final: data.horimetro ?? "",
    Pontuacao: data.pontuacao ?? 0,
    ID_Cliente: data.idOperadorSession ?? "",
    prefeituraId: data.prefeituraId ?? "",
    Obs: data.obs ?? null,
  };
}

function Hu360NavIcon({
  kind,
}: {
  kind: "dash" | "check" | "audit" | "alert" | "play";
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
      <circle cx="12" cy="12" r="10" />
      <polygon
        points="10 8 16 12 10 16 10 8"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function ChecklistControlePage() {
  const { session, setSession } = useOperadorSession();
  const [aba, setAba] = useState<Aba>("dashboard");

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

  const [chassisChecklistDraft, setChassisChecklistDraft] = useState("");
  const [chassisChecklistAtivo, setChassisChecklistAtivo] = useState("");
  const [equipamentoAtual, setEquipamentoAtual] =
    useState<EquipFirestore | null>(null);
  const [buscandoChassis, setBuscandoChassis] = useState(false);
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
  const [descEmerg, setDescEmerg] = useState("");
  const [gpsEmerg, setGpsEmerg] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsErro, setGpsErro] = useState("");
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

  const horimetroVideoRef = useRef<HTMLVideoElement>(null);
  const horimetroStreamRef = useRef<MediaStream | null>(null);
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
    const maxSide = 1280;
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
    let dataUrl = canvas.toDataURL("image/jpeg", 0.86);
    if (dataUrl.length > 3_400_000) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.65);
    }
    if (dataUrl.length > 3_400_000) {
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
    const dataUrl = v ? jpegDataUrlFromVideoEmergencia(v) : null;
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
    const dataUrl = v ? jpegDataUrlFromVideoEmergencia(v) : null;
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
        const rows = snap.docs.map((d) =>
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
        const rows: Record<string, unknown>[] = snap.docs.map((d) => ({
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
    if (m?.Chassis != null) setChassisChecklistDraft(String(m.Chassis));
  }, [session?.idMaquina]);

  useEffect(() => {
    if (!chassisChecklistAtivo) return;
    if (normalizeChassis(chassisChecklistDraft) !== chassisChecklistAtivo) {
      setChassisChecklistAtivo("");
      setEquipamentoAtual(null);
      setAnswers({});
      setNomeOperadorChecklist("");
      setHorimetro("");
      setFotoHorimetroDataUrl("");
      stopHorimetroCamera();
      stopItemNaoCamera();
    }
  }, [
    chassisChecklistDraft,
    chassisChecklistAtivo,
    stopHorimetroCamera,
    stopItemNaoCamera,
  ]);

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

  const treinamentosDaLocacao = useMemo(() => {
    if (!maquinaDaSessao) return [];
    return seedData.treinamentos_video.filter((t) =>
      treinoAplicaAMaquina(t, maquinaDaSessao),
    );
  }, [maquinaDaSessao]);

  console.log("Treinamentos da locação:", session);

  const itensFiltrados: ItemChecklist[] = useMemo(() => {
    if (!equipamentoAtual) return [];
    const cat = inferirCategoriaChecklist(
      equipamentoAtual.label,
      equipamentoAtual.modelo,
    );
    return seedData.itens_checklist.filter((it) => it.Categoria === cat);
  }, [equipamentoAtual]);

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
    setChassisChecklistDraft(m0?.Chassis != null ? String(m0.Chassis) : "");
    setChassisChecklistAtivo("");
    setAnswers({});
    setNomeOperadorChecklist("");
    setHorimetro("");
    setFotoHorimetroDataUrl("");
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
    stopHorimetroCamera();
    stopItemNaoCamera();
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

  async function handleAbrirListaPorChassi() {
    setCheckMsg("");
    const normalizado = normalizeChassis(chassisChecklistDraft);
    if (!normalizado) {
      setCheckMsg("Informe o chassi antes de abrir a lista.");
      return;
    }
    setBuscandoChassis(true);
    try {
      // Tenta normalizado (maiúsculas, sem espaços) e, como fallback, o valor exato digitado
      let snap = await getDocs(
        query(
          collection(db, "equipamentos"),
          where("chassis", "==", normalizado),
        ),
      );
      if (snap.empty) {
        snap = await getDocs(
          query(
            collection(db, "equipamentos"),
            where("chassis", "==", chassisChecklistDraft.trim()),
          ),
        );
      }
      if (snap.empty) {
        setCheckMsg("Chassi não encontrado no cadastro de equipamentos.");
        setChassisChecklistAtivo("");
        setEquipamentoAtual(null);
        return;
      }
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      const equip: EquipFirestore = {
        id: docSnap.id,
        prefeituraId: String(data.prefeituraId ?? ""),
        label: String(data.label ?? data.descricao ?? ""),
        chassis: String(data.chassis ?? ""),
        modelo: String(data.modelo ?? ""),
        linha: String(data.linha ?? ""),
      };
      setEquipamentoAtual(equip);
      setChassisChecklistAtivo(normalizado);
      setAnswers({});
      setNomeOperadorChecklist(session?.nome ?? "");
      setHorimetro("");
      setFotoHorimetroDataUrl("");
      stopHorimetroCamera();
      stopItemNaoCamera();
      setCheckMsg("Lista de verificação aberta para este chassi.");
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
    (numKey: string, v: "sim" | "nao") => {
      if (v === "sim") {
        if (itemNaoCameraKey === numKey) stopItemNaoCamera();
        setAnswers((prev) => ({ ...prev, [numKey]: { v: "sim" } }));
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
          `Responda Sim/Não em todos os itens (pendente: ${incompleto}).`,
        );
      }
      return;
    }

    const numSim = keys.filter((k) => answers[k]?.v === "sim").length;
    const pontos = numSim * 2;
    const itensNao = itensFiltrados
      .filter((it) => answers[String(it["Nº"])]?.v === "nao")
      .map((it) => {
        const num = String(it["Nº"]);
        const titulo = it.Tipo
          ? `${it.Tipo}: ${it["Item de Verificação"]}`
          : String(it["Item de Verificação"]);
        return {
          numero: num,
          titulo,
          //@ts-ignore
          problema: answers[num]?.problema ?? "",
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
      Categoria: inferirCategoriaChecklist(
        equipamentoAtual.label,
        equipamentoAtual.modelo,
      ),
      Modelo: equipamentoAtual.label,
      Linha: equipamentoAtual.linha,
      Item_Verificado: `Checklist ${itensFiltrados.length} itens`,
      Status_Ok_Nao: `${numSim}/${keys.length} OK`,
      Respostas_JSON: JSON.stringify(answers),
      Horimetro_Final: horimetro.trim(),
      Foto_Horimetro: fotoHorimetroDataUrl,
      Obs: obsChecklist || null,
      Pontuacao: pontos,
      ID_Cliente: session.idCliente,
    };

    // Salva no histórico local (para auditoria offline)
    const hist = loadChecklistHistory();
    hist.unshift(reg);
    saveChecklistHistory(hist);

    // Salva no Firestore
    setSalvandoChecklist(true);
    try {
      await addDoc(collection(db, "checklistsRegistros"), {
        id,
        prefeituraId: equipamentoAtual.prefeituraId,
        equipamentoId: equipamentoAtual.id,
        chassis: equipamentoAtual.chassis || chassisChecklistAtivo,
        modelo: equipamentoAtual.label,
        linha: equipamentoAtual.linha,
        categoria: inferirCategoriaChecklist(
          equipamentoAtual.label,
          equipamentoAtual.modelo,
        ),
        operador: nomeOperadorChecklist.trim(),
        idOperadorSession: session.idCliente,
        horimetro: horimetro.trim(),
        fotoHorimetro: fotoHorimetroDataUrl,
        totalItens: keys.length,
        totalSim: numSim,
        totalNao: keys.length - numSim,
        itensNao,
        pontuacao: pontos,
        respostas: answers,
        obs: obsChecklist || null,
        criadoEm: serverTimestamp(),
        dataHoraIso: dataHora,
      });
      setCheckMsg("✅ Checklist salvo com sucesso!");
      setChecklistsHojeTick((t) => t + 1);
      setAuditoriaTick((t) => t + 1);
    } catch (err) {
      console.error("[Checklist] Erro ao salvar no Firestore:", err);
      setCheckMsg(
        "⚠️ Salvo localmente, mas falhou no servidor. Verifique a conexão.",
      );
    } finally {
      setSalvandoChecklist(false);
    }

    setAnswers({});
    setNomeOperadorChecklist("");
    setHorimetro("");
    setFotoHorimetroDataUrl("");
    stopHorimetroCamera();
    stopItemNaoCamera();
    setObsChecklist("");
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

      await addDoc(collection(db, "emergenciasRegistros"), {
        id,
        prefeituraId,
        idOperadorSession: session.idCliente,
        idMaquina: mid,
        chassis: maquinaDaSessao ? String(maquinaDaSessao.Chassis ?? "") : "",
        modelo: maquinaDaSessao
          ? `${String(maquinaDaSessao.Marca ?? "")} ${String(maquinaDaSessao.Modelo ?? "")}`.trim()
          : "",
        operador: session.nome,
        tipoFalha: tipoResolvido,
        descricao: descEmerg.trim(),
        localizacaoGps: gpsEmerg.trim() || null,
        statusAtendimento: "aberto",
        fotos: fotosEmergencia.filter((u) => u.startsWith("data:image")),
        qtdFotos: fotosEmergencia.filter((u) => u.startsWith("data:image"))
          .length,
        criadoEm: serverTimestamp(),
        dataHoraIso: dataHora,
      });
      setEmergMsg("✅ Emergência registrada e enviada ao servidor.");
      setEmergTick((t) => t + 1);
    } catch (err) {
      console.error("[Emerg] Erro ao salvar no Firestore:", err);
      setEmergMsg(
        "⚠️ Salvo localmente, mas falhou no servidor. Verifique a conexão.",
      );
    } finally {
      setSalvandoEmerg(false);
    }

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
          {ABAS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`hu360-nav-btn ${aba === t.id ? "hu360-nav-btn--active" : ""}`}
              onClick={() => setAba(t.id)}
            >
              <span className="hu360-nav-btn__ico" aria-hidden>
                <Hu360NavIcon kind={t.icon} />
              </span>
              <span className="hu360-nav-btn__lab">{t.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="hu360-main hu360-main--light">
        <header className="hu360-app-head">
          <div className="hu360-app-head__titles">
            <p className="hu360-app-head__date">{dataLongaPtBr(new Date())}</p>
            <h1 className="hu360-app-head__title">
              {ABAS.find((x) => x.id === aba)?.label ?? "Painel"}
            </h1>
          </div>
          <div className="hu360-app-head__actions">
            <Link to="/" className="hu360-app-head__link">
              Portal inicial
            </Link>
            <span className="hu360-app-head__user">
              {session.nome} · {session.empresa}
            </span>
            <button
              type="button"
              className="hu360-app-head__sair"
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
              <input
                id="hu360-chassis"
                autoComplete="off"
                value={chassisChecklistDraft}
                onChange={(ev) => setChassisChecklistDraft(ev.target.value)}
                placeholder="Digite o chassi (conforme cadastro)"
              />
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
                    Nome do operador <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    id="hu360-nome-operador-chk"
                    autoComplete="name"
                    required
                    value={nomeOperadorChecklist}
                    onChange={(ev) => setNomeOperadorChecklist(ev.target.value)}
                    placeholder="Nome completo de quem está fazendo a verificação"
                  />

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
                    {itensFiltrados.map((it) => {
                      const key = String(it["Nº"]);
                      const cur = answers[key];
                      const bloq = !checklistItensLiberados;
                      const isSim = cur?.v === "sim";
                      const isNao = cur?.v === "nao";
                      return (
                        <div key={key} className="hu360-check-block">
                          <div className="hu360-check-row">
                            <span className="hu360-check-num">{key}</span>
                            <div style={{ flex: "1 1 220px" }}>
                              {it["Item de Verificação"]}
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "var(--hu-muted)",
                                }}
                              >
                                {it.Tipo}
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
                          <strong>Nome:</strong> {session?.nome}{" "}
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

        {aba === "treinamentos" ? (
          <section className="hu360-page">
            <p className="hu360-page__lead">
              Vídeos da planilha <strong>TREINAMENTOS_VIDEO</strong>{" "}
              <strong>da máquina da sua locação</strong>
              {maquinaDaSessao ? (
                <>
                  : <strong>{maquinaDaSessao.ID}</strong>, chassi{" "}
                  <strong>{String(maquinaDaSessao.Chassis ?? "—")}</strong>,
                  modelo{" "}
                  <strong>{String(maquinaDaSessao.Modelo ?? "—")}</strong>
                </>
              ) : (
                " (vínculo de máquina não encontrado)"
              )}
              . O filtro usa <strong>chassi e modelo</strong> ao mesmo tempo. No
              cadastro do vídeo dá para informar pares (chassi + modelo), listas
              de chassis e de modelos, ou só a categoria — neste último caso,
              aparecem vídeos da categoria para a qual sua máquina (chassi e
              modelo) está cadastrada na frota.
            </p>
            {treinamentosDaLocacao.length === 0 ? (
              <p
                style={{
                  color: "#64748b",
                  fontSize: "0.95rem",
                  marginBottom: 16,
                }}
              >
                Nenhum vídeo cadastrado para este chassi e modelo.
              </p>
            ) : null}
            <div className="hu360-train-grid">
              {treinamentosDaLocacao.map((t) => (
                <article key={t.ID_Treino} className="hu360-train-card">
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--hu-accent)",
                      fontWeight: 700,
                    }}
                  >
                    {t.ID_Treino} · {t.Categoria}
                  </div>
                  <h3 style={{ margin: "8px 0 10px", fontSize: "1.05rem" }}>
                    {t.Titulo_Video_IA}
                  </h3>
                  <p
                    style={{
                      margin: "0 0 10px",
                      fontSize: "0.88rem",
                      color: "var(--hu-muted)",
                    }}
                  >
                    {t.Descricao_CapCut}
                  </p>
                  <a href={t.Link_Video_URL} target="_blank" rel="noreferrer">
                    Abrir vídeo
                  </a>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
