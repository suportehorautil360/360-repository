# 360 — Login do Checklist configurável por empresa (+ redesign + dark/light)

- **Data:** 2026-08-11
- **Apps envolvidos:** `back` (NestJS) e `360-repository` (Vite/React admin)
- **Status:** Design aprovado, pronto para plano de implementação

## 1. Objetivo

Permitir que cada empresa (`cliente`/`prefeitura`) escolha, no painel admin, quais **modos de login do checklist** aceita: **CPF/Login + senha** (o atual) e/ou **Chassi da máquina** (novo). Modos são **combináveis por empresa** — a empresa pode habilitar um, o outro, ou os dois.

No mesmo escopo, **redesenhar** a tela `/checklist-login` seguindo padrão enterprise (layout split, shadcn/ui, tipografia forte) e adicionar **toggle dark/light isolado** apenas nessa página.

## 2. Decisões aprovadas

- **Modelo de dados:** dois booleans por cliente (`cpfSenha`, `chassi`), não enum — flexibilidade pra habilitar ambos.
- **Login por chassi:** só o chassi (sem senha/PIN). Após validação, **modal pede o nome livre do operador** — auditoria mínima.
- **Descoberta da empresa:** transparente. Digita chassi → back resolve qual empresa é. Cache local guarda chassis de todas as empresas já vistas no aparelho.
- **Cache offline dos chassis:** mesmo padrão de `credenciais-offline.ts` — `provisionarChassisEmpresa` após 1º login online popula o cache com todos os chassis daquela empresa. TTL 7 dias. Permite login offline por chassi em aparelhos compartilhados.
- **Chassi duplicado em 2+ empresas:** rejeita com 409 e mensagem clara — "Contate o suporte." (chassi real é único; duplicata = erro de cadastro).
- **UI stack:** **shadcn/ui + Tailwind v4** (já instalados). MUI descartado — traria 300KB, dois sistemas de UI, inconsistência com o resto do 360.
- **Dark/light:** **isolado na página** de login (`<div class="dark">` só no root). Preferência salva em `localStorage`. Global depois, se quiser.
- **Config no admin:** aba nova **"Configurações"** no detalhe do cliente (`CadastroClientesSection`), migrando o "tab manual" atual pra `<Tabs>` shadcn.
- **Default de migração:** empresas existentes recebem `{ cpfSenha: true, chassi: false }` — backward compat total.
- **Escopo do PR:** feature completa em **1 PR por repo** (2 PRs coordenados: back + 360). Não misturar com o `#133 fix admin.css`.
- **Workflow do 360 (CLAUDE.md):** branch + **PR draft**, **não** mesclar na `main`; commits curtos **sem assinatura de IA**; validar `pnpm lint && pnpm test && pnpm build`.

## 3. Modelo de dados

### 3.1 Coleção `clientes` (novo campo)

```ts
{
  // ... campos existentes (nome, uf, cnpj, contrato, etc)
  checklistLogin?: {
    cpfSenha: boolean;   // default true
    chassi: boolean;     // default false
  }
}
```

Constraint: **pelo menos um dos dois deve ser `true`**. Validada no back (rejeita PATCH que zeraria ambos) e no front (botão Salvar desabilitado).

Backward compat: docs sem `checklistLogin` → back interpreta como `{ cpfSenha: true, chassi: false }`.

### 3.2 Coleção `equipamentos` (existente, sem mudança)

Já indexada por `prefeituraId` e com campo `chassis` normalizado (uppercase, sem espaços). Aproveitamos como está.

### 3.3 Nova estrutura de auditoria no doc do checklist finalizado

Campo `operador` no checklist ganha discriminante:

```ts
// login por CPF/senha (como hoje, apenas formaliza tipo)
{ operador: { tipo: "funcionario", funcionarioId, nome, cpf } }

// login por chassi (novo)
{ operador: { tipo: "chassi", nomeInformado, chassiUsado, idMaquina } }
```

