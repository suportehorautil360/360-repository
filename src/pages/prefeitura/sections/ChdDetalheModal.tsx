import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  Layers,
  Loader2,
  MinusCircle,
  Package,
  PenLine,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import {
  checklistDevolucaoApi,
  mensagemErroChd,
  type ChdDocCompleto,
} from "../../../lib/api/checklist-devolucao";
import { baixarChdPdf } from "../../../lib/chd/chd-pdf";
import {
  labelCombustivelChd,
  labelItemChd,
  labelModuloSecao,
  labelStatusItemChd,
  secaoModuloChd,
} from "../../../lib/chd/chd-checklist-labels";
import { labelStatusChd } from "./auditoria-devolucao-model";
import "./chd-detalhe-modal.css";

type AbaChd =
  | "identificacao"
  | "estado-geral"
  | "modulos"
  | "pecas"
  | "servicos"
  | "encerramento";

const ABAS: {
  id: AbaChd;
  label: string;
  Icon: typeof ClipboardList;
}[] = [
  { id: "identificacao", label: "Identificação", Icon: ClipboardList },
  { id: "estado-geral", label: "Estado geral", Icon: ShieldCheck },
  { id: "modulos", label: "Módulos", Icon: Layers },
  { id: "pecas", label: "Peças", Icon: Package },
  { id: "servicos", label: "Serviços", Icon: Wrench },
  { id: "encerramento", label: "Encerramento", Icon: PenLine },
];

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.045 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 420, damping: 28 },
  },
};

function resumoChd(doc: ChdDocCompleto) {
  const allStatuses = [
    ...Object.values(doc.generalState ?? {}),
    ...Object.values(doc.modules ?? {}),
  ].filter((i) => i?.status);

  return {
    pecas: doc.parts?.items?.length ?? 0,
    servicos: doc.services?.items?.length ?? 0,
    ok: allStatuses.filter((i) => i.status === "ok").length,
    anomalias: allStatuses.filter((i) => i.status === "anomaly").length,
  };
}

function CampoCard({
  label,
  value,
  destaque,
}: {
  label: string;
  value?: string;
  destaque?: boolean;
}) {
  return (
    <motion.div
      className={`chd-modal__card${destaque ? " chd-modal__card--destaque" : ""}`}
      variants={itemVariants}
    >
      <span className="chd-modal__card-label">{label}</span>
      <span className="chd-modal__card-valor">{value?.trim() ? value : "—"}</span>
    </motion.div>
  );
}

function StatusCheck({ status }: { status?: string }) {
  if (status === "ok") {
    return (
      <span className="chd-modal__check chd-modal__check--ok">
        <CheckCircle2 size={15} aria-hidden />
        OK
      </span>
    );
  }
  if (status === "anomaly") {
    return (
      <span className="chd-modal__check chd-modal__check--anomaly">
        <AlertTriangle size={15} aria-hidden />
        Anomalia
      </span>
    );
  }
  if (status === "na") {
    return (
      <span className="chd-modal__check chd-modal__check--na">
        <MinusCircle size={15} aria-hidden />
        N/A
      </span>
    );
  }
  return (
    <span className="chd-modal__check">{labelStatusItemChd(status)}</span>
  );
}

function FotoCard({ label, url }: { label: string; url?: string }) {
  if (!url?.trim()) return null;
  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="chd-modal__foto-card"
      variants={itemVariants}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="chd-modal__foto-card-label">{label}</span>
      <img src={url} alt={label} className="chd-modal__foto-card-img" />
      <span className="chd-modal__foto-card-hint">Clique para ampliar</span>
    </motion.a>
  );
}

function VazioAnimado({ texto }: { texto: string }) {
  return (
    <motion.div
      className="chd-modal__vazio"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <MinusCircle size={28} strokeWidth={1.5} aria-hidden />
      <p>{texto}</p>
    </motion.div>
  );
}

