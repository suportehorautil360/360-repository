import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, Navigate } from "react-router-dom";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "@firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import seedData from "../../data/hu360OperadorSeed.json";
import "./checklist-controle.css";
import { useOperadorSession } from "./useOperadorSession";

type Aba = "dashboard" | "checklist" | "emergencia" | "treinamentos";

type ItemChecklist = (typeof seedData.itens_checklist)[number];

interface MaquinaChecklistInfo {
  ID: string;
  Marca: string;
  Modelo: string;
  Chassis: string;
  Categoria: string;
}

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

function contarFotosEmergenciaRow(row: Record<string, unknown>): number {
  const j = row.Fotos_Evidencia_JSON;
  if (typeof j === "string" && j.length > 0) {
    try {
      const a = JSON.parse(j) as unknown;
      if (Array.isArray(a)) {
        return a.filter(
          (x) => typeof x === "string" && x.startsWith("data:image"),
        ).length;
      }
    } catch {
      /* ignore */
    }
  }
  if (
    typeof row.Foto_Evidencia === "string" &&
    String(row.Foto_Evidencia).trim().length > 0
  ) {
    return 1;
  }
  return 0;
}

/**
 * Comprime uma data URL de imagem para armazenamento no Firestore.
 * Reduz para max 480px e qualidade 0.45, produzindo ~40-100 KB por foto.
 */
function compressPhotoForFirestore(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl.startsWith("data:image")) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const maxSide = 480;
      let w = img.width;
      let h = img.height;
      if (Math.max(w, h) > maxSide) {
        const r = maxSide / Math.max(w, h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.45));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function checklistCategoriaFromMaquina(catMaquina: string): string {
  if (catMaquina.startsWith("Caminhão")) return "Caminhões";
  return catMaquina;
}

type FrotaRow = (typeof seedData.cadastro_frota)[number];

function normalizeChassis(s: string): string {
  return s.replace(/\s+/g, "").toUpperCase();
}

