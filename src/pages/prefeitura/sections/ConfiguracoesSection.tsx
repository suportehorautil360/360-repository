import { useCallback, useEffect, useState } from "react";
import { Building2, Bell, Wrench, Clock, Save } from "lucide-react";
import { toast } from "sonner";
import { escalaApi, type Escala } from "../../../lib/api/escala";
import {
  configuracoesApi,
  configPadrao,
  empresaCompleta,
  type CategoriaIntervalo,
  type Configuracao,
} from "../../../lib/api/configuracoes";
import { cnpjValido, formatarCnpj } from "../../../lib/funcionarios/cnpj";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { toE164 } from "@/lib/phone";
import { isValidPhoneNumber } from "react-phone-number-input";
import { EscalaConfig } from "./EscalaConfig";
import "./configuracoes.css";

const SELECT_TRIGGER_CLS =
  "w-full border-white/15 bg-white/[0.04] text-slate-100 data-[placeholder]:text-slate-400";

const CATEGORIAS: { key: CategoriaIntervalo; label: string; icon: string }[] = [
  { key: "carro", label: "Carro", icon: "🚗" },
  { key: "caminhao", label: "Caminhão", icon: "🚚" },
  { key: "maquina", label: "Máquina", icon: "⚙️" },
  { key: "ambulancia", label: "Ambulância", icon: "🚑" },
  { key: "van", label: "Van / Outros", icon: "🚐" },
];

function Switch({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={`cfg__switch ${on ? "is-on" : ""}`}
      onClick={() => onChange(!on)}
    >
      <span className="cfg__switch-dot" />
    </button>
  );
}

function ToggleRow({
  titulo,
  sub,
  on,
  onChange,
}: {
  titulo: string;
  sub: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="cfg__toggle-row">
      <div className="cfg__toggle-txt">
        <strong>{titulo}</strong>
        <span>{sub}</span>
      </div>
      <Switch on={on} onChange={onChange} />
    </div>
  );
}

