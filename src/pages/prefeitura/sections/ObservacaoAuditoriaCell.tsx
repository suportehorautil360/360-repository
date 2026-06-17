import type { ObservacaoAuditoriaFormatada } from "./auditoria-devolucao-model";

export function ObservacaoAuditoriaCell({
  fmt,
}: {
  fmt: ObservacaoAuditoriaFormatada;
}) {
  return (
    <span className="adev-obs-texto" title={fmt.exportText}>
      {fmt.resumo}
    </span>
  );
}
