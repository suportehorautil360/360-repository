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
import {
  funcionariosApi,
  type FuncionarioInput,
  type ImportResultado,
} from "../../../lib/funcionarios/funcionarios";
import { limparCpf } from "../../../lib/funcionarios/cpf";
import {
  baixarModeloCsv,
  parsePlanilha,
  TEMPLATE_COLUNAS,
} from "../../../lib/funcionarios/importar-planilha";

interface Props {
  prefeituraId: string;
  onClose: () => void;
  onImportado: () => void;
}

/** Avalia problemas que dá pra detectar no próprio arquivo (pré-envio). */
function problemaLinha(
  f: FuncionarioInput,
  cpfsVistos: Set<string>,
): string | null {
  if (!f.nome.trim()) return "Nome vazio";
  const cpf = limparCpf(f.cpf);
  if (cpf.length !== 11) return "CPF inválido";
  if (cpfsVistos.has(cpf)) return "CPF duplicado na planilha";
  return null;
}

export function ImportarFuncionariosModal({
  prefeituraId,
  onClose,
  onImportado,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<FuncionarioInput[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ImportResultado | null>(null);

  const analise = useMemo(() => {
    const vistos = new Set<string>();
    const avaliadas = linhas.map((f) => {
      const problema = problemaLinha(f, vistos);
      if (!problema) vistos.add(limparCpf(f.cpf));
      return { f, problema };
    });
    const validas = avaliadas.filter((x) => !x.problema).length;
    return { avaliadas, validas, comAviso: avaliadas.length - validas };
  }, [linhas]);

  async function aoEscolher(file: File | null) {
    if (!file) return;
    setArquivo(file);
    setResultado(null);
    setAnalisando(true);
    try {
      const parsed = await parsePlanilha(file);
      if (!parsed.length) {
        toast.error("Planilha vazia ou sem linhas de dados.");
        setLinhas([]);
      } else {
        setLinhas(parsed);
      }
    } catch (e) {
      console.error("[Importar funcionários] erro ao ler:", e);
      toast.error("Não foi possível ler a planilha. Confira o formato.");
      setLinhas([]);
    } finally {
      setAnalisando(false);
    }
  }

  async function importar() {
    if (!analise.validas || enviando) return;
    setEnviando(true);
    try {
      const r = await funcionariosApi.importar(prefeituraId, linhas);
      setResultado(r);
      onImportado();
      if (r.criados > 0) toast.success(`${r.criados} funcionário(s) importado(s).`);
      if (r.criados === 0) toast.error("Nenhum funcionário foi importado.");
    } catch (e) {
      console.error("[Importar funcionários] erro ao importar:", e);
      toast.error(e instanceof Error ? e.message : "Falha na importação.");
    } finally {
      setEnviando(false);
    }
  }

  function trocarArquivo() {
    setArquivo(null);
    setLinhas([]);
    setResultado(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="pf-modal-overlay">
      <div className="func-imp">
        <header className="func-imp__head">
          <h2>
            <FileSpreadsheet size={18} aria-hidden="true" /> Importar funcionários
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
                {resultado.ignorados} ignorado(s)
              </p>
              {resultado.erros.length > 0 && (
                <div className="func-imp__erros">
                  <strong>Linhas ignoradas:</strong>
                  <ul>
                    {resultado.erros.slice(0, 50).map((e, i) => (
                      <li key={i}>
                        Linha {e.linha}: {e.nome || "(sem nome)"} — {e.motivo}
                      </li>
                    ))}
                  </ul>
                  {resultado.erros.length > 50 && (
                    <p>… e mais {resultado.erros.length - 50}.</p>
                  )}
                </div>
              )}
            </div>
          ) : !arquivo ? (
            <>
              <p className="func-imp__intro">
                Suba uma planilha <strong>.xlsx</strong> ou <strong>.csv</strong>.
                Colunas reconhecidas: {TEMPLATE_COLUNAS.join(", ")}. Obrigatórios:{" "}
                <strong>Nome</strong> e <strong>CPF</strong> (a senha inicial é o
                CPF).
              </p>
              <label className="func-imp__drop">
                <Upload size={22} aria-hidden="true" />
                <span>Clique para escolher a planilha</span>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(e) => void aoEscolher(e.target.files?.[0] ?? null)}
                />
              </label>
              <button
                type="button"
                className="func-imp__link"
                onClick={baixarModeloCsv}
              >
                <Download size={14} aria-hidden="true" /> Baixar modelo CSV
              </button>
            </>
          ) : analisando ? (
            <p className="func-imp__intro">Lendo planilha…</p>
          ) : (
            <>
              <p className="func-imp__resumo">
                <strong>{linhas.length}</strong> linha(s) · {analise.validas}{" "}
                válida(s)
                {analise.comAviso > 0 && (
                  <span className="func-imp__aviso">
                    <AlertTriangle size={14} /> {analise.comAviso} com aviso
                  </span>
                )}
              </p>
              <div className="func-imp__previa">
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>CPF</th>
                      <th>Cargo</th>
                      <th>Perfil</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analise.avaliadas.slice(0, 8).map((x, i) => (
                      <tr key={i} className={x.problema ? "tem-aviso" : ""}>
                        <td>{x.f.nome || "—"}</td>
                        <td>{x.f.cpf || "—"}</td>
                        <td>{x.f.cargo || "—"}</td>
                        <td>{x.f.tipo}</td>
                        <td>{x.problema ?? "OK"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {linhas.length > 8 && (
                  <p className="func-imp__mais">
                    … e mais {linhas.length - 8} linha(s).
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
              <button type="button" className="func__btn" onClick={trocarArquivo}>
                Trocar arquivo
              </button>
              <button
                type="button"
                className="func__btn func__btn--primary"
                disabled={!analise.validas || enviando}
                onClick={() => void importar()}
              >
                {enviando
                  ? "Importando…"
                  : `Importar ${analise.validas} funcionário(s)`}
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