## 4. Backend (`back` — NestJS)

### 4.1 Endpoints novos

| Método | Rota | Retorno | Auth |
|---|---|---|---|
| `PATCH` | `/clientes/:id/checklist-login-config` | 204 | JWT admin |
| `POST` | `/checklist/resolver-chassi` | `{ empresaId, empresaNome, idMaquina, chassi }` \| 404 \| 409 | Público (lookup) |
| `GET` | `/checklist/chassis-empresa/:empresaId` | `{ chassis: string[], expiraEm }` | Público (chassi não é credencial — ver 7.3); mesmo rate limit do resolver |

### 4.2 Service `ChecklistChassiService`

`back/src/modules/checklist/checklist-chassi.service.ts` (novo).

- `resolverChassi(chassi: string)`:
  1. Normaliza (`limparChassi` — uppercase, sem espaços).
  2. Query `equipamentos where chassis == X, limit 5`.
  3. Filtra: só empresas cujo `cliente.checklistLogin.chassi === true` (join simples via cache local no service).
  4. `matches.length === 0` → `NotFoundException("chassi não encontrado ou empresa não habilita")`.
  5. `matches.length > 1` → `ConflictException("chassi vinculado a múltiplas empresas")`.
  6. Retorna `{ empresaId, empresaNome, idMaquina, chassi }`.
- `listarChassisDaEmpresa(empresaId)`:
  - Query `equipamentos where prefeituraId == empresaId` → mapa `chassis[]`.
  - Retorna `{ chassis, expiraEm: now + 7d }`.
- `atualizarChecklistLoginConfig(clienteId, dto)`:
  - Valida `pelo menos 1 modo ativo`.
  - `updateDoc(clientes/{id}, { checklistLogin: dto })`.

### 4.3 Rate limit + log

Ambos os endpoints públicos (`POST /checklist/resolver-chassi` e `GET /checklist/chassis-empresa/:id`) recebem:

- Rate limit **10 req/min por IP** (throttler NestJS).
- Alerta a partir de **100 req/min** (log warn no Datadog / Sentry).
- Log estruturado por chamada: `{ endpoint, chassi?, empresaId?, ip, userAgent, resultado }`.

### 4.4 Migração `back/scripts/migrar-checklist-login.mjs`

Espelha padrão dos scripts `list-admin-users.mjs` / `create-admin-user.mjs`:

- Dry-run por padrão, `--commit` grava.
- Percorre `clientes` sem `checklistLogin` → seta `{ cpfSenha: true, chassi: false }`.
- Log: `"X atualizados, Y já OK, Z sem prefeituraId (ignorados)"`.

## 5. Frontend admin — aba "Configurações"

### 5.1 Refactor: `<Tabs>` shadcn em `CadastroClientesSection.tsx`

Substituir o "tab manual" (state boolean atual, linha 743) por `<Tabs>` shadcn com 3 abas:

```tsx
<Tabs defaultValue="dados">
  <TabsList>
    <TabsTrigger value="dados">Dados & Contrato</TabsTrigger>
    <TabsTrigger value="acessos">Acessos</TabsTrigger>
    <TabsTrigger value="config">Configurações</TabsTrigger>   {/* NOVA */}
  </TabsList>
  <TabsContent value="dados">{/* form atual (mantém como está) */}</TabsContent>
  <TabsContent value="acessos"><CadastroAcessosTab clienteIdInicial={clienteId} /></TabsContent>
  <TabsContent value="config"><CadastroConfigTab clienteId={clienteId} /></TabsContent>
</Tabs>
```

### 5.2 Novo componente `CadastroConfigTab.tsx`

`src/pages/admin/sections/CadastroConfigTab.tsx`.

