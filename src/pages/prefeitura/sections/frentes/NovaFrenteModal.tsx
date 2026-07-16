import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { useAccess } from "../../../admin/hooks/access/use-access";
import type { UsuarioFirestore } from "../../../admin/hooks/access/types";
import { vinculoPrefeitura } from "../../../../lib/usuarios/vinculo";
import {
  STATUS_FRENTE_OPTIONS,
  isoParaDateInput,
  type Frente,
  type FrenteStatus,
  type NovaFrenteInput,
} from "./frentes-api";

export function NovaFrenteModal({
  frente,
  prefeituraId,
  onFechar,
  onSalvar,
}: {
  /** Quando informado, o modal abre em modo edição. */
  frente?: Frente | null;
  prefeituraId: string;
  onFechar: () => void;
  onSalvar: (dados: NovaFrenteInput) => Promise<void>;
}) {
  const { listarUsuarios } = useAccess();
  const editando = !!frente;
  const [nome, setNome] = useState(frente?.nome ?? "");
  const [endereco, setEndereco] = useState(frente?.endereco ?? "");
  const [responsavel, setResponsavel] = useState(frente?.responsavel ?? "");
  const [responsavelId, setResponsavelId] = useState(frente?.responsavelId ?? "");
  const [telefone, setTelefone] = useState<string | undefined>(
    frente?.telefone || undefined,
  );
  const [email, setEmail] = useState(frente?.email ?? "");
  const [status, setStatus] = useState<FrenteStatus>(frente?.status ?? "Ativa");
  const [custo, setCusto] = useState<number>(frente?.custo ?? 0);
  const [inicio, setInicio] = useState(isoParaDateInput(frente?.inicio ?? ""));
  const [fim, setFim] = useState(isoParaDateInput(frente?.fim ?? ""));
  const [salvando, setSalvando] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioFirestore[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(true);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const lista = await listarUsuarios({ prefeituraId });
        if (ativo) setUsuarios(lista.filter(vinculoPrefeitura));
      } finally {
        if (ativo) setCarregandoUsuarios(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [listarUsuarios, prefeituraId]);

  const opcoesResponsavel = useMemo(
    () =>
      usuarios.map((u) => ({
        value: u.id,
        label: u.nome || u.usuario,
        keywords: [u.usuario, u.email ?? ""].filter(Boolean),
      })),
    [usuarios],
  );

  const responsavelLegado = !responsavelId && responsavel.trim() !== "";

  function escolherResponsavel(id: string) {
    setResponsavelId(id);
    const u = usuarios.find((x) => x.id === id);
    if (!u) return;
    setResponsavel(u.nome || u.usuario);
    // Não sobrescreve um email já informado à mão.
    if (!email.trim() && u.email) setEmail(u.email);
  }

  const podeSalvar =
    nome.trim() !== "" &&
    endereco.trim() !== "" &&
    (editando || responsavelId !== "") &&
    inicio !== "";

  async function handleSalvar() {
    if (!podeSalvar || salvando) return;
    setSalvando(true);
    try {
      await onSalvar({
        nome,
        endereco,
        responsavel,
        responsavelId,
        telefone: telefone ?? "",
        email,
        status,
        custo,
        inicio,
        fim,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="ft-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={editando ? "Editar frente de trabalho" : "Nova frente de trabalho"}
      onClick={onFechar}
    >
      <div className="ft-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ft-modal__head">
          <h2>{editando ? "Editar Frente de Trabalho" : "Nova Frente de Trabalho"}</h2>
          <button
            type="button"
            className="ft-modal__close"
            onClick={onFechar}
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>

        <div className="ft-modal__body">
          <label className="ft-field">
            <span className="ft-field__label">Nome da frente de trabalho</span>
            <input
              className="ft-input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Rodovia SP-310 — Trecho 4"
              autoFocus
            />
          </label>

          <label className="ft-field">
            <span className="ft-field__label">Local / Endereço</span>
            <input
              className="ft-input"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Ex: São Carlos, SP"
            />
          </label>

          <div className="ft-field-row">
            <label className="ft-field">
              <span className="ft-field__label">Responsável</span>
              <Combobox
                className="ft-select-trigger w-full"
                contentClassName="z-[70]"
                value={responsavelId}
                onValueChange={escolherResponsavel}
                disabled={carregandoUsuarios || opcoesResponsavel.length === 0}
                placeholder={
                  carregandoUsuarios
                    ? "Carregando usuários..."
                    : opcoesResponsavel.length === 0
                      ? "Nenhum usuário nesta prefeitura"
                      : "Selecione o responsável..."
                }
                searchPlaceholder="Buscar por nome, login ou email..."
                emptyText="Nenhum usuário encontrado."
                options={opcoesResponsavel}
              />
              {responsavelLegado && (
                <small className="ft-field__hint">
                  Responsável atual: <strong>{responsavel}</strong> — texto
                  livre, sem login vinculado. Vincular um usuário é opcional
                  aqui; ao vincular, a frente passa a aparecer só para ele e
                  para os admins.
                </small>
              )}
            </label>

            <label className="ft-field">
              <span className="ft-field__label">Status</span>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as FrenteStatus)}
              >
                <SelectTrigger className="ft-select-trigger w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[70]">
                  {STATUS_FRENTE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <label className="ft-field">
            <span className="ft-field__label">Telefone (WhatsApp)</span>
            <PhoneInput
              value={telefone}
              onChange={setTelefone}
              placeholder="Recebe o alerta de emergência do equipamento"
            />
          </label>

          <label className="ft-field">
            <span className="ft-field__label">Email</span>
            <input
              type="email"
              className="ft-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Recebe o alerta de emergência/checklist por email"
            />
          </label>

          <label className="ft-field">
            <span className="ft-field__label">Custo estimado (R$)</span>
            <CurrencyInput
              className="ft-input"
              value={custo}
              onValueChange={setCusto}
            />
          </label>

          <div className="ft-field-row">
            <label className="ft-field">
              <span className="ft-field__label">Início</span>
              <input
                type="date"
                className="ft-input"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </label>

            <label className="ft-field">
              <span className="ft-field__label">Previsão de término</span>
              <input
                type="date"
                className="ft-input"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </label>
          </div>
        </div>

        <footer className="ft-modal__foot">
          <button type="button" className="ft-btn-ghost" onClick={onFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="ft-btn-primary"
            onClick={handleSalvar}
            disabled={!podeSalvar || salvando}
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
