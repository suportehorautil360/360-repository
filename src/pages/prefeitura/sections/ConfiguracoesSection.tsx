import { useCallback, useEffect, useState } from "react";
import { Building2, Bell, Wrench, Clock, Save } from "lucide-react";
import { toast } from "sonner";
import { escalaApi, type Escala } from "../../../lib/api/escala";
import {
  configuracoesApi,
  configPadrao,
  empresaCompleta,
  type Configuracao,
} from "../../../lib/api/configuracoes";
import { clientesApi } from "../../../lib/api/clientes";
import { toE164 } from "@/lib/phone";
import { EscalaConfig } from "./EscalaConfig";
import "./configuracoes.css";

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

function CampoEmpresa({
  rotulo,
  valor,
  onChange,
  hint,
  largura = "metade",
  placeholder = "Não informado",
  type = "text",
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  hint?: string;
  largura?: "metade" | "inteira";
  placeholder?: string;
  type?: string;
}) {
  return (
    <div
      className={`cfg__campo${largura === "inteira" ? " cfg__campo--full" : ""}`}
    >
      <span className="cfg__campo-rotulo">
        {rotulo}
        {hint ? <span className="cfg__opt"> {hint}</span> : null}
      </span>
      <input
        className="cfg__campo-input"
        type={type}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
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
      const [cfg, esc, cliente] = await Promise.all([
        configuracoesApi.obter(prefeituraId),
        escalaApi.obter(prefeituraId).catch(() => null),
        // O cliente (cadastro no /admin) é a fonte única dos dados da empresa.
        clientesApi.obter(prefeituraId).catch(() => null),
      ]);
      // Cliente prevalece; só cai na config salva como retrocompat (legado).
      const emp: Configuracao["empresa"] = {
        razaoSocial: cliente?.nome || cfg.empresa.razaoSocial || "",
        cnpj: cliente?.cnpj || cfg.empresa.cnpj || "",
        caepf: cliente?.caepf || cfg.empresa.caepf || "",
        cidade: cliente?.cidade || cfg.empresa.cidade || "",
        estado: cliente?.uf || cfg.empresa.estado || "",
        emailAlertas:
          cliente?.contrato?.emailContratante || cfg.empresa.emailAlertas || "",
        whatsappNumero: cliente?.whatsapp || cfg.empresa.whatsappNumero || "",
      };
      const rawWhats = emp.whatsappNumero;
      setConfig({
        ...cfg,
        empresa: {
          ...emp,
          // Migra número legado (sem DDI) para E.164 na carga.
          whatsappNumero: toE164(rawWhats) ?? rawWhats,
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

  // Helpers de atualização imutável.
  const setAlerta = (k: keyof Configuracao["alertas"], v: boolean) =>
    setConfig((c) => ({ ...c, alertas: { ...c.alertas, [k]: v } }));
  const setBloqueio = (k: keyof Configuracao["bloqueio"], v: boolean) =>
    setConfig((c) => ({ ...c, bloqueio: { ...c.bloqueio, [k]: v } }));
  const setEmpresa = (k: keyof Configuracao["empresa"], v: string) =>
    setConfig((c) => ({ ...c, empresa: { ...c.empresa, [k]: v } }));

  /** Grava os dados da empresa no cadastro de Clientes (fonte única). */
  async function salvarEmpresa() {
    if (salvando) return;
    setSalvando(true);
    try {
      const e = config.empresa;
      const payload: Parameters<typeof clientesApi.atualizar>[1] = {
        cnpj: e.cnpj.trim(),
        caepf: e.caepf.trim(),
        cidade: e.cidade.trim(),
        whatsapp: (toE164(e.whatsappNumero) ?? e.whatsappNumero ?? "").trim(),
        contrato: { emailContratante: e.emailAlertas.trim() },
      };
      // nome/uf têm validação no backend — só envia quando preenchidos.
      if (e.razaoSocial.trim()) payload.nome = e.razaoSocial.trim();
      if (e.estado.trim()) payload.uf = e.estado.trim();
      await clientesApi.atualizar(prefeituraId, payload);
      toast.success("Dados da empresa salvos.");
      await carregar();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível salvar.",
      );
    } finally {
      setSalvando(false);
    }
  }

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
        Parâmetros operacionais da prefeitura — alertas, bloqueio por revisão
        e a escala da jornada. Os dados da empresa são apenas consulta.
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
            <p className="cfg__card-sub">
              Mesma ficha do cadastro de <strong>Clientes</strong> no admin —
              editar aqui altera a fonte única usada nos documentos legais.
            </p>
            {!empresaCompleta(config.empresa) && (
              <p className="cfg__aviso" role="status">
                Dados fiscais incompletos para emissão legal (Portaria 671):
                falta <strong>razão social</strong> e/ou{" "}
                <strong>CNPJ ou CAEPF/CEI</strong>. Peça ao administrador para
                completar no Hub Mestre — sem isso o CRPT e o AFD saem sem
                identificar o empregador.
              </p>
            )}
            <div className="cfg__dados-empresa">
              <CampoEmpresa
                rotulo="Razão social"
                valor={config.empresa.razaoSocial}
                onChange={(v) => setEmpresa("razaoSocial", v)}
                largura="inteira"
              />
              <CampoEmpresa
                rotulo="CNPJ"
                valor={config.empresa.cnpj}
                onChange={(v) => setEmpresa("cnpj", v)}
              />
              <CampoEmpresa
                rotulo="CAEPF/CEI"
                hint="(se não houver CNPJ)"
                valor={config.empresa.caepf}
                onChange={(v) => setEmpresa("caepf", v)}
              />
              <CampoEmpresa
                rotulo="Cidade"
                valor={config.empresa.cidade}
                onChange={(v) => setEmpresa("cidade", v)}
              />
              <CampoEmpresa
                rotulo="Estado"
                hint="(UF)"
                valor={config.empresa.estado}
                onChange={(v) => setEmpresa("estado", v.toUpperCase().slice(0, 2))}
                placeholder="SP"
              />
              <CampoEmpresa
                rotulo="E-mail para alertas"
                type="email"
                valor={config.empresa.emailAlertas}
                onChange={(v) => setEmpresa("emailAlertas", v)}
                largura="inteira"
              />
              <CampoEmpresa
                rotulo="WhatsApp para emergências"
                hint="(DDI + DDD)"
                valor={config.empresa.whatsappNumero}
                onChange={(v) => setEmpresa("whatsappNumero", v)}
                largura="inteira"
                placeholder="+55 (67) 99999-9999"
              />
            </div>
            <div className="cfg__card-foot">
              <button
                type="button"
                className="cfg__btn cfg__btn--primary"
                onClick={() => void salvarEmpresa()}
                disabled={salvando}
              >
                <Save size={14} aria-hidden="true" />{" "}
                {salvando ? "Salvando…" : "Salvar dados da empresa"}
              </button>
            </div>
          </section>

          {/* Comportamento do bloqueio por revisão */}
          <section className="cfg__card">
            <header className="cfg__card-head">
              <Wrench size={15} aria-hidden="true" />
              <h2>Comportamento do bloqueio</h2>
            </header>
            <p className="cfg__card-sub">
              Defina quando bloquear o abastecimento e alertar sobre revisões
              vencidas.
            </p>

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
