/**
 * Login offline do operador: após um login online bem-sucedido, a credencial
 * (hash com o mesmo esquema do banco) fica no aparelho por 7 dias e permite
 * entrar sem rede. Sem rede não há como validar credencial nova — só quem
 * já logou neste aparelho entra offline.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashSenhaFuncionario,
  type Funcionario,
} from "../../lib/funcionarios/funcionarios";
import {
  autenticarOffline,
  provisionarCredenciaisPrefeitura,
  removerCredencialOffline,
  salvarCredencialOffline,
} from "./credenciais-offline";

const FUNC = {
  id: "f1",
  nome: "João Operador",
  cpf: "39053344705",
  prefeituraId: "pref-1",
  tipo: "operador",
  status: "ativo",
  loginGerado: "joao.operador",
} as Funcionario;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-11T08:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("credenciais-offline", () => {
  it("após salvar, autentica offline por CPF (mesmo com máscara)", async () => {
    await salvarCredencialOffline({
      funcionario: FUNC,
      empresa: "Prefeitura X",
      senha: "segredo1",
    });
    const r = await autenticarOffline("390.533.447-05", "segredo1");
    expect(r?.funcionario.nome).toBe("João Operador");
    expect(r?.empresa).toBe("Prefeitura X");
  });

  it("autentica offline pelo login gerado (case-insensitive)", async () => {
    await salvarCredencialOffline({
      funcionario: FUNC,
      empresa: "Prefeitura X",
      senha: "segredo1",
    });
    const r = await autenticarOffline("Joao.Operador", "segredo1");
    expect(r?.funcionario.id).toBe("f1");
  });

  it("senha errada → null", async () => {
    await salvarCredencialOffline({
      funcionario: FUNC,
      empresa: "Prefeitura X",
      senha: "segredo1",
    });
    expect(await autenticarOffline(FUNC.cpf, "errada")).toBeNull();
  });

  it("sem credencial salva → null", async () => {
    expect(await autenticarOffline(FUNC.cpf, "segredo1")).toBeNull();
  });

  it("credencial expira em 7 dias", async () => {
    await salvarCredencialOffline({
      funcionario: FUNC,
      empresa: "Prefeitura X",
      senha: "segredo1",
    });
    vi.setSystemTime(new Date("2026-06-18T08:00:01Z")); // 7d + 1s
    expect(await autenticarOffline(FUNC.cpf, "segredo1")).toBeNull();
  });

  it("novo login online renova a credencial (sem duplicar)", async () => {
    await salvarCredencialOffline({
      funcionario: FUNC,
      empresa: "Prefeitura X",
      senha: "segredo1",
    });
    await salvarCredencialOffline({
      funcionario: FUNC,
      empresa: "Prefeitura X",
      senha: "senha-nova",
    });
    expect(await autenticarOffline(FUNC.cpf, "segredo1")).toBeNull();
    expect(await autenticarOffline(FUNC.cpf, "senha-nova")).not.toBeNull();
  });

  it("removerCredencialOffline apaga a credencial do identificador", async () => {
    await salvarCredencialOffline({
      funcionario: FUNC,
      empresa: "Prefeitura X",
      senha: "segredo1",
    });
    removerCredencialOffline("joao.operador");
    expect(await autenticarOffline(FUNC.cpf, "segredo1")).toBeNull();
  });

  it("provisiona a prefeitura: operador loga offline sem nunca ter logado neste aparelho", async () => {
    const maria = {
      ...FUNC,
      id: "f2",
      nome: "Maria",
      cpf: "52998224725",
      loginGerado: "maria",
    } as Funcionario;
    // Hashes vêm prontos dos docs do Firestore (não recalculados da senha).
    provisionarCredenciaisPrefeitura(
      [
        { funcionario: FUNC, senhaHash: await hashSenhaFuncionario(FUNC.cpf, "s1") },
        { funcionario: maria, senhaHash: await hashSenhaFuncionario(maria.cpf, "s2") },
      ],
      "Prefeitura X",
    );
    expect((await autenticarOffline(FUNC.cpf, "s1"))?.funcionario.id).toBe("f1");
    expect((await autenticarOffline("maria", "s2"))?.funcionario.id).toBe("f2");
    expect(await autenticarOffline(FUNC.cpf, "errada")).toBeNull();
  });

  it("re-provisionar não duplica e renova o prazo", async () => {
    const item = {
      funcionario: FUNC,
      senhaHash: await hashSenhaFuncionario(FUNC.cpf, "s1"),
    };
    provisionarCredenciaisPrefeitura([item], "Prefeitura X");
    provisionarCredenciaisPrefeitura([item], "Prefeitura X");
    const raw = JSON.parse(
      localStorage.getItem("hu360-credenciais-offline") ?? "[]",
    ) as unknown[];
    expect(raw).toHaveLength(1);
  });

  it("provisionar preserva credencial de login individual já existente", async () => {
    await salvarCredencialOffline({
      funcionario: FUNC,
      empresa: "Prefeitura X",
      senha: "s1",
    });
    const outro = { ...FUNC, id: "f9", cpf: "11144477735", loginGerado: "ze" } as Funcionario;
    provisionarCredenciaisPrefeitura(
      [{ funcionario: outro, senhaHash: await hashSenhaFuncionario(outro.cpf, "s9") }],
      "Prefeitura X",
    );
    expect(await autenticarOffline(FUNC.cpf, "s1")).not.toBeNull();
    expect(await autenticarOffline("ze", "s9")).not.toBeNull();
  });

  it("suporta mais de um operador no mesmo aparelho", async () => {
    const maria = { ...FUNC, id: "f2", nome: "Maria", cpf: "52998224725", loginGerado: "maria" } as Funcionario;
    await salvarCredencialOffline({
      funcionario: FUNC,
      empresa: "Prefeitura X",
      senha: "segredo1",
    });
    await salvarCredencialOffline({
      funcionario: maria,
      empresa: "Prefeitura X",
      senha: "segredo2",
    });
    expect((await autenticarOffline(FUNC.cpf, "segredo1"))?.funcionario.id).toBe("f1");
    expect((await autenticarOffline(maria.cpf, "segredo2"))?.funcionario.id).toBe("f2");
  });
});
