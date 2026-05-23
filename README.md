# Hora Útil 360

Plataforma web de **gestão de operações e manutenção de frota/equipamentos**, multi-cliente. Atende clientes do tipo **prefeitura** (contratos públicos) e **locação**, com portais para administração, oficina, posto de combustível, locação e o **checklist operacional de campo** (que funciona como PWA instalável e offline).

## Stack

- **React 19 + TypeScript + Vite 8**
- **react-router-dom 7** (roteamento, com lazy-load por rota)
- **Firebase / Cloud Firestore** — o front conversa direto com o banco (sem backend próprio no fluxo principal)
- **Zustand** — estado global (hooks `use-*`)
- **PWA** via `vite-plugin-pwa` (instalável + offline; persistência offline do Firestore)
- **jsPDF** (PDFs), **tesseract.js** + **pdfjs-dist** (OCR de documentos)
- **Vitest** + **Testing Library** (unit) e **Playwright** (E2E)

## Como rodar

```bash
pnpm install
cp .env.example .env   # preencha as credenciais do Firebase (veja abaixo)
pnpm dev               # ambiente de desenvolvimento (sem service worker)
```

### Variáveis de ambiente (`.env`)

```
VITE_ADMIN_SECRET=...            # senha do painel admin (atenção: vai pro bundle)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> ⚠️ Variáveis `VITE_*` são embutidas no bundle e ficam **visíveis no navegador**. A proteção real do banco são as **Firestore Security Rules**, não essas chaves.

## Scripts

| Script | O que faz |
|--------|-----------|
| `pnpm dev` | Servidor de desenvolvimento (service worker desligado) |
| `pnpm build` | Type-check (`tsc -b`) + build de produção (gera manifest + service worker) |
| `pnpm preview` | Serve o build — **necessário para testar o PWA/offline** |
| `pnpm test` | Testes unitários (Vitest) |
| `pnpm test:watch` | Vitest em watch |
| `pnpm test:e2e` | E2E do PWA (Playwright; sobe build+preview automaticamente) |
| `pnpm lint` | ESLint |

## Estrutura

```
src/
  AppRoutes.tsx          # rotas (lazy-load por área) + ErrorBoundary
  main.tsx               # entrypoint: providers + PWA prompts
  components/            # Sidebar, Pwa (update/offline), ErrorBoundary, ...
  pages/                 # admin, oficina, locacao, posto, prefeitura, checklist, login
  portal/                # subsistema do portal de posto
  lib/
    firebase/firebase.ts # init do Firestore (cache offline + banco "default")
    hu360/               # núcleo de domínio (parte ainda migrando do legado)
  utils/                 # helpers (ex.: hashSenha)
e2e/                     # testes Playwright (PWA)
```

## PWA (foco no operador de checklist)

O app é instalável e funciona offline. O **precache é enxuto, focado no checklist** — admin/prefeitura/posto/oficina/locação **não** entram no precache (carregam sob demanda). Para validar:

```bash
pnpm build && pnpm preview
# DevTools → Application → Service Workers; teste offline; Lighthouse → PWA
```

## Notas importantes

- **Banco Firestore nomeado**: o projeto usa um banco de id `"default"` (não o `(default)` padrão). Por isso `firebase.ts` passa o id explicitamente — sem ele o SDK retorna `5 NOT_FOUND`.
- **Login** usa a coleção `users` (campo `usuario` + `senha` em SHA-256), consultada direto no Firestore.
- O lint reporta avisos herdados do código legado (dívida técnica visível, não bloqueante).

Mais contexto de arquitetura e armadilhas em [`CLAUDE.md`](./CLAUDE.md).
