import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import {
  funcionariosApi,
  type Funcionario,
} from "../../../lib/funcionarios/funcionarios";
import { pontosApi, type PontoRegistro } from "../../../lib/api/pontos";
import { escalaApi, type Escala } from "../../../lib/api/escala";
import { abonosApi, type Abono } from "../../../lib/api/abonos";
import {
  solicitacoesPontoApi,
  type SolicitacaoPonto,
} from "../../../lib/api/solicitacoes-ponto";
import { EspelhoDetalhado } from "../../checklist-controle/EspelhoDetalhado";
import { diaLocal, diaDaSolicitacao } from "./ponto-dia-utils";
import { formatarCpf } from "../../../lib/funcionarios/cpf";
import "./historico-ponto.css";

/**
 * Histórico de ponto de UM funcionário, visto pelo RH/gestor a partir do
 * painel da prefeitura. Reusa o componente EspelhoDetalhado (puro) usado
 * pelo operador na folha de ponto — mesma navegação mensal, totais por mês
 * e tabela diária — passando o nome do funcionário escolhido.
 *
 * A vinculação ponto × funcionário continua por `name` (string), pois é o
 * que o backend de time-records guarda. Casamos pelo cadastro de
 * `operadores` (nome, CPF, matrícula etc.) só para exibir contexto.
 */
export function HistoricoPontoSection({
  prefeituraId,
  funcId,
}: {
  prefeituraId: string;
  funcId: string;
}) {
  const navigate = useNavigate();
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [batidas, setBatidas] = useState<PontoRegistro[]>([]);
  const [escala, setEscala] = useState<Escala | null>(null);
  const [abonos, setAbonos] = useState<Abono[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoPonto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!prefeituraId || !funcId) return;
    setCarregando(true);
    setErro("");
    try {
      const [f, ptos, esc, abs, sols] = await Promise.all([
        funcionariosApi.obter(funcId),
        pontosApi.listar(prefeituraId),
        escalaApi.obter(prefeituraId).catch(() => null),
        abonosApi.listar(prefeituraId).catch(() => []),
        solicitacoesPontoApi.listar(prefeituraId).catch(() => []),
      ]);
      if (!f) {
        setErro("Funcionário não encontrado.");
        return;
      }
      setFuncionario(f);
      setBatidas(ptos);
      setEscala(esc);
      setAbonos(abs);
      setSolicitacoes(sols);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId, funcId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const nome = funcionario?.nome ?? "";
  const diasComPendencia = useMemo(() => {
    const set = new Set<string>();
    const alvo = nome.trim().toLowerCase();
    if (!alvo) return set;
    for (const b of batidas) {
      if ((b.status ?? "pendente") !== "pendente") continue;
      if ((b.name ?? "").trim().toLowerCase() !== alvo) continue;
      set.add(diaLocal(b.timestampOriginal));
    }
    for (const s of solicitacoes) {
      if (s.status !== "pendente") continue;
      if ((s.name ?? "").trim().toLowerCase() !== alvo) continue;
      const d = diaDaSolicitacao(s, batidas);
      if (d) set.add(d);
    }
    return set;
  }, [nome, batidas, solicitacoes]);

  function voltarParaLista() {
    navigate(`/prefeitura/${prefeituraId}/funcionarios`);
  }

  if (carregando) {
    return <p className="hist__msg">Carregando histórico…</p>;
  }
  if (erro || !funcionario) {
    return (
      <div className="hist">
        <header className="hist__topo">
          <button type="button" className="hist__voltar" onClick={voltarParaLista}>
            <ArrowLeft size={14} aria-hidden="true" />
            Voltar
          </button>
        </header>
        <div className="hist__alerta" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{erro || "Funcionário não encontrado."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="hist">
      <header className="hist__contexto">
        <div className="hist__id">
          <strong>{funcionario.nome}</strong>
          <span className="hist__sub">
            {funcionario.cpf ? formatarCpf(funcionario.cpf) : "CPF não informado"}
            {funcionario.cargo ? ` · ${funcionario.cargo}` : ""}
            {funcionario.matricula ? ` · mat. ${funcionario.matricula}` : ""}
          </span>
        </div>
      </header>

      <div className="hist__espelho-wrap">
        <EspelhoDetalhado
          batidas={batidas}
          escala={escala}
          nome={funcionario.nome}
          abonos={abonos}
          funcionarioCpf={funcionario.cpf}
          onVoltar={voltarParaLista}
          onSelecionarDia={(dia) =>
            navigate(
              `/prefeitura/${prefeituraId}/funcionarios/${funcId}/historico/${dia}`,
            )
          }
          diasComPendencia={diasComPendencia}
        />
      </div>
    </div>
  );
}
