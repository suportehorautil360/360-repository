import { useEffect, useMemo, useState } from "react";
import { useHU360 } from "../../../lib/hu360";
import { useFrota } from "./frota/use-frota";
import {
  FROTA_EXEMPLO,
  TIPO_ICON,
  TIPO_LABEL,
  isBloqueado,
  isVencido,
  revisaoEm,
  rotuloLeitura,
  textoLeitura,
  textoRevisao,
  unidadeDe,
  type TipoVeiculo,
  type VeiculoFrota,
  type VeiculoFrotaInput,
} from "./frota/types";
import { RevisaoModal } from "./frota/RevisaoModal";
import "./frota/frota.css";

const TIPOS: TipoVeiculo[] = ["carro", "caminhao", "van", "maquina"];

const FORM_VAZIO: VeiculoFrotaInput = {
  placa: "",
  nome: "",
  marca: "",
  tipo: "carro",
  ano: new Date().getFullYear(),
  medicaoAtual: 0,
  intervaloRevisao: 0,
  ultimaRevisao: 0,
  obra: "",
};

export function FrotaSection({
  prefeituraId,
}: {
  /** Quando informado (ex.: painel da prefeitura), fixa a frota nessa
   *  prefeitura e oculta o seletor. Sem ele (admin), mostra o seletor. */
  prefeituraId?: string;
} = {}) {
  const scoped = prefeituraId != null;
  const { prefeituras } = useHU360();
  const [prefIdState, setPrefIdState] = useState(
    () => prefeituras[0]?.id ?? "",
  );
  const prefId = scoped ? prefeituraId : prefIdState;
  const frota = useFrota(prefId);
  const [busca, setBusca] = useState("");
  const [modalAdd, setModalAdd] = useState(false);
  const [editando, setEditando] = useState<VeiculoFrota | null>(null);
  const [liberando, setLiberando] = useState<VeiculoFrota | null>(null);

  useEffect(() => {
    if (!scoped && !prefIdState && prefeituras[0]?.id) {
      setPrefIdState(prefeituras[0].id);
    }
  }, [scoped, prefIdState, prefeituras]);

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return frota.lista;
    return frota.lista.filter((v) =>
      [v.placa, v.nome, v.marca, v.obra, TIPO_LABEL[v.tipo], String(v.ano)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [frota.lista, busca]);

  return (
    <section className="frota-section">
      <div className="frota-toolbar">
        <div>
          <h2 style={{ margin: 0 }}>Veículos cadastrados</h2>
          <p className="frota-toolbar__count">
            {frota.lista.length} veículo{frota.lista.length === 1 ? "" : "s"}{" "}
            cadastrado{frota.lista.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="frota-toolbar__actions">
          {!scoped && (
            <select
              className="frota-pref"
              value={prefId}
              onChange={(e) => setPrefIdState(e.target.value)}
              aria-label="Prefeitura / cliente"
            >
              {prefeituras.length === 0 && (
                <option value="">Sem prefeituras</option>
              )}
              {prefeituras.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.uf})
                </option>
              ))}
            </select>
          )}
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
            className="frota-btn frota-btn--primary"
            style={{ margin: 0, width: "auto", whiteSpace: "nowrap" }}
            onClick={() => setModalAdd(true)}
            disabled={!prefId}
          >
            + Veículo
          </button>
        </div>
      </div>

      {frota.erro && (
        <p className="frota-empty" style={{ color: "#fca5a5" }}>
          {frota.erro}
        </p>
      )}

      {frota.loading ? (
        <p className="frota-empty">Carregando frota…</p>
      ) : !prefId ? (
        <p className="frota-empty">
          Selecione uma prefeitura para ver a frota.
        </p>
      ) : frota.lista.length === 0 && !frota.erro ? (
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
              className="frota-btn frota-btn--primary"
              style={{ margin: 0, width: "auto" }}
              onClick={() => setModalAdd(true)}
            >
              + Adicionar veículo
            </button>
            <button
              type="button"
              className="frota-btn frota-btn--secundario"
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
                if (window.confirm(`Remover ${v.nome} (${v.placa})?`)) {
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
          soLeitura={false}
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
          inicial={veiculoParaInput(editando)}
          soLeitura
          onFechar={() => setEditando(null)}
          onSalvar={async (dados) => {
            await frota.atualizar(editando.id, dados.medicaoAtual);
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

function veiculoParaInput(v: VeiculoFrota): VeiculoFrotaInput {
  return {
    placa: v.placa,
    nome: v.nome,
    marca: v.marca,
    tipo: v.tipo,
    ano: v.ano,
    medicaoAtual: v.medicaoAtual,
    intervaloRevisao: v.intervaloRevisao,
    ultimaRevisao: v.ultimaRevisao,
    obra: v.obra,
  };
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

  return (
    <article className={`frota-card ${bloqueado ? "is-bloqueado" : "is-ok"}`}>
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
            {veiculo.placa} · {veiculo.marca} · {veiculo.ano}
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
        <div>
          <div className="frota-meta__label">Próximo limite</div>
          <div className="frota-meta__value">
            {revisaoEm(veiculo).toLocaleString("pt-BR")}{" "}
            {unidadeDe(veiculo.tipo)}
          </div>
        </div>
      </div>

      <div className="frota-card__obra">
        <div className="frota-meta__label">Obra atual</div>
        {veiculo.obra}
      </div>

      <div className="frota-card__actions">
        {bloqueado && (
          <button
            type="button"
            className="frota-btn frota-btn-liberar"
            onClick={onLiberar}
          >
            Liberar
          </button>
        )}
        <button
          type="button"
          className="frota-btn frota-btn--secundario"
          onClick={onAtualizar}
        >
          ↻ Atualizar
        </button>
        <button
          type="button"
          className="frota-btn frota-btn-del"
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
  soLeitura,
  onFechar,
  onSalvar,
}: {
  titulo: string;
  inicial: VeiculoFrotaInput;
  soLeitura: boolean;
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
                  <label htmlFor="frota-placa">Placa / código</label>
                  <input
                    id="frota-placa"
                    type="text"
                    placeholder="ABC-1234"
                    value={form.placa}
                    onChange={(e) => set("placa", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="frota-tipo">Tipo</label>
                  <select
                    id="frota-tipo"
                    value={form.tipo}
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
                  <label htmlFor="frota-ano">Ano</label>
                  <input
                    id="frota-ano"
                    type="number"
                    min={1950}
                    value={form.ano}
                    onChange={(e) => set("ano", Number(e.target.value))}
                  />
                </div>
                <div className="full">
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
            {!soLeitura && (
              <>
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
                <div>
                  <label htmlFor="frota-ultima">
                    Leitura na última revisão ({unidade})
                  </label>
                  <input
                    id="frota-ultima"
                    type="number"
                    min={0}
                    value={form.ultimaRevisao}
                    onChange={(e) =>
                      set("ultimaRevisao", Number(e.target.value))
                    }
                  />
                </div>
              </>
            )}
          </div>

          <p className="frota-modal__msg">{msg}</p>

          <div className="frota-modal__footer">
            <button
              type="button"
              className="frota-btn frota-btn--secundario"
              onClick={onFechar}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="frota-btn frota-btn--primary"
              disabled={salvando}
            >
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
