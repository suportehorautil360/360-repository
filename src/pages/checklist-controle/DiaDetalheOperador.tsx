import { useState } from "react";
import { TIPOS_PONTO, type PontoRegistro, type TipoPonto } from "./ponto-api";
import type { BatidaEfetiva } from "../../lib/ponto/resolverLedger";
import "./ponto.css";

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "YYYY-MM-DD" → "DD/MM/YYYY". */
function dataBr(diaIso: string): string {
  return diaIso.split("-").reverse().join("/");
}

/**
 * Detalhe de um dia no espelho do operador: mostra cada batida (entrada,
 * almoço, volta, saída) com a selfie registrada, o horário e, se houver, o
 * aviso de correção pendente. Somente leitura.
 */
export function DiaDetalheOperador({
  dia,
  batidas,
  onVoltar,
}: {
  dia: string;
  batidas: PontoRegistro[];
  onVoltar: () => void;
}) {
  const [fotoAmpliada, setFotoAmpliada] = useState("");

  const porTipo = new Map<TipoPonto, BatidaEfetiva>();
  for (const b of batidas) porTipo.set(b.tipo, b as BatidaEfetiva);

  return (
    <section className="folha__card">
      <header className="folha__card-head">
        <button
          type="button"
          className="ponto-btn ponto-btn--secundario ponto-btn--sm"
          onClick={onVoltar}
        >
          ← Voltar
        </button>
        <h2 className="folha__card-titulo">Dia {dataBr(dia)}</h2>
      </header>

      <ul className="folha__regs">
        {TIPOS_PONTO.map(({ tipo, label }) => {
          const reg = porTipo.get(tipo);
          return (
            <li key={tipo} className="folha__reg">
              <div className="folha__reg-linha">
                {reg?.photo ? (
                  <button
                    type="button"
                    className="dia-det__foto"
                    onClick={() => setFotoAmpliada(reg.photo ?? "")}
                    aria-label="Ampliar selfie"
                  >
                    <img src={reg.photo} alt={`Selfie ${label}`} />
                  </button>
                ) : (
                  <span className="dia-det__foto dia-det__foto--sem" aria-hidden="true">
                    📷
                  </span>
                )}
                <span className="folha__reg-label">{label}</span>
                <span className="folha__reg-acao">
                  <strong className="folha__reg-hora">
                    {reg ? horaDe(reg.timestampOriginal) : "—:—"}
                  </strong>
                  {reg?.ajustePendente && (
                    <span className="ponto-status ponto-status--pendente">
                      Ajuste pendente
                    </span>
                  )}
                </span>
              </div>
              {reg?.ajustePendente && reg.horarioAjustePendente && (
                <span className="ponto-slot__motivo">
                  Correção para {horaDe(reg.horarioAjustePendente)} aguardando
                  aprovação do RH.
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {fotoAmpliada && (
        <div
          className="dia-det__foto-modal"
          onClick={() => setFotoAmpliada("")}
          role="presentation"
        >
          <img src={fotoAmpliada} alt="Selfie ampliada" />
        </div>
      )}
    </section>
  );
}
