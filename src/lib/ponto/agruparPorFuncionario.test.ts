import { describe, expect, it } from "vitest";
import {
  agruparPorFuncionario,
  diasEntre,
  intervaloDoPeriodo,
  statusDoDia,
} from "./agruparPorFuncionario";
import type { PontoRegistro } from "../api/pontos";
import type { Escala } from "../api/escala";
import type { Funcionario } from "../funcionarios/funcionarios";
import type { Abono } from "../api/abonos";

function b(
  name: string,
  iso: string,
  tipo: PontoRegistro["tipo"],
  status: PontoRegistro["status"] = "aprovado",
): PontoRegistro {
  return {
    id: `${name}-${tipo}-${iso}`,
    name,
    prefeituraId: "p1",
    timestampOriginal: iso,
    tipo,
    status,
  };
}

const ESCALA: Escala = {
  prefeituraId: "p1",
  inicio: "08:00",
  fim: "18:00",
  diasSemana: [1, 2, 3, 4, 5],
  almocoMinutos: 60,
};

const FUNCIONARIO_JOAO: Funcionario = {
  id: "f1",
  prefeituraId: "p1",
  nome: "João Silva",
  cpf: "11122233344",
  cargo: "Operador",
  tipo: "operador",
  status: "ativo",
  temSenha: true,
};

describe("statusDoDia", () => {
  it("retorna 'sem-jornada' em fim de semana", () => {
    // 2026-05-30 é sábado
    expect(statusDoDia([], ESCALA, "2026-05-30")).toBe("sem-jornada");
  });

  it("retorna 'falta' em dia útil sem batidas", () => {
    expect(statusDoDia([], ESCALA, "2026-05-27")).toBe("falta");
  });

  it("retorna 'incompleto' quando falta entrada ou saída", () => {
    const so = [b("X", "2026-05-27T08:00:00", "entrada")];
    expect(statusDoDia(so, ESCALA, "2026-05-27")).toBe("incompleto");
  });

  it("retorna 'atraso' quando entrada passa da tolerância de 5min", () => {
    const lista = [
      b("X", "2026-05-27T08:06:00", "entrada"),
      b("X", "2026-05-27T18:00:00", "saida"),
    ];
    expect(statusDoDia(lista, ESCALA, "2026-05-27")).toBe("atraso");
  });

  it("retorna 'ok' quando entrada está dentro da tolerância", () => {
    const lista = [
      b("X", "2026-05-27T08:05:00", "entrada"),
      b("X", "2026-05-27T18:00:00", "saida"),
    ];
    expect(statusDoDia(lista, ESCALA, "2026-05-27")).toBe("ok");
  });

  it("sem escala definida, dia com entrada+saída fica 'ok'", () => {
    const lista = [
      b("X", "2026-05-27T10:00:00", "entrada"),
      b("X", "2026-05-27T20:00:00", "saida"),
    ];
    expect(statusDoDia(lista, null, "2026-05-27")).toBe("ok");
  });
});

describe("diasEntre", () => {
  it("retorna os dias inclusivos em ordem cronológica", () => {
    expect(diasEntre("2026-05-25", "2026-05-27")).toEqual([
      "2026-05-25",
      "2026-05-26",
      "2026-05-27",
    ]);
  });

  it("retorna um único dia quando início = fim", () => {
    expect(diasEntre("2026-05-27", "2026-05-27")).toEqual(["2026-05-27"]);
  });
});

describe("intervaloDoPeriodo", () => {
  it("'hoje' retorna apenas o dia atual", () => {
    const r = intervaloDoPeriodo("hoje", new Date("2026-05-27T15:00:00"));
    expect(r.dias).toEqual(["2026-05-27"]);
  });

  it("'ontem' retorna o dia anterior", () => {
    const r = intervaloDoPeriodo("ontem", new Date("2026-05-27T15:00:00"));
    expect(r.dias).toEqual(["2026-05-26"]);
  });

  it("'semana' retorna 7 dias acabando em hoje", () => {
    const r = intervaloDoPeriodo("semana", new Date("2026-05-27T15:00:00"));
    expect(r.dias.length).toBe(7);
    expect(r.dias[r.dias.length - 1]).toBe("2026-05-27");
  });
});

