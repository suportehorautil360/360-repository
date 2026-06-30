import { useMemo, useRef, useState } from "react";
import {
  Upload,
  Download,
  X,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { equipamentosApi } from "./equipamentos-api";
import {
  baixarModeloCsvEquip,
  parsePlanilhaEquip,
  TEMPLATE_COLUNAS_EQUIP,
  type EquipParsado,
} from "./importar-planilha-equip";

interface Props {
  prefeituraId: string;
  onClose: () => void;
  onImportado: () => void;
}

interface Resultado {
  criados: number;
  erros: Array<{ linha: number; id: string; motivo: string }>;
}

export function ImportarEquipamentosModal({
  prefeituraId,
  onClose,
  onImportado,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [parsed, setParsed] = useState<EquipParsado[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [progresso, setProgresso] = useState<{
    atual: number;
    total: number;
  } | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const validas = useMemo(() => parsed.filter((p) => !p.problema), [parsed]);
  const invalidas = useMemo(() => parsed.filter((p) => p.problema), [parsed]);
  const enviando = progresso !== null;

  async function aoEscolher(file: File | null) {
    if (!file) return;
    setArquivo(file);
    setResultado(null);
    setAnalisando(true);
    try {
      const data = await parsePlanilhaEquip(file);
      if (!data.length) {
        toast.error("Planilha vazia ou sem linhas de dados.");
        setParsed([]);
      } else {
        setParsed(data);
      }
    } catch (e) {
      console.error("[Importar equipamentos] erro ao ler:", e);
      toast.error("Não foi possível ler a planilha. Confira o formato.");
      setParsed([]);
    } finally {
      setAnalisando(false);
    }
  }

  async function importar() {
    if (!validas.length || enviando) return;
    const erros: Resultado["erros"] = [];
    let criados = 0;

    for (let i = 0; i < validas.length; i++) {
      setProgresso({ atual: i + 1, total: validas.length });
      const item = validas[i];
      try {
        await equipamentosApi.criar(item.input, prefeituraId);
        criados++;
      } catch (e) {
        erros.push({
          linha: parsed.indexOf(item) + 2,
          id: item.input.placa || item.input.chassis,
          motivo: e instanceof Error ? e.message : "Erro desconhecido",
        });
      }
    }

    setProgresso(null);
    setResultado({ criados, erros });
    onImportado();
    if (criados > 0) toast.success(`${criados} equipamento(s) importado(s).`);
    else toast.error("Nenhum equipamento foi importado.");
  }

  function trocarArquivo() {
    setArquivo(null);
    setParsed([]);
    setResultado(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="pf-modal-overlay">
      <div className="func-imp">
        <header className="func-imp__head">
          <h2>
            <FileSpreadsheet size={18} aria-hidden="true" /> Importar
            equipamentos
          </h2>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="func-imp__body">
          {resultado ? (
            <div className="func-imp__resultado">
              <p className="func-imp__resumo">
                <CheckCircle2 size={16} /> {resultado.criados} criado(s) ·{" "}
                {resultado.erros.length} erro(s)
              </p>
              {resultado.erros.length > 0 && (
                <div className="func-imp__erros">
                  <strong>Linhas com erro:</strong>
                  <ul>
                    {resultado.erros.slice(0, 50).map((e, i) => (
                      <li key={i}>
                        Linha {e.linha}: {e.id || "(sem ID)"} — {e.motivo}
                      </li>
                    ))}
                  </ul>
                  {resultado.erros.length > 50 && (
                    <p>… e mais {resultado.erros.length - 50}.</p>
                  )}
                </div>
              )}
            </div>
          ) : enviando ? (
            <p className="func-imp__intro">
              Importando {progresso.atual} de {progresso.total}…
            </p>
          ) : !arquivo ? (
            <>
              <p className="func-imp__intro">
                Suba uma planilha <strong>.xlsx</strong> ou{" "}
                <strong>.csv</strong>. Colunas reconhecidas:{" "}
                {TEMPLATE_COLUNAS_EQUIP.join(", ")}. Obrigatórios:{" "}
                <strong>Placa ou Chassi</strong>, <strong>Marca</strong> e{" "}
                <strong>Modelo</strong>.
              </p>
              <label className="func-imp__drop">
                <Upload size={22} aria-hidden="true" />
                <span>Clique para escolher a planilha</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(e) =>
                    void aoEscolher(e.target.files?.[0] ?? null)
                  }
                />
              </label>
              <button
                type="button"
                className="func-imp__link"
                onClick={baixarModeloCsvEquip}
              >
                <Download size={14} aria-hidden="true" /> Baixar modelo CSV
              </button>
            </>
          ) : analisando ? (
            <p className="func-imp__intro">Lendo planilha…</p>
          ) : (
            <>
              <p className="func-imp__resumo">
                <strong>{parsed.length}</strong> linha(s) · {validas.length}{" "}
                válida(s)
                {invalidas.length > 0 && (
                  <span className="func-imp__aviso">
                    <AlertTriangle size={14} /> {invalidas.length} inválida(s)
                  </span>
                )}
              </p>
              <div className="func-imp__previa">
                <table>
                  <thead>
                    <tr>
                      <th>Placa</th>
                      <th>Chassi</th>
                      <th>Marca</th>
                      <th>Modelo</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 8).map((x, i) => (
                      <tr key={i} className={x.problema ? "tem-aviso" : ""}>
                        <td>{x.input.placa || "—"}</td>
                        <td>{x.input.chassis || "—"}</td>
                        <td>{x.input.marca || "—"}</td>
                        <td>{x.input.modelo || "—"}</td>
                        <td>{x.problema ?? "OK"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.length > 8 && (
                  <p className="func-imp__mais">
                    … e mais {parsed.length - 8} linha(s).
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <footer className="func-imp__foot">
          {resultado ? (
            <button
              type="button"
              className="func__btn func__btn--primary"
              onClick={onClose}
            >
              Fechar
            </button>
          ) : arquivo && !analisando ? (
            <>
              <button
                type="button"
                className="func__btn"
                onClick={trocarArquivo}
                disabled={enviando}
              >
                Trocar arquivo
              </button>
              <button
                type="button"
                className="func__btn func__btn--primary"
                disabled={!validas.length || enviando}
                onClick={() => void importar()}
              >
                {enviando
                  ? `Importando ${progresso?.atual} de ${progresso?.total}…`
                  : `Importar ${validas.length} equipamento(s)`}
              </button>
            </>
          ) : (
            <button type="button" className="func__btn" onClick={onClose}>
              Cancelar
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
