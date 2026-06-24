# 360 — Detalhe do Posto + Acessos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drawer de detalhe do posto na tela oficinas-postos, com gestão dos acessos/logins daquele posto (criar, listar, resetar senha, remover).

**Architecture:** Reusa a coleção `users` e o hook `useAccess` (Zustand + Firestore direto), estendido com filtro `postoId` e `resetarSenha`. Um drawer (shadcn `Sheet`) aberto da lista (`OficinasPostosSection`) consome esse hook. `prefeituraId` do posto vem de `getDoc(postos/{id})`. UI em Tailwind + shadcn (o `admin.css` é id-escopado e não alcança o portal do Sheet).

**Tech Stack:** Vite + React 19 + TypeScript + Firebase Firestore (client) + Zustand + shadcn/ui + Tailwind. Vitest + Testing Library.

## Global Constraints

- **Workflow do 360 (CLAUDE.md):** trabalhar em **branch**, abrir **PR draft**, **NÃO** mesclar na `main`. Commits curtos **sem assinatura de IA**. Validar `pnpm lint && pnpm test && pnpm build`.
- **Não alterar o backend** nem o cadastro de posto existente.
- **Senha** em **SHA-256** via `hashSenha` (sem sal) — padrão do `users`.
- **Acesso de posto:** doc `users` com `vinculo:"posto"`, `type:"posto"`, `postoId`, `prefeituraId`, `perfil:"gestor"`.
- Estilo do drawer: Tailwind + shadcn (tema admin escuro `#0e1424`/`#090f1f`, acento laranja `#f97316`), no padrão do `WhatsappQrSheet`.
- pt-BR na UI e comentários.

---

## File Structure

| Caminho | Responsabilidade |
|---|---|
| `src/pages/admin/hooks/access/types.ts` (mod) | `listarUsuarios` aceita `postoId`; nova `resetarSenha` na interface. |
| `src/pages/admin/hooks/access/use-access.ts` (mod) | filtro `postoId` em `listarUsuarios`; implementação de `resetarSenha`. |
| `src/pages/admin/hooks/access/use-access.test.ts` (novo) | testes do filtro `postoId` e do `resetarSenha`. |
| `src/pages/admin/sections/PostoDetalheDrawer.tsx` (novo) | drawer de detalhe + acessos (lista/criar/resetar/remover). |
| `src/pages/admin/sections/PostoDetalheDrawer.test.tsx` (novo) | render + criar acesso. |
| `src/pages/admin/sections/OficinasPostosSection.tsx` (mod) | botão "Detalhes / Acesso" no `PostoRow` + estado do drawer. |

---

## Task 0: Branch + verificação do id do posto

**Files:** nenhum (setup + verificação).

- [ ] **Step 1: Criar a branch**

Run: `cd /Users/viniciusaguiar/Development/horautil/360-repository && git checkout -b feat/posto-detalhe-acesso`
Expected: na branch nova.

- [ ] **Step 2: Confirmar que `PostoParceiroApi.id` casa com o doc da coleção `postos`** (o drawer busca `prefeituraId` por `getDoc(postos/{id})`). Com o **back rodando no host** (`localhost:3000`), rode um check rápido no browser/dev OU via curl + leitura. Se o id da overview NÃO for o doc id de `postos`, ajuste o Task 3 (Step de resolver `prefeituraId`) para buscar por outro campo. Critério: `getDoc(doc(db,"postos", <id da overview>))` existe e tem `prefeituraId`.

Run (sanity pelo back): `curl -s http://localhost:3000/parceiros/overview -H "Authorization: Bearer x" | head -c 400 || echo "(rota protegida — validar no app)"`
Expected: lista de postos com `id`. (Se protegida por auth, validar abrindo o app logado; seguir assumindo `id == postos doc id`, com fallback tratado no Task 3.)

---

## Task 1: Estender `use-access` — filtro `postoId` + `resetarSenha`

**Files:**
- Modify: `src/pages/admin/hooks/access/types.ts`, `src/pages/admin/hooks/access/use-access.ts`
- Create: `src/pages/admin/hooks/access/use-access.test.ts`

**Interfaces:**
- Produces:
  - `listarUsuarios(filtros?: { prefeituraId?: string; vinculo?: VinculoUsuario; postoId?: string }): Promise<UsuarioFirestore[]>`
  - `resetarSenha(id: string, novaSenha: string): Promise<AddLocacaoResult>`

- [ ] **Step 1: Atualizar `access/types.ts`** — acrescentar `postoId` ao filtro e `resetarSenha` à interface

