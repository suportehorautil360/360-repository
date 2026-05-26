# Arquitetura do front

Mapa da organização **de pastas e rotas** do front (Vite + React + React Router).
Leia junto com o [README](./README.md) e o [CLAUDE.md](./CLAUDE.md) (este último cobre
dados/Firestore, PWA e code-splitting). Aqui o foco é **estrutura**, não a camada de dados.

> Status: o app cresceu por acreção e hoje convivem **dois paradigmas** de organização.
> Este documento descreve o que existe, fixa a **convenção-alvo** e lista as **dívidas**
> a pagar aos poucos (sem travar features).

## Estrutura de pastas (`src/`)

| Pasta | Papel |
| --- | --- |
| `pages/<área>/` | Telas por área (`admin`, `checklist-controle`, `locacao`, `login`, `oficina`, `posto`, `prefeitura`). Cada área tem sua página e, quando grande, `sections/`. |
| `features/<feature>/` | Feature com **domínio isolado e testável** (`features/checklist/domain`). Estilo moderno — ainda só o checklist segue. |
| `lib/` | Integração/infra: `firebase/` (SDK + named DB `"default"`), `hu360/` (núcleo legado/migração), `api/` (client HTTP do backend NestJS). |
| `components/` | UI **genuinamente compartilhada** entre áreas (`Sidebar`, `Pwa`, `ErrorBoundary`). |
| `portal/` | Núcleo do **portal do posto** (landing `/`): `PostoPortalProvider`, `PostoAppShell`, `HubControlePanel` e helpers. |
| `admin/` | `adminSession` (sessão isolada do admin). |
| `utils/` | Funções utilitárias puras. |
| `data/` | Seeds/JSON estáticos. |
| `test/` | Setup do Vitest. |
| `assets/` | Estáticos importados pelo bundler. |

Arquivos de topo: `main.tsx` (entry), `AppRoutes.tsx` (todas as rotas), `index.css`/`globals.d.ts`.

## Rotas

Todas em [`AppRoutes.tsx`](./src/AppRoutes.tsx), com `React.lazy` por rota (1 chunk por área),
envoltas em `RouteErrorBoundary` + `Suspense`.

| Rota | Tela | Navegação interna |
| --- | --- | --- |
| `/` | `RootRoute` → admin vai p/ `/admin/dashboard`; senão portal do posto | — |
| `/admin` + filhos | `AdminPage` (layout) | **Rotas aninhadas** (`<Route>` filhos + `index`) |
| `/prefeitura`, `/prefeitura/:id` | `PrefeituraPage` | Abas via **estado local** |
| `/oficina/:id`, `/locacao/:id`, `/posto/:id` | páginas operacionais (auth) | estado local |
| `/checklist-login`, `/checklist-controle`, `/ponto` | PWA do operador | abas via estado local |
| `/login-operacional` | login operacional | — |
| `*` | redireciona p/ `/` | — |

## Convenção-alvo (para código novo)

1. **Uma área = uma pasta dona de tudo dela.** Página, `sections/`, componentes e domínio
   da área moram juntos. Evitar espalhar a mesma área em pastas-irmãs diferentes.
2. **`components/` só para UI cross-app.** Componente específico de uma área vai na pasta
   da área, não no balde global.
3. **`lib/` é integração/infra**, não tela. Hooks de domínio ficam na área/feature.
4. **Rotas novas com sub-navegação** devem usar **rotas aninhadas** (como `/admin`),
   não estado de aba interno — mantém deep-link e refresh.
5. **Code-splitting por rota** (`React.lazy`) continua obrigatório; conferir os
   `globIgnores` do PWA em `vite.config.ts` ao nomear chunks (área de campo entra no
   precache; admin/prefeitura/etc. ficam de fora).

## Dívidas conhecidas (pagar aos poucos)

- [ ] **Dois paradigmas convivendo:** `pages/ + sections/` (maioria) vs `features/<x>/domain`
      (só checklist). Escolher um e migrar gradualmente.
- [ ] **Mesmo conceito em duas casas:** `portal/` ⟷ `pages/posto/` (ambos "posto");
      `admin/` ⟷ `pages/admin/`. Consolidar.
- [ ] **Componentes de feature no balde global:** mover `components/checklistHistorico` e
      `components/emergencia` para a área do checklist.
- [ ] **Navegação inconsistente:** prefeitura/posto/oficina/locação usam abas por estado
      local (não deep-linkáveis). Avaliar migrar para rotas aninhadas como o `/admin`.
- [ ] **Util de moeda duplicado** em várias telas (ver issue #18) — extrair p/ `utils/`.
