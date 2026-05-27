import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * Campo de selfie: mostra preview/placeholder, abre a câmera (getUserMedia),
 * captura ao vivo e emite o data URL por `onFoto`. Desliga o stream sozinho.
 */
export function CameraSelfie({
  foto,
  onFoto,
}: {
  foto: string;
  onFoto: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [aberta, setAberta] = useState(false);
  const [erro, setErro] = useState("");

  const parar = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setAberta(false);
  }, []);

  const abrir = useCallback(async () => {
    setErro("");
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
      setAberta(true);
    } catch (e) {
      const negado = e instanceof DOMException && e.name === "NotAllowedError";
      setErro(
        negado
          ? "Permissão da câmera negada."
          : "Não foi possível abrir a câmera neste dispositivo.",
      );
    }
  }, []);

  useEffect(() => {
    if (aberta && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [aberta]);

  useEffect(() => () => parar(), [parar]);

  const capturar = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const url = capturarDoVideo(v);
    if (!url) {
      setErro("Não consegui capturar a imagem. Tente de novo.");
      return;
    }
    onFoto(url);
    parar();
  }, [onFoto, parar]);

  return (
    <>
      <div className="ponto-foto">
        {aberta ? (
          <video ref={videoRef} autoPlay playsInline muted />
        ) : foto ? (
          <img src={foto} alt="Selfie capturada" />
        ) : (
          <div className="ponto-foto__vazio" aria-hidden="true">
            📷
          </div>
        )}
      </div>

      {aberta ? (
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
            onClick={parar}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="ponto-btn ponto-btn--secundario"
          onClick={() => void abrir()}
        >
          {foto ? "Tirar outra foto" : "Abrir câmera"}
        </button>
      )}

      {erro && <p className="ponto-msg ponto-msg--err">{erro}</p>}
    </>
  );
}