```ts
export interface AcessoLoginProps {
  adicionarUsuario: (data: DTOAddUsuario) => Promise<AddLocacaoResult>;
  listarUsuarios: (filtros?: {
    prefeituraId?: string;
    vinculo?: VinculoUsuario;
    postoId?: string;
  }) => Promise<UsuarioFirestore[]>;
  resetarSenha: (id: string, novaSenha: string) => Promise<AddLocacaoResult>;
  removerUsuario: (id: string) => Promise<AddLocacaoResult>;
}
```

- [ ] **Step 2: Teste falho `use-access.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getDocsMock, addDocMock, updateDocMock, whereMock, docMock } = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  addDocMock: vi.fn(),
  updateDocMock: vi.fn(),
  whereMock: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  docMock: vi.fn((_db: unknown, col: string, id: string) => ({ col, id })),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn((_ref: unknown, ...cs: unknown[]) => ({ cs })),
  where: whereMock,
  getDocs: getDocsMock,
  addDoc: addDocMock,
  updateDoc: updateDocMock,
  deleteDoc: vi.fn(),
  doc: docMock,
}));
vi.mock("../../../../lib/firebase/firebase", () => ({ db: {} }));
vi.mock("../../../../utils/hashSenha", () => ({
  hashSenha: vi.fn(async (s: string) => `hash:${s}`),
}));

import { useAccess } from "./use-access";

beforeEach(() => {
  getDocsMock.mockReset();
  addDocMock.mockReset();
  updateDocMock.mockReset();
  whereMock.mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("useAccess.listarUsuarios", () => {
  it("filtra por postoId", async () => {
    getDocsMock.mockResolvedValue({ docs: [{ id: "u1", data: () => ({ usuario: "p01" }) }] });
    const r = await useAccess.getState().listarUsuarios({ postoId: "posto-1" });
    expect(whereMock).toHaveBeenCalledWith("postoId", "==", "posto-1");
    expect(r[0]).toMatchObject({ id: "u1", usuario: "p01" });
  });
});

describe("useAccess.resetarSenha", () => {
  it("rejeita senha curta", async () => {
    const r = await useAccess.getState().resetarSenha("u1", "12");
    expect(r.ok).toBe(false);
    expect(updateDocMock).not.toHaveBeenCalled();
  });
  it("grava o hash da nova senha", async () => {
    const r = await useAccess.getState().resetarSenha("u1", "novaSenha");
    expect(r.ok).toBe(true);
    expect(updateDocMock).toHaveBeenCalledWith({ col: "users", id: "u1" }, { senha: "hash:novaSenha" });
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** — `pnpm vitest run src/pages/admin/hooks/access/use-access.test.ts` → FAIL (`resetarSenha` não existe / filtro postoId ausente).

- [ ] **Step 4: Implementar em `use-access.ts`** — (a) importar `updateDoc`; (b) filtro `postoId`; (c) `resetarSenha`

No import do `firebase/firestore`, acrescentar `updateDoc`:

```ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
```

Em `listarUsuarios`, dentro do bloco de `constraints`, acrescentar:

```ts
    if (filtros?.postoId) {
      constraints.push(where("postoId", "==", filtros.postoId));
    }
```

Acrescentar o método `resetarSenha` ao store (junto dos outros):

```ts
  resetarSenha: async (id, novaSenha) => {
    const senha = novaSenha.trim();
    if (!id) return { ok: false, message: "ID inválido." };
    if (senha.length < 4) {
      return { ok: false, message: "A senha deve ter no mínimo 4 caracteres." };
    }
    const senhaHash = await hashSenha(senha);
    await updateDoc(doc(db, "users", id), { senha: senhaHash });
    return { ok: true, message: "Senha redefinida." };
  },
