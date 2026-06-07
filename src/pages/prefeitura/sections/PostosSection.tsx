import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, DollarSign, Fuel, type LucideIcon } from "lucide-react";
import {
  calcularKpisPostos,
  postosApi,
  type PostoTela,
} from "../../../lib/api/postos";
import type { DadosPrefeitura } from "../../../lib/hu360/types";
import { baixarPlanilhaPostos } from "./postosExport";
import "./postos.css";

interface PostosSectionProps {
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

function fmtMoeda(v: number): string {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type KpiCardConfig = {
  id: string;
  Icon: LucideIcon;
  iconClass: string;
  valor: string;
  label: string;
};

function montarKpisCards(
  kpis: ReturnType<typeof calcularKpisPostos>,
): KpiCardConfig[] {
  return [
    {
      id: "postos",
      Icon: Building2,
      iconClass: "pst-kpi-icon--verde",
      valor: String(kpis.totalPostos),
      label: "Postos cadastrados",
    },
    {
      id: "abastecimentos",
      Icon: Fuel,
      iconClass: "pst-kpi-icon--amarelo",
      valor: String(kpis.totalAbastecimentos),
      label: "Abastecimentos em posto",
    },
    {
      id: "gasto",
      Icon: DollarSign,
      iconClass: "pst-kpi-icon--vermelho",
      valor: fmtMoeda(kpis.totalGasto),
      label: "Total gasto em postos",
    },
  ];
}

const cachePostos = new Map<string, PostoTela[]>();
const buscaEmAndamento = new Map<string, Promise<PostoTela[]>>();

function obterPostos(prefeituraId: string): Promise<PostoTela[]> {
  const emCache = cachePostos.get(prefeituraId);
  if (emCache) return Promise.resolve(emCache);

  const pendente = buscaEmAndamento.get(prefeituraId);
  if (pendente) return pendente;

  const promessa = postosApi
    .listar(prefeituraId)
    .then((data) => {
      cachePostos.set(prefeituraId, data);
      buscaEmAndamento.delete(prefeituraId);
      return data;
    })
    .catch((erro) => {
      buscaEmAndamento.delete(prefeituraId);
      throw erro;
    });

  buscaEmAndamento.set(prefeituraId, promessa);
  return promessa;
}

export function PostosSection({ prefeituraId }: PostosSectionProps) {
  const [periodoInicio, setPeriodoInicio] = useState(isoInicioMes);
  const [periodoFim, setPeriodoFim] = useState(isoHoje);
  const [postos, setPostos] = useState<PostoTela[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!prefeituraId) return;

    const emCache = cachePostos.get(prefeituraId);
    if (emCache) {
      setPostos(emCache);
      setErro(null);
      setCarregando(false);
      return;
    }

    let ativo = true;
    setCarregando(true);
    setErro(null);

    obterPostos(prefeituraId)
      .then((data) => {
        if (!ativo) return;
        setPostos(data);
      })
      .catch((e) => {
        if (!ativo) return;
        setPostos([]);
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar os postos.",
        );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [prefeituraId]);

  const kpis = useMemo(() => calcularKpisPostos(postos), [postos]);
  const kpiCards = useMemo(() => montarKpisCards(kpis), [kpis]);
  const podeExportar = !carregando && postos.length > 0;

  const handleExportar = useCallback(() => {
    if (!podeExportar) return;
    baixarPlanilhaPostos(postos, {
      prefeituraId,
      periodoInicio,
      periodoFim,
    });
  }, [podeExportar, postos, prefeituraId, periodoInicio, periodoFim]);

  return (
    <section className="pf-section">
      <header className="pf-section-head pst-header">
        <h1 className="pf-section-title">Postos Cadastrados</h1>

        <div className="pst-periodo">
          <label htmlFor="pst-periodo-inicio" className="pst-periodo-label">
            Período
          </label>
          <input
            id="pst-periodo-inicio"
            type="date"
            className="pst-periodo-input"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            aria-label="Data inicial do período"
          />
          <span className="pst-periodo-sep" aria-hidden>
            —
          </span>
          <input
            id="pst-periodo-fim"
            type="date"
            className="pst-periodo-input"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            aria-label="Data final do período"
          />
        </div>
      </header>

      <div className="pst-kpis">
        {kpiCards.map((card) => (
          <article key={card.id} className="pst-kpi">
            <div className={`pst-kpi-icon ${card.iconClass}`} aria-hidden>
              <card.Icon size={18} strokeWidth={2.25} />
            </div>
            <div className="pst-kpi-body">
              <strong>{card.valor}</strong>
              <span>{card.label}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="pst-card">
        <div className="pst-card-head">
          <p className="pst-nota">
            Postos onde os veículos podem abastecer. O sistema do posto envia os
            abastecimentos automaticamente.
          </p>
          <button
            type="button"
            className="pst-btn-export"
            onClick={handleExportar}
            disabled={!podeExportar}
            title={
              podeExportar
                ? "Exportar lista para planilha"
                : "Nenhum posto para exportar"
            }
          >
            <span aria-hidden>⬇️</span> Baixar planilha
          </button>
        </div>

        {erro ? (
          <p className="pst-msg pst-msg--erro" role="alert">
            {erro}
          </p>
        ) : null}

        <div className="pst-table-wrap">
          <table className="pst-table">
            <thead>
              <tr>
                <th>Posto</th>
                <th>Endereço</th>
                <th>Preço/L</th>
                <th>Abastec.</th>
                <th>Litros</th>
                <th>Gasto</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={6} className="pst-table-empty">
                    Carregando postos…
                  </td>
                </tr>
              ) : postos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="pst-table-empty">
                    Nenhum posto cadastrado.
                  </td>
                </tr>
              ) : (
                postos.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="pst-td-posto">
                        <strong>{item.nome}</strong>
                        <span>{item.codigo}</span>
                      </div>
                    </td>
                    <td>
                      <span className="pst-badge-endereco">
                        <span aria-hidden>📍</span> {item.endereco}
                      </span>
                    </td>
                    <td className="pst-td-preco">{item.precoLitroLabel}</td>
                    <td>{item.abastecimentos}</td>
                    <td className="pst-td-litros">{item.litrosLabel}</td>
                    <td className="pst-td-gasto">{item.gastoLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
