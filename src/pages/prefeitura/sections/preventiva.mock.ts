export type PreventivaStatus = "em_dia" | "vencida" | "proxima";

export type PreventivaRow = {
  idChassiPlaca: string;
  nomeEquipamento: string;
  tipoMedidor: "KM" | "Horimetro";
  planoIntervalo: string;
  ultimaPreventiva: string;
  proximaPreventivaMeta: string;
  leituraAtual: string;
  restanteParaVencer: string;
  status: PreventivaStatus;
  ultimaAtualizacao: string;
};

/**
 * Mock de referência para o backend (payload esperado pela tela de Preventiva).
 */
export const PREVENTIVAS_MOCK: PreventivaRow[] = [
  {
    idChassiPlaca: "9BFXXXXXXHZ000001",
    nomeEquipamento: "Trator John Deere 6100J",
    tipoMedidor: "Horimetro",
    planoIntervalo: "250 h",
    ultimaPreventiva: "1.000 h",
    proximaPreventivaMeta: "1.250 h",
    leituraAtual: "1.205 h",
    restanteParaVencer: "45 h",
    status: "proxima",
    ultimaAtualizacao: "01/06/2026",
  },
  {
    idChassiPlaca: "9BFXXXXXXHZ000002",
    nomeEquipamento: "Trator Case Ih Farmall 80",
    tipoMedidor: "Horimetro",
    planoIntervalo: "250 h",
    ultimaPreventiva: "500 h",
    proximaPreventivaMeta: "750 h",
    leituraAtual: "620 h",
    restanteParaVencer: "130 h",
    status: "em_dia",
    ultimaAtualizacao: "01/06/2026",
  },
  {
    idChassiPlaca: "ABC-1234",
    nomeEquipamento: "Caminhao Pipa VW 26.280",
    tipoMedidor: "KM",
    planoIntervalo: "10.000 km",
    ultimaPreventiva: "45.000 km",
    proximaPreventivaMeta: "55.000 km",
    leituraAtual: "54.850 km",
    restanteParaVencer: "150 km",
    status: "proxima",
    ultimaAtualizacao: "01/06/2026",
  },
  {
    idChassiPlaca: "XYZ-5678",
    nomeEquipamento: "Caminhao Cacamba MB 2726",
    tipoMedidor: "KM",
    planoIntervalo: "10.000 km",
    ultimaPreventiva: "12.000 km",
    proximaPreventivaMeta: "22.000 km",
    leituraAtual: "21.500 km",
    restanteParaVencer: "500 km",
    status: "proxima",
    ultimaAtualizacao: "31/05/2026",
  },
  {
    idChassiPlaca: "9BFXXXXXXHZ000003",
    nomeEquipamento: "Escavadeira Caterpillar 320",
    tipoMedidor: "Horimetro",
    planoIntervalo: "500 h",
    ultimaPreventiva: "2.000 h",
    proximaPreventivaMeta: "2.500 h",
    leituraAtual: "2.460 h",
    restanteParaVencer: "40 h",
    status: "vencida",
    ultimaAtualizacao: "01/06/2026",
  },
  {
    idChassiPlaca: "KGB-9012",
    nomeEquipamento: "Fiat Uno (Ronda)",
    tipoMedidor: "KM",
    planoIntervalo: "10.000 km",
    ultimaPreventiva: "80.000 km",
    proximaPreventivaMeta: "90.000 km",
    leituraAtual: "89.900 km",
    restanteParaVencer: "100 km",
    status: "proxima",
    ultimaAtualizacao: "01/06/2026",
  },
];
