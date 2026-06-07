import { useEffect, useMemo, useState } from "react";

import {

  Building2,

  CalendarDays,

  DollarSign,

  Gauge,

  Truck,

  type LucideIcon,

} from "lucide-react";

import {

  abastecimentosApi,

  type AbastecimentoTela,

} from "../../../lib/api/abastecimentos";

import type { DadosPrefeitura } from "../../../lib/hu360/types";

import {

  calcularConsumoMedio,

  calcularKpisVisaoGeral,

  fmtLitros,

  fmtMoeda,

  fmtPeriodoExibicao,

  type ConsumoVeiculo,

} from "./abastecimentoVisaoGeral";

import "./abastecimento-visao-geral.css";



interface AbastecimentoVisaoGeralSectionProps {

  dados: DadosPrefeitura;

  prefeituraId: string;

}



function isoInicioMes(): string {

  const d = new Date();

  const y = d.getFullYear();

  const m = String(d.getMonth() + 1).padStart(2, "0");

  return `${y}-${m}-01`;

}



function isoHoje(): string {

  const d = new Date();

  const y = d.getFullYear();

  const m = String(d.getMonth() + 1).padStart(2, "0");

  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;

}



function chaveCache(

  prefeituraId: string,

  inicio: string,

  fim: string,

): string {

  return `${prefeituraId}|${inicio}|${fim}|v4`;

}



const cacheAbastecimentos = new Map<string, AbastecimentoTela[]>();



type KpiCard = {

  id: string;

  Icon: LucideIcon;

  iconClass: string;

  valor: string;

  label: string;

};



function BarraConsumo({

  item,

  larguraPct,

}: {

  item: ConsumoVeiculo;

  larguraPct: number;

}) {

  return (

    <div className="avgv-chart-row">

      <div className="avgv-chart-veiculo">

        <strong>{item.nome}</strong>

        <span>

          {item.placa} · {item.categoria}

        </span>

      </div>

      <div className="avgv-bar-track" aria-hidden>

        <div

          className="avgv-bar-fill"

          style={{ width: `${larguraPct}%` }}

        />

      </div>

      <div className="avgv-chart-valor">{item.consumoLabel}</div>

    </div>

  );

}



export function AbastecimentoVisaoGeralSection({

  prefeituraId,

}: AbastecimentoVisaoGeralSectionProps) {

  const [periodoInicio, setPeriodoInicio] = useState(isoInicioMes);

  const [periodoFim, setPeriodoFim] = useState(isoHoje);

  const [lista, setLista] = useState<AbastecimentoTela[]>([]);

  const [carregando, setCarregando] = useState(false);

  const [erro, setErro] = useState<string | null>(null);



  useEffect(() => {

    if (!prefeituraId || !periodoInicio || !periodoFim) return;



    const chave = chaveCache(prefeituraId, periodoInicio, periodoFim);

    const emCache = cacheAbastecimentos.get(chave);

    if (emCache) {

      setLista(emCache);

      setErro(null);

      setCarregando(false);

      return;

    }



    let ativo = true;

    setCarregando(true);

    setErro(null);



    abastecimentosApi

      .listarPorPeriodo(prefeituraId, periodoInicio, periodoFim)

      .then((data) => {

        if (!ativo) return;

        cacheAbastecimentos.set(chave, data);

        setLista(data);

      })

      .catch((e) => {

        if (!ativo) return;

        setLista([]);

        setErro(

          e instanceof Error

            ? e.message

            : "Não foi possível carregar os dados.",

        );

      })

      .finally(() => {

        if (ativo) setCarregando(false);

      });



    return () => {

      ativo = false;

    };

  }, [prefeituraId, periodoInicio, periodoFim]);



  const kpis = useMemo(() => calcularKpisVisaoGeral(lista), [lista]);

  const consumos = useMemo(() => calcularConsumoMedio(lista), [lista]);



  const maxConsumo = useMemo(

    () => Math.max(...consumos.map((c) => c.consumo), 0.001),

    [consumos],

  );



  const kpiCards: KpiCard[] = useMemo(

    () => [

      {

        id: "comboio",

        Icon: Truck,

        iconClass: "avgv-kpi-icon--amarelo",

        valor: fmtLitros(kpis.litrosComboio),

        label: "Litros pelo comboio",

      },

      {

        id: "posto",

        Icon: Building2,

        iconClass: "avgv-kpi-icon--verde",

        valor: fmtLitros(kpis.litrosPosto),

        label: "Litros em posto",

      },

      {

        id: "gasto",

        Icon: DollarSign,

        iconClass: "avgv-kpi-icon--laranja",

        valor: fmtMoeda(kpis.gastoPostos),

        label: "Gasto em postos",

      },

      {

        id: "veiculos",

        Icon: Gauge,

        iconClass: "avgv-kpi-icon--cinza",

        valor: String(kpis.veiculosAtivos),

        label: "Veículos ativos",

      },

    ],

    [kpis],

  );



  return (

    <section className="pf-section">

      <header className="pf-section-head avgv-header">

        <div className="avgv-header-text">

          <h1 className="pf-section-title">Visão Geral</h1>

          <p className="avgv-periodo-label">

            <CalendarDays size={15} strokeWidth={2} aria-hidden />

            Período: {fmtPeriodoExibicao(periodoInicio, periodoFim)}

          </p>

        </div>



        <div className="avgv-periodo">

          <span className="avgv-periodo-field-label">Período</span>

          <input

            id="avgv-periodo-inicio"

            type="date"

            className="avgv-periodo-input"

            value={periodoInicio}

            onChange={(e) => setPeriodoInicio(e.target.value)}

            aria-label="Data inicial do período"

          />

          <span className="avgv-periodo-sep" aria-hidden>

            —

          </span>

          <input

            id="avgv-periodo-fim"

            type="date"

            className="avgv-periodo-input"

            value={periodoFim}

            onChange={(e) => setPeriodoFim(e.target.value)}

            aria-label="Data final do período"

          />

        </div>

      </header>



      {erro ? (

        <p className="avgv-msg avgv-msg--erro" role="alert">

          {erro}

        </p>

      ) : null}



      <div className="avgv-kpis">

        {kpiCards.map((card) => (

          <article key={card.id} className="avgv-kpi">

            <div className={`avgv-kpi-icon ${card.iconClass}`} aria-hidden>

              <card.Icon size={18} strokeWidth={2.25} />

            </div>

            <div className="avgv-kpi-body">

              <strong>{card.valor}</strong>

              <span>{card.label}</span>

            </div>

          </article>

        ))}

      </div>



      <article className="avgv-chart-card">

        <div className="avgv-chart-head">

          <h2 className="avgv-chart-title">Consumo médio por veículo</h2>

          <p className="avgv-chart-hint">

            litros por hora (máquinas) ou por km (carros e caminhões)

          </p>

        </div>



        {carregando ? (

          <p className="avgv-chart-empty">Carregando consumo…</p>

        ) : consumos.length === 0 ? (

          <p className="avgv-chart-empty">

            Nenhum abastecimento no período para calcular o consumo.

          </p>

        ) : (

          <div className="avgv-chart-list">

            {consumos.map((item) => (

              <BarraConsumo

                key={item.id}

                item={item}

                larguraPct={(item.consumo / maxConsumo) * 100}

              />

            ))}

          </div>

        )}

      </article>

    </section>

  );

}


