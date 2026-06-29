/** Payload mock alinhado à spec V2 — Caso 1 (KM) + Caso 2 (HORA sem preço). */
export const consumoCustoApiMock = {
  data: {
    titulo: "Consumo & Custo por Veículo",
    periodo: {
      label: "01/06/2026 — 30/06/2026",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    },
    calculo: {
      titulo: "Como o consumo e o custo são calculados",
      formulaConsumo:
        "Consumo = litros do abastecimento ÷ (leitura atual − leitura anterior)",
      formulaCusto:
        "Quando há preço por litro, o gasto = litros × preço/l e o custo unitário = consumo médio × preço/l.",
      observacao:
        "Válido para carros, caminhões e máquinas pesadas. Em campo, o consumo usa os litros do reabastecimento que completa o tanque.",
    },
    veiculos: [
      {
        equipmentId: "eq-frota-1",
        nome: "Frota Teste E2E",
        placa: "ABC-1234",
        tipo: "Carro Leve",
        setor: "Garagem",
        subtitulo: "ABC-1234 · Carro Leve · Garagem",
        measurementType: "odometro",
        unidadeMedicao: "km",
        temCusto: true,
        consumoMedio: {
          rotulo: "MÉDIO L/KM",
          valor: 0.15,
          valorExibicao: "0,15 L/km",
        },
        custoMedio: {
          rotulo: "CUSTO /KM",
          valor: 0.8985,
          valorExibicao: "R$ 0,90/km",
        },
        totalDestaque: {
          tipo: "gasto",
          rotulo: "GASTO TOTAL",
          valor: 269.55,
          valorExibicao: "R$ 269,55",
        },
        totais: {
          litros: 45,
          litrosExibicao: "45,000 L",
          gasto: 269.55,
          gastoExibicao: "R$ 269,55",
        },
        historicoIntervalos: [
          {
            periodoLabel: "01/06/2026, 08:00 → 15/06/2026, 12:00",
            distanciaLabel: "300 km",
            consumoLabel: "0,15 L/km",
            custoLabel: "R$ 0,90/km",
          },
        ],
        historicoAbastecimentos: [],
      },
      {
        equipmentId: "eq-campo-1",
        nome: "Escavadeira E2E",
        placa: "MAQ-001",
        tipo: "Linha Amarela",
        setor: "Obra",
        subtitulo: "MAQ-001 · Linha Amarela · Obra",
        measurementType: "horimetro",
        unidadeMedicao: "h",
        temCusto: false,
        consumoMedio: {
          rotulo: "MÉDIO L/H",
          valor: 43.75,
          valorExibicao: "43,75 L/h",
        },
        custoMedio: {
          rotulo: "CUSTO /H",
          valor: null,
          valorExibicao: "—",
        },
        totalDestaque: {
          tipo: "litros",
          rotulo: "LITROS TOTAL",
          valor: 350,
          valorExibicao: "350,000 L",
        },
        totais: {
          litros: 350,
          litrosExibicao: "350,000 L",
          gasto: 0,
          gastoExibicao: "R$ 0,00",
        },
        historicoIntervalos: [
          {
            periodoLabel: "01/06/2026, 08:00 → 02/06/2026, 18:00",
            distanciaLabel: "8 h",
            consumoLabel: "43,75 L/h",
            custoLabel: "—",
          },
        ],
        historicoAbastecimentos: [],
      },
    ],
  },
  message: "Consumo e custo buscados com sucesso!",
};
