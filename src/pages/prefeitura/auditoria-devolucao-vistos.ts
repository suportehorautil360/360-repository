const STORAGE_PREFIX = "hu360:chd-auditoria-vistos:";

export interface ChdAuditoriaVistosState {
  initialized: boolean;
  viewedIds: string[];
}

function storageKey(prefeituraId: string): string {
  return `${STORAGE_PREFIX}${prefeituraId}`;
}

export function lerChdAuditoriaVistos(
  prefeituraId: string,
): ChdAuditoriaVistosState {
  if (!prefeituraId || typeof localStorage === "undefined") {
    return { initialized: false, viewedIds: [] };
  }

  try {
    const raw = localStorage.getItem(storageKey(prefeituraId));
    if (!raw) {
      return { initialized: false, viewedIds: [] };
    }
    const parsed = JSON.parse(raw) as Partial<ChdAuditoriaVistosState>;
    const viewedIds = Array.isArray(parsed.viewedIds)
      ? parsed.viewedIds.filter((id): id is string => typeof id === "string")
      : [];
    return {
      initialized: parsed.initialized === true,
      viewedIds: [...new Set(viewedIds)],
    };
  } catch {
    return { initialized: false, viewedIds: [] };
  }
}

function salvarChdAuditoriaVistos(
  prefeituraId: string,
  state: ChdAuditoriaVistosState,
): void {
  if (!prefeituraId || typeof localStorage === "undefined") return;
  localStorage.setItem(
    storageKey(prefeituraId),
    JSON.stringify({
      initialized: state.initialized,
      viewedIds: [...new Set(state.viewedIds)],
    }),
  );
}

export function emitChdAuditoriaVistosAtualizado(prefeituraId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("hu360:chd-auditoria-vistos", {
      detail: { prefeituraId },
    }),
  );
}

/** Na 1ª carga, marca os CHDs já existentes como vistos (só os novos disparam alerta). */
export function sincronizarBaselineChdAuditoria(
  prefeituraId: string,
  chdIds: string[],
): ChdAuditoriaVistosState {
  const atual = lerChdAuditoriaVistos(prefeituraId);
  if (atual.initialized || chdIds.length === 0) return atual;

  const next: ChdAuditoriaVistosState = {
    initialized: true,
    viewedIds: [...new Set(chdIds)],
  };
  salvarChdAuditoriaVistos(prefeituraId, next);
  return next;
}

export function marcarChdAuditoriaVisto(
  prefeituraId: string,
  chdId: string,
  chdIdsAtuais: string[] = [],
): ChdAuditoriaVistosState {
  const base = sincronizarBaselineChdAuditoria(prefeituraId, chdIdsAtuais);
  if (!chdId || base.viewedIds.includes(chdId)) {
    return base;
  }

  const next: ChdAuditoriaVistosState = {
    initialized: true,
    viewedIds: [...base.viewedIds, chdId],
  };
  salvarChdAuditoriaVistos(prefeituraId, next);
  emitChdAuditoriaVistosAtualizado(prefeituraId);
  return next;
}

export function contarChdsAuditoriaNaoVistos(
  prefeituraId: string,
  chdIds: string[],
): number {
  const state = sincronizarBaselineChdAuditoria(prefeituraId, chdIds);
  return chdIds.filter((id) => !state.viewedIds.includes(id)).length;
}

export function chdAuditoriaNaoVisto(
  prefeituraId: string,
  chdId: string,
  chdIdsAtuais: string[] = [],
): boolean {
  const state = sincronizarBaselineChdAuditoria(prefeituraId, chdIdsAtuais);
  return !state.viewedIds.includes(chdId);
}

export function idsChdsAuditoriaNaoVistos(
  prefeituraId: string,
  chdIds: string[],
): string[] {
  const state = sincronizarBaselineChdAuditoria(prefeituraId, chdIds);
  return chdIds.filter((id) => !state.viewedIds.includes(id));
}
