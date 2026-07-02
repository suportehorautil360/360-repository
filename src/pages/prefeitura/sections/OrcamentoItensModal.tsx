import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  calcularSubtotaisOrcamento,
  fmtBRL,
  fmtNum,
  fmtPrazoDias,
  labelTipoHora,
  resolverSecoesOrcamento,
} from "./orcamento-itens-detail";
import {
  podeAprovarOrcamento,
  statusOrdem,
  statusSolicitacao,
  type OrdemOrcamento,
  type SolicitacaoOrcamento,
} from "./orcamentos-aprovacoes-model";

interface OrcamentoItensModalProps {
  ordem: OrdemOrcamento;
  solicitacao: SolicitacaoOrcamento | null;
  aprovando: boolean;
  onFechar: () => void;
  onAprovar?: () => void;
}

function CampoResumo({ label, value }: { label: string; value: string }) {
  return (
    <div className="oap-itens-modal__campo">
      <span className="oap-itens-modal__campo-label">{label}</span>
      <span className="oap-itens-modal__campo-valor">{value || "—"}</span>
    </div>
  );
}

function ValorLeitura({ value }: { value: string }) {
  return (
    <div className="oap-itens-modal__valor-leitura">
      {value.trim() ? value : "—"}
    </div>
  );
}

function SecaoCard({
  titulo,
  dica,
  children,
}: {
  titulo: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <section className="oap-itens-modal__secao">
      <h3 className="oap-itens-modal__secao-titulo">{titulo}</h3>
      <div className="oap-itens-modal__secao-corpo">{children}</div>
      {dica ? <p className="oap-itens-modal__secao-dica">{dica}</p> : null}
    </section>
  );
}

