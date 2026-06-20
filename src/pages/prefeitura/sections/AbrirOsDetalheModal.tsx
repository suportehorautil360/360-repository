import { useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { SolicitacaoOS } from "./abrir-os-model";
import {
  fmtClassificacao,
  fmtDataOs,
  statusBadgeOs,
} from "./abrir-os-model";

interface AbrirOsDetalheModalProps {
  os: SolicitacaoOS;
  onFechar: () => void;
}

function CampoDetalhe({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="aos-modal__campo">
      <span className="aos-modal__label">{label}</span>
      <div className="aos-modal__valor">{children}</div>
    </div>
  );
}

export function AbrirOsDetalheModal({ os, onFechar }: AbrirOsDetalheModalProps) {
  const st = statusBadgeOs(os.status);
  const relato = os.relato?.trim() || "—";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  return (
    <motion.div
      className="aos-modal-backdrop"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onFechar}
    >
        <motion.div
          className="aos-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="aos-modal-titulo"
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          onClick={(e) => e.stopPropagation()}
        >
          <header className="aos-modal__head">
            <div>
              <p className="aos-modal__kicker">Ordem de serviço</p>
              <h2 id="aos-modal-titulo" className="aos-modal__titulo">
                {os.protocolo || "—"}
              </h2>
            </div>
            <button
              type="button"
              className="aos-modal__fechar"
              onClick={onFechar}
              aria-label="Fechar"
            >
              ×
            </button>
          </header>

          <div className="aos-modal__grid">
            <CampoDetalhe label="Equipamento">{os.equipamento || "—"}</CampoDetalhe>
            <CampoDetalhe label="Classificação">
              {fmtClassificacao(os.linha)}
            </CampoDetalhe>
            <CampoDetalhe label="Operador">{os.operador || "—"}</CampoDetalhe>
            <CampoDetalhe label="Data">{fmtDataOs(os.criadoEm)}</CampoDetalhe>
            <CampoDetalhe label="Status">
              <span className={`aos-status ${st.cls}`}>{st.label}</span>
            </CampoDetalhe>
          </div>

          <div className="aos-modal__relato">
            <span className="aos-modal__label">Descrição / relato</span>
            <div className="aos-modal__relato-texto">{relato}</div>
          </div>

          <footer className="aos-modal__foot">
            <button
              type="button"
              className="aos-btn aos-btn--outline"
              onClick={onFechar}
            >
              Fechar
            </button>
          </footer>
        </motion.div>
      </motion.div>
  );
}
