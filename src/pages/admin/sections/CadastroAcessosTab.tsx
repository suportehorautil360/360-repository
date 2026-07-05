import { FileText, KeyRound, Loader2, Pencil, Trash2, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  clientesApi,
  type AcessoApi,
  type ClienteOverviewApi,
  type PerfilAcessoApi,
} from "../../../lib/api/clientes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERFIS: { value: PerfilAcessoApi; label: string }[] = [
  { value: "gestor", label: "Gestor" },
  { value: "admin", label: "Admin" },
];

const REQ = <span style={{ color: "#f87171" }}>*</span>;

function dominioDoEmail(email: string): string {
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(at + 1).trim() : "";
}

interface AcessoForm {
  nome: string;
  email: string;
  whatsapp: string;
  usuario: string;
  perfil: PerfilAcessoApi;
  senha: string;
  notificaEmail: boolean;
  notificaWhatsapp: boolean;
}

const FORM_INICIAL: AcessoForm = {
  nome: "",
  email: "",
  whatsapp: "",
  usuario: "",
  perfil: "gestor",
  senha: "",
  notificaEmail: true,
  notificaWhatsapp: true,
};

export function CadastroAcessosTab({
  clienteIdInicial,
}: {
  clienteIdInicial?: string;
}) {
  const [clientes, setClientes] = useState<ClienteOverviewApi[]>([]);
  const [selId, setSelId] = useState(clienteIdInicial ?? "");
  const [acessos, setAcessos] = useState<AcessoApi[]>([]);
  const [form, setForm] = useState<AcessoForm>(FORM_INICIAL);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AcessoForm>(FORM_INICIAL);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingAcessos, setLoadingAcessos] = useState(false);
  const [erroAcessos, setErroAcessos] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [baixandoContrato, setBaixandoContrato] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"none" | "ok" | "err">("none");

  function setMsgTexto(tone: "none" | "ok" | "err", texto: string) {
    setMsgTone(tone);
    setMsg(texto);
  }

  function update<K extends keyof AcessoForm>(key: K, value: AcessoForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    let ativo = true;
    void (async () => {
      setLoadingClientes(true);
      try {
        const lista = await clientesApi.overview();
        if (!ativo) return;
        setClientes(lista);
        setSelId((cur) => cur || clienteIdInicial || lista[0]?.id || "");
      } catch {
        if (ativo) setMsgTexto("err", "Falha ao carregar clientes.");
      } finally {
        if (ativo) setLoadingClientes(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [clienteIdInicial]);

  useEffect(() => {
    if (clienteIdInicial) setSelId(clienteIdInicial);
  }, [clienteIdInicial]);

  useEffect(() => {
    if (!selId) {
      setAcessos([]);
      setErroAcessos(null);
      setLoadingAcessos(false);
      return;
    }
    let ativo = true;
    void (async () => {
      setLoadingAcessos(true);
      setErroAcessos(null);
      try {
        const lista = await clientesApi.listarAcessos(selId);
        if (ativo) setAcessos(lista);
      } catch (err) {
        if (ativo) {
          setAcessos([]);
          setErroAcessos(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar os acessos.",
          );
        }
      } finally {
        if (ativo) setLoadingAcessos(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [selId]);

  const selCliente = useMemo(
    () => clientes.find((c) => c.id === selId),
    [clientes, selId],
  );
  const dominio = dominioDoEmail(selCliente?.email ?? "");

  async function adicionar(e: FormEvent) {
    e.preventDefault();
    setMsgTexto("none", "");
    if (!selId) {
      setMsgTexto("err", "Selecione o cliente vinculado.");
      return;
    }
    setSalvando(true);
    try {
      await clientesApi.criarAcesso(selId, {
        nome: form.nome.trim(),
        usuario: form.usuario.trim(),
        senha: form.senha,
        perfil: form.perfil,
        email: form.email.trim(),
        whatsapp: form.whatsapp.trim(),
        notificaEmail: form.notificaEmail,
        notificaWhatsapp: form.notificaWhatsapp,
      });
      setMsgTexto("ok", `Acesso de ${form.nome.trim()} criado.`);
      setForm(FORM_INICIAL);
      setAcessos(await clientesApi.listarAcessos(selId));
    } catch (err) {
      setMsgTexto(
        "err",
        err instanceof Error
          ? err.message
          : "Não foi possível criar o acesso.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string, nome: string) {
    if (!window.confirm(`Remover o acesso de "${nome}"?`)) return;
    try {
      await clientesApi.removerAcesso(selId, id);
      setAcessos((cur) => cur.filter((a) => a.id !== id));
      if (editandoId === id) {
        setEditandoId(null);
      }
    } catch (err) {
      setMsgTexto(
        "err",
        err instanceof Error ? err.message : "Não foi possível remover.",
      );
    }
  }

  function iniciarEdicao(acesso: AcessoApi) {
    setEditandoId(acesso.id);
    setEditForm({
      nome: acesso.nome,
      email: acesso.email,
      whatsapp: acesso.whatsapp,
      usuario: acesso.usuario,
      perfil: acesso.perfil === "admin" ? "admin" : "gestor",
      senha: "",
      notificaEmail: acesso.notificaEmail,
      notificaWhatsapp: acesso.notificaWhatsapp,
    });
    setMsgTexto("none", "");
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setEditForm(FORM_INICIAL);
  }

  function updateEdit<K extends keyof AcessoForm>(key: K, value: AcessoForm[K]) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault();
    if (!selId || !editandoId) return;
    setSalvandoEdicao(true);
    setMsgTexto("none", "");
    try {
      const atualizado = await clientesApi.atualizarAcesso(selId, editandoId, {
        nome: editForm.nome.trim(),
        usuario: editForm.usuario.trim(),
        perfil: editForm.perfil,
        email: editForm.email.trim(),
        whatsapp: editForm.whatsapp.trim(),
        notificaEmail: editForm.notificaEmail,
        notificaWhatsapp: editForm.notificaWhatsapp,
      });
      setAcessos((cur) =>
        cur.map((a) => (a.id === editandoId ? atualizado : a)),
      );
      setMsgTexto("ok", `Acesso de ${atualizado.nome} atualizado.`);
      cancelarEdicao();
    } catch (err) {
      setMsgTexto(
        "err",
        err instanceof Error ? err.message : "Não foi possível salvar.",
      );
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function resetarSenha(id: string, nome: string) {
    const nova = window.prompt(
      `Nova senha para "${nome}" (mínimo 4 caracteres):`,
    );
    if (nova === null) return;
    if (nova.trim().length < 4) {
      setMsgTexto("err", "A senha deve ter no mínimo 4 caracteres.");
      return;
    }
    try {
      await clientesApi.resetarSenhaAcesso(selId, id, nova.trim());
      setMsgTexto("ok", `Senha de ${nome} redefinida.`);
    } catch (err) {
      setMsgTexto(
        "err",
        err instanceof Error ? err.message : "Não foi possível redefinir.",
      );
    }
  }

  async function baixarContrato() {
    if (!selId || baixandoContrato) return;
    setMsgTexto("none", "");
    setBaixandoContrato(true);
    try {
      const cliente = await clientesApi.obter(selId);
      if (!cliente) {
        setMsgTexto("err", "Cliente não encontrado.");
        return;
      }
      const { baixarContratoClientePdf } = await import("./clienteContratoPdf");
      baixarContratoClientePdf(cliente);
      setMsgTexto("ok", "Contrato exportado em PDF.");
    } catch (err) {
      setMsgTexto(
        "err",
        err instanceof Error
          ? err.message
          : "Não foi possível gerar o PDF do contrato.",
      );
    } finally {
      setBaixandoContrato(false);
    }
  }

  function acoesLinha(acesso: AcessoApi) {
    return (
      <td className="ac-acoes">
        <button
          type="button"
          className="ac-btn-acao"
          onClick={() => iniciarEdicao(acesso)}
          title={`Editar acesso de ${acesso.nome}`}
          aria-label={`Editar acesso de ${acesso.nome}`}
        >
          <Pencil size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="ac-btn-acao"
          onClick={() => void resetarSenha(acesso.id, acesso.nome)}
          title={`Redefinir senha de ${acesso.nome}`}
          aria-label={`Redefinir senha de ${acesso.nome}`}
        >
          <KeyRound size={16} aria-hidden />
        </button>
        <button
          type="button"
          className="ac-btn-acao ac-btn-acao--danger"
          onClick={() => remover(acesso.id, acesso.nome)}
          title={`Remover acesso de ${acesso.nome}`}
          aria-label={`Remover acesso de ${acesso.nome}`}
        >
          <Trash2 size={16} aria-hidden />
        </button>
      </td>
    );
  }

  const msgClass =
    msgTone === "none"
      ? "status"
      : `status status--${msgTone === "ok" ? "ok" : "err"}`;

  return (
    <form id="formAcessoCliente" onSubmit={adicionar}>
      <div className="cad-banner">
        Os acessos abaixo são vinculados ao cliente selecionado. O e-mail de cada
        usuário usa, por padrão, o domínio fornecido pela empresa{" "}
        <strong>{dominio ? `@${dominio}` : "—"}</strong>.
      </div>

      <div className="row-2">
        <div>
          <label htmlFor="acSelCliente">Cliente (contrato) {REQ}</label>
          <Select
            value={selCliente ? selId : undefined}
            onValueChange={setSelId}
            disabled={loadingClientes || clientes.length === 0}
          >
            <SelectTrigger id="acSelCliente" className="admin-select">
              <SelectValue
                placeholder={
                  loadingClientes ? "Carregando..." : "Selecione o cliente"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} ({c.uf})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="acEmpresaEmail">
            E-mail da empresa (origem do acesso)
          </label>
          <input
            id="acEmpresaEmail"
            readOnly
            value={selCliente?.email ?? ""}
            placeholder="—"
          />
        </div>
      </div>

      <div className="row-2" style={{ marginTop: 10 }}>
        <div>
          <label htmlFor="acNome">Nome completo {REQ}</label>
          <input
            id="acNome"
            required
            placeholder="Ex.: Maria Oliveira"
            value={form.nome}
            onChange={(e) => update("nome", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="acEmail">E-mail do usuário {REQ}</label>
          <input
            id="acEmail"
            type="email"
            required
            placeholder={dominio ? `nome@${dominio}` : "nome@empresa.com"}
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </div>
      </div>

      <div className="row-2" style={{ marginTop: 10 }}>
        <div>
          <label htmlFor="acWhatsapp">WhatsApp (notificações)</label>
          <input
            id="acWhatsapp"
            placeholder="(00) 90000-0000"
            value={form.whatsapp}
            onChange={(e) => update("whatsapp", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="acUsuario">Usuário de login {REQ}</label>
          <input
            id="acUsuario"
            required
            placeholder="Ex.: maria.oliveira"
            value={form.usuario}
            onChange={(e) => update("usuario", e.target.value)}
          />
        </div>
      </div>

      <div className="row-3" style={{ marginTop: 10 }}>
        <div>
          <label htmlFor="acPerfil">Perfil</label>
          <Select
            value={form.perfil}
            onValueChange={(v) => update("perfil", v as PerfilAcessoApi)}
          >
            <SelectTrigger id="acPerfil" className="admin-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERFIS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="acSenha">Senha inicial {REQ}</label>
          <input
            id="acSenha"
            type="text"
            required
            minLength={4}
            placeholder="Mínimo 4 caracteres"
            value={form.senha}
            onChange={(e) => update("senha", e.target.value)}
          />
        </div>
        <div>
          <span className="ac-cap">Receber notificações por</span>
          <div className="ac-notif">
            <label className="ac-notif-opt">
              <input
                type="checkbox"
                checked={form.notificaEmail}
                onChange={(e) => update("notificaEmail", e.target.checked)}
              />
              E-mail
            </label>
            <label className="ac-notif-opt">
              <input
                type="checkbox"
                checked={form.notificaWhatsapp}
                onChange={(e) => update("notificaWhatsapp", e.target.checked)}
              />
              WhatsApp
            </label>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary ac-add"
        disabled={salvando || !selId}
      >
        {salvando ? "Salvando..." : "+ Adicionar acesso"}
      </button>
      <div id="msgAcessoCliente" className={msgClass} role="status">
        {msg}
      </div>

      <h3 className="ac-lista-titulo">
        Acessos de{" "}
        {selCliente ? `${selCliente.nome} (${selCliente.uf})` : "—"}{" "}
        <span className="ac-count">{acessos.length}</span>
        <button
          type="button"
          className="ac-btn-acao"
          style={{ marginLeft: 12, verticalAlign: "middle" }}
          disabled={!selId || baixandoContrato}
          onClick={() => void baixarContrato()}
          title="Baixar contrato PDF"
        >
          {baixandoContrato ? (
            <Loader2 size={16} className="ac-btn-acao__spin" aria-hidden />
          ) : (
            <FileText size={16} aria-hidden />
          )}
        </button>
      </h3>

      {editandoId ? (
        <div className="cad-banner" style={{ marginBottom: 12 }}>
          <form onSubmit={salvarEdicao}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <strong>Editar acesso</strong>
              <button
                type="button"
                className="ac-btn-acao"
                onClick={cancelarEdicao}
                aria-label="Cancelar edição"
              >
                <X size={16} />
              </button>
            </div>
            <div className="row-2">
              <div>
                <label htmlFor="edNome">Nome completo {REQ}</label>
                <input
                  id="edNome"
                  required
                  value={editForm.nome}
                  onChange={(e) => updateEdit("nome", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="edEmail">E-mail {REQ}</label>
                <input
                  id="edEmail"
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => updateEdit("email", e.target.value)}
                />
              </div>
            </div>
            <div className="row-2" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="edWhatsapp">WhatsApp</label>
                <input
                  id="edWhatsapp"
                  value={editForm.whatsapp}
                  onChange={(e) => updateEdit("whatsapp", e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="edUsuario">Usuário de login {REQ}</label>
                <input
                  id="edUsuario"
                  required
                  value={editForm.usuario}
                  onChange={(e) => updateEdit("usuario", e.target.value)}
                />
              </div>
            </div>
            <div className="row-3" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="edPerfil">Perfil</label>
                <Select
                  value={editForm.perfil}
                  onValueChange={(v) =>
                    updateEdit("perfil", v as PerfilAcessoApi)
                  }
                >
                  <SelectTrigger id="edPerfil" className="admin-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERFIS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <span className="ac-cap">Notificações</span>
                <div className="ac-notif">
                  <label className="ac-notif-opt">
                    <input
                      type="checkbox"
                      checked={editForm.notificaEmail}
                      onChange={(e) =>
                        updateEdit("notificaEmail", e.target.checked)
                      }
                    />
                    E-mail
                  </label>
                  <label className="ac-notif-opt">
                    <input
                      type="checkbox"
                      checked={editForm.notificaWhatsapp}
                      onChange={(e) =>
                        updateEdit("notificaWhatsapp", e.target.checked)
                      }
                    />
                    WhatsApp
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={salvandoEdicao}
                >
                  {salvandoEdicao ? "Salvando…" : "Salvar alterações"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
      <div className="hub-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Login</th>
              <th>E-mail</th>
              <th>WhatsApp</th>
              <th>Notificações</th>
              <th>Perfil</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {acessos.length === 0 ? (
              <tr>
                <td colSpan={7} className="topbar-user">
                  {loadingAcessos
                    ? "Carregando acessos…"
                    : erroAcessos
                      ? erroAcessos
                      : "Nenhum acesso cadastrado."}
                </td>
              </tr>
            ) : (
              acessos.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.nome}</strong>
                  </td>
                  <td>
                    <code style={{ fontSize: "0.78rem" }}>{a.usuario}</code>
                  </td>
                  <td>{a.email || "—"}</td>
                  <td>{a.whatsapp || "—"}</td>
                  <td>
                    {a.notificaEmail && (
                      <span className="ac-badge ac-badge--email">E-mail</span>
                    )}
                    {a.notificaWhatsapp && (
                      <span className="ac-badge ac-badge--wpp">WhatsApp</span>
                    )}
                    {!a.notificaEmail && !a.notificaWhatsapp && "—"}
                  </td>
                  <td>
                    <span className="ac-badge ac-badge--perfil">
                      {a.perfil === "admin" ? "Admin" : "Gestor"}
                    </span>
                  </td>
                  {acoesLinha(a)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </form>
  );
}
