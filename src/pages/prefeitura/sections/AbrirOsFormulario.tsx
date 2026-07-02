import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { db } from "../../../lib/firebase/firebase";
import {
  equipamentosApi,
  type EquipRow,
} from "./equipamentos/equipamentos-api";
import {
  criarSolicitacaoOs,
  mensagemErroCriarOs,
} from "./criar-solicitacao-os";
import {
  type AbaOsForm,
  hojeISO,
} from "./abrir-os-model";
import { AbrirOsAbaOficina } from "./AbrirOsAbaOficina";
import { AbrirOsAbaGarantia } from "./AbrirOsAbaGarantia";
import {
  AbrirOsPainelGeral,
  type PainelGeralOs,
} from "./AbrirOsPainelGeral";

import { planosPreventivosApi } from "../../../lib/api/planos-preventivos";
import {
  clonarMatrizPadrao,
  labelCiclo,
  montarRelatoPreventivo,
  type MatrizPreventiva,
} from "./plano-preventivo-model";

const TIPOS_OS = [
  { value: "C", label: "C - Corretiva", titulo: "O.S. Corretiva – INCLUIR" },
  { value: "P", label: "P - Preditiva", titulo: "O.S. Preditiva – INCLUIR" },
  { value: "V", label: "V - Preventiva", titulo: "O.S. Preventiva – INCLUIR" },
] as const;

const SITUACOES = [{ value: "aberta", label: "Aberta" }];

const ABAS: { id: AbaOsForm; label: string; icon?: "shield" }[] = [
  { id: "geral", label: "Geral" },
  { id: "oficina", label: "Oficina" },
  { id: "garantia", label: "Garantia", icon: "shield" },
];

const OPERADORES_MOCK = ["João Silva", "Jefferson Da Silva Lima", "Leandro"];

function fmtHorimetro(eq: EquipRow | null): string {
  if (!eq) return "";
  const u = eq.unidadeRevisao === "h" ? "h" : "km";
  return `${eq.medicaoAtual.toLocaleString("pt-BR")} ${u}`;
}

function Req() {
  return (
    <span className="aos-req" aria-hidden>
      {" "}
      *
    </span>
  );
}

interface AbrirOsFormularioProps {
  prefeituraId: string;
  onCancelar: () => void;
  onVoltarLista: () => void;
  onSalvo: (opts?: { irMaquinaParada?: boolean }) => void;
}