function ConteudoChd({
  doc,
  aba,
  oficinaNome,
}: {
  doc: ChdDocCompleto;
  aba: AbaChd;
  oficinaNome?: string;
}) {
  const id = doc.identification ?? {};

  const modulosPorSecao = useMemo(() => {
    const map = new Map<string, { id: string; status: string }[]>();
    for (const [key, item] of Object.entries(doc.modules ?? {})) {
      if (!item?.status) continue;
      const secao = secaoModuloChd(key);
      const titulo = labelModuloSecao(secao);
      const lista = map.get(titulo) ?? [];
      lista.push({ id: key, status: item.status });
      map.set(titulo, lista);
    }
    return map;
  }, [doc.modules]);

  if (aba === "identificacao") {
    return (
      <motion.div
        className="chd-modal__cards-grid"
        variants={listVariants}
        initial="hidden"
        animate="show"
      >
        <CampoCard label="Nº CHD" value={doc.number} destaque />
        <CampoCard label="O.S." value={id.os} destaque />
        <CampoCard label="Oficina" value={oficinaNome || doc.oficinaId} />
        <CampoCard label="Status" value={labelStatusChd(doc.status)} />
        <CampoCard label="Data" value={id.date} />
        <CampoCard label="Hora" value={id.time} />
        <CampoCard label="Equipamento" value={id.brandModel} />
        <CampoCard label="Placa / prefixo" value={id.platePrefix} />
        <CampoCard label="KM" value={id.currentKm} />
        <CampoCard label="Horímetro" value={id.hourMeter} />
        <CampoCard label="Condutor" value={id.driver} />
        <CampoCard label="Resp. técnico" value={id.technicalResponsible} />
        <CampoCard label="Combustível" value={labelCombustivelChd(id.fuel)} />
      </motion.div>
    );
  }

  if (aba === "estado-geral") {
    const itens = Object.entries(doc.generalState ?? {}).filter(
      ([, item]) => item?.status,
    );
    if (itens.length === 0) {
      return <VazioAnimado texto="Nenhum item registrado nesta seção." />;
    }
    return (
      <motion.div className="chd-modal__lista" variants={listVariants} initial="hidden" animate="show">
        {itens.map(([key, item]) => (
          <motion.div key={key} className="chd-modal__item" variants={itemVariants}>
            <div className="chd-modal__item-head">
              <span className="chd-modal__item-nome">{labelItemChd(key)}</span>
              <StatusCheck status={item.status} />
            </div>
            <FotoCard label="Foto da anomalia" url={item.photo} />
          </motion.div>
        ))}
      </motion.div>
    );
  }

  if (aba === "modulos") {
    if (modulosPorSecao.size === 0) {
      return <VazioAnimado texto="Nenhum módulo preenchido neste checklist." />;
    }
    return (
      <motion.div className="chd-modal__secoes" variants={listVariants} initial="hidden" animate="show">
        {Array.from(modulosPorSecao.entries()).map(([titulo, itens]) => (
          <motion.section key={titulo} className="chd-modal__secao" variants={itemVariants}>
            <h3 className="chd-modal__secao-titulo">
              <Layers size={14} aria-hidden />
              {titulo}
            </h3>
            <div className="chd-modal__lista chd-modal__lista--compacta">
              {itens.map((item) => (
                <div key={item.id} className="chd-modal__item chd-modal__item--inline">
                  <span className="chd-modal__item-nome">{labelItemChd(item.id)}</span>
                  <StatusCheck status={item.status} />
                </div>
              ))}
            </div>
          </motion.section>
        ))}
      </motion.div>
    );
  }

  if (aba === "pecas") {
    const parts = doc.parts?.items ?? [];
    if (parts.length === 0) {
      return <VazioAnimado texto="Nenhuma peça registrada." />;
    }
    return (
      <motion.div className="chd-modal__secoes" variants={listVariants} initial="hidden" animate="show">
        {parts.map((part, index) => (
          <motion.section
            key={`${part.partNumber}-${index}`}
            className="chd-modal__secao chd-modal__secao--peca"
            variants={itemVariants}
          >
            <h3 className="chd-modal__secao-titulo">
              <Package size={14} aria-hidden />
              Peça {index + 1}
            </h3>
            <div className="chd-modal__cards-grid chd-modal__cards-grid--3">
              <CampoCard label="Descrição" value={part.description} />
              <CampoCard label="Nº peça" value={part.partNumber} />
              <CampoCard label="Marca" value={part.brand} />
              <CampoCard label="Destino peça antiga" value={part.oldPartDestination} />
            </div>
            <div className="chd-modal__fotos-grid">
              <FotoCard label="Peça nova" url={part.newPhoto} />
              <FotoCard label="Peça substituída" url={part.replacedPhoto} />
            </div>
          </motion.section>
        ))}
      </motion.div>
    );
  }

  if (aba === "servicos") {
    const services = doc.services?.items ?? [];
    if (services.length === 0) {
      return <VazioAnimado texto="Nenhum serviço registrado." />;
    }
    return (
      <motion.div
        className="chd-modal__servicos"
        variants={listVariants}
        initial="hidden"
        animate="show"
      >
        {services.map((svc, index) => (
          <motion.article key={`${svc.systemComponent}-${index}`} className="chd-modal__servico-card" variants={itemVariants}>
            <div className="chd-modal__servico-head">
              <span className="chd-modal__servico-num">#{index + 1}</span>
              <strong>{svc.systemComponent || "—"}</strong>
            </div>
            <dl className="chd-modal__servico-dl">
              <div>
                <dt>Diagnóstico</dt>
                <dd>{svc.initialDiagnosis || "—"}</dd>
              </div>
              <div>
                <dt>Ação técnica</dt>
                <dd>{svc.technicalAction || "—"}</dd>
              </div>
              <div>
                <dt>Técnico</dt>
                <dd>{svc.technician || "—"}</dd>
              </div>
              <div>
                <dt>Horas</dt>
                <dd>{svc.manHours || "—"}</dd>
              </div>
            </dl>
          </motion.article>
        ))}
      </motion.div>
    );
  }

  const closing = doc.closing;
  const inventarioOk = Boolean(closing?.inventoryChecked);

  return (
    <motion.div
      className="chd-modal__encerramento"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
    >
      <div
        className={`chd-modal__inventario${inventarioOk ? " chd-modal__inventario--ok" : " chd-modal__inventario--off"}`}
      >
        {inventarioOk ? (
          <CheckCircle2 size={32} aria-hidden />
        ) : (
          <AlertTriangle size={32} aria-hidden />
        )}
        <div>
          <strong>Inventário de bordo</strong>
          <p>
            {inventarioOk
              ? "Conferido — macaco, triângulo, chave, estepe e CRLV"
              : "Não conferido neste checklist"}
          </p>
        </div>
      </div>
      <div className="chd-modal__cards-grid">
        <CampoCard label="Assinatura condutor" value={closing?.driverSignature} />
        <CampoCard label="Assinatura oficina" value={closing?.workshopSignature} />
      </div>
    </motion.div>
  );
}

