import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  criarDadosDemo,
  useHU360,
  useHU360Auth,
  type PostoCredenciado,
  type Prefeitura,
  type Usuario,
} from "../../../lib/hu360";
import { useLogin } from "../../login/hooks/use-login";
import { useAccess } from "../hooks/access/use-access";

/**
 * O acesso a esta seção já é gateado por `AdminPage` (senha em
 * `VITE_ADMIN_SECRET`). Quem chega aqui é admin do hub, então liberamos os
 * formulários sem checar `useHU360Auth().user.perfil` (que pode estar como
 * `gestor` se o seed/sessão local divergir).
 */

function hubClientePermiteRedeMunicipal(p: Prefeitura | undefined): boolean {
  if (!p?.id) return false;
  if (p.tipoCliente === "locacao") return false;
  const st = p.contrato?.status || "ativo";
  return st === "ativo";
}

function clienteEhLocacaoAtivo(p: Prefeitura | undefined): boolean {
  if (!p?.id) return false;
  if (p.tipoCliente !== "locacao") return false;
  const st = p.contrato?.status || "ativo";
  return st === "ativo";
}

function controleMesclado(
  prefeituraId: string,
  obterDadosPrefeitura: (id: string) => ReturnType<typeof criarDadosDemo>,
): NonNullable<
  ReturnType<typeof criarDadosDemo>["prefeituraModulo"]
>["controleAbastecimento"] {
  const dados = obterDadosPrefeitura(prefeituraId) as ReturnType<
    typeof criarDadosDemo
  >;
  const demo = criarDadosDemo(prefeituraId);
  const pmBase = demo.prefeituraModulo;
  const caBase = pmBase?.controleAbastecimento ?? {};
  const caSav = dados.prefeituraModulo?.controleAbastecimento ?? {};
  return { ...caBase, ...caSav };
}

function postosAtivosDoCliente(
  pid: string,
  obterDadosPrefeitura: (id: string) => ReturnType<typeof criarDadosDemo>,
): PostoCredenciado[] {
  const ca = controleMesclado(pid, obterDadosPrefeitura);
  const lista = ca.postosCredenciados ?? [];
  return lista.filter((p) => (p.status || "Ativo").toLowerCase() === "ativo");
}

function nomePostoCredenciado(
  pid: string,
  postoId: string,
  obterDadosPrefeitura: (id: string) => ReturnType<typeof criarDadosDemo>,
): string {
  const postos = postosAtivosDoCliente(pid, obterDadosPrefeitura);
  const p = postos.find((x) => x.id === postoId);
  if (!p) return postoId || "—";
  const nome =
    (p.nomeFantasia && String(p.nomeFantasia).trim()) || p.razaoSocial;
  return nome || postoId;
}

function vinculoPrefeitura(u: Usuario): boolean {
  const v = u.vinculo || "prefeitura";
  return v !== "oficina" && v !== "posto" && v !== "locacao";
}

function vinculoOficina(u: Usuario): boolean {
  return u.vinculo === "oficina";
}

function vinculoPosto(u: Usuario): boolean {
  return u.vinculo === "posto";
}

function vinculoLocacao(u: Usuario): boolean {
  return u.vinculo === "locacao";
}

type MsgTone = "none" | "ok" | "err" | "warn";

function msgClass(tone: MsgTone): string {
  if (tone === "none") return "status";
  if (tone === "warn") return "status status--warn";
  return `status status--${tone === "ok" ? "ok" : "err"}`;
}

function criarLocadoraFake(id: string, nome: string, uf: string): Prefeitura {
  return {
    id,
    nome,
    uf,
    tipoCliente: "locacao",
    contrato: {
      numero: `LC-${id}`,
      processo: "DEMO",
      modalidade: "contrato_direto",
      dataAssinatura: "2025-01-01",
      vigenciaInicio: "2025-01-01",
      vigenciaFim: "2027-12-31",
      objeto: "Cliente de locacao de demonstracao",
      valorMensal: "R$ 0,00",
      valorTotal: "R$ 0,00",
      indiceReajuste: "IPCA",
      periodicidadeFaturamento: "mensal",
      slaRespostaHoras: "24",
      responsavelContratante: "Conta Demo",
      cargoContratante: "Operacoes",
      emailContratante: `contato+${id}@demo.local`,
      telefoneContratante: "(00) 0000-0000",
      observacoes: "Registro fake para facilitar cadastro em ambiente local.",
      status: "ativo",
    },
  };
}

