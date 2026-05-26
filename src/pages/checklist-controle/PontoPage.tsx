import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useOperadorSession } from "./useOperadorSession";
import { pontoApi } from "./ponto-api";
import { jaBateuHoje, marcarBatidaHoje } from "./ponto-dia";
import { CameraSelfie } from "./CameraSelfie";
import { RelogioAoVivo } from "./RelogioAoVivo";
import "./ponto.css";

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Gate de entrada: bate o ponto de ENTRADA logo após o login do checklist.
 * As demais batidas (almoço/volta/saída) ficam na aba Pontos do checklist.
 */
export function PontoPage() {
  const { session } = useOperadorSession();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [fotoDataUrl, setFotoDataUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [recibo, setRecibo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [obrigatorio] = useState(() =>
    session ? !jaBateuHoje(session) : false,
  );

  const prefeituraId = session?.idCliente ?? "";

  async function baterEntrada() {
    setMsg("");
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
        tipo: "entrada",
      });
      if (session) marcarBatidaHoje(session);
      if (obrigatorio) {
        navigate("/checklist-controle", { replace: true });
        return;
      }
      setRecibo(horaDe(reg.timestampOriginal));
      setFotoDataUrl("");
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
          <h1>Ponto de entrada</h1>
          {!obrigatorio && (
            <Link className="ponto-voltar" to="/checklist-controle">
              ← Voltar
            </Link>
          )}
        </header>

        {recibo ? (
          <PontoRecibo
            hora={recibo}
            label="Entrada"
            onBaterOutra={() => {
              setRecibo(null);
              setNome("");
            }}
          />
        ) : (
          <>
            <p className="ponto-sub">
              {obrigatorio
                ? "Bata o ponto de entrada para acessar o checklist."
                : session.empresa}
            </p>

            <RelogioAoVivo />

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

            <CameraSelfie foto={fotoDataUrl} onFoto={setFotoDataUrl} />

            <button
              type="button"
              className="ponto-btn ponto-btn--primary"
              onClick={() => void baterEntrada()}
              disabled={salvando}
            >
              {salvando ? "Registrando…" : "Bater entrada"}
            </button>

            {msg && <p className="ponto-msg ponto-msg--err">{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/** Recibo de confirmação exibido após uma batida. */
export function PontoRecibo({
  hora,
  label,
  onBaterOutra,
}: {
  hora: string;
  label: string;
  onBaterOutra: () => void;
}) {
  return (
    <div className="ponto-recibo">
      <div className="ponto-recibo__check" aria-hidden="true">
        ✓
      </div>
      <strong className="ponto-recibo__titulo">{label} registrada</strong>
      <span className="ponto-recibo__hora">{hora}</span>
      <span className="ponto-status ponto-status--pendente">
        Aguardando aprovação
      </span>
      <button
        type="button"
        className="ponto-btn ponto-btn--secundario"
        onClick={onBaterOutra}
      >
        Bater outra
      </button>
    </div>
  );
}
