export function CadastrosSection() {
  return (
    <>
      <h1>Painel de Cadastros</h1>
      <div className="grid">
        <article className="card">
          <h3>+ Novo Equipamento</h3>
          <label>Descrição</label>
          <input type="text" placeholder="Ex: Patrola linha amarela" />
          <label>Prefixo / Placa</label>
          <input type="text" placeholder="TL-15" />
          <button className="btn" type="button">
            Cadastrar Máquina
          </button>
        </article>
        <article className="card">
          <h3>+ Novo Operador</h3>
          <label>Nome Completo</label>
          <input type="text" placeholder="Ex: José Ferreira" />
          <label>Cargo</label>
          <select>
            <option>Operador de Máquinas</option>
            <option>Motorista</option>
            <option>Mecânico</option>
          </select>
          <button className="btn" type="button">
            Cadastrar Pessoa
          </button>
        </article>
      </div>
      <p
        style={{
          marginTop: 14,
          fontSize: '0.82rem',
          color: 'var(--text-gray)',
          maxWidth: 760,
          lineHeight: 1.5,
        }}
      >
        Para cadastro estruturado de máquinas com chassis, marca e modelo (com
        importação de planilha), use a aba <strong>Equipamentos</strong>. Os
        registros operam em escopo deste município.
      </p>
    </>
  )
}