- Bloco "Login do Checklist" com 2 `<Switch>` (shadcn) — CPF/Senha, Chassi.
- Se ambos `false` → `<Alert variant="destructive">` bloqueando o Save.
- Se `chassi === true` e `useEquipamentos(empresaId).length === 0` → warning inline ("Cadastre equipamentos antes.").
- `<Button>` Salvar → `useChecklistLoginConfig(clienteId).salvar()` → toast Sonner.

### 5.3 Hook `useChecklistLoginConfig(clienteId)`

`src/pages/admin/hooks/access/use-checklist-login-config.ts`.

- `GET /clientes/:id` traz `checklistLogin`.
- `PATCH /clientes/:id/checklist-login-config` salva.
- Estado local otimista, rollback em erro.

### 5.4 Instalar componente shadcn

`npx shadcn add switch` (o restante já existe).

## 6. Frontend `/checklist-login` — redesign + chassi + dark/light

### 6.1 Layout (split, shadcn "new-york")

- **Desktop (>= 1024px):** 50/50 — form à esquerda, painel visual à direita.
- **Tablet/mobile:** empilha vertical, painel visual vira banner topo (180px) ou some.
- Header com logo do 360 (esquerda) e toggle 🌗 (direita).

### 6.2 Toggle dark/light isolado

```tsx
// ChecklistLoginPage.tsx
const [theme, setTheme] = useState<'light' | 'dark'>(() =>
  (localStorage.getItem('hu360-checklist-theme') as 'light' | 'dark')
  ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
);

useEffect(() => {
  localStorage.setItem('hu360-checklist-theme', theme);
}, [theme]);

return (
  <div className={theme === 'dark' ? 'dark' : ''}>
    <div className="min-h-screen bg-background text-foreground">{/* ... */}</div>
  </div>
);
```

Não altera `<html>`, não vaza pro resto do app. `bg-background` e `text-foreground` são vars shadcn que já respondem a `.dark`.

### 6.3 Tabs Chassi vs CPF — sempre visíveis

Aparelho pode ter empresas em modos distintos. Sempre mostra as 2 abas. Aba padrão = última usada (localStorage `hu360-checklist-last-tab`).

- **Aba "Chassi":** `<Input>` uppercase auto + botão "Entrar". Sem senha.
- **Aba "CPF":** form atual (CPF/login + senha), só re-estilizado com shadcn.

### 6.4 Fluxo login por chassi (online)

1. Submit → `funcionariosApi.autenticarPorChassi(chassi)` → `POST /checklist/resolver-chassi`.
2. Sucesso: `{ empresaId, empresaNome, idMaquina, chassi }`.
3. `GET /checklist/chassis-empresa/:empresaId` → `provisionarChassisEmpresa(...)` popula cache local.
4. Abre `<Dialog>` "Como podemos te chamar?" (Input livre).
5. Confirma → `useOperadorSession.setSession({ idCliente: empresaId, empresa: empresaNome, idMaquina, chassis: chassi, modoLogin: "chassi", nomeInformado: nome })`.
6. `navigate("/checklist-controle")`.

### 6.5 Fluxo login por chassi (offline)

1. Submit → `resolverChassiOffline(chassi)` no cache local.
2. Se achou: abre `<Dialog>` "Seu nome" → sessão → navega.
3. Se não achou + offline: erro "Sem conexão. Esse aparelho não conhece esse chassi. Conecte à internet ou peça pra alguém logar online primeiro no aparelho."

### 6.6 Erros tratados

| Caso | Mensagem |
|---|---|
| Chassi vazio | "Digite o chassi da máquina." |
| 404 do back | "Chassi não encontrado. Confirme o número com o gestor." |
| 409 do back (duplicata) | "Chassi vinculado a mais de uma empresa. Contate o suporte." |
| Empresa não habilita chassi | "Esse chassi não permite login direto. Use CPF/senha." |
| Offline + fora do cache | ver 6.5 |
| Nome vazio no modal | Botão desabilitado |

## 7. Cache offline dos chassis

### 7.1 Novo módulo `chassis-offline.ts`

