import { describe, expect, it, beforeEach } from "vitest";
import {
  chdAuditoriaNaoVisto,
  contarChdsAuditoriaNaoVistos,
  lerChdAuditoriaVistos,
  marcarChdAuditoriaVisto,
  sincronizarBaselineChdAuditoria,
} from "./auditoria-devolucao-vistos";

const PREFEITURA = "pref-test";

describe("auditoria-devolucao-vistos", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("faz baseline na primeira carga sem contar CHDs antigos", () => {
    sincronizarBaselineChdAuditoria(PREFEITURA, ["chd-1", "chd-2"]);
    expect(contarChdsAuditoriaNaoVistos(PREFEITURA, ["chd-1", "chd-2"])).toBe(0);
    expect(contarChdsAuditoriaNaoVistos(PREFEITURA, ["chd-1", "chd-2", "chd-3"])).toBe(
      1,
    );
  });

  it("marca CHD como visto ao abrir detalhes", () => {
    sincronizarBaselineChdAuditoria(PREFEITURA, ["chd-1"]);
    marcarChdAuditoriaVisto(PREFEITURA, "chd-2", ["chd-1", "chd-2"]);
    expect(chdAuditoriaNaoVisto(PREFEITURA, "chd-2", ["chd-1", "chd-2"])).toBe(
      false,
    );
    expect(lerChdAuditoriaVistos(PREFEITURA).viewedIds).toContain("chd-2");
  });
});
