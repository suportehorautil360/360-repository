import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useOperadorSession } from "./useOperadorSession";
import { pontoApi, type PontoRegistro } from "./ponto-api";
import "./ponto.css";

/** Lê o arquivo, reduz para no máximo `maxSide`px e devolve JPEG base64. */
async function fileParaDataUrlReduzido(
  file: File,
  maxSide = 800,
  quality = 0.7,
): Promise<string> {
  const original = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(new Error("Falha ao ler a imagem."));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Imagem inválida."));
    im.src = original;
  });
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
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, w, h);
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
  const [nome, setNome] = useState("");
  const [fotoDataUrl, setFotoDataUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [batidas, setBatidas] = useState<PontoRegistro[]>([]);

  const prefeituraId = session?.idCliente ?? "";

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

  async function onFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg("");
    try {
      setFotoDataUrl(await fileParaDataUrlReduzido(file));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Falha ao processar a foto.");
    }
  }

  async function baterPonto() {
    setMsg("");
    setOkMsg("");
    if (!nome.trim()) {
      setMsg("Informe seu nome.");
      return;
    }
    if (!fotoDataUrl) {
      setMsg("Tire a foto antes de bater o ponto.");
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
          <Link className="ponto-voltar" to="/checklist-controle">
            ← Voltar
          </Link>
        </header>
        <p className="ponto-sub">{session.empresa}</p>

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
          {fotoDataUrl ? (
            <img src={fotoDataUrl} alt="Pré-visualização da selfie" />
          ) : (
            <div className="ponto-foto__vazio" aria-hidden="true">
              📷
            </div>
          )}
        </div>

        <label className="ponto-btn ponto-btn--secundario" htmlFor="ponto-cam">
          {fotoDataUrl ? "Tirar outra foto" : "Tirar foto"}
          <input
            id="ponto-cam"
            type="file"
            accept="image/*"
            capture="user"
            onChange={(e) => void onFoto(e)}
            hidden
          />
        </label>

        <button
          type="button"
          className="ponto-btn ponto-btn--primary"
          onClick={() => void baterPonto()}
          disabled={salvando}
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