`src/pages/checklist-controle/chassis-offline.ts`. Espelha `credenciais-offline.ts` (idem chave, TTL, API pública):

```ts
const KEY = "hu360-chassis-offline";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type EmpresaChassis = {
  empresaId: string;
  empresaNome: string;
  chassis: string[];
  expiraEm: string;
};

export function provisionarChassisEmpresa(entrada: EmpresaChassis): void;
export function resolverChassiOffline(chassi: string):
  { empresaId: string; empresaNome: string } | null;
export function removerChassisEmpresa(empresaId: string): void;
export function limparExpirados(): void;
```

### 7.2 Ciclo de vida do cache

- **Login online por chassi:** ao resolver, dispara `GET /checklist/chassis-empresa/:id` → `provisionarChassisEmpresa`.
- **Login online por CPF/senha:** se a empresa tem `chassi: true`, também baixa a lista de chassis — pra futuros logins offline por chassi no mesmo aparelho.
- **Login offline:** consulta `resolverChassiOffline` (pode ter chassis de várias empresas — busca em todas).
- **A cada login online:** `limparExpirados()`.

### 7.3 Segurança

Chassi **não é credencial** — é identificador de equipamento. Cache exposto num aparelho roubado não permite acesso a mais do que já era possível via qualquer canal (o abuso máximo é fingir um checklist falso, o que "nome livre" já permitia).

## 8. Sessão + assinatura

### 8.1 `useOperadorSession.ts` — expansão

```diff
 type OperadorSession = {
   nome: string;
   idCliente: string;
   empresa: string;
-  funcionarioId: string;
+  funcionarioId?: string;      // agora opcional (chassi não tem)
   cpf?: string;
   tipo?: "operador" | "supervisor" | "admin";
   idMaquina?: string;
   chassis?: string;
+  modoLogin: "cpf-senha" | "chassi";
+  nomeInformado?: string;      // nome livre quando modoLogin === "chassi"
 };
```

Sessões legadas (sem `modoLogin`) → default `"cpf-senha"` na leitura. TTL 24h já garante rotação rápida.

### 8.2 Assinatura do checklist finalizado

Onde hoje o checklist grava `operador: { funcionarioId, nome, cpf }`, passa a gravar discriminante:

```ts
operador: session.modoLogin === "chassi"
  ? { tipo: "chassi", nomeInformado: session.nomeInformado!, chassiUsado: session.chassis!, idMaquina: session.idMaquina! }
  : { tipo: "funcionario", funcionarioId: session.funcionarioId!, nome: session.nome, cpf: session.cpf };
```

Backfill de checklists antigos: **não é necessário** — ausência de `operador.tipo` implica `"funcionario"` (todos os antigos foram assim).

## 9. Testes

### 9.1 Unit (Vitest)

**Back:**
- `checklist-chassi.service.spec.ts` — resolver com filtro por modo habilitado; 404; 409 (duplicata); listagem por empresa.
- `clientes.service.spec.ts` (existente): novo caso — validação "pelo menos 1 modo ativo".

**Front (360):**
- `chassis-offline.test.ts` — provision, resolve, expiração, remove, multi-empresa.
- `funcionariosApi.autenticarPorChassi.test.ts` — todos os motivos.
- `CadastroConfigTab.test.tsx` — toggle, validação, save otimista + rollback.
- `useOperadorSession.test.ts` — retrocompatibilidade (sessão sem `modoLogin`).
- `ChecklistLoginPage.test.tsx` — 2 abas, submit por chassi, dialog de nome, erros.

### 9.2 E2E (Playwright)

- `chassi-login-online.spec.ts` — chassi → resolver → modal nome → `/checklist-controle`.
- `chassi-login-offline.spec.ts` — pré-popular cache → offline → chassi → sessão.
- `checklist-config-admin.spec.ts` — abrir aba Configurações → alternar toggles → salvar → recarregar → persiste.

## 10. Migração + rollout

### 10.1 Ordem

