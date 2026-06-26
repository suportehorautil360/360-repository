# 360 — Detalhe do Posto + Acessos/Logins

- **Data:** 2026-06-23
- **App:** `360-repository` (Vite/React admin)
- **Status:** Design aprovado, pronto para plano

## 1. Objetivo

Na tela **oficinas-postos**, adicionar um **drawer de detalhe do posto** onde o admin
gerencia o **acesso/login** daquele posto — as credenciais que o operador usa para entrar
no `posto-web`. Escopo: **criar, listar, resetar senha e remover** acessos (vários
operadores por posto).

## 2. Decisões aprovadas

- Detalhe como **drawer (shadcn `Sheet`, side right)** aberto da lista — sem rota nova.
- Acesso: **criar + listar + resetar senha + remover**.
- Reusa a coleção/fluxo de `users` existente (`vinculo:"posto"`, `postoId`); não altera o cadastro do posto.
- Estilo do drawer em **Tailwind + shadcn** (o `admin.css` é id-escopado e não alcança o portal do Sheet).
- **Workflow do 360 (CLAUDE.md):** branch + **PR draft**, **não** mesclar na `main`; commits curtos sem assinatura de IA; validar `pnpm lint && pnpm test && pnpm build`.

## 3. Modelo de dados (existente)

- **Posto (lista):** vem da API do back `parceirosApi.overview()` → `PostoParceiroApi { id, nome, razaoSocial, cidadeUf, bandeira, condicaoPagamento, limiteCredito, ativo }`. **Sem `prefeituraId`.**
- **Posto (doc):** coleção `postos` tem `prefeituraId` — obtido por `getDoc(doc(db,"postos",posto.id))`.
- **Acesso/login:** coleção `users`, doc `UsuarioFirestore { id, nome, usuario, senha(SHA-256), perfil, type, vinculo, prefeituraId, postoId, createdAt }`. Senha via `hashSenha` (SHA-256 sem sal). Login em `use-login.ts` faz `where usuario==X && senha==hash`.

## 4. Camada de dados — estender `use-access.ts` (DRY)

`src/pages/admin/hooks/access/use-access.ts` (Zustand, Firestore direto):
- **Reusa:** `adicionarUsuario(DTOAddUsuario)` (valida nome/login/senha≥4/prefeituraId, **usuário único**, hash, `addDoc`) e `removerUsuario(id)` (`deleteDoc users/{id}`).
- **Estende `listarUsuarios`** com filtro `postoId?` → `where("postoId","==",postoId)`.
- **Adiciona `resetarSenha(id, novaSenha)`** → valida (≥4), `updateDoc(doc(db,"users",id), { senha: hashSenha(novaSenha) })`.
- Atualiza os tipos em `access/types.ts` (`listarUsuarios` filtros + `resetarSenha` na interface).

## 5. Drawer `PostoDetalheDrawer`

`src/pages/admin/sections/PostoDetalheDrawer.tsx` (novo):
- **Props:** `{ posto: PostoParceiroApi | null; open: boolean; onClose: () => void }`.
- **Ao abrir:** resolve `prefeituraId` (`getDoc postos/{posto.id}`) e lista acessos (`listarUsuarios({ postoId: posto.id })`). Se o posto não tiver `prefeituraId`/doc, desabilita o form com aviso claro.
- **Conteúdo:**
  - **Resumo (read-only):** `nome`/`razaoSocial`, `cidadeUf`, `bandeira`, badge ativo/suspenso.
  - **Acessos do posto:** lista (`usuario`, `nome`) com **Resetar senha** e **Remover** por linha; vazio → "Nenhum acesso ainda."
  - **Novo acesso:** form `nome`, `usuário`, `senha` → `adicionarUsuario({ nome, usuario, senha, perfil:"gestor", vinculo:"posto", postoId: posto.id, prefeituraId })`.
  - **Resetar senha:** prompt/input de nova senha → `resetarSenha(docId, nova)`.
- Após cada ação, recarrega a lista. Mensagens de sucesso/erro inline.
- **UI:** `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` + `Button`/`Input` (shadcn) + Tailwind (tema admin escuro, acento laranja `#f97316`), no padrão do `WhatsappQrSheet`.

## 6. Entrada na lista — `OficinasPostosSection`

- `PostoRow` ganha um botão **"Detalhes / Acesso"** que faz `onSelecionar(posto)`.
- A section guarda `const [postoSel, setPostoSel] = useState<PostoParceiroApi | null>(null)` e renderiza `<PostoDetalheDrawer posto={postoSel} open={!!postoSel} onClose={() => setPostoSel(null)} />`.

## 7. Testes (Vitest + Testing Library)

- **Unit (`use-access.test.ts`):** mock `firebase/firestore` + `db` + `hashSenha`; cobre `listarUsuarios({postoId})` (aplica `where postoId`), `resetarSenha` (valida ≥4, chama `updateDoc` com hash), e confirma que `adicionarUsuario` grava `vinculo:"posto"`/`postoId` (já coberto + caso posto).
- **Component (`PostoDetalheDrawer.test.tsx`):** mock do hook `useAccess` + `getDoc`; renderiza resumo, lista acessos mockados, e o submit do "novo acesso" chama `adicionarUsuario` com os campos certos.

## 8. Critérios de aceite

1. Botão "Detalhes / Acesso" em cada posto abre o drawer com o resumo e os acessos daquele posto.
2. Criar acesso grava em `users` com `vinculo:"posto"`, `postoId`, `prefeituraId`, senha em SHA-256; bloqueia usuário duplicado e senha < 4.
3. Resetar senha atualiza o hash; remover apaga o doc; a lista recarrega após cada ação.
4. `pnpm lint && pnpm test && pnpm build` passam.
5. Entregue em **branch** com **PR draft** (sem merge na main).