describe("agruparPorFuncionario", () => {
  it("inclui funcionários ativos sem batida (faltas)", () => {
    const r = agruparPorFuncionario(
      [], // sem batidas
      [FUNCIONARIO_JOAO],
      ["2026-05-27"],
      ESCALA,
    );
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("João Silva");
    expect(r[0].dias[0].status).toBe("falta");
    expect(r[0].totais.faltas).toBe(1);
  });

  it("casa batidas com o cadastro pelo nome (case-insensitive)", () => {
    const batidas = [
      b("joão silva", "2026-05-27T08:00:00", "entrada"),
      b("joão silva", "2026-05-27T18:00:00", "saida"),
    ];
    const r = agruparPorFuncionario(
      batidas,
      [FUNCIONARIO_JOAO],
      ["2026-05-27"],
      ESCALA,
    );
    expect(r[0].funcionario?.id).toBe("f1");
    // Prefere o nome com capitalização do cadastro
    expect(r[0].nome).toBe("João Silva");
    expect(r[0].dias[0].status).toBe("ok");
  });

  it("inclui pessoa sem cadastro (somente batidas)", () => {
    const batidas = [b("desconhecido", "2026-05-27T08:00:00", "entrada")];
    const r = agruparPorFuncionario(batidas, [], ["2026-05-27"], ESCALA);
    expect(r).toHaveLength(1);
    expect(r[0].funcionario).toBeNull();
    expect(r[0].nome).toBe("desconhecido");
    expect(r[0].dias[0].status).toBe("incompleto");
  });

  it("conta totais agregados do período", () => {
    const batidas = [
      // dia 1: ok
      b("X", "2026-05-26T08:00:00", "entrada"),
      b("X", "2026-05-26T18:00:00", "saida"),
      // dia 2: atraso
      b("X", "2026-05-27T08:10:00", "entrada"),
      b("X", "2026-05-27T18:00:00", "saida"),
    ];
    const r = agruparPorFuncionario(
      batidas,
      [],
      ["2026-05-26", "2026-05-27"],
      ESCALA,
    );
    expect(r[0].totais.diasOk).toBe(1);
    expect(r[0].totais.atrasos).toBe(1);
  });

  it("ordena quem tem mais sinais negativos primeiro", () => {
    const ativos: Funcionario[] = [
      { ...FUNCIONARIO_JOAO, id: "fA", nome: "Ana" },
      { ...FUNCIONARIO_JOAO, id: "fB", nome: "Bruno" },
    ];
    const batidas = [
      // Ana: ok
      b("Ana", "2026-05-27T08:00:00", "entrada"),
      b("Ana", "2026-05-27T18:00:00", "saida"),
      // Bruno: atraso
      b("Bruno", "2026-05-27T08:30:00", "entrada"),
      b("Bruno", "2026-05-27T18:00:00", "saida"),
    ];
    const r = agruparPorFuncionario(batidas, ativos, ["2026-05-27"], ESCALA);
    expect(r[0].nome).toBe("Bruno"); // atraso primeiro
    expect(r[1].nome).toBe("Ana");
  });

  it("conta batidas pendentes no agregado", () => {
    const batidas = [
      b("X", "2026-05-27T08:00:00", "entrada", "pendente"),
      b("X", "2026-05-27T18:00:00", "saida", "aprovado"),
    ];
    const r = agruparPorFuncionario(batidas, [], ["2026-05-27"], ESCALA);
    expect(r[0].totais.pendentes).toBe(1);
  });

  it("ignora batidas com status='cancelado' (vindas de aprovação de cancelamento)", () => {
    const batidas = [
      b("X", "2026-05-27T08:00:00", "entrada", "aprovado"),
      // saída foi cancelada → não deve contar; dia fica incompleto
      b("X", "2026-05-27T18:00:00", "saida", "cancelado"),
    ];
    const r = agruparPorFuncionario(batidas, [], ["2026-05-27"], ESCALA);
    expect(r[0].dias[0].batidas).toHaveLength(1);
    expect(r[0].dias[0].status).toBe("incompleto");
  });

  it("converte falta em 'abonado' quando há abono ativo pro CPF/dia", () => {
    const abono: Abono = {
      id: "ab1",
      prefeituraId: "p1",
      funcionarioCpf: "11122233344",
      funcionarioNome: "João Silva",
      data: "2026-05-27",
      motivo: "Consulta médica",
      solicitacaoId: "sol1",
      createdAt: "2026-05-27T10:00:00Z",
    };
    const r = agruparPorFuncionario(
      [], // sem batidas
      [FUNCIONARIO_JOAO],
      ["2026-05-27"],
      ESCALA,
      [abono],
    );
    expect(r[0].dias[0].status).toBe("abonado");
    expect(r[0].dias[0].motivoAbono).toBe("Consulta médica");
    expect(r[0].totais.faltas).toBe(0);
    expect(r[0].totais.abonados).toBe(1);
  });

  it("dia abonado conta horas previstas no trabalhado (saldo neutro)", () => {
    const abono: Abono = {
      id: "ab1",
      prefeituraId: "p1",
      funcionarioCpf: "11122233344",
      funcionarioNome: "João Silva",
      data: "2026-05-27",
      motivo: null,
      createdAt: "2026-05-27T10:00:00Z",
    };
    const r = agruparPorFuncionario(
      [],
      [FUNCIONARIO_JOAO],
      ["2026-05-27"],
      ESCALA,
      [abono],
    );
    // Escala 08:00-18:00 com 60 min de almoço = 9h previstas = 540 min
    expect(r[0].dias[0].previstoMin).toBe(540);
    expect(r[0].dias[0].trabalhadoMin).toBe(540);
    expect(r[0].dias[0].saldoMin).toBe(0);
    expect(r[0].totais.saldoMin).toBe(0);
  });

  it("abono não afeta dia que já tem batidas", () => {
    const abono: Abono = {
      id: "ab1",
      prefeituraId: "p1",
      funcionarioCpf: "11122233344",
      funcionarioNome: "João Silva",
      data: "2026-05-27",
      motivo: null,
      createdAt: "2026-05-27T10:00:00Z",
    };
    const batidas = [
      b("João Silva", "2026-05-27T08:00:00", "entrada"),
      b("João Silva", "2026-05-27T18:00:00", "saida"),
    ];
    const r = agruparPorFuncionario(
      batidas,
      [FUNCIONARIO_JOAO],
      ["2026-05-27"],
      ESCALA,
      [abono],
    );
    // Mesmo com abono, batidas presentes → status 'ok'
    expect(r[0].dias[0].status).toBe("ok");
    expect(r[0].totais.abonados).toBe(0);
  });

  it("abono sem CPF casado (funcionário não cadastrado) não é aplicado", () => {
    const abono: Abono = {
      id: "ab1",
      prefeituraId: "p1",
      funcionarioCpf: "11122233344",
      funcionarioNome: "Desconhecido",
      data: "2026-05-27",
      motivo: null,
      createdAt: "2026-05-27T10:00:00Z",
    };
    const r = agruparPorFuncionario(
      [],
      [], // sem cadastro
      ["2026-05-27"],
      ESCALA,
      [abono],
    );
    // Sem batidas e sem funcionário cadastrado, o resumo nem existe
    expect(r).toHaveLength(0);
  });
});