export function ConfiguracoesSection({ prefeituraId }: { prefeituraId: string }) {
  const [config, setConfig] = useState<Configuracao>(() =>
    configPadrao(prefeituraId),
  );
  const [escala, setEscala] = useState<Escala | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setCarregando(true);
    try {
      const [cfg, esc] = await Promise.all([
        configuracoesApi.obter(prefeituraId),
        escalaApi.obter(prefeituraId).catch(() => null),
      ]);
      // Migra número legado (sem DDI) para E.164 uma única vez, na carga.
      setConfig({
        ...cfg,
        empresa: {
          ...cfg.empresa,
          whatsappNumero:
            toE164(cfg.empresa.whatsappNumero) ?? cfg.empresa.whatsappNumero,
        },
      });
      setEscala(esc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar(msg: string) {
    if (salvando) return;
    setSalvando(true);
    try {
      await configuracoesApi.salvar(config);
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  /** Salva os dados da empresa validando o CNPJ (quando preenchido). */
  async function salvarEmpresa() {
    const cnpj = config.empresa.cnpj.trim();
    if (cnpj && !cnpjValido(cnpj)) {
      toast.error("CNPJ inválido. Confira os dígitos.");
      return;
    }
    const wpp = config.empresa.whatsappNumero.trim();
    if (wpp && !isValidPhoneNumber(wpp)) {
      toast.error("WhatsApp inválido. Confira o DDI, DDD e o número.");
      return;
    }
    await salvar("Dados da empresa salvos.");
  }

  // Helpers de atualização imutável.
  const setEmpresa = (k: keyof Configuracao["empresa"], v: string) =>
    setConfig((c) => ({ ...c, empresa: { ...c.empresa, [k]: v } }));
  const setAlerta = (k: keyof Configuracao["alertas"], v: boolean) =>
    setConfig((c) => ({ ...c, alertas: { ...c.alertas, [k]: v } }));
  const setBloqueio = (k: keyof Configuracao["bloqueio"], v: boolean) =>
    setConfig((c) => ({ ...c, bloqueio: { ...c.bloqueio, [k]: v } }));
  const setIntervalo = (
    cat: CategoriaIntervalo,
    campo: "valor" | "unidade",
    v: string,
  ) =>
    setConfig((c) => ({
      ...c,
      intervalos: {
        ...c.intervalos,
        [cat]: {
          ...c.intervalos[cat],
          [campo]: campo === "valor" ? Number(v.replace(/\D/g, "")) || 0 : v,
        },
      },
    }));

  if (carregando) {
    return (
      <div className="cfg">
        <h1 className="cfg__page-titulo">Configurações</h1>
        <p className="cfg__msg">Carregando configurações…</p>
      </div>
    );
  }

  return (
    <div className="cfg">
      <h1 className="cfg__page-titulo">Configurações</h1>
      <p className="cfg__lead">
        Parâmetros operacionais da prefeitura — dados da empresa, alertas,
        intervalos de revisão e a escala da jornada.
      </p>

      <div className="cfg__grid">
        {/* Coluna esquerda */}
        <div className="cfg__col">
          {/* Dados da empresa */}
          <section className="cfg__card">
            <header className="cfg__card-head">
              <Building2 size={15} aria-hidden="true" />
              <h2>Dados da empresa</h2>
            </header>
            {!empresaCompleta(config.empresa) && (
              <p className="cfg__aviso" role="status">
                Dados fiscais incompletos para emissão legal (Portaria 671):
                informe a <strong>razão social</strong> e o{" "}
                <strong>CNPJ ou CAEPF/CEI</strong>. Sem isso o comprovante (CRPT)
                e o AFD saem sem identificar o empregador.
              </p>
            )}
            <div className="cfg__form-grid">
              <label>
                Razão social
                <input
                  value={config.empresa.razaoSocial}
                  onChange={(e) => setEmpresa("razaoSocial", e.target.value)}
                  placeholder="Transportes ABC Ltda."
                />
              </label>
              <label>
                CNPJ
                <input
                  value={config.empresa.cnpj}
                  onChange={(e) =>
                    setEmpresa("cnpj", formatarCnpj(e.target.value))
                  }
                  placeholder="12.345.678/0001-90"
                  inputMode="numeric"
                />
              </label>
              <label>
                CAEPF/CEI <span className="cfg__opt">(se não houver CNPJ)</span>
                <input
                  value={config.empresa.caepf}
                  onChange={(e) => setEmpresa("caepf", e.target.value)}
                  placeholder="Inscrição do empregador"
                />
              </label>
              <label>
                Cidade
                <input
                  value={config.empresa.cidade}
                  onChange={(e) => setEmpresa("cidade", e.target.value)}
                  placeholder="Três Lagoas"
                />
              </label>
              <label>
                Estado
                <input
                  value={config.empresa.estado}
                  onChange={(e) => setEmpresa("estado", e.target.value)}
                  placeholder="MS"
                />
              </label>
              <label className="cfg__col-span">
                E-mail para alertas
                <input
                  type="email"
                  value={config.empresa.emailAlertas}
                  onChange={(e) => setEmpresa("emailAlertas", e.target.value)}
                  placeholder="gestor@empresa.com.br"
                />
              </label>
              <label className="cfg__col-span">
                WhatsApp para emergências{" "}
                <span className="cfg__opt">(código do país + DDD)</span>
                <PhoneInput
                  value={config.empresa.whatsappNumero || undefined}
                  onChange={(v) => setEmpresa("whatsappNumero", v ?? "")}
                  placeholder="Número com DDI"
                />
              </label>
            </div>
            <div className="cfg__card-foot">
              <button
                type="button"
                className="cfg__btn cfg__btn--primary"
                disabled={salvando}
                onClick={() => void salvarEmpresa()}
              >
                <Save size={14} /> Salvar
              </button>
            </div>
          </section>

          {/* Intervalos de revisão + comportamento do bloqueio */}
          <section className="cfg__card">
            <header className="cfg__card-head">
              <Wrench size={15} aria-hidden="true" />
              <h2>Intervalos de revisão por tipo</h2>
            </header>
            <p className="cfg__card-sub">
              Define o intervalo padrão por tipo. Cada equipamento pode ter valor
              personalizado.
            </p>

            <div className="cfg__intervalos">
              {CATEGORIAS.map((cat) => (
                <div key={cat.key} className="cfg__intervalo-row">
                  <span className="cfg__intervalo-nome">
                    {cat.icon} {cat.label}
                  </span>
                  <input
                    className="cfg__intervalo-valor"
                    inputMode="numeric"
                    value={String(config.intervalos[cat.key].valor)}
                    onChange={(e) =>
                      setIntervalo(cat.key, "valor", e.target.value)
                    }
                  />
                  <Select
                    value={config.intervalos[cat.key].unidade}
                    onValueChange={(v) => setIntervalo(cat.key, "unidade", v)}
                  >
                    <SelectTrigger className={`${SELECT_TRIGGER_CLS} cfg__intervalo-un`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="km">km</SelectItem>
                      <SelectItem value="horas">horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <h3 className="cfg__sub-titulo">Comportamento do bloqueio</h3>
            <ToggleRow
              titulo="Bloquear abastecimento ao vencer"
              sub="Impede até o gestor registrar revisão e liberar"
              on={config.bloqueio.bloquearAoVencer}
              onChange={(v) => setBloqueio("bloquearAoVencer", v)}
            />
            <ToggleRow
              titulo="Alertar ao atingir 80%"
              sub="Notificação prévia para agendar revisão"
              on={config.bloqueio.alertar80}
              onChange={(v) => setBloqueio("alertar80", v)}
            />
            <ToggleRow
              titulo="Alertar ao atingir 90%"
              sub="Alerta crítico — revisão urgente"
              on={config.bloqueio.alertar90}
              onChange={(v) => setBloqueio("alertar90", v)}
            />

            <div className="cfg__card-foot">
              <button
                type="button"
                className="cfg__btn cfg__btn--primary"
                disabled={salvando}
                onClick={() => void salvar("Configurações salvas.")}
              >
                <Save size={14} /> Salvar configurações
              </button>
            </div>
          </section>
        </div>

        {/* Coluna direita */}
        <div className="cfg__col">
          {/* Alertas e notificações */}
          <section className="cfg__card">
            <header className="cfg__card-head">
              <Bell size={15} aria-hidden="true" />
              <h2>Alertas e notificações</h2>
            </header>
            <ToggleRow
              titulo="Bloqueio por revisão vencida"
              sub="Alertar gestor ao bloquear equipamento"
              on={config.alertas.bloqueioRevisaoVencida}
              onChange={(v) => setAlerta("bloqueioRevisaoVencida", v)}
            />
            <ToggleRow
              titulo="Nível crítico de tanque"
              sub="Alertar quando abaixo de 20%"
              on={config.alertas.nivelCriticoTanque}
              onChange={(v) => setAlerta("nivelCriticoTanque", v)}
            />
            <ToggleRow
              titulo="Abastecimento irregular"
              sub="Desvio de hodômetro ou volume suspeito"
              on={config.alertas.abastecimentoIrregular}
              onChange={(v) => setAlerta("abastecimentoIrregular", v)}
            />
            <ToggleRow
              titulo="CNH próxima ao vencimento"
              sub="Avisar com 90 dias de antecedência"
              on={config.alertas.cnhProximaVencimento}
              onChange={(v) => setAlerta("cnhProximaVencimento", v)}
            />
            <ToggleRow
              titulo="Relatório semanal por e-mail"
              sub="Resumo toda segunda-feira às 08h"
              on={config.alertas.relatorioSemanal}
              onChange={(v) => setAlerta("relatorioSemanal", v)}
            />
            <ToggleRow
              titulo="Notificar emergências por WhatsApp"
              sub="Dispara para o WhatsApp cadastrado quando uma emergência é criada"
              on={config.alertas.notificacaoWhatsapp}
              onChange={(v) => setAlerta("notificacaoWhatsapp", v)}
            />
            <div className="cfg__card-foot">
              <button
                type="button"
                className="cfg__btn cfg__btn--primary"
                disabled={salvando}
                onClick={() => void salvar("Alertas salvos.")}
              >
                <Save size={14} /> Salvar alertas
              </button>
            </div>
          </section>

          {/* Escala da jornada */}
          <section className="cfg__card">
            <header className="cfg__card-head">
              <Clock size={15} aria-hidden="true" />
              <h2>Escala da jornada</h2>
            </header>
            <p className="cfg__card-sub">
              Horário de entrada/saída, dias úteis e duração do almoço. Usado
              para calcular horas previstas, atrasos e faltas.
            </p>
            <EscalaConfig
              prefeituraId={prefeituraId}
              escala={escala}
              onSalvo={() => void carregar()}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
