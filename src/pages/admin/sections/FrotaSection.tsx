import { useMemo, useState } from "react";
import { useFrota } from "./frota/use-frota";
import {
  FROTA_EXEMPLO,
  TIPO_ICON,
  TIPO_LABEL,
  isBloqueado,
  isVencido,
  rotuloLeitura,
  textoLeitura,
  textoRevisao,
  textoVencimento,
  unidadeDe,
  type RevisaoInput,
  type TipoVeiculo,
  type VeiculoFrota,
  type VeiculoFrotaInput,
} from "./frota/types";
import "./frota/frota.css";

const TIPOS: TipoVeiculo[] = ["carro", "caminhao", "van", "maquina"];

const FORM_VAZIO: VeiculoFrotaInput = {
  codigo: "",
  nome: "",
  marca: "",
  tipo: "carro",
  medicaoAtual: 0,
  revisaoEm: 0,
  intervaloRevisao: 0,
  obra: "",
};

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export function FrotaSection() {
  const frota = useFrota();
  const [busca, setBusca] = useState("");
  const [modalAdd, setModalAdd] = useState(false);
  const [editando, setEditando] = useState<VeiculoFrota | null>(null);
  const [liberando, setLiberando] = useState<VeiculoFrota | null>(null);

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return frota.lista;
    return frota.lista.filter((v) =>
      [v.codigo, v.nome, v.marca, v.obra, TIPO_LABEL[v.tipo]]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [frota.lista, busca]);

  return (
    <section id="frota" className="aba-conteudo ativa">
      <div className="frota-toolbar">
        <div>
          <h2 style={{ margin: 0 }}>Veículos cadastrados</h2>
          <p className="frota-toolbar__count">
            {frota.lista.length} veículo{frota.lista.length === 1 ? "" : "s"}{" "}
            cadastrado{frota.lista.length === 1 ? "" : "s"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="frota-search">
            <input
              type="search"
              placeholder="Buscar…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar veículo"
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ margin: 0, width: "auto", whiteSpace: "nowrap" }}
            onClick={() => setModalAdd(true)}
          >
            + Veículo
          </button>
        </div>
      </div>

      {frota.loading ? (
        <p className="frota-empty">Carregando frota…</p>
      ) : frota.lista.length === 0 ? (
        <div className="frota-empty">
          <p style={{ marginTop: 0 }}>Nenhum veículo cadastrado ainda.</p>
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              marginTop: 12,
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              style={{ margin: 0, width: "auto" }}
              onClick={() => setModalAdd(true)}
            >
              + Adicionar veículo
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ margin: 0, width: "auto" }}
              onClick={() => void frota.adicionarLote(FROTA_EXEMPLO)}
            >
              Popular com exemplos
            </button>
          </div>
        </div>
      ) : filtrada.length === 0 ? (
        <p className="frota-empty">Nenhum veículo encontrado para “{busca}”.</p>
      ) : (
        <div className="frota-grid">
          {filtrada.map((v) => (
            <FrotaCard
              key={v.id}
              veiculo={v}
              onLiberar={() => setLiberando(v)}
              onAtualizar={() => setEditando(v)}
              onRemover={() => {
                if (window.confirm(`Remover ${v.nome} (${v.codigo})?`)) {
                  void frota.remover(v.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {modalAdd && (
        <VeiculoModal
          titulo="Adicionar veículo"
          inicial={FORM_VAZIO}
          travarTipo={false}
          onFechar={() => setModalAdd(false)}
          onSalvar={async (dados) => {
            const r = await frota.adicionar(dados);
            if (r.ok) setModalAdd(false);
            return r;
          }}
        />
      )}

      {editando && (
        <VeiculoModal
          titulo={`Atualizar leitura — ${editando.nome}`}
          inicial={editando}
          travarTipo
          soLeitura
          onFechar={() => setEditando(null)}
          onSalvar={async (dados) => {
            await frota.atualizar(editando.id, {
              medicaoAtual: dados.medicaoAtual,
              revisaoEm: dados.revisaoEm,
            });
            setEditando(null);
            return { ok: true, message: "" };
          }}
        />
      )}

      {liberando && (
        <RevisaoModal
          veiculo={liberando}
          onFechar={() => setLiberando(null)}
          onConfirmar={async (dados) => {
            await frota.registrarRevisao(liberando, dados);
            setLiberando(null);
          }}
        />
      )}
    </section>
  );
}

function FrotaCard({
  veiculo,
  onLiberar,
  onAtualizar,
  onRemover,
}: {
  veiculo: VeiculoFrota;
  onLiberar: () => void;
  onAtualizar: () => void;
  onRemover: () => void;
}) {
  const bloqueado = isBloqueado(veiculo);
  const vencido = isVencido(veiculo);
  const estado = bloqueado
    ? "is-bloqueado"
    : vencido
      ? "is-liberado"
      : "is-ok";

  return (
    <article className={`frota-card ${estado}`}>
      <span className="frota-card__lock" aria-hidden="true">
        {bloqueado ? "🔒" : "🔓"}
      </span>

      <div className="frota-card__head">
        <span className="frota-card__avatar" aria-hidden="true">
          {TIPO_ICON[veiculo.tipo]}
        </span>
        <div>
          <div className="frota-card__title">{veiculo.nome}</div>
          <div className="frota-card__sub">
            {veiculo.codigo} · {veiculo.marca}
          </div>
        </div>
      </div>

      <div className="frota-card__meta">
        <div>
          <div className="frota-meta__label">{rotuloLeitura(veiculo.tipo)}</div>
          <div className="frota-meta__value">{textoLeitura(veiculo)}</div>
        </div>
        <div>
          <div className="frota-meta__label">Tipo</div>
          <div className="frota-meta__value">{TIPO_LABEL[veiculo.tipo]}</div>
        </div>
        <div>
          <div className="frota-meta__label">Revisão</div>
          <div
            className={`frota-meta__value ${vencido ? "is-danger" : "is-ok"}`}
          >
            {textoRevisao(veiculo)}
          </div>
        </div>
        {vencido && veiculo.liberado && (
          <div>
            <div className="frota-meta__label">Status</div>
            <div className="frota-meta__value">Liberado</div>
          </div>
        )}
      </div>

      <div className="frota-card__obra">
        <div className="frota-meta__label">Obra atual</div>
        {veiculo.obra}
      </div>

      <div className="frota-card__actions">
        {bloqueado && (
          <button
            type="button"
            className="btn frota-btn-liberar"
            onClick={onLiberar}
          >
            Liberar
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onAtualizar}>
          ↻ Atualizar
        </button>
        <button
          type="button"
          className="btn frota-btn-del"
          onClick={onRemover}
          aria-label={`Remover ${veiculo.nome}`}
        >
          🗑
        </button>
      </div>
    </article>
  );
}

function VeiculoModal({
  titulo,
  inicial,
  travarTipo,
  soLeitura = false,
  onFechar,
  onSalvar,
}: {
  titulo: string;
  inicial: VeiculoFrotaInput;
  travarTipo: boolean;
  soLeitura?: boolean;
  onFechar: () => void;
  onSalvar: (
    dados: VeiculoFrotaInput,
  ) => Promise<{ ok: boolean; message: string }>;
}) {
  const [form, setForm] = useState<VeiculoFrotaInput>(inicial);
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);
  const unidade = unidadeDe(form.tipo);

  function set<K extends keyof VeiculoFrotaInput>(
    campo: K,
    valor: VeiculoFrotaInput[K],
  ) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  async function handleSubmit() {
    setSalvando(true);
    const r = await onSalvar(form);
    setSalvando(false);
    if (!r.ok) setMsg(r.message);
  }

  return (
    <div
      className="frota-modal-backdrop"
      role="presentation"
      onClick={onFechar}
    >
      <div
        className="frota-modal"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{titulo}</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="frota-modal__grid">
            {!soLeitura && (
              <>
                <div>
                  <label htmlFor="frota-codigo">Código</label>
                  <input
                    id="frota-codigo"
                    type="text"
                    placeholder="CAR-001"
                    value={form.codigo}
                    onChange={(e) => set("codigo", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="frota-tipo">Tipo</label>
                  <select
                    id="frota-tipo"
                    value={form.tipo}
                    disabled={travarTipo}
                    onChange={(e) => set("tipo", e.target.value as TipoVeiculo)}
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {TIPO_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="full">
                  <label htmlFor="frota-nome">Nome / modelo</label>
                  <input
                    id="frota-nome"
                    type="text"
                    placeholder="HB20 2021"
                    value={form.nome}
                    onChange={(e) => set("nome", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="frota-marca">Marca</label>
                  <input
                    id="frota-marca"
                    type="text"
                    placeholder="Hyundai"
                    value={form.marca}
                    onChange={(e) => set("marca", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="frota-obra">Obra atual</label>
                  <input
                    id="frota-obra"
                    type="text"
                    placeholder="Disponível"
                    value={form.obra}
                    onChange={(e) => set("obra", e.target.value)}
                  />
                </div>
              </>
            )}
            <div>
              <label htmlFor="frota-medicao">
                {rotuloLeitura(form.tipo)} ({unidade})
              </label>
              <input
                id="frota-medicao"
                type="number"
                min={0}
                value={form.medicaoAtual}
                onChange={(e) => set("medicaoAtual", Number(e.target.value))}
              />
            </div>
            <div>
              <label htmlFor="frota-revisao">Próxima revisão em ({unidade})</label>
              <input
                id="frota-revisao"
                type="number"
                min={0}
                value={form.revisaoEm}
                onChange={(e) => set("revisaoEm", Number(e.target.value))}
              />
            </div>
            {!soLeitura && (
              <div>
                <label htmlFor="frota-intervalo">
                  Intervalo entre revisões ({unidade})
                </label>
                <input
                  id="frota-intervalo"
                  type="number"
                  min={0}
                  value={form.intervaloRevisao}
                  onChange={(e) =>
                    set("intervaloRevisao", Number(e.target.value))
                  }
                />
              </div>
            )}
          </div>

          <p className="frota-modal__msg">{msg}</p>

          <div className="frota-modal__footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onFechar}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RevisaoModal({
  veiculo,
  onFechar,
  onConfirmar,
}: {
  veiculo: VeiculoFrota;
  onFechar: () => void;
  onConfirmar: (dados: RevisaoInput) => Promise<void>;
}) {
  const unidade = unidadeDe(veiculo.tipo);
  const [data, setData] = useState(hojeISO());
  const [hodometro, setHodometro] = useState<number | "">("");
  const [oficina, setOficina] = useState("");
  const [servicos, setServicos] = useState("");
  const [custo, setCusto] = useState<number | "">("");
  const [notaFiscal, setNotaFiscal] = useState("");
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  const novoLimite =
    typeof hodometro === "number"
      ? hodometro + veiculo.intervaloRevisao
      : null;

  async function handleConfirmar() {
    if (typeof hodometro !== "number" || hodometro <= 0) {
      setMsg("Informe o hodômetro / horas registrado na revisão.");
      return;
    }
    if (hodometro < veiculo.medicaoAtual) {
      setMsg(
        `A leitura não pode ser menor que a atual (${veiculo.medicaoAtual.toLocaleString("pt-BR")} ${unidade}).`,
      );
      return;
    }
    setSalvando(true);
    await onConfirmar({
      data,
      hodometro,
      oficina,
      servicos,
      custo: typeof custo === "number" ? custo : 0,
      notaFiscal,
    });
    setSalvando(false);
  }

  return (
    <div className="frota-modal-backdrop" role="presentation" onClick={onFechar}>
      <div
        className="frota-modal frota-modal--rev"
        role="dialog"
        aria-modal="true"
        aria-label="Liberar bloqueio de revisão"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="frota-rev__head">
          <div>
            <h3 style={{ margin: 0 }}>🔒 Liberar bloqueio de revisão</h3>
            <p className="frota-rev__veic">
              Veículo: <strong>{veiculo.codigo}</strong> — {veiculo.nome}
            </p>
          </div>
          <button
            type="button"
            className="frota-rev__close"
            onClick={onFechar}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="frota-rev__alerta">
          <span aria-hidden="true">⚠️</span>
          <div>
            <strong>Revisão vencida</strong>
            <p>{textoVencimento(veiculo)}</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleConfirmar();
          }}
        >
          <div className="frota-modal__grid">
            <div>
              <label htmlFor="rev-data">Data da revisão realizada</label>
              <input
                id="rev-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="rev-hod">Hodômetro / horas na revisão ({unidade})</label>
              <input
                id="rev-hod"
                type="number"
                min={0}
                placeholder={`Ex: 183900`}
                value={hodometro}
                onChange={(e) =>
                  setHodometro(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
              />
            </div>
            <div className="full">
              <label htmlFor="rev-oficina">Oficina / responsável</label>
              <input
                id="rev-oficina"
                type="text"
                placeholder="Nome da oficina ou mecânico"
                value={oficina}
                onChange={(e) => setOficina(e.target.value)}
              />
            </div>
            <div className="full">
              <label htmlFor="rev-serv">Serviços realizados</label>
              <textarea
                id="rev-serv"
                rows={3}
                placeholder="Descreva os serviços realizados…"
                value={servicos}
                onChange={(e) => setServicos(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="rev-custo">Custo da revisão (R$)</label>
              <input
                id="rev-custo"
                type="number"
                min={0}
                step="0.01"
                placeholder="0,00"
                value={custo}
                onChange={(e) =>
                  setCusto(e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            </div>
            <div>
              <label htmlFor="rev-nf">Nota fiscal</label>
              <input
                id="rev-nf"
                type="text"
                placeholder="NF-00000"
                value={notaFiscal}
                onChange={(e) => setNotaFiscal(e.target.value)}
              />
            </div>
          </div>

          <div className="frota-rev__aviso">
            <strong>Atenção:</strong> ao confirmar, o próximo limite de revisão
            será recalculado
            {novoLimite != null && (
              <> para {novoLimite.toLocaleString("pt-BR")} {unidade}</>
            )}{" "}
            e o uso será liberado imediatamente.
          </div>

          <p className="frota-modal__msg">{msg}</p>

          <div className="frota-modal__footer">
            <button type="button" className="btn btn-secondary" onClick={onFechar}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn frota-btn-confirmar"
              disabled={salvando}
            >
              {salvando ? "Salvando…" : "✓ Confirmar revisão e liberar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
