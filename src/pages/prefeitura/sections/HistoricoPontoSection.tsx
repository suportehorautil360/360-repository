import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import {
  funcionariosApi,
  type Funcionario,
} from "../../../lib/funcionarios/funcionarios";
import { pontosApi, type PontoRegistro } from "../../../lib/api/pontos";
import { escalaApi, type Escala } from "../../../lib/api/escala";
import { EspelhoDetalhado } from "../../checklist-controle/EspelhoDetalhado";
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
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!prefeituraId || !funcId) return;
    setCarregando(true);
    setErro("");
    try {
      const [f, ptos, esc] = await Promise.all([
        funcionariosApi.obter(funcId),
        pontosApi.listar(prefeituraId),
        escalaApi.obter(prefeituraId).catch(() => null),
      ]);
      if (!f) {
        setErro("Funcionário não encontrado.");
        return;
      }
      setFuncionario(f);
      setBatidas(ptos);
      setEscala(esc);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId, funcId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

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
          onVoltar={voltarParaLista}
        />
      </div>
    </div>
  );
}