function normalizeModelo(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function findMaquinaPorChassis(raw: string): FrotaRow | null {
  const n = normalizeChassis(raw);
  if (!n) return null;
  return (
    seedData.cadastro_frota.find(
      (m) => normalizeChassis(String(m.Chassis ?? "")) === n,
    ) ?? null
  );
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

function genId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 10)}`;
}

const ABAS: {
  id: Aba;
  label: string;
  icon: "dash" | "check" | "alert" | "play";
}[] = [
  { id: "dashboard", label: "Dashboard", icon: "dash" },
  { id: "checklist", label: "Checklist", icon: "check" },
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
      const o = JSON.parse(raw) as Record<string, string>;
      const entries = Object.values(o);
      const total = entries.length;
      const sim = entries.filter((v) => v === "sim").length;
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

function Hu360NavIcon({ kind }: { kind: "dash" | "check" | "alert" | "play" }) {
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

  const [chassisChecklistDraft, setChassisChecklistDraft] = useState("");
  const [chassisChecklistAtivo, setChassisChecklistAtivo] = useState("");
  const [answers, setAnswers] = useState<Record<string, "sim" | "nao">>({});
  const [horimetro, setHorimetro] = useState("");
  const [fotoHorimetroDataUrl, setFotoHorimetroDataUrl] = useState("");
  const [horimetroCameraUi, setHorimetroCameraUi] = useState(false);
  const [obsChecklist, setObsChecklist] = useState("");
  const [checkMsg, setCheckMsg] = useState("");
  const [maquinaAtual, setMaquinaAtual] = useState<MaquinaChecklistInfo | null>(
    null,
  );
  const [loadingChassis, setLoadingChassis] = useState(false);

  const [tipoFalhaCategoria, setTipoFalhaCategoria] = useState("");
  const [tipoFalhaOutros, setTipoFalhaOutros] = useState("");
  const [descEmerg, setDescEmerg] = useState("");
  const [gpsEmerg, setGpsEmerg] = useState("");
  const [fotosEmergencia, setFotosEmergencia] = useState<string[]>(() =>
    Array.from({ length: EMERG_NUM_FOTOS }, () => ""),
  );
  const [emergCameraSlot, setEmergCameraSlot] = useState<number | null>(null);
  const [emergMsg, setEmergMsg] = useState("");
  const [emergSaving, setEmergSaving] = useState(false);
  const [emergRows, setEmergRows] = useState<Record<string, unknown>[]>(() =>
    loadEmergencias(),
  );
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "loading" | "granted" | "denied" | "unavailable"
  >("idle");
  const [geoCoords, setGeoCoords] = useState("");

  const horimetroVideoRef = useRef<HTMLVideoElement>(null);
  const horimetroStreamRef = useRef<MediaStream | null>(null);
  const emergVideoRef = useRef<HTMLVideoElement>(null);
  const emergStreamRef = useRef<MediaStream | null>(null);

  const stopHorimetroCamera = useCallback(() => {
    horimetroStreamRef.current?.getTracks().forEach((t) => t.stop());
    horimetroStreamRef.current = null;
    const v = horimetroVideoRef.current;
    if (v) v.srcObject = null;
    setHorimetroCameraUi(false);
  }, []);

  const abrirCameraHorimetro = useCallback(async () => {
    setCheckMsg("");
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
  }, [stopHorimetroCamera]);

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
    [stopEmergenciaCamera],
  );

  const requestGeo = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus("unavailable");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        setGeoCoords(`${lat}, ${lon}`);
        setGeoStatus("granted");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus("denied");
        } else {
          setGeoStatus("unavailable");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const loadEmergenciasFromFirestore = useCallback(async () => {
    if (!session?.idCliente) return;
    try {
      const q = query(
        collection(db, "emergencias"),
        where("prefeituraId", "==", session.idCliente),
        orderBy("dataHora", "desc"),
        limit(30),
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => {
        const data = d.data();
        const fotos: string[] = Array.isArray(data.fotos) ? data.fotos : [];
        return {
          ID_Emergencia: d.id,
          Data_Hora:
            data.dataHora?.toDate?.()?.toISOString() ??
            new Date().toISOString(),
          ID_Maquina: String(data.idMaquina ?? ""),
          Chassis: String(data.chassis ?? ""),
          Operador: String(data.operador ?? ""),
          ID_Cliente: String(data.prefeituraId ?? ""),
          Tipo_Falha: String(data.tipoFalha ?? ""),
          Descricao_Curta: String(data.descricaoCurta ?? ""),
          Localizacao_GPS: data.localizacaoGps ?? null,
          Status_Atendimento: String(data.statusAtendimento ?? "Aberto"),
          Fotos_Evidencia_JSON: JSON.stringify(fotos),
          Qtd_Fotos_Evidencia: fotos.length,
        } as Record<string, unknown>;
      });
      if (rows.length > 0) setEmergRows(rows);
    } catch {
      /* mantém dados do localStorage em caso de erro */
    }
  }, [session?.idCliente]);

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

  const dashMetrics = useMemo(() => {
    const today = startOfLocalDayIso(new Date());
    const hist = loadChecklistHistory();
    let checklistsHoje = 0;
    let itensHoje = 0;
    let simHoje = 0;
    for (const row of hist) {
      const dh = String(row.Data_Hora ?? "");
      if (!isSameLocalDay(dh, today)) continue;
      checklistsHoje += 1;
      const { total, sim } = parseRespostasChecklist(row);
      itensHoje += total;
      simHoje += sim;
    }
    const emAberto = emergRows.filter(
      (r) =>
        String(r.Status_Atendimento ?? "").toLowerCase() === "aberto" &&
        (!session?.idCliente ||
          String(r.ID_Cliente ?? "") === session.idCliente),
    ).length;
    const aproveitamento =
      itensHoje > 0 ? Math.round((simHoje / itensHoje) * 100) : 0;
    return { checklistsHoje, itensHoje, emAberto, aproveitamento };
  }, [emergRows, checkMsg, session?.idCliente]);

  useEffect(() => {
    document.body.classList.add("hu360-root");
    return () => {
      document.body.classList.remove("hu360-root");
    };
  }, []);

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
    return () => {
      horimetroStreamRef.current?.getTracks().forEach((t) => t.stop());
      horimetroStreamRef.current = null;
      emergStreamRef.current?.getTracks().forEach((t) => t.stop());
      emergStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    requestGeo();
  }, [requestGeo]);

  useEffect(() => {
    void loadEmergenciasFromFirestore();
  }, [loadEmergenciasFromFirestore]);

  useEffect(() => {
    if (aba === "emergencia") void loadEmergenciasFromFirestore();
  }, [aba, loadEmergenciasFromFirestore]);

  useEffect(() => {
    if (geoCoords) setGpsEmerg(geoCoords);
  }, [geoCoords]);

  useEffect(() => {
    if (aba !== "checklist") stopHorimetroCamera();
    if (aba !== "emergencia") stopEmergenciaCamera();
  }, [aba, stopHorimetroCamera, stopEmergenciaCamera]);

  useEffect(() => {
    if (!session?.idMaquina) return;
    const m = seedData.cadastro_frota.find((x) => x.ID === session.idMaquina);
    if (m?.Chassis != null) setChassisChecklistDraft(String(m.Chassis));
  }, [session?.idMaquina]);

  useEffect(() => {
    if (!chassisChecklistAtivo) return;
    if (normalizeChassis(chassisChecklistDraft) !== chassisChecklistAtivo) {
      setChassisChecklistAtivo("");
      setMaquinaAtual(null);
      setAnswers({});
      setHorimetro("");
      setFotoHorimetroDataUrl("");
      stopHorimetroCamera();
    }
  }, [chassisChecklistDraft, chassisChecklistAtivo, stopHorimetroCamera]);

  const checklistItensLiberados = useMemo(
    () => Boolean(chassisChecklistAtivo && maquinaAtual),
    [chassisChecklistAtivo, maquinaAtual],
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

  const itensFiltrados: ItemChecklist[] = useMemo(() => {
    if (!maquinaAtual) return [];
    const cat = checklistCategoriaFromMaquina(maquinaAtual.Categoria);
    return seedData.itens_checklist.filter((it) => it.Categoria === cat);
  }, [maquinaAtual]);

  function handleLogout() {
    setSession(null);
    setAnswers({});
    setChassisChecklistDraft("");
    setChassisChecklistAtivo("");
    setMaquinaAtual(null);
    setHorimetro("");
    setFotoHorimetroDataUrl("");
    stopHorimetroCamera();
    setTipoFalhaCategoria("");
    setTipoFalhaOutros("");
    setDescEmerg("");
    setGpsEmerg("");
    setFotosEmergencia(Array.from({ length: EMERG_NUM_FOTOS }, () => ""));
    stopEmergenciaCamera();
    setAba("dashboard");
  }

  async function handleAbrirListaPorChassi() {
    setCheckMsg("");
    const chassisTrimmed = chassisChecklistDraft.trim();
    if (!chassisTrimmed) {
      setCheckMsg("Informe o chassi.");
      return;
    }
    setLoadingChassis(true);
    try {
      const q = query(
        collection(db, "equipamentos"),
        where("chassis", "==", chassisTrimmed),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setCheckMsg("Chassi não encontrado no cadastro de equipamentos.");
        setChassisChecklistAtivo("");
        setMaquinaAtual(null);
        return;
      }
      const docSnap = snap.docs[0];
      const data = docSnap.data();
      if (session && docSnap.id !== session.idMaquina) {
        setCheckMsg(
          "Este chassi não corresponde à máquina da sua locação. Use o chassi do equipamento vinculado ao seu acesso.",
        );
        setChassisChecklistAtivo("");
        setMaquinaAtual(null);
        return;
      }
      // Tenta obter a categoria do seed (para filtrar itens do checklist)
      const seedRow = findMaquinaPorChassis(chassisTrimmed);
      const categoria =
        seedRow?.Categoria ?? String(data.linha ?? data.descricao ?? "");
      const maquina: MaquinaChecklistInfo = {
        ID: docSnap.id,
        Marca: String(data.marca ?? ""),
        Modelo: String(data.modelo ?? ""),
        Chassis: chassisTrimmed,
        Categoria: categoria,
      };
      setMaquinaAtual(maquina);
      setChassisChecklistAtivo(normalizeChassis(chassisTrimmed));
      setAnswers({});
      setHorimetro("");
      setFotoHorimetroDataUrl("");
      stopHorimetroCamera();
      setCheckMsg("Lista de verificação aberta para este chassi.");
    } catch {
      setCheckMsg("Erro ao consultar o banco de dados. Tente novamente.");
      setMaquinaAtual(null);
    } finally {
      setLoadingChassis(false);
    }
  }

  const setAnswer = useCallback(
    (numKey: string, v: "sim" | "nao") => {
      setAnswers((prev) => ({ ...prev, [numKey]: v }));
    },
    [],
  );

  function handleSalvarChecklist(e: FormEvent) {
    e.preventDefault();
    setCheckMsg("");
    if (!session) {
      setCheckMsg("Faça login para registrar o checklist.");
      return;
    }
    if (!maquinaAtual) {
      setCheckMsg(
        "Informe o chassi e clique em «Abrir lista de verificação» para carregar o checklist.",
      );
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
    const falta = keys.filter((k) => answers[k] == null);
    if (falta.length > 0) {
      setCheckMsg(
        `Responda Sim/Não em todos os itens (${falta.length} pendente(s)).`,
      );
      return;
    }

    const numSim = keys.filter((k) => answers[k] === "sim").length;
    const pontos = numSim * 2;

    const reg = {
      ID_Registro: genId("CHK"),
      Data_Hora: new Date().toISOString(),
      Operador: session.nome,
      Chassis: String(maquinaAtual.Chassis ?? chassisChecklistAtivo),
      ID_Maquina: maquinaAtual.ID,
      Categoria: maquinaAtual.Categoria,
      Marca: maquinaAtual.Marca,
      Modelo: maquinaAtual.Modelo,
      Item_Verificado: `Checklist ${itensFiltrados.length} itens`,
      Status_Ok_Nao: `${numSim}/${keys.length} OK`,
      Respostas_JSON: JSON.stringify(answers),
      Horimetro_Final: horimetro.trim(),
      Foto_Horimetro: fotoHorimetroDataUrl,
      Obs: obsChecklist || null,
      Pontuacao: pontos,
      ID_Cliente: session.idCliente,
    };

    const hist = loadChecklistHistory();
    hist.unshift(reg);
    saveChecklistHistory(hist);
    setCheckMsg("Checklist registrado localmente (demonstração).");
    setAnswers({});
    setHorimetro("");
    setFotoHorimetroDataUrl("");
    stopHorimetroCamera();
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

    const faltaFotoIdx = fotosEmergencia.findIndex(
      (u) => !u || !u.startsWith("data:image"),
    );
    if (faltaFotoIdx !== -1) {
      setEmergMsg(
        `Tire as ${EMERG_NUM_FOTOS} fotos na hora com a câmera (falta a foto ${faltaFotoIdx + 1}).`,
      );
      return;
    }

    setEmergSaving(true);
    try {
      // Comprime cada foto para caber dentro do limite do Firestore
      const fotosComprimidas = await Promise.all(
        fotosEmergencia.map(compressPhotoForFirestore),
      );

      const chassis =
        session.chassis ?? maquinaAtual?.Chassis ?? "";
      const dataHoraLocal = new Date().toISOString();

      const docData = {
        prefeituraId: session.idCliente,
        dataHora: serverTimestamp(),
        chassis,
        idMaquina: session.idMaquina,
        operador: session.nome,
        tipoFalha: tipoResolvido,
        descricaoCurta: descEmerg.trim(),
        localizacaoGps: gpsEmerg.trim() || null,
        statusAtendimento: "Aberto",
        fotos: fotosComprimidas,
        qtdFotos: fotosComprimidas.length,
      };

      const docRef = await addDoc(collection(db, "emergencias"), docData);

      const row: Record<string, unknown> = {
        ID_Emergencia: docRef.id,
        Data_Hora: dataHoraLocal,
        ID_Maquina: session.idMaquina,
        Chassis: chassis,
        Operador: session.nome,
        ID_Cliente: session.idCliente,
        Tipo_Falha: tipoResolvido,
        Descricao_Curta: descEmerg.trim(),
        Localizacao_GPS: gpsEmerg.trim() || null,
        Status_Atendimento: "Aberto",
        Fotos_Evidencia_JSON: JSON.stringify(fotosComprimidas),
        Qtd_Fotos_Evidencia: fotosComprimidas.length,
      };

      const next = [row, ...emergRows];
      try {
        saveEmergencias(next);
      } catch {
        /* ignora erro de localStorage cheio — Firestore já salvou */
      }
      setEmergRows(next);
      setEmergMsg("Emergência registrada com sucesso.");
      setTipoFalhaCategoria("");
      setTipoFalhaOutros("");
      setDescEmerg("");
      setGpsEmerg(geoCoords);
      setFotosEmergencia(Array.from({ length: EMERG_NUM_FOTOS }, () => ""));
      stopEmergenciaCamera();
    } catch {
      setEmergMsg(
        "Erro ao salvar emergência no banco de dados. Tente novamente.",
      );
    } finally {
      setEmergSaving(false);
    }
  }

  if (!session) {
    return <Navigate to="/checklist-login" replace />;
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
              </article>
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
                  onClick={() => {
                    void handleAbrirListaPorChassi();
                  }}
                  disabled={loadingChassis}
                >
                  {loadingChassis
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

              {chassisChecklistAtivo && maquinaAtual ? (
                <p
                  className="hu360-chassis-resumo"
                  style={{
                    marginTop: 14,
                    fontSize: "0.88rem",
                    color: "var(--hu-muted)",
                  }}
                >
                  <strong>{maquinaAtual.ID}</strong> · {maquinaAtual.Marca}{" "}
                  {maquinaAtual.Modelo} · Chassi{" "}
                  <strong>{maquinaAtual.Chassis}</strong>
                </p>
              ) : null}

              {!maquinaAtual && chassisChecklistAtivo ? (
                <p style={{ color: "#f87171", marginTop: 12 }}>
                  Não foi possível resolver a máquina para o chassi confirmado.
                </p>
              ) : null}

              {maquinaAtual && itensFiltrados.length === 0 ? (
                <p style={{ color: "#f87171", marginTop: 12 }}>
                  Sem itens de checklist para a categoria &quot;
                  {checklistCategoriaFromMaquina(maquinaAtual.Categoria)}&quot;
                  na planilha.
                </p>
              ) : null}

              {maquinaAtual ? (
                <form
                  onSubmit={handleSalvarChecklist}
                  style={{ marginTop: 16 }}
                >
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

                  {!horimetro.trim() || !fotoHorimetroDataUrl ? (
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
                      <strong>câmera</strong> para fotografar o horímetro na
                      hora antes de salvar.
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
                      return (
                        <div key={key} className="hu360-check-row">
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
                              className={cur === "sim" ? "active-sim" : ""}
                              disabled={bloq}
                              onClick={() => setAnswer(key, "sim")}
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              className={cur === "nao" ? "active-nao" : ""}
                              disabled={bloq}
                              onClick={() => setAnswer(key, "nao")}
                            >
                              Não
                            </button>
                          </div>
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
                    <button type="submit" className="hu360-btn">
                      Salvar checklist
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
                    {maquinaDaSessao ? (
                      <>
                        <strong>
                          {maquinaDaSessao.Marca} {maquinaDaSessao.Modelo}
                        </strong>
                        <br />
                        <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                          Chassi:{" "}
                          <strong>
                            {String(maquinaDaSessao.Chassis ?? "—")}
                          </strong>
                        </span>
                      </>
                    ) : session ? (
                      <strong>{session.nome}</strong>
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
                  Localização (GPS ou referência)
                </label>
                {geoStatus === "denied" || geoStatus === "unavailable" ? (
                  <div
                    style={{
                      marginBottom: 8,
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "#fff7ed",
                      border: "1px solid #fed7aa",
                      color: "#9a3412",
                      fontSize: "0.84rem",
                    }}
                  >
                    {geoStatus === "denied"
                      ? "Permissão de localização negada. Ative nas configurações do navegador ou toque no botão abaixo para tentar novamente."
                      : "Localização não disponível neste dispositivo/navegador."}
                    {geoStatus === "denied" ? (
                      <div style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="hu360-btn"
                          style={{
                            width: "auto",
                            padding: "7px 14px",
                            fontSize: "0.85rem",
                          }}
                          onClick={requestGeo}
                        >
                          Ativar localização
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <input
                  id="hu360-gps-emerg"
                  value={gpsEmerg}
                  onChange={(ev) => setGpsEmerg(ev.target.value)}
                  placeholder={
                    geoStatus === "loading"
                      ? "Obtendo localização…"
                      : "-20.xxx, -54.xxx ou trecho da obra"
                  }
                  readOnly={geoStatus === "loading"}
                />

                <div className="hu360-inline-label" style={{ marginTop: 16 }}>
                  Fotos da emergência{" "}
                  <span style={{ color: "#dc2626" }}>*</span> ({EMERG_NUM_FOTOS}{" "}
                  na hora)
                </div>
                <p
                  style={{
                    margin: "6px 0 12px",
                    fontSize: "0.84rem",
                    color: "#64748b",
                  }}
                >
                  Obrigatórias {EMERG_NUM_FOTOS} fotos com a câmera do aparelho,
                  ao vivo (sem galeria). Toque em «Tirar foto» em cada quadro,
                  capture e repita até completar as seis.
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
                        {src ? (
                          <button
                            type="button"
                            className="hu360-btn hu360-btn-ghost"
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              fontSize: "0.85rem",
                            }}
                            onClick={() => {
                              setFotosEmergencia((prev) => {
                                const n = [...prev];
                                n[i] = "";
                                return n;
                              });
                            }}
                          >
                            Remover
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {emergCameraSlot !== null ? (
                  <div className="hu360-emerg-camera-panel">
                    <p
                      style={{
                        margin: "14px 0 8px",
                        fontWeight: 600,
                        color: "#334155",
                      }}
                    >
                      Câmera — foto {emergCameraSlot + 1} de {EMERG_NUM_FOTOS}
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
                  disabled={emergSaving}
                >
                  {emergSaving ? "Salvando..." : "Acionar emergência"}
                </button>
                {emergMsg ? (
                  <div
                    className={`hu360-msg ${emergMsg.includes("registrada") ? "ok" : "err"}`}
                  >
                    {emergMsg}
                  </div>
                ) : null}
              </form>
            </div>

            <div className="hu360-card">
              <h3>Últimos registros</h3>
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
                    {emergRows.slice(0, 20).map((row) => (
                      <tr key={String(row.ID_Emergencia)}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {String(row.Data_Hora ?? "")
                            .slice(0, 19)
                            .replace("T", " ")}
                        </td>
                        <td>{String(row.Chassis ?? row.ID_Maquina ?? "")}</td>
                        <td>{String(row.Operador ?? "")}</td>
                        <td>{String(row.Tipo_Falha ?? "")}</td>
                        <td>{contarFotosEmergenciaRow(row)}</td>
                        <td>{String(row.Status_Atendimento ?? "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {emergRows.length === 0 ? (
                <p style={{ color: "var(--hu-muted)", margin: 0 }}>
                  Nenhuma emergência registrada.
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
