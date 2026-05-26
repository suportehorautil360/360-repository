import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useOperadorSession } from "./useOperadorSession";
import { baterComFila } from "../../lib/api/pontos-fila";
import { usePontoAtivo } from "../../lib/api/feature-flags";
import { jaBateuHoje, marcarBatidaHoje } from "./ponto-dia";
import { usePontoSync } from "./usePontoSync";
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
  const { pendentes, atualizar } = usePontoSync();
  const [nome, setNome] = useState("");
  const [fotoDataUrl, setFotoDataUrl] = useState("");
  const [recibo, setRecibo] = useState<{ hora: string; offline: boolean } | null>(
    null,
  );
  const [salvando, setSalvando] = useState(false);
  const [obrigatorio] = useState(() =>
    session ? !jaBateuHoje(session) : false,
  );

  const prefeituraId = session?.idCliente ?? "";
  const { ativo: pontoAtivo, carregando: flagCarregando } =
    usePontoAtivo(prefeituraId);

  async function baterEntrada() {
    if (!nome.trim()) {
      toast.error("Informe seu nome.");
      return;
    }
    if (!fotoDataUrl) {
      toast.error("Capture a foto antes de bater o ponto.");
      return;
    }
    setSalvando(true);
    const hora = new Date();
    try {
      const r = await baterComFila({
        name: nome.trim(),
        photo: fotoDataUrl,
        prefeituraId,
        timestampOriginal: hora.toISOString(),
        tipo: "entrada",
      });
      if (session) marcarBatidaHoje(session);
      atualizar();
      if (obrigatorio) {
        navigate("/checklist-controle", { replace: true });
        return;
      }
      setRecibo({ hora: horaDe(hora.toISOString()), offline: !r.sincronizado });
      setFotoDataUrl("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar o ponto.");
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

  if (!flagCarregando && !pontoAtivo) {
    return (
      <div className="ponto-page">
        <div className="ponto-card ponto-vazio">
          <h1>Ponto indisponível</h1>
          <p>O registro de ponto não está ativo para esta prefeitura.</p>
          <Link className="ponto-btn ponto-btn--primary" to="/checklist-controle">
            Voltar ao checklist
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

        {pendentes > 0 && (
          <p className="ponto-pendentes">
            {pendentes} batida(s) aguardando sincronização.
          </p>
        )}

        {recibo ? (
          <PontoRecibo
            hora={recibo.hora}
            label="Entrada"
            offline={recibo.offline}
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
  offline = false,
  onBaterOutra,
}: {
  hora: string;
  label: string;
  offline?: boolean;
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
        {offline ? "Offline — sincroniza ao reconectar" : "Aguardando aprovação"}
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