export interface ChdDetalheModalProps {
  chdId: string;
  chdNumero?: string;
  oficinaNome?: string;
  onFechar: () => void;
}

export function ChdDetalheModal({
  chdId,
  chdNumero,
  oficinaNome,
  onFechar,
}: ChdDetalheModalProps) {
  const [aba, setAba] = useState<AbaChd>("identificacao");
  const [doc, setDoc] = useState<ChdDocCompleto | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [baixandoPdf, setBaixandoPdf] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    setDoc(null);
    setAba("identificacao");

    void checklistDevolucaoApi
      .obterPorId(chdId)
      .then((data) => {
        if (ativo) setDoc(data);
      })
      .catch((err) => {
        if (ativo) setErro(mensagemErroChd(err));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [chdId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  async function handlePdf() {
    if (!doc || baixandoPdf) return;
    setBaixandoPdf(true);
    try {
      await baixarChdPdf(doc, { oficinaNome });
    } finally {
      setBaixandoPdf(false);
    }
  }

  const titulo = doc?.number || chdNumero || "Checklist de devolução";
  const resumo = doc ? resumoChd(doc) : null;
  const statusCls = doc?.status ? `chd-modal__hero-badge--${doc.status}` : "";

  return (
    <motion.div
      className="chd-modal-backdrop"
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onFechar}
    >
      <motion.div
        className="chd-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chd-modal-titulo"
        initial={{ opacity: 0, y: 32, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chd-modal__hero">
          <div className="chd-modal__hero-glow" aria-hidden />
          <div className="chd-modal__hero-top">
            <div className="chd-modal__hero-icon-wrap">
              <ClipboardList size={22} aria-hidden />
            </div>
            <div className="chd-modal__hero-text">
              <p className="chd-modal__kicker">Checklist de devolução</p>
              <h2 id="chd-modal-titulo" className="chd-modal__titulo">
                {titulo}
              </h2>
              {doc?.identification?.os ? (
                <p className="chd-modal__meta">O.S. {doc.identification.os}</p>
              ) : null}
            </div>
            <div className="chd-modal__head-acoes">
              <motion.button
                type="button"
                className="chd-modal__btn chd-modal__btn--pdf"
                onClick={() => void handlePdf()}
                disabled={!doc || carregando || baixandoPdf}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                {baixandoPdf ? (
                  <Loader2 size={15} className="chd-modal__spin" aria-hidden />
                ) : (
                  <Download size={15} aria-hidden />
                )}
                Baixar PDF
              </motion.button>
              <button
                type="button"
                className="chd-modal__fechar"
                onClick={onFechar}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {doc && resumo ? (
            <motion.div
              className="chd-modal__hero-stats"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.3 }}
            >
              <span className={`chd-modal__hero-badge ${statusCls}`}>
                {labelStatusChd(doc.status)}
              </span>
              <span className="chd-modal__hero-chip">
                <Package size={13} aria-hidden />
                {resumo.pecas} peça{resumo.pecas === 1 ? "" : "s"}
              </span>
              <span className="chd-modal__hero-chip">
                <Wrench size={13} aria-hidden />
                {resumo.servicos} serviço{resumo.servicos === 1 ? "" : "s"}
              </span>
              <span className="chd-modal__hero-chip chd-modal__hero-chip--ok">
                <CheckCircle2 size={13} aria-hidden />
                {resumo.ok} OK
              </span>
              {resumo.anomalias > 0 ? (
                <span className="chd-modal__hero-chip chd-modal__hero-chip--warn">
                  <AlertTriangle size={13} aria-hidden />
                  {resumo.anomalias} anomalia{resumo.anomalias === 1 ? "" : "s"}
                </span>
              ) : null}
            </motion.div>
          ) : null}
        </div>

        <nav className="chd-modal__tabs" aria-label="Seções do CHD">
          {ABAS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`chd-modal__tab${aba === id ? " chd-modal__tab--ativa" : ""}`}
              onClick={() => setAba(id)}
            >
              {aba === id ? (
                <motion.span
                  layoutId="chd-tab-indicator"
                  className="chd-modal__tab-indicator"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              ) : null}
              <Icon size={14} aria-hidden className="chd-modal__tab-icon" />
              {label}
            </button>
          ))}
        </nav>

        <div className="chd-modal__body">
          {carregando ? (
            <div className="chd-modal__loading">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
              >
                <Loader2 size={28} aria-hidden />
              </motion.div>
              <p>Carregando checklist…</p>
            </div>
          ) : erro ? (
            <div className="chd-modal__erro">{erro}</div>
          ) : doc ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={aba}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <ConteudoChd doc={doc} aba={aba} oficinaNome={oficinaNome} />
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>

        {doc?.createdAt ? (
          <footer className="chd-modal__foot">
            Registrado em {doc.createdAt}
            {oficinaNome ? ` · ${oficinaNome}` : null}
          </footer>
        ) : null}
      </motion.div>
    </motion.div>
  );
}
