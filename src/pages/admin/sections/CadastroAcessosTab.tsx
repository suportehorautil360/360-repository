import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  clientesApi,
  type AcessoApi,
  type ClienteOverviewApi,
  type PerfilAcessoApi,
} from "../../../lib/api/clientes";

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

export function CadastroAcessosTab() {
  const [clientes, setClientes] = useState<ClienteOverviewApi[]>([]);
  const [selId, setSelId] = useState("");
  const [acessos, setAcessos] = useState<AcessoApi[]>([]);
  const [form, setForm] = useState<AcessoForm>(FORM_INICIAL);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [loadingAcessos, setLoadingAcessos] = useState(false);
  const [salvando, setSalvando] = useState(false);
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
        setSelId((cur) => cur || lista[0]?.id || "");
      } catch {
        if (ativo) setMsgTexto("err", "Falha ao carregar clientes.");
      } finally {
        if (ativo) setLoadingClientes(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!selId) {
      setAcessos([]);
      return;
    }
    let ativo = true;
    void (async () => {
      setLoadingAcessos(true);
      try {
        const lista = await clientesApi.listarAcessos(selId);
        if (ativo) setAcessos(lista);
      } catch {
        if (ativo) setAcessos([]);
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
    } catch (err) {
      setMsgTexto(
        "err",
        err instanceof Error ? err.message : "Não foi possível remover.",
      );
    }
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
          <select
            id="acSelCliente"
            required
            value={selId}
            onChange={(e) => setSelId(e.target.value)}
          >
            {clientes.length === 0 && (
              <option value="">
                {loadingClientes ? "Carregando..." : "Nenhum cliente"}
              </option>
            )}
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.uf})
              </option>
            ))}
          </select>
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
          <select
            id="acPerfil"
            value={form.perfil}
            onChange={(e) => update("perfil", e.target.value as PerfilAcessoApi)}
          >
            {PERFIS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="acSenha">Senha inicial</label>
          <input
            id="acSenha"
            type="text"
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
      </h3>
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
                    ? "Carregando..."
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
                  <td>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => remover(a.id, a.nome)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </form>
  );
}