const LOCADORAS_FAKES: Prefeitura[] = [
  criarLocadoraFake("locadora-premium", "Locadora Premium", "SP"),
  criarLocadoraFake("locadora-expresso", "Locadora Expresso", "MG"),
  criarLocadoraFake("locadora-rapida", "Locadora Rapida", "RJ"),
  criarLocadoraFake("locadora-elite", "Locadora Elite", "DF"),
  criarLocadoraFake("locadora-master", "Locadora Master", "BA"),
];

export function AcessosLoginsSection() {
  const {
    prefeituras,
    usuarios,
    salvarUsuarios,
    prefeituraLabel,
    obterDadosPrefeitura,
  } = useHU360();
  const { user } = useLogin();
  const { handleAddLocacao } = useAccess();

  const prefsRede = useMemo(
    () => prefeituras.filter(hubClientePermiteRedeMunicipal),
    [prefeituras],
  );

  const locadoras = useMemo(() => {
    const reais = prefeituras.filter(clienteEhLocacaoAtivo);
    const porId = new Map<string, Prefeitura>();
    for (const p of [...LOCADORAS_FAKES, ...reais]) {
      porId.set(p.id, p);
    }
    return Array.from(porId.values());
  }, [prefeituras]);

  const labelLocadora = useCallback(
    (id: string) => {
      const encontrada = locadoras.find((p) => p.id === id);
      if (encontrada) return `${encontrada.nome} (${encontrada.uf})`;
      return prefeituraLabel(id);
    },
    [locadoras, prefeituraLabel],
  );

  const [selMunPref, setSelMunPref] = useState("");
  const [selMunOfi, setSelMunOfi] = useState("");
  const [selMunPosto, setSelMunPosto] = useState("");
  const [selPostoCred, setSelPostoCred] = useState("");
  const [selLocacao, setSelLocacao] = useState("");

  const [prefNome, setPrefNome] = useState("");
  const [prefLogin, setPrefLogin] = useState("");
  const [prefPerfil, setPrefPerfil] = useState<"gestor" | "admin">("gestor");
  const [prefSenha, setPrefSenha] = useState("");

  const [ofiNome, setOfiNome] = useState("");
  const [ofiLogin, setOfiLogin] = useState("");
  const [ofiPerfil, setOfiPerfil] = useState<"gestor" | "admin">("gestor");
  const [ofiSenha, setOfiSenha] = useState("");

  const [postoNome, setPostoNome] = useState("");
  const [postoLogin, setPostoLogin] = useState("");
  const [postoPerfil, setPostoPerfil] = useState<"gestor" | "admin">("gestor");
  const [postoSenha, setPostoSenha] = useState("");

  const [locNome, setLocNome] = useState("");
  const [locLogin, setLocLogin] = useState("");
  const [locPerfil, setLocPerfil] = useState<"gestor" | "admin">("gestor");
  const [locSenha, setLocSenha] = useState("");

  const [msgPref, setMsgPref] = useState({ tone: "none" as MsgTone, text: "" });
  const [msgOfi, setMsgOfi] = useState({ tone: "none" as MsgTone, text: "" });
  const [msgPosto, setMsgPosto] = useState({
    tone: "none" as MsgTone,
    text: "",
  });
  const [msgLoc, setMsgLoc] = useState({ tone: "none" as MsgTone, text: "" });

  useEffect(() => {
    if (!selMunPref && prefeituras[0]) setSelMunPref(prefeituras[0].id);
  }, [prefeituras, selMunPref]);

  useEffect(() => {
    if (!selMunOfi && prefsRede[0]) setSelMunOfi(prefsRede[0].id);
  }, [prefsRede, selMunOfi]);

  useEffect(() => {
    if (!selMunPosto && prefsRede[0]) setSelMunPosto(prefsRede[0].id);
  }, [prefsRede, selMunPosto]);

  useEffect(() => {
    if (!selLocacao && locadoras[0]) setSelLocacao(locadoras[0].id);
  }, [locadoras, selLocacao]);

  const postosDoMun = useMemo(
    () =>
      selMunPosto
        ? postosAtivosDoCliente(selMunPosto, obterDadosPrefeitura)
        : [],
    [selMunPosto, obterDadosPrefeitura],
  );

  useEffect(() => {
    if (selPostoCred && !postosDoMun.some((p) => p.id === selPostoCred)) {
      setSelPostoCred("");
    }
  }, [postosDoMun, selPostoCred]);

  const usersPref = useMemo(
    () =>
      usuarios.filter(
        (u) => u.prefeituraId === selMunPref && vinculoPrefeitura(u),
      ),
    [usuarios, selMunPref],
  );

  const usersOfi = useMemo(
    () =>
      usuarios.filter((u) => u.prefeituraId === selMunOfi && vinculoOficina(u)),
    [usuarios, selMunOfi],
  );

  const usersPosto = useMemo(
    () =>
      usuarios.filter((u) => u.prefeituraId === selMunPosto && vinculoPosto(u)),
    [usuarios, selMunPosto],
  );

  const usersLoc = useMemo(
    () =>
      usuarios.filter(
        (u) => u.prefeituraId === selLocacao && vinculoLocacao(u),
      ),
    [usuarios, selLocacao],
  );

  const setMsgPrefCb = useCallback((tone: MsgTone, text: string) => {
    setMsgPref({ tone, text });
  }, []);

  const setMsgOfiCb = useCallback((tone: MsgTone, text: string) => {
    setMsgOfi({ tone, text });
  }, []);

  const setMsgPostoCb = useCallback((tone: MsgTone, text: string) => {
    setMsgPosto({ tone, text });
  }, []);

  const setMsgLocCb = useCallback((tone: MsgTone, text: string) => {
    setMsgLoc({ tone, text });
  }, []);

  function tentarIncluirUsuario(opts: {
    nome: string;
    usuario: string;
    senha: string;
    perfil: "gestor" | "admin";
    prefeituraId: string;
    vinculo: Usuario["vinculo"];
    postoId?: string;
    setMsg: (tone: MsgTone, text: string) => void;
    msgSucesso: string;
  }): boolean {
    const nome = opts.nome.trim();
    const usuario = opts.usuario.trim();
    const senha = opts.senha.trim();
    if (senha.length < 4) {
      opts.setMsg("err", "A senha deve ter no mínimo 4 caracteres.");
      return false;
    }
    if (
      usuarios.some((u) => u.usuario.toLowerCase() === usuario.toLowerCase())
    ) {
      opts.setMsg("err", "Já existe um usuário com esse login.");
      return false;
    }
    const novo: Usuario = {
      nome,
      usuario,
      senha,
      perfil: opts.perfil,
      prefeituraId: opts.prefeituraId,
      vinculo: opts.vinculo,
      ...(opts.postoId ? { postoId: opts.postoId } : {}),
    };
    salvarUsuarios([...usuarios, novo]);
    opts.setMsg("ok", opts.msgSucesso);
    return true;
  }

  function handlePrefSubmit(e: FormEvent) {
    e.preventDefault();
    setMsgPrefCb("none", "");
    if (!selMunPref) {
      setMsgPrefCb("err", "Selecione o município.");
      return;
    }
    const ok = tentarIncluirUsuario({
      nome: prefNome,
      usuario: prefLogin,
      senha: prefSenha,
      perfil: prefPerfil,
      prefeituraId: selMunPref,
      vinculo: "prefeitura",
      setMsg: setMsgPrefCb,
      msgSucesso: "Usuário da prefeitura cadastrado.",
    });
    if (ok) {
      setPrefNome("");
      setPrefLogin("");
      setPrefSenha("");
      setPrefPerfil("gestor");
    }
  }

  function handleOfiSubmit(e: FormEvent) {
    e.preventDefault();
    setMsgOfiCb("none", "");
    if (!selMunOfi) {
      setMsgOfiCb("err", "Selecione o município.");
      return;
    }
    const ok = tentarIncluirUsuario({
      nome: ofiNome,
      usuario: ofiLogin,
      senha: ofiSenha,
      perfil: ofiPerfil,
      prefeituraId: selMunOfi,
      vinculo: "oficina",
      setMsg: setMsgOfiCb,
      msgSucesso: "Usuário da oficina cadastrado.",
    });
    if (ok) {
      setOfiNome("");
      setOfiLogin("");
      setOfiSenha("");
      setOfiPerfil("gestor");
    }
  }

  async function handleLocSubmit(e: FormEvent) {
    e.preventDefault();
    setMsgLocCb("none", "");
    if (!selLocacao) {
      setMsgLocCb("err", "Selecione a empresa de locação.");
      return;
    }
    const result = await handleAddLocacao({
      fullName: locNome,
      initialPassword: locSenha,
      profille: locPerfil === "admin" ? "Administrador" : "Gestor",
      userLogin: locLogin,
    });
    if (result.ok) {
      setLocNome("");
      setLocLogin("");
      setLocSenha("");
      setLocPerfil("gestor");
    }
  }

  function handlePostoSubmit(e: FormEvent) {
    e.preventDefault();
    setMsgPostoCb("none", "");
    if (!selMunPosto) {
      setMsgPostoCb("err", "Selecione o município.");
      return;
    }
    if (!selPostoCred) {
      setMsgPostoCb(
        "err",
        "Cadastre um posto em Gestão → Oficinas e postos ou selecione o posto na lista.",
      );
      return;
    }
    const ok = tentarIncluirUsuario({
      nome: postoNome,
      usuario: postoLogin,
      senha: postoSenha,
      perfil: postoPerfil,
      prefeituraId: selMunPosto,
      vinculo: "posto",
      postoId: selPostoCred,
      setMsg: setMsgPostoCb,
      msgSucesso: "Usuário do posto cadastrado.",
    });
    if (ok) {
      setPostoNome("");
      setPostoLogin("");
      setPostoSenha("");
      setPostoPerfil("gestor");
    }
  }

  function removerUsuario(
    login: string,
    setMsg: (tone: MsgTone, text: string) => void,
    filtro: (u: Usuario) => boolean,
  ) {
    if (login === user?.usuario) {
      setMsg("err", "Você não pode remover a sua própria conta.");
      return;
    }
    const alvo = usuarios.find((u) => u.usuario === login);
    if (!alvo || !filtro(alvo)) {
      setMsg("err", "Usuário não encontrado neste bloco e município.");
      return;
    }
    salvarUsuarios(usuarios.filter((u) => u.usuario !== login));
    setMsg("ok", "Usuário removido.");
  }

  return (
    <section id="usuarios-acesso" className="aba-conteudo ativa">
      <h2>Acessos ao sistema — prefeitura, locação, oficina e posto</h2>
      <p
        className="topbar-user"
        style={{ marginBottom: 16, maxWidth: 920, lineHeight: 1.55 }}
      >
        Cadastros <strong>separados</strong>: servidores da{" "}
        <strong>prefeitura</strong>, equipe da{" "}
        <strong>empresa de locação</strong>, equipe da{" "}
        <strong>oficina credenciada</strong> e{" "}
        <strong>pessoal do posto de combustível</strong> vinculado ao convênio
        do cliente (postos cadastrados em{" "}
        <strong>Gestão → Oficinas e postos</strong>). A senha fica neste
        navegador (demonstração).
      </p>

      <article className="card">
        <h3>Equipe da prefeitura</h3>
        <p className="topbar-user" style={{ marginBottom: 12 }}>
          Funcionários e gestores que acessam o painel em nome do órgão público
          municipal.
        </p>
        <form id="formUsuarioPrefeitura" onSubmit={handlePrefSubmit}>
          <div className="row-2">
            <div>
              <label htmlFor="cadastroSelMunicipioPref">
                Município (contrato)
              </label>
              <select
                id="cadastroSelMunicipioPref"
                required
                value={selMunPref}
                onChange={(e) => setSelMunPref(e.target.value)}
              >
                {prefeituras.map((p) => (
                  <option key={p.id} value={p.id}>
                    {prefeituraLabel(p.id)}
                  </option>
                ))}
              </select>
            </div>
            <div />
          </div>
          <div className="row-2">
            <div>
              <label htmlFor="prefNome">Nome completo</label>
              <input
                id="prefNome"
                required
                placeholder="Ex.: Maria Oliveira"
                autoComplete="name"
                value={prefNome}
                onChange={(e) => setPrefNome(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="prefLogin">Usuário de login</label>
              <input
                id="prefLogin"
                required
                placeholder="Ex.: maria.oliveira"
                autoComplete="off"
                value={prefLogin}
                onChange={(e) => setPrefLogin(e.target.value)}
              />
            </div>
          </div>
          <div className="row-2">
            <div>
              <label htmlFor="prefPerfil">Perfil</label>
              <select
                id="prefPerfil"
                value={prefPerfil}
                onChange={(e) =>
                  setPrefPerfil(e.target.value as "gestor" | "admin")
                }
              >
                <option value="gestor">Gestor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div>
              <label htmlFor="prefSenha">Senha inicial</label>
              <input
                id="prefSenha"
                type="password"
                required
                placeholder="Mínimo 4 caracteres"
                autoComplete="new-password"
                value={prefSenha}
                onChange={(e) => setPrefSenha(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit">
            Cadastrar — prefeitura
          </button>
          <div
            id="msgUsuariosPref"
            className={msgClass(msgPref.tone)}
            role="status"
          >
            {msgPref.text}
          </div>
        </form>
        <h4 className="usuarios-acesso-subtitulo">Cadastrados (prefeitura)</h4>
        <p className="topbar-user usuarios-acesso-hint">
          Filtra pelo município selecionado no formulário acima.
        </p>
        <div className="hub-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Login</th>
                <th>Município</th>
                <th>Perfil</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody id="tabelaUsuariosPrefeitura">
              {usersPref.length === 0 ? (
                <tr>
                  <td colSpan={5} className="topbar-user">
                    Nenhum usuário para este município.
                  </td>
                </tr>
              ) : (
                usersPref.map((u) => (
                  <tr key={u.usuario}>
                    <td>{u.nome}</td>
                    <td>{u.usuario}</td>
                    <td>{prefeituraLabel(u.prefeituraId)}</td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (u.perfil === "admin"
                            ? "badge-admin"
                            : "badge-gestor")
                        }
                      >
                        {u.perfil}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-text"
                        onClick={() =>
                          removerUsuario(
                            u.usuario,
                            setMsgPrefCb,
                            (x) =>
                              x.prefeituraId === selMunPref &&
                              vinculoPrefeitura(x),
                          )
                        }
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
      </article>

      <article className="card" style={{ marginTop: 18 }}>
        <h3>Equipe da empresa de locação</h3>
        <p className="topbar-user" style={{ marginBottom: 12 }}>
          Funcionários da locadora contratante (cliente do tipo{" "}
          <strong>locação</strong>) que acessam o Painel Locação para acompanhar
          a frota.
        </p>
        <form id="formUsuarioLocacao" onSubmit={handleLocSubmit}>
          <div className="row-2">
            <div>
              <label htmlFor="cadastroSelLocacao">Empresa de locação</label>
              <select
                id="cadastroSelLocacao"
                required
                value={selLocacao}
                onChange={(e) => setSelLocacao(e.target.value)}
              >
                {locadoras.length === 0 ? (
                  <option value="">— Nenhuma locadora ativa —</option>
                ) : (
                  locadoras.map((p) => (
                    <option key={p.id} value={p.id}>
                      {labelLocadora(p.id)}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div />
          </div>
          <div className="row-2">
            <div>
              <label htmlFor="locNome">Nome completo</label>
              <input
                id="locNome"
                required
                placeholder="Ex.: Patrícia Locação"
                autoComplete="name"
                value={locNome}
                onChange={(e) => setLocNome(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="locLogin">Usuário de login</label>
              <input
                id="locLogin"
                required
                placeholder="Ex.: patricia.locacao"
                autoComplete="off"
                value={locLogin}
                onChange={(e) => setLocLogin(e.target.value)}
              />
            </div>
          </div>
          <div className="row-2">
            <div>
              <label htmlFor="locPerfil">Perfil</label>
              <select
                id="locPerfil"
                value={locPerfil}
                onChange={(e) =>
                  setLocPerfil(e.target.value as "gestor" | "admin")
                }
              >
                <option value="gestor">Gestor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div>
              <label htmlFor="locSenha">Senha inicial</label>
              <input
                id="locSenha"
                type="password"
                required
                placeholder="Mínimo 4 caracteres"
                autoComplete="new-password"
                value={locSenha}
                onChange={(e) => setLocSenha(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit">
            Cadastrar — locação
          </button>
          <div
            id="msgUsuariosLoc"
            className={msgClass(msgLoc.tone)}
            role="status"
          >
            {msgLoc.text}
          </div>
        </form>
        <h4 className="usuarios-acesso-subtitulo">Cadastrados (locação)</h4>
        <p className="topbar-user usuarios-acesso-hint">
          Filtra pela empresa de locação selecionada no formulário acima.
          Cadastre novas locadoras em <strong>Cadastro de clientes</strong>{" "}
          (segmento Locação).
        </p>
        <div className="hub-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Login</th>
                <th>Empresa</th>
                <th>Perfil</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody id="tabelaUsuariosLocacao">
              {usersLoc.length === 0 ? (
                <tr>
                  <td colSpan={5} className="topbar-user">
                    Nenhum usuário para esta locadora.
                  </td>
                </tr>
              ) : (
                usersLoc.map((u) => (
                  <tr key={u.usuario}>
                    <td>{u.nome}</td>
                    <td>{u.usuario}</td>
                    <td>{labelLocadora(u.prefeituraId)}</td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (u.perfil === "admin"
                            ? "badge-admin"
                            : "badge-gestor")
                        }
                      >
                        {u.perfil}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-text"
                        onClick={() =>
                          removerUsuario(
                            u.usuario,
                            setMsgLocCb,
                            (x) =>
                              x.prefeituraId === selLocacao &&
                              vinculoLocacao(x),
                          )
                        }
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
      </article>

      <article className="card" style={{ marginTop: 18 }}>
        <h3>Equipe da oficina credenciada</h3>
        <p className="topbar-user" style={{ marginBottom: 12 }}>
          Pessoas da oficina parceira que atendem aquele município no portal de
          oficina / fluxos vinculados.
        </p>
        <form id="formUsuarioOficina" onSubmit={handleOfiSubmit}>
          <div className="row-2">
            <div>
              <label htmlFor="cadastroSelMunicipioOfi">
                Município (contrato)
              </label>
              <select
                id="cadastroSelMunicipioOfi"
                required
                value={selMunOfi}
                onChange={(e) => setSelMunOfi(e.target.value)}
              >
                {prefsRede.length === 0 ? (
                  <option value="">— Nenhum cliente municipal ativo —</option>
                ) : (
                  prefsRede.map((p) => (
                    <option key={p.id} value={p.id}>
                      {prefeituraLabel(p.id)}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div />
          </div>
          <div className="row-2">
            <div>
              <label htmlFor="ofiNome">Nome completo</label>
              <input
                id="ofiNome"
                required
                placeholder="Ex.: João Mecânico"
                autoComplete="name"
                value={ofiNome}
                onChange={(e) => setOfiNome(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="ofiLogin">Usuário de login</label>
              <input
                id="ofiLogin"
                required
                placeholder="Ex.: joao.oficina"
                autoComplete="off"
                value={ofiLogin}
                onChange={(e) => setOfiLogin(e.target.value)}
              />
            </div>
          </div>
          <div className="row-2">
            <div>
              <label htmlFor="ofiPerfil">Perfil</label>
              <select
                id="ofiPerfil"
                value={ofiPerfil}
                onChange={(e) =>
                  setOfiPerfil(e.target.value as "gestor" | "admin")
                }
              >
                <option value="gestor">Gestor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div>
              <label htmlFor="ofiSenha">Senha inicial</label>
              <input
                id="ofiSenha"
                type="password"
                required
                placeholder="Mínimo 4 caracteres"
                autoComplete="new-password"
                value={ofiSenha}
                onChange={(e) => setOfiSenha(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit">
            Cadastrar — oficina
          </button>
          <div
            id="msgUsuariosOfi"
            className={msgClass(msgOfi.tone)}
            role="status"
          >
            {msgOfi.text}
          </div>
        </form>
        <h4 className="usuarios-acesso-subtitulo">Cadastrados (oficina)</h4>
        <p className="topbar-user usuarios-acesso-hint">
          Filtra pelo município selecionado no formulário acima.
        </p>
        <div className="hub-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Login</th>
                <th>Município</th>
                <th>Perfil</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody id="tabelaUsuariosOficina">
              {usersOfi.length === 0 ? (
                <tr>
                  <td colSpan={5} className="topbar-user">
                    Nenhum usuário para este município.
                  </td>
                </tr>
              ) : (
                usersOfi.map((u) => (
                  <tr key={u.usuario}>
                    <td>{u.nome}</td>
                    <td>{u.usuario}</td>
                    <td>{prefeituraLabel(u.prefeituraId)}</td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (u.perfil === "admin"
                            ? "badge-admin"
                            : "badge-gestor")
                        }
                      >
                        {u.perfil}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-text"
                        onClick={() =>
                          removerUsuario(
                            u.usuario,
                            setMsgOfiCb,
                            (x) =>
                              x.prefeituraId === selMunOfi && vinculoOficina(x),
                          )
                        }
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
      </article>

      <article className="card" style={{ marginTop: 18 }}>
        <h3>Pessoal do posto credenciado</h3>
        <p className="topbar-user" style={{ marginBottom: 12 }}>
          Operadores do posto conveniado ao cliente. Escolha o{" "}
          <strong>posto credenciado</strong> na aba{" "}
          <strong>Gestão → Oficinas e postos</strong>.
        </p>
        <form id="formUsuarioPosto" onSubmit={handlePostoSubmit}>
          <div className="row-2">
            <div>
              <label htmlFor="cadastroSelMunicipioPosto">
                Município (contrato)
              </label>
              <select
                id="cadastroSelMunicipioPosto"
                required
                value={selMunPosto}
                onChange={(e) => {
                  setSelMunPosto(e.target.value);
                  setSelPostoCred("");
                }}
              >
                {prefsRede.length === 0 ? (
                  <option value="">— Nenhum cliente municipal ativo —</option>
                ) : (
                  prefsRede.map((p) => (
                    <option key={p.id} value={p.id}>
                      {prefeituraLabel(p.id)}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label htmlFor="cadastroSelPostoCred">Posto credenciado</label>
              <select
                id="cadastroSelPostoCred"
                aria-label="Posto credenciado para vínculo do usuário"
                value={selPostoCred}
                onChange={(e) => setSelPostoCred(e.target.value)}
              >
                <option value="">— Selecione o posto —</option>
                {postosDoMun.map((p) => (
                  <option key={p.id} value={p.id}>
                    {(p.razaoSocial || p.id) +
                      (p.nomeFantasia?.trim()
                        ? ` · ${p.nomeFantasia.trim()}`
                        : "")}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row-2" style={{ marginTop: 10 }}>
            <div>
              <label htmlFor="postoNome">Nome completo</label>
              <input
                id="postoNome"
                required
                placeholder="Ex.: Carlos frentista"
                autoComplete="name"
                value={postoNome}
                onChange={(e) => setPostoNome(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="postoLogin">Usuário de login</label>
              <input
                id="postoLogin"
                required
                placeholder="Ex.: carlos.posto"
                autoComplete="off"
                value={postoLogin}
                onChange={(e) => setPostoLogin(e.target.value)}
              />
            </div>
          </div>
          <div className="row-2" style={{ marginTop: 10 }}>
            <div>
              <label htmlFor="postoPerfil">Perfil</label>
              <select
                id="postoPerfil"
                value={postoPerfil}
                onChange={(e) =>
                  setPostoPerfil(e.target.value as "gestor" | "admin")
                }
              >
                <option value="gestor">Gestor</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div>
              <label htmlFor="postoSenha">Senha inicial</label>
              <input
                id="postoSenha"
                type="password"
                required
                placeholder="Mínimo 4 caracteres"
                autoComplete="new-password"
                value={postoSenha}
                onChange={(e) => setPostoSenha(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit">
            Cadastrar — posto
          </button>
          <div
            id="msgUsuariosPosto"
            className={msgClass(msgPosto.tone)}
            role="status"
          >
            {msgPosto.text}
          </div>
        </form>
        <h4 className="usuarios-acesso-subtitulo">Cadastrados (posto)</h4>
        <p className="topbar-user usuarios-acesso-hint">
          Filtra pelo município selecionado no formulário acima.
        </p>
        <div className="hub-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Login</th>
                <th>Município</th>
                <th>Posto</th>
                <th>Perfil</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody id="tabelaUsuariosPosto">
              {usersPosto.length === 0 ? (
                <tr>
                  <td colSpan={6} className="topbar-user">
                    Nenhum usuário para este município.
                  </td>
                </tr>
              ) : (
                usersPosto.map((u) => (
                  <tr key={u.usuario}>
                    <td>{u.nome}</td>
                    <td>{u.usuario}</td>
                    <td>{prefeituraLabel(u.prefeituraId)}</td>
                    <td>
                      {nomePostoCredenciado(
                        u.prefeituraId,
                        u.postoId ?? "",
                        obterDadosPrefeitura,
                      )}
                    </td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (u.perfil === "admin"
                            ? "badge-admin"
                            : "badge-gestor")
                        }
                      >
                        {u.perfil}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-text"
                        onClick={() =>
                          removerUsuario(
                            u.usuario,
                            setMsgPostoCb,
                            (x) =>
                              x.prefeituraId === selMunPosto && vinculoPosto(x),
                          )
                        }
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
      </article>
    </section>
  );
}
