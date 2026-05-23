# CLAUDE.md

Contexto para agentes/devs trabalhando neste repositório. Leia junto com o [README](./README.md).

## O que é

Hora Útil 360 — gestão de frota/equipamentos multi-cliente (prefeitura e locação), com portais de admin, oficina, posto, locação, prefeitura e checklist de campo. O checklist é o foco do PWA (uso offline em campo).

## Arquitetura — pontos que NÃO são óbvios

- **Sem backend no fluxo principal.** O front fala direto com o **Cloud Firestore**. A segurança real depende das **Firestore Security Rules** (não das chaves `VITE_*`, que são públicas no bundle).
- **Banco Firestore nomeado `"default"`** (não o `(default)` padrão). `src/lib/firebase/firebase.ts` passa o id explicitamente em `initializeFirestore(app, {...}, "default")`. Sem isso → `5 NOT_FOUND`.
- **Migração legado em andamento.** O núcleo em `src/lib/hu360/` espelha um app antigo baseado em `window.HU360`. Há arquivos `bridge.ts` / `apiBridge.ts` / `equipamentosBridge.ts` que republicam funções no `window` para HTML/JS legado. Código novo deve usar os hooks (`useHU360`, etc.).
- **Dados em DOIS lugares.** Parte vem do Firestore; parte ainda é lida/gravada em **localStorage** (`src/lib/hu360/storage.ts`). Cuidado: isso é fonte de inconsistência. Ao mexer em dados, confirme de onde a tela lê.
- **Três padrões de acesso a dados** coexistindo: Context (`useHU360`), stores Zustand (`use-*`) e chamadas `getDocs`/`addDoc` soltas dentro das páginas. Algumas funções do Context antigo foram desativadas e apontam para o caminho novo (ex.: `adicionarCliente`).

## Autenticação

- Login operacional: `src/pages/login/hooks/use-login.ts` consulta a coleção `users` (`where usuario == ... && senha == hashSenha(senha)`). Hash é **SHA-256 sem salt** (`src/utils/hashSenha.ts`) — fraco, candidato a melhoria.
- Admin: senha via `VITE_ADMIN_SECRET` (está no bundle — não é segredo real).
- Offline: a query de login não resolve na 1ª vez sem rede (doc nunca baixado). `use-login` trata isso com mensagem clara.

## PWA

- `vite-plugin-pwa` (`registerType: 'prompt'`). Service worker só roda no **build/preview**, não no `pnpm dev`.
- **Precache enxuto e focado no checklist**: `vite.config.ts` usa `globIgnores` para excluir os chunks de admin/prefeitura/posto/oficina/locação e o pdfjs (OCR) do precache. Essas áreas carregam sob demanda (`runtimeCaching` StaleWhileRevalidate).
- Persistência offline do Firestore via `persistentLocalCache` em `firebase.ts`.
- Componentes em `src/components/Pwa/` (prompt de update + indicador offline).

## Code-splitting

- `AppRoutes.tsx` usa `React.lazy` por rota → cada área é um chunk próprio. Envolto por `RouteErrorBoundary` (fallback amigável se um chunk falhar offline) + `Suspense`.
- **Não** use `manualChunks` para separar vendor: no rolldown (Vite 8) ele absorve o Firebase para dentro de um chunk de área, criando dependência cruzada. Já foi testado e revertido.

## Testes

- Unit: **Vitest** + Testing Library (`src/**/*.test.tsx`). Mocke `firebase/firestore` e `../lib/firebase/firebase` ao testar hooks que tocam o banco.
- E2E: **Playwright** (`e2e/`), valida manifest, service worker e offline. Sobe `build + preview` sozinho.
- CI (`.github/workflows/ci.yml`) roda lint + unit + build e E2E em cada push/PR.

## Lint

- `eslint.config.js` (flat). Regras barulhentas do legado (`ban-ts-comment`, `no-unused-vars`, etc.) estão como **`warn`** de propósito, para não bloquear. Apertar aos poucos. As regras de hooks novas (React Compiler) ficaram desativadas para não afogar o legado.

## Convenções de trabalho

- pnpm. Commits curtos, **sem assinatura de IA**. Trabalhar em branches e abrir PRs (frequentemente em draft).
- Quem mescla na `main` é o dono do projeto (não o dev) — abrir PR e aguardar.
- Sempre que possível, validar com `pnpm lint && pnpm test && pnpm build` antes de commitar.