export function OrcamentoItensModal({
  ordem,
  solicitacao,
  aprovando,
  onFechar,
  onAprovar,
}: OrcamentoItensModalProps) {
  const secoes = useMemo(
    () => resolverSecoesOrcamento(ordem.itens ?? []),
    [ordem.itens],
  );
  const subtotais = useMemo(
    () => calcularSubtotaisOrcamento(secoes),
    [secoes],
  );
  const stSol = solicitacao
    ? statusSolicitacao(solicitacao.status)
    : null;
  const stOrd = statusOrdem(ordem.status);
  const podeAprovar =
    solicitacao != null && podeAprovarOrcamento(solicitacao, ordem);
  const totalExibido =
    ordem.valorTotal > 0 ? ordem.valorTotal : subtotais.total;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  return (
    <motion.div
      className="oap-itens-modal-backdrop"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onFechar}
    >
      <motion.div
        className="oap-itens-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="oap-itens-modal-titulo"
        initial={{ opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="oap-itens-modal__head">
          <div>
            <h2 id="oap-itens-modal-titulo" className="oap-itens-modal__titulo">
              Orçamento — {ordem.protocolo || "—"}
            </h2>
            <p className="oap-itens-modal__subtitulo">
              Oficina: {ordem.oficinaNome ?? ordem.operador}
              {ordem.equipamento ? ` · Equipamento: ${ordem.equipamento}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="oap-itens-modal__fechar"
            onClick={onFechar}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <div className="oap-itens-modal__corpo">
          <section className="oap-itens-modal__secao oap-itens-modal__secao--resumo">
            <h3 className="oap-itens-modal__secao-titulo">Resumo</h3>
            <div className="oap-itens-modal__resumo-grid">
              <CampoResumo
                label="OS"
                value={solicitacao?.protocolo ?? ordem.protocolo}
              />
              <CampoResumo
                label="Equipamento"
                value={ordem.equipamento || solicitacao?.equipamento || "—"}
              />
              <CampoResumo
                label="Cliente"
                value={solicitacao?.operador ?? ordem.operador}
              />
              <CampoResumo label="Valor total" value={fmtBRL(totalExibido)} />
              <CampoResumo
                label="Prazo"
                value={fmtPrazoDias(ordem.prazoDias)}
              />
              <CampoResumo
                label="Status da solicitação"
                value={stSol?.label ?? "—"}
              />
            </div>
            <p className="oap-itens-modal__status-ordem">
              Status do orçamento:{" "}
              <span className={`oap-ordem ${stOrd.cls}`}>{stOrd.label}</span>
            </p>
          </section>

          <SecaoCard
            titulo="Peças"
            dica="Total da linha = Qtd × Valor unitário (calculado automaticamente)."
          >
            {secoes.pecas.length === 0 ? (
              <p className="oap-itens-modal__vazio">Nenhuma peça informada.</p>
            ) : (
              <div className="oap-itens-modal__tabela-wrap">
                <table className="oap-itens-modal__tabela">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Descrição</th>
                      <th>Marca</th>
                      <th>Qtd</th>
                      <th>Valor unit.</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {secoes.pecas.map((peca) => (
                      <tr key={peca.id}>
                        <td>
                          <ValorLeitura value={peca.codigo} />
                        </td>
                        <td>
                          <ValorLeitura value={peca.descricao} />
                        </td>
                        <td>
                          <ValorLeitura value={peca.marca} />
                        </td>
                        <td>
                          <ValorLeitura value={fmtNum(peca.quantidade)} />
                        </td>
                        <td>
                          <ValorLeitura value={fmtNum(peca.valorUnitario)} />
                        </td>
                        <td className="oap-itens-modal__total-linha">
                          {fmtBRL(peca.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SecaoCard>

          <SecaoCard
            titulo="Mão de Obra / Serviços"
            dica="Total da linha = Horas × Valor/hora."
          >
            {secoes.servicos.length === 0 ? (
              <p className="oap-itens-modal__vazio">
                Nenhum serviço informado.
              </p>
            ) : (
              <div className="oap-itens-modal__tabela-wrap">
                <table className="oap-itens-modal__tabela">
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th>Tipo hora</th>
                      <th>Horas</th>
                      <th>Valor/h</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {secoes.servicos.map((servico) => (
                      <tr key={servico.id}>
                        <td>
                          <ValorLeitura value={servico.descricao} />
                        </td>
                        <td>
                          <ValorLeitura
                            value={labelTipoHora(servico.tipoHora)}
                          />
                        </td>
                        <td>
                          <ValorLeitura value={fmtNum(servico.horas)} />
                        </td>
                        <td>
                          <ValorLeitura value={fmtNum(servico.valorHora)} />
                        </td>
                        <td className="oap-itens-modal__total-linha">
                          {fmtBRL(servico.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SecaoCard>

          <SecaoCard
            titulo="Deslocamento"
            dica="Total = (km × valor/km) + (horas × valor/hora) + taxas extras."
          >
            <div className="oap-itens-modal__desloc-grid">
              <div>
                <span className="oap-itens-modal__campo-label">KM</span>
                <ValorLeitura value={fmtNum(secoes.deslocamento.km)} />
              </div>
              <div>
                <span className="oap-itens-modal__campo-label">Valor/km</span>
                <ValorLeitura value={fmtNum(secoes.deslocamento.valorPorKm)} />
              </div>
              <div>
                <span className="oap-itens-modal__campo-label">Hrs viagem</span>
                <ValorLeitura value={fmtNum(secoes.deslocamento.horasViagem)} />
              </div>
              <div>
                <span className="oap-itens-modal__campo-label">Valor hr</span>
                <ValorLeitura value={fmtNum(secoes.deslocamento.valorHora)} />
              </div>
              <div>
                <span className="oap-itens-modal__campo-label">Taxas</span>
                <ValorLeitura value={fmtNum(secoes.deslocamento.taxas)} />
              </div>
              <div>
                <span className="oap-itens-modal__campo-label">Total</span>
                <div className="oap-itens-modal__desloc-total">
                  {fmtBRL(secoes.deslocamento.total)}
                </div>
              </div>
            </div>
          </SecaoCard>

          <div className="oap-itens-modal__total-card">
            <div className="oap-itens-modal__total-linhas">
              <div>
                <span>Subtotal Peças</span>
                <span>{fmtBRL(subtotais.pecas)}</span>
              </div>
              <div>
                <span>Subtotal Mão de Obra</span>
                <span>{fmtBRL(subtotais.servicos)}</span>
              </div>
              <div>
                <span>Subtotal Deslocamento</span>
                <span>{fmtBRL(subtotais.deslocamento)}</span>
              </div>
            </div>
            <div className="oap-itens-modal__total-final">
              <span>TOTAL</span>
              <span>{fmtBRL(totalExibido)}</span>
            </div>
          </div>
        </div>

        <footer className="oap-itens-modal__foot">
          <button
            type="button"
            className="oap-btn oap-btn--itens"
            onClick={onFechar}
          >
            Fechar
          </button>
          {podeAprovar && onAprovar ? (
            <button
              type="button"
              className="oap-btn oap-btn--aprovar"
              disabled={aprovando}
              onClick={onAprovar}
            >
              {aprovando ? "Aprovando…" : "✓ Aprovar orçamento"}
            </button>
          ) : null}
        </footer>
      </motion.div>
    </motion.div>
  );
}
