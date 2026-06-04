import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useOperadorSession } from "./useOperadorSession";
import { baterComFila } from "../../lib/api/pontos-fila";
import { usePontoAtivo } from "../../lib/api/feature-flags";
import { jaBateuHoje, marcarBatidaHoje } from "./ponto-dia";
import { usePontoSync } from "./usePontoSync";
import { CameraSelfie } from "./CameraSelfie";
import { RelogioAoVivo } from "./RelogioAoVivo";
import { configuracoesApi, type Configuracao } from "../../lib/api/configuracoes";
import type { PontoRegistro } from "../../lib/api/pontos";
import { baixarCRPT, montarCRPT, podeEmitirCRPT } from "../../lib/ponto/crpt";
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
  // Pré-preenche com o funcionário autenticado (login por CPF+senha).
  const [nome, setNome] = useState(() => session?.nome ?? "");
  const [fotoDataUrl, setFotoDataUrl] = useState("");
  const [recibo, setRecibo] = useState<{
    hora: string;
    offline: boolean;
    registro?: PontoRegistro;
  } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [empresa, setEmpresa] = useState<Configuracao["empresa"] | null>(null);
  const [obrigatorio] = useState(() =>
    session ? !jaBateuHoje(session) : false,
  );

  const prefeituraId = session?.idCliente ?? "";
  const { ativo: pontoAtivo, carregando: flagCarregando } =
    usePontoAtivo(prefeituraId);

  // Dados do empregador para o comprovante (CRPT). Best-effort: se falhar, o
  // comprovante sai com "Não informado" nos campos da empresa.
  useEffect(() => {
    if (!prefeituraId) return;
    let vivo = true;
    configuracoesApi
      .obter(prefeituraId)
      .then((c) => vivo && setEmpresa(c.empresa))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [prefeituraId]);

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
      setRecibo({
        hora: horaDe(hora.toISOString()),
        offline: !r.sincronizado,
        registro: r.registro,
      });
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
            registro={recibo.registro}
            empresa={empresa}
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
  registro,
  empresa,
  onBaterOutra,
}: {
  hora: string;
  label: string;
  offline?: boolean;
  registro?: PontoRegistro;
  empresa?: Configuracao["empresa"] | null;
  onBaterOutra: () => void;
}) {
  // CRPT (Portaria 671): só dá para emitir quando a batida foi selada pelo
  // servidor (tem NSR + hash). Offline ainda não tem.
  const emitivel = !!registro && podeEmitirCRPT(registro);
  return (
    <div className="ponto-recibo">
      <div className="ponto-recibo__check" aria-hidden="true">
        ✓
      </div>
      <strong className="ponto-recibo__titulo">{label} registrada</strong>
      <span className="ponto-recibo__hora">{hora}</span>
      <span
        className={`ponto-status ponto-status--${offline ? "pendente" : "aprovado"}`}
      >
        {offline ? "Offline — sincroniza ao reconectar" : "Registro confirmado"}
      </span>

      {emitivel ? (
        <>
          <span className="ponto-recibo__nsr">
            NSR {registro!.nsr} · hash {registro!.hash!.slice(0, 12)}…
          </span>
          <button
            type="button"
            className="ponto-btn ponto-btn--primary"
            onClick={() => baixarCRPT(montarCRPT(registro!, empresa))}
          >
            Baixar comprovante (PDF)
          </button>
        </>
      ) : (
        offline && (
          <span className="ponto-recibo__nsr">
            Comprovante disponível após sincronizar.
          </span>
        )
      )}

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
