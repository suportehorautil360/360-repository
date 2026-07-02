import { useState, type ReactNode } from "react";
import { Shield } from "lucide-react";
import type { PainelGeralOs } from "./abrir-os-paineis-dados";
import { PAINEL_META } from "./abrir-os-paineis-dados";
import { AbrirOsPainelGeralConteudo } from "./AbrirOsPainelGeralConteudo";
import { AbrirOsAbaGarantia } from "./AbrirOsAbaGarantia";
import { AbrirOsAbaMaquinaParada } from "./AbrirOsAbaMaquinaParada";
import { isOsCorretiva, maquinaParadaDeOs, type SolicitacaoOS } from "./abrir-os-model";

export type AbaDetalheOs = "resumo" | PainelGeralOs | "garantia" | "maquina-parada";

const ABAS_BASE: { id: AbaDetalheOs; label: string; icon?: "shield" }[] = [
  { id: "resumo", label: "Resumo" },
  { id: "insumos", label: "Insumos" },
  { id: "sintomas", label: "Sintomas" },
  { id: "ocorrencias", label: "Ocorrências" },
  { id: "maquina-parada", label: "Máq. parada" },
  { id: "garantia", label: "Garantia", icon: "shield" },
];

interface AbrirOsDetalheAbasProps {
  os: SolicitacaoOS;
  resumo: ReactNode;
}

export function AbrirOsDetalheAbas({ os, resumo }: AbrirOsDetalheAbasProps) {
  const [aba, setAba] = useState<AbaDetalheOs>("resumo");
  const exibeMaquinaParada = isOsCorretiva(os);

  const abas = exibeMaquinaParada
    ? ABAS_BASE
    : ABAS_BASE.filter((t) => t.id !== "maquina-parada");

  const painelAtual =
    aba === "insumos" || aba === "sintomas" || aba === "ocorrencias"
      ? aba
      : null;

  return (
    <>
      <nav className="aos-tabs aos-detalhe__tabs" aria-label="Seções da O.S.">
        {abas.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`aos-tab${aba === t.id ? " is-active" : ""}`}
            onClick={() => setAba(t.id)}
          >
            {t.icon === "shield" ? (
              <Shield size={14} className="aos-tab__shield" aria-hidden />
            ) : null}
            {t.label}
          </button>
        ))}
      </nav>

      {aba === "resumo" ? (
        resumo
      ) : painelAtual ? (
        <section className="aos-detalhe__secao aos-detalhe__secao--painel">
          <h2 className="aos-detalhe__secao-titulo">
            <span aria-hidden>{PAINEL_META[painelAtual].icone}</span>{" "}
            {PAINEL_META[painelAtual].titulo}
          </h2>
          <AbrirOsPainelGeralConteudo
            painel={painelAtual}
            solicitacaoOsId={os.id}
            relatoOs={os.relato}
          />
        </section>
      ) : aba === "garantia" ? (
        <section className="aos-detalhe__secao aos-detalhe__secao--painel">
          <AbrirOsAbaGarantia
            solicitacaoOsId={os.id}
            equipamentoId={os.equipamentoId}
            nomeEquipamento={os.equipamento}
            horimetro={os.horimetro ?? ""}
            equipamentoSelecionado={Boolean(os.equipamentoId || os.equipamento)}
            osOrigemAtual={os.protocolo}
            somenteLeitura
          />
        </section>
      ) : aba === "maquina-parada" ? (
        <section className="aos-detalhe__secao aos-detalhe__secao--painel">
          <AbrirOsAbaMaquinaParada
            compacto
            rows={[maquinaParadaDeOs(os)]}
            emptyText="Esta O.S. não está registrada como máquina parada."
          />
        </section>
      ) : null}
    </>
  );
}
