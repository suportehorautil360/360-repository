/**
 * Helpers do fluxo de salvamento offline do checklist do operador.
 *
 * Cobrem os três bugs do diagnóstico:
 * 1. histórico local estourando a cota do localStorage e abortando o save;
 * 2. `await addDoc` offline nunca resolvendo (botão "Salvando..." eterno);
 * 3. documento do Firestore passando do limite de 1 MiB por causa das fotos.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  comprimirAteOrcamento,
  esperarAckComTimeout,
  salvarHistoricoLocal,
  tamanhoDocBytes,
} from "./salvar-offline";

const KEY = "teste-historico";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("salvarHistoricoLocal", () => {
  it("grava as linhas como JSON na chave informada", () => {
    salvarHistoricoLocal(KEY, [{ id: "a" }, { id: "b" }]);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")).toEqual([
      { id: "a" },
      { id: "b" },
    ]);
  });

  it("poda o histórico para o máximo de entradas (mais recentes primeiro)", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: i }));
    salvarHistoricoLocal(KEY, rows, 20);
    const salvo = JSON.parse(localStorage.getItem(KEY) ?? "[]") as {
      id: number;
    }[];
    expect(salvo).toHaveLength(20);
    expect(salvo[0]).toEqual({ id: 0 });
  });

  it("reduz pela metade quando a cota estoura, sem lançar erro", () => {
    let chamadas = 0;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      k: string,
      v: string,
    ) {
      chamadas++;
      // As duas primeiras tentativas estouram a cota; a terceira cabe.
      if (chamadas <= 2) throw new DOMException("quota", "QuotaExceededError");
      Object.defineProperty(this, k, { value: v, configurable: true });
    });

    const rows = Array.from({ length: 8 }, (_, i) => ({ id: i }));
    expect(() => salvarHistoricoLocal(KEY, rows, 20)).not.toThrow();
    expect(chamadas).toBe(3); // 8 → 4 → 2 entradas
  });

  it("desiste em silêncio se nem uma entrada couber", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => salvarHistoricoLocal(KEY, [{ foto: "x".repeat(10) }])).not.toThrow();
  });
});

describe("esperarAckComTimeout", () => {
  it("offline: devolve 'pendente' na hora, sem aguardar a escrita", async () => {
    const nuncaResolve = new Promise<void>(() => {});
    await expect(
      esperarAckComTimeout(nuncaResolve, false, 15_000),
    ).resolves.toBe("pendente");
  });

  it("online com ack do servidor: devolve 'sincronizado'", async () => {
    await expect(
      esperarAckComTimeout(Promise.resolve(), true, 15_000),
    ).resolves.toBe("sincronizado");
  });

  it("online com rede travada: devolve 'pendente' após o timeout", async () => {
    vi.useFakeTimers();
    const nuncaResolve = new Promise<void>(() => {});
    const resultado = esperarAckComTimeout(nuncaResolve, true, 15_000);
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(resultado).resolves.toBe("pendente");
  });

  it("online com escrita rejeitada: propaga o erro", async () => {
    await expect(
      esperarAckComTimeout(Promise.reject(new Error("rules")), true, 15_000),
    ).rejects.toThrow("rules");
  });
});

describe("tamanhoDocBytes", () => {
  it("mede o JSON do payload em bytes UTF-8", () => {
    // '{"a":"é"}' tem 9 caracteres; "é" ocupa 2 bytes em UTF-8 → 10 bytes.
    expect(tamanhoDocBytes({ a: "é" })).toBe(10);
  });
});

describe("comprimirAteOrcamento", () => {
  it("devolve o primeiro resultado dentro do orçamento", () => {
    const encode = (q: number) => "x".repeat(Math.round(q * 100));
    expect(comprimirAteOrcamento(encode, 75, [0.9, 0.7, 0.5])).toBe(
      "x".repeat(70),
    );
  });

  it("devolve null quando nem a menor qualidade cabe", () => {
    const encode = () => "x".repeat(1000);
    expect(comprimirAteOrcamento(encode, 100, [0.9, 0.5, 0.3])).toBeNull();
  });
});