```

- [ ] **Step 5: Rodar e ver passar** — `pnpm vitest run src/pages/admin/hooks/access/use-access.test.ts` → PASS.

- [ ] **Step 6: Lint + commit**

```bash
pnpm exec eslint src/pages/admin/hooks/access/
git add src/pages/admin/hooks/access/
git commit -m "feat(access): filtro postoId em listarUsuarios + resetarSenha"
```

---

## Task 2: Drawer `PostoDetalheDrawer`

**Files:**
- Create: `src/pages/admin/sections/PostoDetalheDrawer.tsx`, `src/pages/admin/sections/PostoDetalheDrawer.test.tsx`

**Interfaces:**
- Consumes: `useAccess` (`listarUsuarios`/`adicionarUsuario`/`resetarSenha`/`removerUsuario`), `getDoc`/`doc` (firestore), `db`, `PostoParceiroApi`, shadcn `Sheet`/`Button`/`Input`.
- Produces: `PostoDetalheDrawer({ posto, open, onClose })`.

- [ ] **Step 1: Implementar `PostoDetalheDrawer.tsx`**

```tsx
import { useCallback, useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase/firebase";
import { useAccess } from "../hooks/access/use-access";
import type { UsuarioFirestore } from "../hooks/access/types";
import type { PostoParceiroApi } from "../../../lib/api/parceiros";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../../../components/ui/sheet";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

type Msg = { tone: "ok" | "err"; text: string } | null;

export function PostoDetalheDrawer({
  posto,
  open,
  onClose,
}: {
  posto: PostoParceiroApi | null;
  open: boolean;
  onClose: () => void;
}) {
  const { listarUsuarios, adicionarUsuario, resetarSenha, removerUsuario } = useAccess();
  const [prefeituraId, setPrefeituraId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [acessos, setAcessos] = useState<UsuarioFirestore[]>([]);
  const [nome, setNome] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(async (postoId: string) => {
    setAcessos(await listarUsuarios({ postoId }));
  }, [listarUsuarios]);

  useEffect(() => {
    if (!open || !posto) return;
    let ativo = true;
    setMsg(null);
    setNome("");
    setUsuario("");
    setSenha("");
    setCarregando(true);
    void (async () => {
      try {
        const snap = await getDoc(doc(db, "postos", posto.id));
        const pref = snap.exists() ? (snap.data().prefeituraId as string | undefined) : undefined;
        if (!ativo) return;
        setPrefeituraId(pref ?? null);
        await recarregar(posto.id);
      } catch {
        if (ativo) setMsg({ tone: "err", text: "Falha ao carregar o posto." });
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [open, posto, recarregar]);

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault();
    if (!posto) return;
    if (!prefeituraId) {
      setMsg({ tone: "err", text: "Cliente vinculado não identificado para este posto." });
      return;
    }
    setSalvando(true);
    const r = await adicionarUsuario({
      nome,
      usuario,
      senha,
      perfil: "gestor",
      vinculo: "posto",
      postoId: posto.id,
      prefeituraId,
    });
    setMsg({ tone: r.ok ? "ok" : "err", text: r.message });
    if (r.ok) {
      setNome("");
      setUsuario("");
      setSenha("");
      await recarregar(posto.id);
    }
    setSalvando(false);
  }

  async function handleReset(id: string, login: string) {
    const nova = window.prompt(`Nova senha para "${login}" (mín. 4):`);
    if (nova == null) return;
    const r = await resetarSenha(id, nova);
    setMsg({ tone: r.ok ? "ok" : "err", text: r.message });
  }

  async function handleRemover(id: string, login: string) {
    if (!posto) return;
    if (!window.confirm(`Remover o acesso "${login}"?`)) return;
    const r = await removerUsuario(id);
    setMsg({ tone: r.ok ? "ok" : "err", text: r.message });
    if (r.ok) await recarregar(posto.id);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto border-white/10 bg-[#0e1424] text-slate-100 sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle className="text-slate-100">{posto?.nome ?? "Posto"}</SheetTitle>
          <SheetDescription className="text-slate-400">
            {[posto?.cidadeUf, posto?.bandeira].filter(Boolean).join(" · ") || "Detalhes e acessos"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <Linha rotulo="Razão social" valor={posto?.razaoSocial} />
            <Linha rotulo="Cidade/UF" valor={posto?.cidadeUf} />
            <Linha rotulo="Bandeira" valor={posto?.bandeira} />
            <Linha rotulo="Status" valor={posto?.ativo ? "Ativo" : "Suspenso"} />
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Acessos do posto
            </h3>
            {carregando ? (
              <p className="text-sm text-slate-400">Carregando…</p>
            ) : acessos.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum acesso ainda.</p>
            ) : (
              <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
                {acessos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.usuario}</p>
                      <p className="truncate text-xs text-slate-400">{a.nome}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="xs" variant="secondary" onClick={() => handleReset(a.id, a.usuario)}>
                        Resetar senha
                      </Button>
                      <Button size="xs" variant="destructive" onClick={() => handleRemover(a.id, a.usuario)}>
                        Remover
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form onSubmit={handleCriar} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Novo acesso
            </h3>
            <Input placeholder="Nome do operador" value={nome} onChange={(e) => setNome(e.target.value)} required />
            <Input placeholder="Usuário (login do caixa)" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
            <Input type="password" placeholder="Senha (mín. 4)" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            {msg ? (
              <p className={`text-sm ${msg.tone === "ok" ? "text-emerald-400" : "text-red-400"}`} role="status">
                {msg.text}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full bg-[#f97316] text-black hover:bg-[#f97316]/90"
              disabled={salvando}
            >
              {salvando ? "Salvando…" : "Criar acesso"}
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor?: string }) {
  if (!valor) return null;
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-slate-400">{rotulo}</span>
      <span className="text-right font-medium">{valor}</span>
    </div>
  );
}
```

- [ ] **Step 2: Teste `PostoDetalheDrawer.test.tsx`**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const adicionarUsuario = vi.fn(async () => ({ ok: true, message: "ok" }));
const listarUsuarios = vi.fn(async () => []);
const resetarSenha = vi.fn(async () => ({ ok: true, message: "ok" }));
const removerUsuario = vi.fn(async () => ({ ok: true, message: "ok" }));

vi.mock("../hooks/access/use-access", () => ({
  useAccess: () => ({ adicionarUsuario, listarUsuarios, resetarSenha, removerUsuario }),
}));
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => ({ exists: () => true, data: () => ({ prefeituraId: "pref-1" }) })),
}));
vi.mock("../../../lib/firebase/firebase", () => ({ db: {} }));

import { PostoDetalheDrawer } from "./PostoDetalheDrawer";

const posto = {
  id: "posto-1",
  nome: "Posto Teste",
  razaoSocial: "Teste LTDA",
  cidadeUf: "São Paulo/SP",
  bandeira: "Ipiranga",
  condicaoPagamento: "",
  limiteCredito: 0,
  ativo: true,
};

describe("PostoDetalheDrawer", () => {
  it("mostra o posto e cria um acesso", async () => {
    render(<PostoDetalheDrawer posto={posto} open onClose={() => {}} />);
    expect(await screen.findByText("Posto Teste")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nome do operador"), { target: { value: "Caixa 1" } });
    fireEvent.change(screen.getByPlaceholderText("Usuário (login do caixa)"), { target: { value: "posto1caixa" } });
    fireEvent.change(screen.getByPlaceholderText("Senha (mín. 4)"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar acesso" }));

    await waitFor(() =>
      expect(adicionarUsuario).toHaveBeenCalledWith(
        expect.objectContaining({ usuario: "posto1caixa", vinculo: "posto", postoId: "posto-1", prefeituraId: "pref-1" }),
      ),
    );
  });
});
```

- [ ] **Step 3: Rodar e ver passar** — `pnpm vitest run src/pages/admin/sections/PostoDetalheDrawer.test.tsx` → PASS. (Se faltar `@testing-library/jest-dom`/`render`, usar o mesmo setup dos testes de componente existentes — ver `src/test/setup.ts`.)

- [ ] **Step 4: Lint + commit**

```bash
pnpm exec eslint src/pages/admin/sections/PostoDetalheDrawer.tsx
git add src/pages/admin/sections/PostoDetalheDrawer.tsx src/pages/admin/sections/PostoDetalheDrawer.test.tsx
git commit -m "feat(postos): drawer de detalhe do posto com acessos (criar/listar/resetar/remover)"
```

---

## Task 3: Ligar o drawer na lista (`OficinasPostosSection`)

**Files:**
- Modify: `src/pages/admin/sections/OficinasPostosSection.tsx`

**Interfaces:**
- Consumes: `PostoDetalheDrawer`, `PostoParceiroApi`.

- [ ] **Step 1: Importar o drawer + `useState` para o posto selecionado**

No topo, ajustar imports:

```tsx
import { useEffect, useState } from "react";
import {
  parceirosApi,
  type OficinaParceiroApi,
  type ParceirosOverviewApi,
  type PostoParceiroApi,
} from "../../../lib/api/parceiros";
import { CadastroParceiroSection } from "./CadastroParceiroSection";
import { PostoDetalheDrawer } from "./PostoDetalheDrawer";
```

- [ ] **Step 2: `PostoRow` recebe um `onAbrir`** e ganha o botão "Detalhes / Acesso"

Substituir o componente `PostoRow`:

```tsx
function PostoRow({ posto, onAbrir }: { posto: PostoParceiroApi; onAbrir: (p: PostoParceiroApi) => void }) {
  const sub = [posto.cidadeUf, posto.bandeira].filter(Boolean).join(" · ");
  return (
    <div className="parc-row">
      <div className="parc-row__info">
        <div className="parc-row__nome">{posto.nome}</div>
        {sub && <div className="parc-row__sub">{sub}</div>}
      </div>
      <div className="parc-row__status" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <StatusBadge ativo={posto.ativo} />
        <button type="button" className="btn-text" onClick={() => onAbrir(posto)}>
          Detalhes / Acesso
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Estado do drawer + render** — dentro de `OficinasPostosSection`, no `modo === "overview"`

Acrescentar o estado (junto dos outros `useState`):

```tsx
  const [postoSel, setPostoSel] = useState<PostoParceiroApi | null>(null);
```

Passar `onAbrir` para o `PostoRow`:

```tsx
            dados.postos.map((p) => (
              <PostoRow key={p.id} posto={p} onAbrir={setPostoSel} />
            ))
```

Renderizar o drawer antes do `</section>` final (depois do botão "+ Cadastrar novo parceiro"):

```tsx
      <PostoDetalheDrawer
        posto={postoSel}
        open={postoSel !== null}
        onClose={() => setPostoSel(null)}
      />
```

- [ ] **Step 4: Lint + build**

Run: `pnpm exec eslint src/pages/admin/sections/OficinasPostosSection.tsx && pnpm build`
Expected: lint limpo; build conclui.

- [ ] **Step 5: Validar no app (manual)** — `pnpm dev`, logar no admin (`vinicius@admin.com`/`1234`), ir em **Oficinas e Postos**, abrir um posto pelo "Detalhes / Acesso", criar um acesso (ex.: `posto1caixa`/`1234`), conferir que aparece na lista; testar reset e remover.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/sections/OficinasPostosSection.tsx
git commit -m "feat(postos): botão Detalhes/Acesso abrindo o drawer na lista"
```

---

## Task 4: Verificação final + PR draft

**Files:** nenhum (verificação + entrega).

- [ ] **Step 1: Verificação completa**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: lint limpo; testes PASS; build conclui.

- [ ] **Step 2: Commitar a spec/plano** (docs)

```bash
git add docs/superpowers/
git commit -m "docs: spec e plano do detalhe/acesso do posto"
```

- [ ] **Step 3: Push da branch + PR draft**

```bash
git push -u origin feat/posto-detalhe-acesso
gh pr create --draft --title "feat: detalhe do posto + acessos/logins" \
  --body "Drawer de detalhe do posto na tela oficinas-postos com gestão de acessos (criar/listar/resetar/remover) na coleção users (vinculo posto). Não mescla na main — revisão do dono."
```

Expected: PR draft criado. **NÃO mesclar** (o dono do projeto mescla).

---

## Self-Review

**1. Cobertura da spec:**
- Botão "Detalhes / Acesso" + drawer → Tasks 2, 3. ✓
- Criar acesso (vinculo posto, postoId, prefeituraId, hash, dup, senha≥4) → Task 2 (reusa `adicionarUsuario`). ✓
- Listar por postoId → Task 1 (filtro) + Task 2. ✓
- Resetar senha → Task 1 (`resetarSenha`) + Task 2. ✓
- Remover acesso → Task 2 (reusa `removerUsuario`). ✓
- prefeituraId via `getDoc(postos/{id})` + fallback → Task 2 (Step 1) + Task 0 (verificação). ✓
- Estilo Tailwind/shadcn → Task 2. ✓
- Testes unit + component → Tasks 1, 2. ✓
- Branch + PR draft, sem merge → Tasks 0, 4. ✓

**2. Placeholders:** nenhum TBD/TODO; código completo em cada passo.

**3. Consistência de tipos:** `listarUsuarios({postoId})`/`resetarSenha(id,nova)` definidos (Task 1) e consumidos no drawer (Task 2); `adicionarUsuario(DTOAddUsuario)` com `perfil:"gestor"`, `vinculo:"posto"`, `postoId`, `prefeituraId` bate com `DTOAddUsuario`; `PostoParceiroApi` (id/nome/razaoSocial/cidadeUf/bandeira/ativo) consistente entre lista e drawer. ✓

**Notas de execução:**
- O `getDoc(postos/{id})` assume `PostoParceiroApi.id == postos doc id` — confirmado no Task 0; se divergir, ajustar a resolução de `prefeituraId` (o resto do drawer não muda).
- `Button size="xs"` e variantes `secondary`/`destructive` existem no `components/ui/button` do 360 (confirmado no mapa do design system).
- Se o teste de componente exigir `@testing-library/jest-dom`, seguir o `src/test/setup.ts` existente (já configurado no `vitest.config.ts`).