1. **Back:** merge → deploy → rodar `migrar-checklist-login.mjs --commit` em prod.
2. **360:** merge → deploy.
3. Admin habilita `chassi` nas empresas piloto → testa no `/checklist-login`.

### 10.2 Rollback

Feature é opt-in por empresa. Rollback = revert dos 2 PRs. Dados do campo `checklistLogin` ficam no Firestore mas ignorados; sistema volta ao comportamento anterior sem impacto.

## 11. Plano de commits (por repo)

### 11.1 `back`

1. `feat(back): campo checklistLogin em Cliente + PATCH /checklist-login-config`
2. `feat(back): endpoints /checklist/resolver-chassi e /checklist/chassis-empresa`
3. `chore(back): script de migração checklistLogin default`
4. `test(back): unit para ChecklistChassiService`

### 11.2 `360-repository`

1. `refactor(360/admin): migrar CadastroClientesSection para shadcn Tabs`
2. `feat(360/admin): CadastroConfigTab com toggles do login do checklist`
3. `feat(360/checklist): módulo chassis-offline (cache local por empresa)`
4. `feat(360/checklist): expandir OperadorSession com modoLogin e nomeInformado`
5. `feat(360/checklist): funcionariosApi.autenticarPorChassi`
6. `feat(360/checklist): redesign ChecklistLoginPage — split layout, dark/light, tabs chassi/cpf`
7. `feat(360/checklist): dialog "Seu nome" após login por chassi`
8. `feat(360/checklist): assinatura do checklist grava operador.tipo (chassi|funcionario)`
9. `test(360): unit + e2e cobertura login por chassi + config admin`

Cada commit compila e passa lint isoladamente. PR único por repo, com referência cruzada nas descrições.

## 12. Fora do escopo (deliberadamente)

- **Dark/light global** — só na tela de login. Depois pode expandir.
- **Migração pra bcrypt** dos hashes de `senha` da coleção `users` — separado.
- **Cadastro em massa de equipamentos** via UI — já existe, não muda.
- **Página dedicada de config por empresa** (fora do detalhe do cliente) — YAGNI.
- **Feature flag global de rollout** — feature é opt-in por empresa, flag é redundante.
- **Dashboard de auditoria** de checklists assinados por chassi — futura iteração.

## 13. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Chassi cadastrado errado em `equipamentos` (typo/duplicata) | Login falha ou vai pra empresa errada | Log estruturado do resolver; script `list-chassis-duplicados.mjs` pra suporte diagnosticar. |
| Cache offline com dados velhos após empresa remover equipamento | Ex-máquina ainda "loga" offline por 7d | TTL curto (7d). Documentar como comportamento esperado. |
| Rate limit do resolver muito alto → DoS-lite | API pública derruba back | Rate limit 10 req/min por IP; alerta a partir de 100/min. |
| Aparelho compartilhado com 2 empresas: usuário de A vê a lista de B (leak?) | Vazamento de chassis (públicos por natureza) | Considerado dado não-sensível — decisão explícita. |
| Migração de sessões antigas quebra login existente | Operadores atuais deslogados | TTL 24h já rota naturalmente; leitura tolera ausência de `modoLogin`. |
| shadcn Tabs no admin quebra layout | Tela do cliente deforma | Cobertura visual manual + Playwright snapshot antes/depois. |

## 14. Referências

- `src/pages/checklist-controle/ChecklistLoginPage.tsx:1` — tela atual
- `src/pages/checklist-controle/credenciais-offline.ts:1` — padrão de cache offline replicado
- `src/pages/admin/sections/CadastroClientesSection.tsx:743` — tab manual atual
- `src/lib/funcionarios/funcionarios.ts:1` — `funcionariosApi` (ganha `autenticarPorChassi`)
- `back/src/modules/auth/auth.service.ts:1` — padrão dos services de auth
- Spec anterior `2026-06-23-posto-detalhe-acesso-design.md` — estilo de spec adotado
