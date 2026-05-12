import type { ChecklistApp } from "../../lib/hu360";

/** Metadado em `Record` para rótulos de itens vindos de `ChecklistApp` (fora do seed operador). */
export const HU360_HIST_ITEM_LABELS = "_hu360_item_labels";

/**
 * Converte um checklist do app (seções + itens) no formato consumido por
 * `ListaChecklistHistoricoLocal` (Respostas_JSON + linha de resumo).
 */
export function checklistAppToHistoricoRow(
  idRegistro: string,
  c: ChecklistApp,
  meta: {
    dataHora?: string;
    operador?: string;
    equipamento?: string;
    chassis?: string;
    /** Texto extra na coluna de status (ex.: índice de confiabilidade). */
    statusResumo?: string;
  },
): Record<string, unknown> {
  const respostas: Record<string, unknown> = {};
  const itemLabels: Record<string, string> = {};
  let n = 0;
  for (const sec of c.secoes ?? []) {
    for (const it of sec.itens ?? []) {
      n += 1;
      const key = String(n);
      const secTit = String(sec.titulo ?? "").trim();
      itemLabels[key] = secTit ? `${secTit}: ${it.item}` : it.item;
      if (it.conforme) {
        respostas[key] = "sim";
      } else {
        respostas[key] = {
          v: "nao" as const,
          problema: String(it.resposta ?? "").trim() || "Não conforme",
        };
      }
    }
  }
  let sim = 0;
  for (const v of Object.values(respostas)) {
    if (v === "sim") sim += 1;
    else if (v && typeof v === "object" && "v" in v && (v as { v?: string }).v === "sim")
      sim += 1;
  }
  const total = Object.keys(respostas).length;
  const obsParts: string[] = [];
  if (c.referenciaOs?.trim()) obsParts.push(`Ref.: ${c.referenciaOs.trim()}`);
  if (c.protocolo?.trim()) obsParts.push(`Protocolo: ${c.protocolo.trim()}`);
  if (c.observacoesCampo?.trim()) obsParts.push(c.observacoesCampo.trim());
  const operadorExt = (c as ChecklistApp & { observacoesOperador?: string }).observacoesOperador;
  if (typeof operadorExt === "string" && operadorExt.trim()) {
    obsParts.push(`Obs. operador: ${operadorExt.trim()}`);
  }
  if (c.fotosResumo?.trim()) obsParts.push(`Anexos: ${c.fotosResumo.trim()}`);
  if (c.assinaturaDigital?.trim()) obsParts.push(c.assinaturaDigital.trim());

  const statusCore = total > 0 ? `${sim}/${total}` : "—";
  const Status_Ok_Nao = meta.statusResumo ? `${statusCore} · ${meta.statusResumo}` : statusCore;
  const dh = meta.dataHora ?? String(c.sincronizadoEm ?? "");

  return {
    ID_Registro: idRegistro,
    Data_Hora: dh,
    Operador: meta.operador ?? "—",
    Status_Ok_Nao,
    Categoria: "",
    Respostas_JSON: JSON.stringify(respostas),
    ID_Maquina: meta.equipamento ?? "—",
    Marca: "—",
    Modelo: "—",
    Chassis: meta.chassis ?? "—",
    Horimetro_Final: c.horimetroCampo ?? "—",
    Obs: obsParts.join("\n\n"),
    [HU360_HIST_ITEM_LABELS]: JSON.stringify(itemLabels),
  };
}
