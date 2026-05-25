import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOperadorSession } from "./useOperadorSession";
import { pontoApi, type PontoRegistro } from "./ponto-api";
import { jaBateuHoje, marcarBatidaHoje } from "./ponto-dia";
import "./ponto.css";

/** Captura um frame do vídeo, reduz para `maxSide`px e devolve JPEG base64. */
function capturarDoVideo(
  video: HTMLVideoElement,
  maxSide = 800,
  quality = 0.7,
): string | null {
  if (video.readyState < 2) return null;
  const w0 = video.videoWidth;
  const h0 = video.videoHeight;
  if (!w0 || !h0) return null;
  let w = w0;
  let h = h0;
  if (Math.max(w0, h0) > maxSide) {
    const r = maxSide / Math.max(w0, h0);
    w = Math.round(w0 * r);
    h = Math.round(h0 * r);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ehHoje(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

export function PontoPage() {
  const { session } = useOperadorSession();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [nome, setNome] = useState("");
  const [fotoDataUrl, setFotoDataUrl] = useState("");
  const [cameraAberta, setCameraAberta] = useState(false);
  const [msg, setMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [batidas, setBatidas] = useState<PontoRegistro[]>([]);
  // Entrou pelo gate obrigatório (ainda não bateu hoje) vs. visita pelo menu.
  const [obrigatorio] = useState(() =>
    session ? !jaBateuHoje(session) : false,
  );

  const prefeituraId = session?.idCliente ?? "";

  const pararCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraAberta(false);
  }, []);

  const abrirCamera = useCallback(async () => {
    setMsg("");
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "user" } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      streamRef.current = stream;
      setCameraAberta(true);
    } catch (e) {
      const negado = e instanceof DOMException && e.name === "NotAllowedError";
      setMsg(
        negado
          ? "Permissão da câmera negada. Libere o acesso para bater o ponto."
          : "Não foi possível abrir a câmera neste dispositivo.",
      );
    }
  }, []);

  // Conecta o stream ao <video> quando a câmera abre.
  useEffect(() => {
    if (cameraAberta && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [cameraAberta]);

  // Garante que a câmera é desligada ao sair da tela.
  useEffect(() => () => pararCamera(), [pararCamera]);

  const capturar = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const url = capturarDoVideo(v);
    if (!url) {
      setMsg("Não consegui capturar a imagem. Tente de novo.");
      return;
    }
    setFotoDataUrl(url);
    pararCamera();
  }, [pararCamera]);

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    try {
      const lista = await pontoApi.listar(prefeituraId);
      setBatidas(lista.filter((p) => ehHoje(p.timestampOriginal)));
    } catch {
      // silencioso: a lista do dia é só apoio; bater ponto é o essencial
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function baterPonto() {
    setMsg("");
    setOkMsg("");
    if (!nome.trim()) {
      setMsg("Informe seu nome.");
      return;
    }
    if (!fotoDataUrl) {
      setMsg("Capture a foto antes de bater o ponto.");
      return;
    }
    setSalvando(true);
    try {
      const reg = await pontoApi.bater({
        name: nome.trim(),
        photo: fotoDataUrl,
        prefeituraId,
        timestampOriginal: new Date().toISOString(),
      });
      setBatidas((prev) => [reg, ...prev]);
      if (session) marcarBatidaHoje(session);
      if (obrigatorio) {
        // Gate concluído: libera o checklist.
        navigate("/checklist-controle", { replace: true });
        return;
      }
      setOkMsg(`Ponto registrado às ${horaDe(reg.timestampOriginal)}.`);
      setFotoDataUrl("");
      setNome("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro ao registrar o ponto.");
    } finally {
      setSalvando(false);
    }
  }

  if (!session) {
    return (
      <div className="ponto-page">
        <div className="ponto-card ponto-vazio">
          <h1>Bater ponto</h1>
          <p>
            Você precisa abrir uma sessão no checklist antes de bater o ponto.
          </p>
          <Link className="ponto-btn ponto-btn--primary" to="/checklist-login">
            Ir para o login do checklist
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ponto-page">
      <div className="ponto-card">
        <header className="ponto-head">
          <h1>Bater ponto</h1>
          {!obrigatorio && (
            <Link className="ponto-voltar" to="/checklist-controle">
              ← Voltar
            </Link>
          )}
        </header>
        <p className="ponto-sub">
          {obrigatorio
            ? "Bata o ponto para acessar o checklist."
            : session.empresa}
        </p>

        <label className="ponto-label" htmlFor="ponto-nome">
          Seu nome
        </label>
        <input
          id="ponto-nome"
          className="ponto-input"
          type="text"
          placeholder="Nome completo"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <div className="ponto-foto">
          {cameraAberta ? (
            <video ref={videoRef} autoPlay playsInline muted />
          ) : fotoDataUrl ? (
            <img src={fotoDataUrl} alt="Selfie capturada" />
          ) : (
            <div className="ponto-foto__vazio" aria-hidden="true">
              📷
            </div>
          )}
        </div>

        {cameraAberta ? (
          <div className="ponto-cam-acoes">
            <button
              type="button"
              className="ponto-btn ponto-btn--primary"
              onClick={capturar}
            >
              Capturar
            </button>
            <button
              type="button"
              className="ponto-btn ponto-btn--secundario"
              onClick={pararCamera}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="ponto-btn ponto-btn--secundario"
            onClick={() => void abrirCamera()}
          >
            {fotoDataUrl ? "Tirar outra foto" : "Abrir câmera"}
          </button>
        )}

        <button
          type="button"
          className="ponto-btn ponto-btn--primary"
          onClick={() => void baterPonto()}
          disabled={salvando || cameraAberta}
        >
          {salvando ? "Registrando…" : "Bater ponto"}
        </button>

        {msg && <p className="ponto-msg ponto-msg--err">{msg}</p>}
        {okMsg && <p className="ponto-msg ponto-msg--ok">{okMsg}</p>}

        {batidas.length > 0 && (
          <div className="ponto-lista">
            <h2>Batidas de hoje</h2>
            <ul>
              {batidas.map((b) => (
                <li key={b.id}>
                  <strong>{horaDe(b.timestampOriginal)}</strong> — {b.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
