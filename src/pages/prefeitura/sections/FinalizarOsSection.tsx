import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "@firebase/firestore";
import { db } from "../../../lib/firebase/firebase";
import type {
  AbastecimentoRegistro,
  ChecklistOficina,
  DadosPrefeitura,
} from "../../../lib/hu360";
import type { PostoFirestore } from "../../admin/hooks/postos/types";

interface ChecklistDevolucao {
  id: string;
  oficinaNome: string;
  equipamento: string;
  relatorio: string;
  ordemServicoId: string | null;
  fotoNovaUrl: string;
  fotoVelhaUrl: string;
  fotoProntoUrl: string;
  criadoEm: { seconds: number } | null;
}

interface FinalizarOsSectionProps {
  dados: DadosPrefeitura;
  prefeituraId: string;
}

function parseValorBR(v: string): number {
  if (!v) return 0;
  const limpo = v
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

function mesIsoDoRegistro(r: AbastecimentoRegistro): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(r.data);
  if (m) return `${m[1]}-${m[2]}`;
  const m2 = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(r.data);
  if (m2) return `${m2[3]}-${m2[2]}`;
  return "";
}

function labelMes(iso: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const meses = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  return `${meses[Number(m[2]) - 1]}/${m[1]}`;
}

export function FinalizarOsSection({
  dados: _dados,
  prefeituraId,
}: FinalizarOsSectionProps) {
  // postos e abastecimentos vêm do Firestore
  const [postos, setPostos] = useState<PostoFirestore[]>([]);
  const [abs, setAbs] = useState<AbastecimentoRegistro[]>([]);
  const [absLoading, setAbsLoading] = useState(true);

  const loadAbsPostos = useCallback(async () => {
    if (!prefeituraId) return;
    setAbsLoading(true);
    try {
      const [postosSnap, absSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "postos"),
            where("prefeituraId", "==", prefeituraId),
          ),
        ),
        getDocs(
          query(
            collection(db, "abastecimentos"),
            where("prefeituraId", "==", prefeituraId),
          ),
        ),
      ]);
      setPostos(
        postosSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as PostoFirestore,
        ),
      );
      const lista = absSnap.docs.map((d) => d.data() as AbastecimentoRegistro);
      lista.sort((a, b) => (a.data < b.data ? 1 : -1));
      setAbs(lista);
    } catch {
      // silently fail
    } finally {
      setAbsLoading(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void loadAbsPostos();
  }, [loadAbsPostos]);

  const [checklistAberto, setChecklistAberto] = useState<{
    titulo: string;
    sub: string;
    checklist: ChecklistOficina;
    fotoNovaUrl?: string;
    fotoVelhaUrl?: string;
    fotoProntoUrl?: string;
  } | null>(null);

  const [checklists, setChecklists] = useState<ChecklistDevolucao[]>([]);
  const [checklistsLoading, setChecklistsLoading] = useState(false);

  const loadChecklists = useCallback(async () => {
    if (!prefeituraId) return;
    setChecklistsLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, "checklistsDevolucao"),
          where("prefeituraId", "==", prefeituraId),
        ),
      );
      setChecklists(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChecklistDevolucao, "id">),
        })),
      );
    } catch {
      // silently fail
    } finally {
      setChecklistsLoading(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void loadChecklists();
  }, [loadChecklists]);

  const [postoSel, setPostoSel] = useState<string>("");

  // Inicializa postoSel quando os postos carregarem
  useEffect(() => {
    if (postos.length > 0 && !postoSel) setPostoSel(postos[0].id);
  }, [postos, postoSel]);

  const meses = useMemo<string[]>(() => {
    const set = new Set<string>();
    abs.forEach((r) => {
      const m = mesIsoDoRegistro(r);
      if (m) set.add(m);
    });
    return Array.from(set).sort().reverse();
  }, [abs]);

  const [mesSel, setMesSel] = useState<string>("");

  // Inicializa mesSel quando os meses calcularem
  useEffect(() => {
    if (meses.length > 0 && !mesSel) setMesSel(meses[0]);
  }, [meses, mesSel]);
  const [chaveNFe, setChaveNFe] = useState("");
  const [arquivoNFe, setArquivoNFe] = useState("");
  const [dataPg, setDataPg] = useState("");
  const [conferi, setConferi] = useState(false);
  const [msgFin, setMsgFin] = useState<{
    tone: "none" | "ok" | "err";
    text: string;
  }>({
    tone: "none",
    text: "",
  });

  const resumoSelecao = useMemo(() => {
    if (!postoSel || !mesSel) return null;
    const itens = abs.filter(
      (r) => r.postoId === postoSel && mesIsoDoRegistro(r) === mesSel,
    );
    const totalLitros = itens.reduce(
      (acc, r) => acc + (Number(r.litros) || 0),
      0,
    );
    const totalValor = itens.reduce(
      (acc, r) => acc + parseValorBR(r.valorTotal),
      0,
    );
    return {
      qtd: itens.length,
      litros: totalLitros,
      valor: totalValor,
    };
  }, [postoSel, mesSel, abs]);

  function handleCsv() {
    // Filtra pelo posto e mês selecionados, ou exporta tudo se não houver seleção
    const itens =
      postoSel && mesSel
        ? abs.filter(
            (r) => r.postoId === postoSel && mesIsoDoRegistro(r) === mesSel,
          )
        : abs;

    const postoLabel =
      postos.find((p) => p.id === postoSel)?.nomeFantasia ||
      postos.find((p) => p.id === postoSel)?.razaoSocial ||
      "todos";

    const linhas = [
      [
        "Data",
        "Veículo",
        "Motorista",
        "Posto",
        "Combustível",
        "Litros",
        "Valor (R$)",
        "Km/Horímetro",
        "Cupom/NF",
        "Secretaria",
      ],
      ...itens.map((r) => [
        r.data,
        r.veiculo,
        r.motorista,
        r.postoNome,
        r.combustivel,
        String(r.litros),
        r.valorTotal,
        String(r.km ?? ""),
        r.cupomFiscal,
        r.secretaria,
      ]),
    ];

    const csv = linhas
      .map((l) => l.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abastecimentos_${postoLabel}_${mesSel || "completo"}_${prefeituraId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const [salvandoNF, setSalvandoNF] = useState(false);

  async function handleRegistrarNF() {
    setMsgFin({ tone: "none", text: "" });
    if (!postoSel || !mesSel) {
      setMsgFin({ tone: "err", text: "Selecione posto e mês." });
      return;
    }
    if (chaveNFe.replace(/\D/g, "").length !== 44) {
      setMsgFin({ tone: "err", text: "Chave NF-e deve ter 44 dígitos." });
      return;
    }
    if (!conferi) {
      setMsgFin({ tone: "err", text: "Marque a confirmação da conferência." });
      return;
    }
    const posto = postos.find((p) => p.id === postoSel);
    const resumo = resumoSelecao;
    setSalvandoNF(true);
    try {
      await addDoc(collection(db, "nfsCombustivel"), {
        prefeituraId,
        postoId: postoSel,
        postoNome: posto?.nomeFantasia || posto?.razaoSocial || postoSel,
        mesReferencia: mesSel,
        chaveNFe: chaveNFe.replace(/\D/g, ""),
        arquivoNFe,
        dataPagamento: dataPg || null,
        qtdCupons: resumo?.qtd ?? 0,
        totalLitros: resumo?.litros ?? 0,
        totalValor: resumo?.valor ?? 0,
        conferido: true,
        criadoEm: serverTimestamp(),
      });
      setMsgFin({
        tone: "ok",
        text: `NF registrada para ${labelMes(mesSel)} — posto ${posto?.nomeFantasia || posto?.razaoSocial || postoSel} (chave ...${chaveNFe.slice(-6)}). Pagamento agendado.`,
      });
      setChaveNFe("");
      setArquivoNFe("");
      setDataPg("");
      setConferi(false);
    } catch {
      setMsgFin({
        tone: "err",
        text: "Erro ao registrar NF. Tente novamente.",
      });
    } finally {
      setSalvandoNF(false);
    }
  }

  return (
    <>
      <h1>Checklist de devolução, NF e pagamento</h1>

      <article className="card">
        <span className="tag-etapa">Etapas 5 e 6 — Financeiro</span>
        <h3 style={{ marginTop: 8 }}>Serviços aguardando NF e pagamento</h3>
        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>O.S.</th>
                <th>Máquina</th>
                <th>Oficina executora</th>
                <th>Valor aprovado</th>
                <th>Etapa</th>
                <th>Checklist da oficina</th>
              </tr>
            </thead>
            <tbody id="pf-tbody-os">
              {checklistsLoading ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--text-gray)" }}>
                    Carregando...
                  </td>
                </tr>
              ) : checklists.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "var(--text-gray)" }}>
                    Nenhum checklist de devolução recebido.
                  </td>
                </tr>
              ) : (
                checklists.map((ck) => {
                  const dataStr = ck.criadoEm
                    ? new Date(ck.criadoEm.seconds * 1000).toLocaleDateString(
                        "pt-BR",
                      )
                    : "—";
                  return (
                    <tr key={ck.id}>
                      <td>
                        <strong>{ck.ordemServicoId ?? "—"}</strong>
                      </td>
                      <td>{ck.equipamento}</td>
                      <td>{ck.oficinaNome}</td>
                      <td>{dataStr}</td>
                      <td>Checklist enviado</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{
                            margin: 0,
                            padding: "5px 10px",
                            fontSize: "0.78rem",
                          }}
                          onClick={() =>
                            setChecklistAberto({
                              titulo: ck.equipamento,
                              sub: `${ck.ordemServicoId ?? "—"} · ${ck.equipamento} · ${ck.oficinaNome}`,
                              fotoNovaUrl: ck.fotoNovaUrl || undefined,
                              fotoVelhaUrl: ck.fotoVelhaUrl || undefined,
                              fotoProntoUrl: ck.fotoProntoUrl || undefined,
                              checklist: {
                                tipoServico: ck.equipamento,
                                protocolo: ck.ordemServicoId ?? "—",
                                oficinaExecutora: ck.oficinaNome,
                                horimetroLeitura: "—",
                                osRef: ck.ordemServicoId ?? "—",
                                observacoesOperador: ck.relatorio,
                                fotosResumo:
                                  [
                                    ck.fotoNovaUrl,
                                    ck.fotoVelhaUrl,
                                    ck.fotoProntoUrl,
                                  ]
                                    .filter(Boolean)
                                    .map(
                                      (_, i) =>
                                        [
                                          "Peça nova",
                                          "Peça velha",
                                          "Equipamento pronto",
                                        ][i],
                                    )
                                    .join(", ") || "",
                                secoes: [
                                  {
                                    titulo: "Relatório do serviço",
                                    itens: [
                                      {
                                        item: "Relato",
                                        resposta: ck.relatorio,
                                        conforme: true,
                                      },
                                    ],
                                  },
                                ],
                              } as ChecklistOficina,
                            })
                          }
                        >
                          Ver checklist
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <span className="tag-etapa">Combustível — Financeiro</span>
        <h3 style={{ marginTop: 8 }}>
          Planilha do controle de abastecimento (Excel)
        </h3>
        <p
          style={{
            color: "var(--text-gray)",
            fontSize: "0.88rem",
            marginBottom: 12,
          }}
        >
          Exporta os registros do posto e mês selecionados (ou todos) em CSV
          para abrir no Excel. Os dados vêm diretamente do banco de dados.
        </p>
        {absLoading ? (
          <p style={{ color: "var(--text-gray)", fontSize: "0.85rem" }}>
            Carregando dados…
          </p>
        ) : abs.length === 0 ? (
          <p style={{ color: "var(--text-gray)", fontSize: "0.85rem" }}>
            Nenhum abastecimento registrado ainda.
          </p>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "auto" }}
            onClick={handleCsv}
          >
            Baixar Excel (CSV) —{" "}
            {postoSel && mesSel
              ? `${labelMes(mesSel)} / ${postos.find((p) => p.id === postoSel)?.nomeFantasia || postos.find((p) => p.id === postoSel)?.razaoSocial || postoSel}`
              : `todos (${abs.length} registros)`}
          </button>
        )}
      </article>

      <article className="card">
        <h3>NF combustível — conferir e enviar para pagamento</h3>
        <p
          style={{
            color: "var(--text-gray)",
            fontSize: "0.88rem",
            marginBottom: 12,
          }}
        >
          Conferência municipal do consumo por posto e mês, cadastro da{" "}
          <strong>chave NF-e</strong> e registro do envio para pagamento.
        </p>
        <div className="grid">
          <div>
            <label htmlFor="pf-fin-abs-posto">Posto credenciado</label>
            <select
              id="pf-fin-abs-posto"
              value={postoSel}
              onChange={(e) => setPostoSel(e.target.value)}
            >
              {absLoading ? (
                <option value="">Carregando…</option>
              ) : postos.length === 0 ? (
                <option value="">— sem postos cadastrados —</option>
              ) : (
                postos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nomeFantasia || p.razaoSocial}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label htmlFor="pf-fin-abs-mes">Mês de referência</label>
            <select
              id="pf-fin-abs-mes"
              value={mesSel}
              onChange={(e) => setMesSel(e.target.value)}
            >
              {meses.length === 0 ? (
                <option value="">— sem registros —</option>
              ) : (
                meses.map((m) => (
                  <option key={m} value={m}>
                    {labelMes(m)}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        <p
          id="pf-fin-abs-resumo"
          style={{
            margin: "14px 0",
            fontSize: "0.88rem",
            color: "#cbd5e1",
            lineHeight: 1.5,
          }}
        >
          {resumoSelecao
            ? `Período selecionado: ${resumoSelecao.qtd} cupom(s), ${resumoSelecao.litros.toLocaleString("pt-BR")} L · R$ ${resumoSelecao.valor.toLocaleString(
                "pt-BR",
                { minimumFractionDigits: 2, maximumFractionDigits: 2 },
              )}.`
            : "Selecione posto e mês para visualizar o resumo."}
        </p>
        <div className="grid" style={{ marginTop: 8 }}>
          <div>
            <label htmlFor="pf-fin-abs-nfe">Chave NF-e (44 dígitos)</label>
            <input
              type="text"
              id="pf-fin-abs-nfe"
              maxLength={44}
              placeholder="Somente números"
              autoComplete="off"
              value={chaveNFe}
              onChange={(e) => setChaveNFe(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pf-fin-abs-arq">
              Nome do arquivo da NF (PDF/XML)
            </label>
            <input
              type="text"
              id="pf-fin-abs-arq"
              placeholder="ex.: NF_combustivel_052026.pdf"
              autoComplete="off"
              value={arquivoNFe}
              onChange={(e) => setArquivoNFe(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pf-fin-abs-data-pg">Data do pagamento</label>
            <input
              type="date"
              id="pf-fin-abs-data-pg"
              value={dataPg}
              onChange={(e) => setDataPg(e.target.value)}
            />
          </div>
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          <input
            type="checkbox"
            id="pf-fin-abs-check"
            checked={conferi}
            onChange={(e) => setConferi(e.target.checked)}
            style={{ width: "auto", margin: 0 }}
          />
          <span>
            Confirmo a conferência entre consumo do período, valores e NF-e.
          </span>
        </label>
        <button
          type="button"
          className="btn btn-success"
          style={{ width: "100%", marginTop: 14 }}
          onClick={handleRegistrarNF}
          disabled={salvandoNF}
        >
          {salvandoNF ? "Salvando…" : "Registrar NF e enviar para pagamento"}
        </button>
        <p
          id="pf-fin-abs-msg"
          style={{
            marginTop: 12,
            fontSize: "0.88rem",
            minHeight: 22,
            color:
              msgFin.tone === "ok"
                ? "#86efac"
                : msgFin.tone === "err"
                  ? "#fca5a5"
                  : "var(--text-gray)",
          }}
        >
          {msgFin.text}
        </p>
      </article>

      {checklistAberto ? (
        <div
          className="pf-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setChecklistAberto(null)}
        >
          <div
            className="pf-modal-box pf-modal-checklist-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="pf-modal-fechar"
              onClick={() => setChecklistAberto(null)}
              aria-label="Fechar"
            >
              ×
            </button>
            <h2 className="pf-modal-titulo">{checklistAberto.titulo}</h2>
            <p className="pf-modal-sub">{checklistAberto.sub}</p>
            <div className="pf-checklist-meta">
              <div>
                <strong>Protocolo:</strong>{" "}
                {checklistAberto.checklist.protocolo}
              </div>
              <div>
                <strong>Oficina:</strong>{" "}
                {checklistAberto.checklist.oficinaExecutora}
              </div>
              <div>
                <strong>Horímetro:</strong>{" "}
                {checklistAberto.checklist.horimetroLeitura}
              </div>
              <div>
                <strong>O.S.:</strong> {checklistAberto.checklist.osRef}
              </div>
            </div>
            {checklistAberto.checklist.secoes.map((s, idx) => (
              <div key={idx} className="pf-checklist-secao">
                <h4>{s.titulo}</h4>
                <ul>
                  {s.itens.map((it, j) => (
                    <li key={j} className={!it.conforme ? "nao-conforme" : ""}>
                      <strong>{it.item}</strong> — {it.resposta}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {checklistAberto.checklist.observacoesOperador ? (
              <p className="pf-modal-obs">
                <strong>Observações:</strong>{" "}
                {checklistAberto.checklist.observacoesOperador}
              </p>
            ) : null}
            {checklistAberto.checklist.fotosResumo ? (
              <p className="pf-modal-obs">
                <strong>Fotos:</strong> {checklistAberto.checklist.fotosResumo}
              </p>
            ) : null}
            {checklistAberto.fotoNovaUrl ||
            checklistAberto.fotoVelhaUrl ||
            checklistAberto.fotoProntoUrl ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                  gap: 12,
                  marginTop: 12,
                }}
              >
                {checklistAberto.fotoNovaUrl ? (
                  <div>
                    <p
                      style={{
                        fontSize: "0.78rem",
                        marginBottom: 4,
                        color: "#94a3b8",
                      }}
                    >
                      Peça nova instalada
                    </p>
                    <img
                      src={checklistAberto.fotoNovaUrl}
                      alt="Peça nova"
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #334155",
                      }}
                    />
                  </div>
                ) : null}
                {checklistAberto.fotoVelhaUrl ? (
                  <div>
                    <p
                      style={{
                        fontSize: "0.78rem",
                        marginBottom: 4,
                        color: "#94a3b8",
                      }}
                    >
                      Peça velha substituída
                    </p>
                    <img
                      src={checklistAberto.fotoVelhaUrl}
                      alt="Peça velha"
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #334155",
                      }}
                    />
                  </div>
                ) : null}
                {checklistAberto.fotoProntoUrl ? (
                  <div>
                    <p
                      style={{
                        fontSize: "0.78rem",
                        marginBottom: 4,
                        color: "#94a3b8",
                      }}
                    >
                      Equipamento pronto
                    </p>
                    <img
                      src={checklistAberto.fotoProntoUrl}
                      alt="Equipamento pronto"
                      style={{
                        width: "100%",
                        borderRadius: 6,
                        border: "1px solid #334155",
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
