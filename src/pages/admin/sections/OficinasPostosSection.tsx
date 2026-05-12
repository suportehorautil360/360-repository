import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHU360 } from "../../../lib/hu360";
import { HUB_CTX_KEY } from "../../../portal/postoPortalCore";
import { CRED_KEYS, CRED_TOTAL } from "./oficinasPostosCredData";
import {
  CRED_OCR_MAX_PAGES_POR_PDF,
  processarExtracaoCredAposAnexos,
} from "./credOcr";
import { useOficinas } from "../hooks/oficinas/use-oficinas";
import { usePostos } from "../hooks/postos/use-postos";
import type { OficinaFirestore } from "../hooks/oficinas/types";
import type { PostoFirestore } from "../hooks/postos/types";

type ModoCadastro = "oficina" | "posto";

function credEmpty(): Record<string, boolean> {
  return Object.fromEntries(CRED_KEYS.map((k) => [k, false])) as Record<
    string,
    boolean
  >;
}

const CRED_BLOCKS: {
  title: string;
  items: { key: string; strong: string; text: string }[];
}[] = [
  {
    title: "1. Documentos de identificação (sócios e empresa)",
    items: [
      {
        key: "id_cnpj",
        strong: "Cartão CNPJ",
        text: " — Atualizado (emitido no site da Receita Federal).",
      },
      {
        key: "id_contrato",
        strong: "Contrato social ou estatuto",
        text: " — Consolidação original e alterações, registradas na Junta Comercial.",
      },
      {
        key: "id_socios",
        strong: "Documentos dos sócios",
        text: " — RG e CPF (ou CNH) de todos os proprietários que assinam pela empresa.",
      },
      {
        key: "id_endereco",
        strong: "Comprovante de endereço",
        text: " — Da sede da oficina.",
      },
    ],
  },
  {
    title: "2. Regularidade fiscal (certidões negativas)",
    items: [
      {
        key: "fisc_federal",
        strong: "Débitos federais e dívida ativa da União",
        text: " — Certidão (tributos federais e INSS).",
      },
      {
        key: "fisc_estadual",
        strong: "Certidão negativa estadual",
        text: " — Secretaria da Fazenda (ICMS).",
      },
      {
        key: "fisc_municipal",
        strong: "Certidão negativa municipal",
        text: " — Prefeitura (ISS e taxas mobiliárias).",
      },
      {
        key: "fisc_fgts",
        strong: "CRF (FGTS)",
        text: " — Caixa Econômica Federal.",
      },
      {
        key: "fisc_cndt",
        strong: "CNDT",
        text: " — Débitos trabalhistas (TST).",
      },
    ],
  },
  {
    title: "3. Habilitação jurídica e econômica",
    items: [
      {
        key: "hab_falencia",
        strong: "Falência ou recuperação judicial",
        text: " — Certidão negativa (Tribunal de Justiça).",
      },
      {
        key: "hab_balanco",
        strong: "Balanço patrimonial",
        text: " — Último exercício social.",
      },
    ],
  },
  {
    title: "4. Qualificação técnica e licenciamento",
    items: [
      {
        key: "tec_alvara",
        strong: "Alvará de funcionamento e localização",
        text: " — Prefeitura.",
      },
      {
        key: "tec_avcb",
        strong: "AVCB",
        text: " — Corpo de Bombeiros.",
      },
      {
        key: "tec_ambiental",
        strong: "Licença ambiental ou dispensa",
        text: " — Órgão ambiental competente.",
      },
      {
        key: "tec_atestado",
        strong: "Atestado de capacidade técnica",
        text: " — Cliente / serviços prestados.",
      },
    ],
  },
];

