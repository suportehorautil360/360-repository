import { useEffect, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  fmtDataOs,
  fmtLinha,
  statusSolicitacao,
  totalConvidadas,
  type SolicitacaoOrcamento,
} from "./orcamentos-aprovacoes-model";

interface OrcamentoSolDetalheModalProps {
  sol: SolicitacaoOrcamento;
  orcamentosRecebidos: number;
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
    <div className="oap-modal__campo">
      <span className="oap-modal__label">{label}</span>
      <div className="oap-modal__valor">{children}</div>
    </div>
  );
}

export function OrcamentoSolDetalheModal({
  sol,
  orcamentosRecebidos,
  onFechar,
}: OrcamentoSolDetalheModalProps) {
  const st = statusSolicitacao(sol.status);
  const relato = sol.relato?.trim() || "—";
  const convidadas = totalConvidadas(sol);
  const oficinas =
    sol.oficinas?.filter(Boolean).join(", ") ||
    (sol.oficinasIds?.length
      ? `${sol.oficinasIds.length} oficina(s) credenciada(s)`
      : "—");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  return (
    <motion.div
      className="oap-modal-backdrop"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onFechar}
    >
      <motion.div
        className="oap-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="oap-modal-titulo"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="oap-modal__head">
          <div>
            <p className="oap-modal__kicker">Ordem de serviço</p>
            <h2 id="oap-modal-titulo" className="oap-modal__titulo">
              {sol.protocolo || "—"}
            </h2>
          </div>
          <button
            type="button"
            className="oap-modal__fechar"
            onClick={onFechar}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="oap-modal__grid">
          <CampoDetalhe label="Equipamento">
            {sol.equipamento || "—"}
          </CampoDetalhe>
          <CampoDetalhe label="Linha">{fmtLinha(sol.linha)}</CampoDetalhe>
          <CampoDetalhe label="Operador solicitante">
            {sol.operador || "—"}
          </CampoDetalhe>
          <CampoDetalhe label="Data">{fmtDataOs(sol.criadoEm)}</CampoDetalhe>
          <CampoDetalhe label="Status">
            <span className={`oap-badge ${st.cls}`}>{st.label}</span>
          </CampoDetalhe>
          <CampoDetalhe label="Orçamentos">
            {orcamentosRecebidos}/{convidadas} recebido(s)
          </CampoDetalhe>
        </div>

        <div className="oap-modal__bloco">
          <span className="oap-modal__label">Oficinas convidadas</span>
          <div className="oap-modal__texto">{oficinas}</div>
        </div>

        <div className="oap-modal__bloco">
          <span className="oap-modal__label">Relato / descrição</span>
          <div className="oap-modal__texto oap-modal__texto--relato">
            {relato}
          </div>
        </div>

        <footer className="oap-modal__foot">
          <button
            type="button"
            className="oap-btn oap-btn--itens"
            onClick={onFechar}
          >
            Fechar
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}