export function AbrirOsFormulario({
  prefeituraId,
  onCancelar,
  onVoltarLista,
  onSalvo,
}: AbrirOsFormularioProps) {
  const [aba, setAba] = useState<AbaOsForm>("geral");
  const [dataAgendamento, setDataAgendamento] = useState(hojeISO);
  const [tipoOs, setTipoOs] = useState("C");
  const [cicloId, setCicloId] = useState("");
  const [matrizPreventiva, setMatrizPreventiva] = useState<MatrizPreventiva>(
    clonarMatrizPadrao,
  );
  const [carregandoCiclos, setCarregandoCiclos] = useState(false);
  const [equipamentoId, setEquipamentoId] = useState("");
  const [situacao, setSituacao] = useState("aberta");
  const [operador, setOperador] = useState("");
  const [relato, setRelato] = useState("");
  const [painelGeral, setPainelGeral] = useState<PainelGeralOs | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  function togglePainelGeral(id: PainelGeralOs) {
    setPainelGeral((atual) => (atual === id ? null : id));
  }

  const [equipamentos, setEquipamentos] = useState<EquipRow[]>([]);
  const [operadores, setOperadores] = useState<string[]>(OPERADORES_MOCK);
  const [carregandoEquip, setCarregandoEquip] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCarregandoEquip(true);
    equipamentosApi
      .listar(prefeituraId)
      .then((lista) => {
        if (vivo) setEquipamentos(lista);
      })
      .catch(() => {
        if (vivo) setEquipamentos([]);
      })
      .finally(() => {
        if (vivo) setCarregandoEquip(false);
      });
    return () => {
      vivo = false;
    };
  }, [prefeituraId]);

  useEffect(() => {
    if (!prefeituraId) {
      setMatrizPreventiva(clonarMatrizPadrao());
      return;
    }

    let vivo = true;
    setCarregandoCiclos(true);

    void planosPreventivosApi
      .obter(prefeituraId)
      .then((salva) => {
        if (!vivo) return;
        setMatrizPreventiva(salva ?? clonarMatrizPadrao());
      })
      .catch(() => {
        if (!vivo) return;
        setMatrizPreventiva(clonarMatrizPadrao());
      })
      .finally(() => {
        if (vivo) setCarregandoCiclos(false);
      });

    return () => {
      vivo = false;
    };
  }, [prefeituraId]);

  useEffect(() => {
    if (tipoOs !== "V" || !cicloId) return;
    setRelato(montarRelatoPreventivo(matrizPreventiva, cicloId));
  }, [matrizPreventiva, tipoOs, cicloId]);

  useEffect(() => {
    if (!prefeituraId) return;
    getDocs(
      query(
        collection(db, "operadores"),
        where("prefeituraId", "==", prefeituraId),
      ),
    )
      .then((snap) => {
        if (snap.empty) return;
        setOperadores(snap.docs.map((d) => (d.data().nome as string) ?? ""));
      })
      .catch(() => {});
  }, [prefeituraId]);

  useEffect(() => {
    if (operadores.length > 0 && !operador) {
      setOperador(operadores[0]);
    }
  }, [operadores, operador]);

  useEffect(() => {
    if (aba !== "geral") setPainelGeral(null);
  }, [aba]);

  const equipSel = useMemo(
    () => equipamentos.find((e) => e.id === equipamentoId) ?? null,
    [equipamentos, equipamentoId],
  );

  const nomeBem = equipSel?.descricao ?? "";
  const classificacao = equipSel?.linha || equipSel?.tipo || "";
  const horimetro = fmtHorimetro(equipSel);
  const tipoOsSel = TIPOS_OS.find((t) => t.value === tipoOs) ?? TIPOS_OS[0];
  const isPreventiva = tipoOs === "V";

  function handleTipoOsChange(value: string) {
    setTipoOs(value);
    if (value !== "V") {
      setCicloId("");
      setRelato("");
    }
  }

  function handleCicloChange(id: string) {
    setCicloId(id);
    setRelato(id ? montarRelatoPreventivo(matrizPreventiva, id) : "");
  }

  async function handleSalvar() {
    setErroSalvar(null);

    if (!equipamentoId) {
      setErroSalvar("Selecione um equipamento.");
      return;
    }
    if (!operador.trim()) {
      setErroSalvar("Selecione o operador solicitante.");
      return;
    }
    if (!relato.trim()) {
      setErroSalvar("Informe o relato do problema.");
      return;
    }
    if (isPreventiva && !cicloId) {
      setErroSalvar("Selecione o ciclo da preventiva.");
      return;
    }
    if (!equipSel) {
      setErroSalvar("Selecione um equipamento.");
      return;
    }

    setSalvando(true);
    try {
      const resultado = await criarSolicitacaoOs({
        prefeituraId,
        equipamento: equipSel,
        operador: operador.trim(),
        relato: relato.trim(),
        tipoOs,
        cicloId: isPreventiva ? cicloId : undefined,
        dataAgendamento: dataAgendamento || undefined,
      });

      const nomes = resultado.invitedWorkshops.map((w) => w.name).join(", ");
      toast.success(
        `O.S. criada! Protocolo: ${resultado.protocolo} · Enviada para ${resultado.invitedWorkshops.length} oficina(s)${nomes ? `: ${nomes}` : ""}.`,
      );
      onSalvo({ irMaquinaParada: tipoOs === "C" });
    } catch (err) {
      const msg = mensagemErroCriarOs(err);
      setErroSalvar(msg);
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="aos-form">
      <div className="aos-form__top">
        <h1 className="aos-form__title">{tipoOsSel.titulo}</h1>
        <div className="aos-form__top-actions">
          <button
            type="button"
            className="aos-btn aos-btn--ghost"
            onClick={onCancelar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="aos-btn aos-btn--primary"
            onClick={() => void handleSalvar()}
            disabled={salvando}
          >
            {salvando ? "Salvando…" : "Salvar OS"}
          </button>
        </div>
      </div>

      <div className="aos-tabs" role="tablist">
        {ABAS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={aba === t.id}
            className={`aos-tab ${aba === t.id ? "is-active" : ""}`}
            onClick={() => setAba(t.id)}
          >
            {t.icon === "shield" ? (
              <Shield size={14} className="aos-tab__shield" aria-hidden />
            ) : null}
            {t.label}
          </button>
        ))}
      </div>

      <div className="aos-form__body">
        {erroSalvar ? <p className="aos-erro">{erroSalvar}</p> : null}
        {aba === "geral" ? (
          <div className="aos-form-grid">
            <div className="aos-field aos-field--sm">
              <label>
                Ordem serv.
                <Req />
              </label>
              <input
                type="text"
                readOnly
                value="Gerado ao salvar"
                title="O protocolo é gerado pelo sistema ao salvar"
              />
            </div>
            <div className="aos-field aos-field--sm">
              <label>
                Dt. agendam.
                <Req />
              </label>
              <input
                type="date"
                value={dataAgendamento}
                onChange={(e) => setDataAgendamento(e.target.value)}
              />
            </div>
            <div className="aos-field aos-field--sm">
              <label>
                Tipo O.S.
                <Req />
              </label>
              <select
                value={tipoOs}
                onChange={(e) => handleTipoOsChange(e.target.value)}
              >
                {TIPOS_OS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {isPreventiva ? (
              <div className="aos-field aos-field--md aos-field--ciclo-preventiva">
                <label>
                  Ciclo da preventiva (do plano de manutenção)
                  <Req />
                </label>
                <select
                  value={cicloId}
                  onChange={(e) => handleCicloChange(e.target.value)}
                  disabled={carregandoCiclos}
                >
                  <option value="">
                    {carregandoCiclos ? "Carregando…" : "Selecione o ciclo…"}
                  </option>
                  {matrizPreventiva.ciclos.map((c, idx) => (
                    <option key={c.id} value={c.id}>
                      {labelCiclo(c, idx)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="aos-field aos-field--md">
              <label>
                Bem
                <Req />
              </label>
              <select
                value={equipamentoId}
                onChange={(e) => setEquipamentoId(e.target.value)}
                disabled={carregandoEquip}
              >
                <option value="">
                  {carregandoEquip ? "Carregando…" : "Selecione…"}
                </option>
                {equipamentos.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.descricao}
                    {eq.placa ? ` · ${eq.placa}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="aos-field aos-field--xs">
              <label>Horímetro (sensor)</label>
              <input type="text" readOnly value={horimetro} />
            </div>

            <div className="aos-field aos-field--lg">
              <label>Nome do bem</label>
              <input type="text" readOnly value={nomeBem} />
            </div>
            <div className="aos-field aos-field--md">
              <label>
                Classificação / linha
                <Req />
              </label>
              <input type="text" readOnly value={classificacao} />
            </div>
            <div className="aos-field aos-field--sm">
              <label>Situação</label>
              <select
                value={situacao}
                onChange={(e) => setSituacao(e.target.value)}
              >
                {SITUACOES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="aos-field aos-field--full">
              <label>Operador solicitante</label>
              <select
                value={operador}
                onChange={(e) => setOperador(e.target.value)}
              >
                {operadores.length === 0 ? (
                  <option value="">— sem operadores —</option>
                ) : (
                  operadores.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="aos-field aos-field--full">
              <label>
                Descrição / relato do problema
                <Req />
              </label>
              <textarea
                rows={4}
                placeholder={
                  isPreventiva
                    ? "Preenchido automaticamente ao selecionar o ciclo…"
                    : "Descreva o sintoma ou defeito…"
                }
                value={relato}
                onChange={(e) => setRelato(e.target.value)}
              />
            </div>
          </div>
        ) : aba === "oficina" ? (
          <AbrirOsAbaOficina
            prefeituraId={prefeituraId}
            equipamento={equipSel}
          />
        ) : aba === "garantia" ? (
          <AbrirOsAbaGarantia
            equipamentoId={equipamentoId}
            nomeEquipamento={nomeBem}
            horimetro={horimetro}
            equipamentoSelecionado={Boolean(equipamentoId)}
          />
        ) : (
          <div className="aos-tab-placeholder">
            <p>Conteúdo da aba em desenvolvimento.</p>
          </div>
        )}
      </div>

      {aba === "geral" && painelGeral ? (
        <AbrirOsPainelGeral
          painel={painelGeral}
          onFechar={() => setPainelGeral(null)}
        />
      ) : null}

      <div
        className={`aos-form__footer ${aba !== "geral" ? "aos-form__footer--solo" : ""}`}
      >
        {aba === "geral" ? (
          <div className="aos-form__footer-links">
            {(
              [
                ["insumos", "Insumos"],
                ["etapas", "Etapas"],
                ["sintomas", "Sintomas"],
                ["ocorrencias", "Ocorrências"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`aos-link-btn ${painelGeral === id ? "is-active" : ""}`}
                onClick={() => togglePainelGeral(id)}
                aria-pressed={painelGeral === id}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="aos-btn aos-btn--outline"
          onClick={onVoltarLista}
        >
          ← Voltar para lista
        </button>
      </div>
    </div>
  );
}