export function OficinasPostosSection() {
  const { prefeituras, prefeituraLabel } = useHU360();
  const {
    listarOficinas,
    adicionarOficina,
    atualizarCredOficina,
    removerOficina,
  } = useOficinas();
  const { listarPostos, adicionarPosto, removerPosto } = usePostos();

  const podeGerenciarParceiros = true;

  const [focoPrefId, setFocoPrefId] = useState<string>(() => {
    if (!prefeituras.length) return "";
    try {
      const s = sessionStorage.getItem(HUB_CTX_KEY);
      if (s && prefeituras.some((p) => p.id === s)) return s;
    } catch {
      /* ignore */
    }
    return prefeituras[0].id;
  });

  const [postoMunicipioId, setPostoMunicipioId] = useState<string>(() => {
    if (!prefeituras.length) return "";
    try {
      const s = sessionStorage.getItem(HUB_CTX_KEY);
      if (s && prefeituras.some((p) => p.id === s)) return s;
    } catch {
      /* ignore */
    }
    return prefeituras[0].id;
  });

  const [modoCadastro, setModoCadastro] = useState<ModoCadastro>("oficina");
  const [novaOficinaNome, setNovaOficinaNome] = useState("");
  const [novaOficinaEsp, setNovaOficinaEsp] = useState("");
  const [novaOficinaStatus, setNovaOficinaStatus] = useState("Ativa");
  const [credChecklist, setCredChecklist] = useState<Record<string, boolean>>(
    () => credEmpty(),
  );
  const [credObs, setCredObs] = useState("");
  const [credAnexosNomes, setCredAnexosNomes] = useState<string[]>([]);
  const [credExtractStatus, setCredExtractStatus] = useState("");
  const [credCnpjAuto, setCredCnpjAuto] = useState("");
  const [credRazaoAuto, setCredRazaoAuto] = useState("");
  const [selOficinaDocId, setSelOficinaDocId] = useState("");
  const [msgParceiros, setMsgParceiros] = useState("");
  const [msgParceirosTone, setMsgParceirosTone] = useState<
    "none" | "ok" | "err"
  >("none");
  const [hubMsgPosto, setHubMsgPosto] = useState("");
  //@ts-ignore
  const [loadingOficinas, setLoadingOficinas] = useState(false);
  //@ts-ignore
  const [loadingPostos, setLoadingPostos] = useState(false);
  const [oficinasLista, setOficinasLista] = useState<OficinaFirestore[]>([]);
  const [postosLista, setPostosLista] = useState<PostoFirestore[]>([]);

  const [postoRazao, setPostoRazao] = useState("");
  const [postoFantasia, setPostoFantasia] = useState("");
  const [postoCnpj, setPostoCnpj] = useState("");
  const [postoBandeira, setPostoBandeira] = useState("");
  const [postoEndereco, setPostoEndereco] = useState("");
  const [postoComb, setPostoComb] = useState("");
  const [postoLimite, setPostoLimite] = useState("");
  const [postoContrato, setPostoContrato] = useState("");
  const [postoValidade, setPostoValidade] = useState("");
  const [credProgressWrapVisible, setCredProgressWrapVisible] = useState(false);
  const [credProgressPct, setCredProgressPct] = useState(0);
  const [credProgressLabel, setCredProgressLabel] = useState("Progresso");
  const ocrTokenRef = useRef(0);

  useEffect(() => {
    if (!focoPrefId && prefeituras[0]) {
      setFocoPrefId(prefeituras[0].id);
    }
    if (!postoMunicipioId && prefeituras[0]) {
      setPostoMunicipioId(prefeituras[0].id);
    }
  }, [prefeituras, focoPrefId, postoMunicipioId]);

  const carregarOficinas = useCallback(
    async (prefId: string) => {
      if (!prefId) return;
      setLoadingOficinas(true);
      const lista = await listarOficinas(prefId);
      setOficinasLista(lista);
      setLoadingOficinas(false);
    },
    [listarOficinas],
  );

  const carregarPostos = useCallback(
    async (prefId: string) => {
      if (!prefId) return;
      setLoadingPostos(true);
      const lista = await listarPostos(prefId);
      setPostosLista(lista);
      setLoadingPostos(false);
    },
    [listarPostos],
  );

  useEffect(() => {
    void carregarOficinas(focoPrefId);
  }, [focoPrefId, carregarOficinas]);
  useEffect(() => {
    void carregarPostos(postoMunicipioId);
  }, [postoMunicipioId, carregarPostos]);

  const credMarcados = useMemo(
    () => CRED_KEYS.filter((k) => credChecklist[k]).length,
    [credChecklist],
  );

  useEffect(() => {
    const el = document.getElementById("ctxPrefeitura");
    if (el && focoPrefId) {
      el.textContent = `Cliente em foco: ${prefeituraLabel(focoPrefId)}`;
    }
  }, [focoPrefId, prefeituraLabel]);

  useEffect(() => {
    if (!selOficinaDocId) {
      setCredChecklist(credEmpty());
      setCredObs("");
      setCredAnexosNomes([]);
      setCredExtractStatus("");
      setCredCnpjAuto("");
      setCredRazaoAuto("");
      setCredProgressWrapVisible(false);
      setCredProgressPct(0);
      setCredProgressLabel("Progresso");
      return;
    }
    const p = oficinasLista.find((x) => x.id === selOficinaDocId);
    if (!p) return;
    const next = credEmpty();
    for (const k of CRED_KEYS) {
      next[k] = Boolean(p.credChecklist?.[k]);
    }
    setCredChecklist(next);
    setCredObs(p.credObservacoes ?? "");
    const nomes =
      p.credAnexosNomes && p.credAnexosNomes.length ? p.credAnexosNomes : [];
    setCredAnexosNomes(nomes);
    setCredCnpjAuto(p.credCnpjExtraido ?? "");
    setCredRazaoAuto(p.credRazaoSocialExtraida ?? "");
    setCredExtractStatus("");
    setCredProgressWrapVisible(false);
    setCredProgressPct(0);
    setCredProgressLabel("Progresso");
  }, [selOficinaDocId, oficinasLista]);

  const setFocoAndStorage = useCallback((id: string) => {
    setFocoPrefId(id);
    try {
      sessionStorage.setItem(HUB_CTX_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  function setMsg(tone: "none" | "ok" | "err", texto: string) {
    setMsgParceirosTone(tone);
    setMsgParceiros(texto);
  }

  /** Persiste o estado atual do credenciamento na oficina selecionada (Firestore). */
  const persistCredOnSelected = useCallback(
    (override?: Partial<OficinaFirestore>) => {
      if (!selOficinaDocId || !podeGerenciarParceiros) return;
      void atualizarCredOficina(selOficinaDocId, {
        credChecklist: override?.credChecklist ?? { ...credChecklist },
        credObservacoes:
          override?.credObservacoes ?? (credObs.trim() || undefined),
        credAnexosNomes:
          override?.credAnexosNomes ??
          (credAnexosNomes.length ? credAnexosNomes : undefined),
        credCnpjExtraido:
          override?.credCnpjExtraido ?? (credCnpjAuto.trim() || undefined),
        credRazaoSocialExtraida:
          override?.credRazaoSocialExtraida ??
          (credRazaoAuto.trim() || undefined),
      }).then(() => carregarOficinas(focoPrefId));
    },
    [
      selOficinaDocId,
      focoPrefId,
      podeGerenciarParceiros,
      atualizarCredOficina,
      carregarOficinas,
      credChecklist,
      credObs,
      credAnexosNomes,
      credCnpjAuto,
      credRazaoAuto,
    ],
  );

  function toggleCred(key: string) {
    if (!podeGerenciarParceiros) return;
    setCredChecklist((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (selOficinaDocId) {
        void atualizarCredOficina(selOficinaDocId, {
          credChecklist: next,
        }).then(() => carregarOficinas(focoPrefId));
      }
      return next;
    });
  }

  async function handleCredFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) {
      setCredAnexosNomes([]);
      setCredExtractStatus("");
      setCredProgressWrapVisible(false);
      setCredProgressPct(0);
      return;
    }
    const names = Array.from(files).map((f) => f.name);
    setCredAnexosNomes(names);
    setCredExtractStatus(
      `${names.length} arquivo(s) selecionado(s). Extraindo texto…`,
    );
    setCredProgressWrapVisible(true);
    setCredProgressPct(0);
    setCredProgressLabel("Iniciando…");

    const token = ++ocrTokenRef.current;
    const fileList = files;

    persistCredOnSelected({
      credAnexosNomes: names,
      credAnexosResumo: names.join(", "),
    });

    try {
      const r = await processarExtracaoCredAposAnexos({
        files: fileList,
        onProgresso: ({ pct, rotulo }) => {
          if (token !== ocrTokenRef.current) return;
          setCredProgressPct(Math.round(pct));
          if (rotulo) setCredProgressLabel(rotulo);
        },
      });
      if (token !== ocrTokenRef.current) return;
      setCredExtractStatus(r.status);
      if (r.cnpj) setCredCnpjAuto(r.cnpj);
      if (r.razaoSocial) setCredRazaoAuto(r.razaoSocial);
      const proximoChecklist = r.cnpj
        ? { ...credChecklist, id_cnpj: true }
        : credChecklist;
      if (r.cnpj) setCredChecklist(proximoChecklist);
      persistCredOnSelected({
        credChecklist: proximoChecklist,
        credCnpjExtraido: r.cnpj || undefined,
        credRazaoSocialExtraida: r.razaoSocial || undefined,
        credAnexosNomes: names,
      });
      window.setTimeout(() => {
        if (token !== ocrTokenRef.current) return;
        setCredProgressWrapVisible(false);
        setCredProgressPct(0);
        setCredProgressLabel("Progresso");
      }, 900);
    } catch {
      if (token !== ocrTokenRef.current) return;
      setCredExtractStatus(
        "Falha ao processar os arquivos. Tente novamente ou preencha manualmente.",
      );
      setCredProgressWrapVisible(false);
    }
  }

  async function handleSalvarOficina(e: FormEvent) {
    e.preventDefault();
    if (!focoPrefId) {
      setMsg("err", "Selecione o cliente em foco.");
      return;
    }
    const nome = novaOficinaNome.trim();
    const esp = novaOficinaEsp.trim();
    if (!nome || !esp) {
      setMsg("err", "Preencha nome e especialidade.");
      return;
    }
    if (!podeGerenciarParceiros) {
      setMsg("err", "Sem permissão para cadastrar parceiros.");
      return;
    }
    const resultado = await adicionarOficina({
      prefeituraId: focoPrefId,
      nome,
      especialidade: esp,
      status: novaOficinaStatus as "Ativa" | "Suspensa",
      credChecklist: { ...credChecklist },
      credObservacoes: credObs.trim() || undefined,
      credAnexosNomes: credAnexosNomes.length ? credAnexosNomes : undefined,
      credCnpjExtraido: credCnpjAuto.trim() || undefined,
      credRazaoSocialExtraida: credRazaoAuto.trim() || undefined,
    });
    if (!resultado.ok) {
      setMsg("err", resultado.message);
      return;
    }
    await carregarOficinas(focoPrefId);
    setNovaOficinaNome("");
    setNovaOficinaEsp("");
    setNovaOficinaStatus("Ativa");
    setCredChecklist(credEmpty());
    setCredObs("");
    setCredAnexosNomes([]);
    setCredExtractStatus("");
    setCredCnpjAuto("");
    setCredRazaoAuto("");
    if (resultado.id) setSelOficinaDocId(resultado.id);
    setMsg(
      "ok",
      "Oficina salva com checklist e anexos (metadados) neste cliente.",
    );
  }

  async function handleRemoverOficina(id: string) {
    if (!window.confirm("Remover esta oficina da lista?")) return;
    await removerOficina(id);
    await carregarOficinas(focoPrefId);
    if (selOficinaDocId === id) setSelOficinaDocId("");
  }

  async function handleSalvarPosto() {
    if (!postoMunicipioId) {
      setHubMsgPosto("Selecione o cliente (contrato).");
      return;
    }
    const razao = postoRazao.trim();
    if (!razao) {
      setHubMsgPosto("Preencha a razão social.");
      return;
    }
    const lim = Number(postoLimite.replace(/\D/g, "")) || 0;
    const resultado = await adicionarPosto({
      prefeituraId: postoMunicipioId,
      razaoSocial: razao,
      nomeFantasia: postoFantasia.trim() || undefined,
      cnpj: postoCnpj.trim() || undefined,
      bandeira: postoBandeira.trim() || undefined,
      endereco: postoEndereco.trim() || undefined,
      combustiveis: postoComb.trim() || undefined,
      limiteLitrosMes: lim || undefined,
      contrato: postoContrato.trim() || undefined,
      validadeAte: postoValidade.trim() || undefined,
      status: "Ativa",
    });
    if (!resultado.ok) {
      setHubMsgPosto(resultado.message);
      return;
    }
    await carregarPostos(postoMunicipioId);
    setPostoRazao("");
    setPostoFantasia("");
    setPostoCnpj("");
    setPostoBandeira("");
    setPostoEndereco("");
    setPostoComb("");
    setPostoLimite("");
    setPostoContrato("");
    setPostoValidade("");
    setHubMsgPosto("Posto salvo.");
    window.setTimeout(() => setHubMsgPosto(""), 4000);
  }

  async function handleRemoverPosto(postoId: string) {
    if (!window.confirm("Remover este posto credenciado?")) return;
    await removerPosto(postoId);
    await carregarPostos(postoMunicipioId);
  }

  const msgClass =
    msgParceirosTone === "none"
      ? "status"
      : `status status--${msgParceirosTone === "ok" ? "ok" : "err"}`;

  return (
    <section id="hub-oficinas-postos" className="aba-conteudo ativa">
      <h2>Parceiros e postos credenciados</h2>
      <p
        className="topbar-user"
        style={{ marginBottom: 14, maxWidth: 920, lineHeight: 1.5 }}
      >
        Escolha se vai cadastrar uma <strong>oficina</strong> (com checklist de
        documentos) ou um <strong>posto</strong> para abastecimento da frota. As
        listas ficam <strong>separadas</strong> abaixo. Respeita o{" "}
        <strong>cliente em foco</strong> na gestão (barra superior). Para{" "}
        <strong>logins</strong>, use{" "}
        <strong>Controle → Acessos e logins</strong>.
      </p>

      <article className="card" style={{ marginBottom: 18 }}>
        <h3>Cliente em foco (cadastro de oficinas)</h3>
        <p
          id="msgParceirosEscopo"
          className="topbar-user"
          style={{ marginBottom: 12 }}
        >
          {focoPrefId
            ? `Cadastro de oficinas e checklist vão para: ${prefeituraLabel(focoPrefId)}.`
            : "—"}
        </p>
        <label
          htmlFor="hub-sel-foco-pref"
          className="topbar-user"
          style={{ display: "block", marginBottom: 6 }}
        >
          Prefeitura / contratante
        </label>
        <select
          id="hub-sel-foco-pref"
          value={focoPrefId}
          onChange={(e) => setFocoAndStorage(e.target.value)}
        >
          {prefeituras.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({p.uf})
            </option>
          ))}
        </select>
      </article>

      <article className="card" style={{ marginBottom: 18 }}>
        <h3>Cadastro na rede</h3>
        <div
          className="hub-parceiros-modo-pick"
          role="radiogroup"
          aria-label="O que deseja cadastrar"
        >
          <label>
            <input
              type="radio"
              name="hubModoCadastroRede"
              value="oficina"
              checked={modoCadastro === "oficina"}
              onChange={() => setModoCadastro("oficina")}
            />
            Oficina
          </label>
          <label>
            <input
              type="radio"
              name="hubModoCadastroRede"
              value="posto"
              checked={modoCadastro === "posto"}
              onChange={() => setModoCadastro("posto")}
            />
            Posto de combustível
          </label>
        </div>

        <div
          id="hub-bloco-cadastro-oficina"
          className={modoCadastro === "posto" ? "hub-parceiros-hidden" : ""}
        >
          <form id="formParceiro" onSubmit={handleSalvarOficina}>
            <div className="row-2">
              <div>
                <label htmlFor="novaParceiroNome">
                  Nome do estabelecimento
                </label>
                <input
                  id="novaParceiroNome"
                  required
                  placeholder="Ex.: Oficina Norte credenciada"
                  value={novaOficinaNome}
                  onChange={(e) => setNovaOficinaNome(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="novaParceiroEspecialidade">
                  Especialidade ou serviço
                </label>
                <input
                  id="novaParceiroEspecialidade"
                  required
                  placeholder="Ex.: Linha pesada / manutenção frota"
                  value={novaOficinaEsp}
                  onChange={(e) => setNovaOficinaEsp(e.target.value)}
                />
              </div>
            </div>
            <div className="row-2" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="novaParceiroStatus">Status</label>
                <select
                  id="novaParceiroStatus"
                  value={novaOficinaStatus}
                  onChange={(e) => setNovaOficinaStatus(e.target.value)}
                >
                  <option value="Ativa">Ativa</option>
                  <option value="Suspensa">Suspensa</option>
                </select>
              </div>
              <div />
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              style={{ marginTop: 8 }}
            >
              Salvar oficina
            </button>
            <p
              className="topbar-user"
              style={{ margin: "10px 0 0", fontSize: "0.82rem" }}
            >
              O checklist de credenciamento abaixo é gravado{" "}
              <strong>junto</strong> a esta oficina ao salvar.
            </p>
            <div id="msgParceiros" className={msgClass} role="status">
              {msgParceiros}
            </div>
          </form>

          <article
            className="card"
            id="credenciamento-oficina-card"
            style={{ marginBottom: 0, marginTop: 18 }}
          >
            <h3>Credenciamento de oficina — documentos</h3>
            <p
              className="topbar-user"
              style={{ margin: "0 0 14px", lineHeight: 1.5, maxWidth: 960 }}
            >
              Tudo em uma única tela: vá marcando no fluxo natural e,{" "}
              <strong>no final</strong>, anexe os arquivos (PDF, imagens etc.).
              Os dados são por <strong>oficina</strong>. Esta lista não
              substitui edital ou processo oficial do município.
            </p>
            <div className="hub-cred-head">
              <label htmlFor="hub-sel-oficina-doc">
                <span
                  className="topbar-user"
                  style={{ display: "block", marginBottom: 4 }}
                >
                  Acompanhar documentos de:
                </span>
                <select
                  id="hub-sel-oficina-doc"
                  aria-label="Oficina para checklist de credenciamento"
                  value={selOficinaDocId}
                  onChange={(e) => setSelOficinaDocId(e.target.value)}
                  disabled={!podeGerenciarParceiros}
                >
                  <option value="">— Selecione uma oficina cadastrada —</option>
                  {oficinasLista.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p id="hub-cred-progress">
              {credMarcados} de {CRED_TOTAL} itens marcados
            </p>
            <p
              className="topbar-user"
              style={{ margin: "-8px 0 12px", fontSize: "0.82rem" }}
            >
              O filtro acima carrega o checklist da oficina selecionada. Ao{" "}
              <strong>salvar oficina nova</strong>, o estado atual do checklist,
              observações e resumo de anexos entram no novo cadastro.
            </p>
            <div className="hub-cred-unica" id="hub-cred-unica">
              {CRED_BLOCKS.map((block) => (
                <div key={block.title}>
                  <h4>{block.title}</h4>
                  <ul className="cred-list">
                    {block.items.map((it) => (
                      <li key={it.key}>
                        <label className="cred-item">
                          <input
                            type="checkbox"
                            className="cred-chk"
                            data-cred-key={it.key}
                            checked={!!credChecklist[it.key]}
                            onChange={() => toggleCred(it.key)}
                            disabled={!podeGerenciarParceiros}
                          />
                          <span>
                            <strong>{it.strong}</strong>
                            {it.text}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="hub-cred-anexos-fim">
                <label htmlFor="hub-cred-obs">
                  Observações do processo (opcional)
                </label>
                <textarea
                  id="hub-cred-obs"
                  className="cred-obs"
                  placeholder="Pendências, protocolos, contatos do contador…"
                  value={credObs}
                  onChange={(e) => setCredObs(e.target.value)}
                  onBlur={() => persistCredOnSelected()}
                  disabled={!podeGerenciarParceiros}
                />
                <label htmlFor="hub-cred-anexos" style={{ marginTop: 14 }}>
                  Anexar documentos
                </label>
                <input
                  type="file"
                  id="hub-cred-anexos"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                  onChange={handleCredFiles}
                  disabled={!podeGerenciarParceiros}
                />
                <div
                  id="hub-cred-progress-wrap"
                  className={
                    "hub-cred-progress-wrap" +
                    (credProgressWrapVisible ? "" : " hub-parceiros-hidden")
                  }
                  aria-live="polite"
                >
                  <div className="hub-cred-progress-meta">
                    <span id="hub-cred-progress-label">
                      {credProgressLabel}
                    </span>
                    <span id="hub-cred-progress-pct">{credProgressPct}%</span>
                  </div>
                  <div
                    id="hub-cred-progress-bar"
                    className="hub-cred-progress-bar"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={credProgressPct}
                    aria-labelledby="hub-cred-progress-label"
                  >
                    <div
                      id="hub-cred-progress-fill"
                      className="hub-cred-progress-fill"
                      style={{ width: `${credProgressPct}%` }}
                    />
                  </div>
                  <p
                    className="topbar-user"
                    style={{ margin: "8px 0 0", fontSize: "0.76rem" }}
                  >
                    OCR analisa no máximo{" "}
                    <strong id="hub-cred-max-pages-label">
                      {CRED_OCR_MAX_PAGES_POR_PDF}
                    </strong>{" "}
                    páginas por PDF (configurável no código).
                  </p>
                </div>
                <p
                  id="hub-cred-extract-status"
                  className="topbar-user"
                  style={{
                    marginTop: 10,
                    minHeight: "1.3em",
                    fontSize: "0.84rem",
                  }}
                >
                  {credExtractStatus}
                </p>
                <div className="row-2" style={{ marginTop: 12 }}>
                  <div>
                    <label htmlFor="hub-cred-cnpj-auto">CNPJ</label>
                    <input
                      id="hub-cred-cnpj-auto"
                      type="text"
                      placeholder="Preenchido ao enviar PDF (cartão CNPJ etc.)"
                      maxLength={20}
                      autoComplete="off"
                      value={credCnpjAuto}
                      onChange={(e) => setCredCnpjAuto(e.target.value)}
                      onBlur={() => persistCredOnSelected()}
                      disabled={!podeGerenciarParceiros}
                    />
                  </div>
                  <div>
                    <label htmlFor="hub-cred-razao-auto">Razão social</label>
                    <input
                      id="hub-cred-razao-auto"
                      type="text"
                      placeholder="Detectada no texto quando possível"
                      maxLength={220}
                      autoComplete="off"
                      value={credRazaoAuto}
                      onChange={(e) => setCredRazaoAuto(e.target.value)}
                      onBlur={() => persistCredOnSelected()}
                      disabled={!podeGerenciarParceiros}
                    />
                  </div>
                </div>
                <p
                  id="hub-cred-anexos-resumo"
                  className="topbar-user"
                  style={{ marginTop: 12 }}
                >
                  {credAnexosNomes.length
                    ? `Arquivos selecionados ou já registrados: ${credAnexosNomes.join(", ")}`
                    : ""}
                </p>
                <p
                  className="topbar-user"
                  style={{ margin: "10px 0 0", fontSize: "0.78rem" }}
                >
                  <strong>PDF com texto</strong>: leitura direta.{" "}
                  <strong>PDF escaneado ou JPG/PNG</strong>: OCR em português no
                  navegador (pode demorar na primeira vez). Os arquivos não
                  sobem para servidor nesta demonstração — só nomes e dados
                  extraídos ficam salvos localmente.
                </p>
              </div>
            </div>
          </article>
        </div>

        <div
          id="hub-bloco-cadastro-posto"
          className={modoCadastro === "oficina" ? "hub-parceiros-hidden" : ""}
        >
          <h4
            className="topbar-user"
            style={{ margin: "0 0 8px", fontSize: "0.95rem" }}
          >
            Posto para abastecimento da frota
          </h4>
          <p
            className="topbar-user"
            style={{
              marginBottom: 12,
              fontSize: "0.86rem",
              lineHeight: 1.5,
            }}
          >
            Os dados alimentam o portal do cliente (
            <strong>Abastecimento &amp; postos</strong>): limites, contrato e
            abertura do <strong>Portal Posto</strong>.
          </p>
          <form
            id="formPostoCredenciadoHub"
            onSubmit={(e) => {
              e.preventDefault();
              handleSalvarPosto();
            }}
          >
            <div className="row-2">
              <div>
                <label htmlFor="hub-posto-municipio">
                  Cliente (contrato) <span style={{ color: "#f87171" }}>*</span>
                </label>
                <select
                  id="hub-posto-municipio"
                  required
                  value={postoMunicipioId}
                  onChange={(e) => setPostoMunicipioId(e.target.value)}
                >
                  {prefeituras.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.uf})
                    </option>
                  ))}
                </select>
              </div>
              <div />
            </div>
            <div className="row-2" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="hub-posto-razao">
                  Razão social <span style={{ color: "#f87171" }}>*</span>
                </label>
                <input
                  id="hub-posto-razao"
                  type="text"
                  required
                  placeholder="Razão social do estabelecimento"
                  autoComplete="organization"
                  value={postoRazao}
                  onChange={(e) => setPostoRazao(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="hub-posto-fantasia">Nome fantasia</label>
                <input
                  id="hub-posto-fantasia"
                  type="text"
                  placeholder="Nome fantasia / razão"
                  autoComplete="off"
                  value={postoFantasia}
                  onChange={(e) => setPostoFantasia(e.target.value)}
                />
              </div>
            </div>
            <div className="row-2" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="hub-posto-cnpj">CNPJ</label>
                <input
                  id="hub-posto-cnpj"
                  type="text"
                  placeholder="00.000.000/0001-00"
                  autoComplete="off"
                  value={postoCnpj}
                  onChange={(e) => setPostoCnpj(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="hub-posto-bandeira">Bandeira</label>
                <input
                  id="hub-posto-bandeira"
                  type="text"
                  placeholder="BR, Shell, Ipiranga…"
                  autoComplete="off"
                  value={postoBandeira}
                  onChange={(e) => setPostoBandeira(e.target.value)}
                />
              </div>
            </div>
            <div className="row-2" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="hub-posto-endereco">Endereço</label>
                <input
                  id="hub-posto-endereco"
                  type="text"
                  placeholder="Logradouro, número"
                  autoComplete="street-address"
                  value={postoEndereco}
                  onChange={(e) => setPostoEndereco(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="hub-posto-comb">Combustíveis autorizados</label>
                <input
                  id="hub-posto-comb"
                  type="text"
                  placeholder="Diesel S10, Gasolina…"
                  autoComplete="off"
                  value={postoComb}
                  onChange={(e) => setPostoComb(e.target.value)}
                />
              </div>
            </div>
            <div className="row-2" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="hub-posto-limite">Limite (L/mês)</label>
                <input
                  id="hub-posto-limite"
                  type="number"
                  min={0}
                  step={100}
                  placeholder="20000"
                  value={postoLimite}
                  onChange={(e) => setPostoLimite(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="hub-posto-contrato">Nº contrato / ATA</label>
                <input
                  id="hub-posto-contrato"
                  type="text"
                  placeholder="CT-ABS-2026"
                  autoComplete="off"
                  value={postoContrato}
                  onChange={(e) => setPostoContrato(e.target.value)}
                />
              </div>
            </div>
            <div className="row-2" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="hub-posto-validade">Validade até</label>
                <input
                  id="hub-posto-validade"
                  type="text"
                  placeholder="31/12/2027"
                  autoComplete="off"
                  value={postoValidade}
                  onChange={(e) => setPostoValidade(e.target.value)}
                />
              </div>
              <div />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: 14 }}
            >
              Salvar posto
            </button>
            <span
              id="hub-msg-posto"
              style={{
                marginLeft: 12,
                fontSize: "0.88rem",
                color: "var(--muted)",
              }}
            >
              {hubMsgPosto}
            </span>
          </form>
        </div>
      </article>

      <article className="card" style={{ marginBottom: 18 }}>
        <h3>Oficinas credenciadas</h3>
        <div className="hub-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Oficina</th>
                <th>Especialidade</th>
                <th>Status</th>
                <th id="hub-parceiros-col-acao">Ação</th>
              </tr>
            </thead>
            <tbody id="hub-tbody-oficinas">
              {oficinasLista.map((o) => (
                <tr key={o.id}>
                  <td>{o.nome}</td>
                  <td>{o.especialidade}</td>
                  <td>{o.status}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => handleRemoverOficina(o.id)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
              {oficinasLista.length === 0 ? (
                <tr>
                  <td colSpan={4} className="topbar-user">
                    Nenhuma oficina cadastrada para este cliente.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <h3>Postos credenciados</h3>
        <p className="topbar-user" style={{ marginBottom: 12 }}>
          Lista do <strong>cliente (contrato)</strong> escolhido no cadastro de{" "}
          <strong>posto</strong> acima.
        </p>
        <div className="hub-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Razão social</th>
                <th>Nome fantasia</th>
                <th>CNPJ</th>
                <th>Bandeira</th>
                <th>Endereço</th>
                <th>Combustíveis</th>
                <th>Limite L/mês</th>
                <th>Contrato</th>
                <th>Validade</th>
                <th>Status</th>
                <th>Portal</th>
              </tr>
            </thead>
            <tbody id="hub-tbody-postos-cred">
              {postosLista.map((p) => (
                <tr key={p.id}>
                  <td>{p.razaoSocial}</td>
                  <td>{p.nomeFantasia || "—"}</td>
                  <td>{p.cnpj || "—"}</td>
                  <td>{p.bandeira || "—"}</td>
                  <td>{p.endereco || "—"}</td>
                  <td>{p.combustiveis || "—"}</td>
                  <td>{p.limiteLitrosMes ?? "—"}</td>
                  <td>{p.contrato || "—"}</td>
                  <td>{p.validadeAte || "—"}</td>
                  <td>{p.status || "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => handleRemoverPosto(p.id)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
              {postosLista.length === 0 ? (
                <tr>
                  <td colSpan={11} className="topbar-user">
                    Nenhum posto para o cliente selecionado no formulário de
                    posto.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
