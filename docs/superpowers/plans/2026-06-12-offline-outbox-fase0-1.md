# Offline outbox — Fases 0 e 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Idempotência no backend (Fase 0) + outbox em IndexedDB substituindo a fila localStorage do ponto (Fase 1), conforme a spec `docs/superpowers/specs/2026-06-12-offline-outbox-design.md`.

**Architecture:** No back, um interceptor NestJS lê o header `Idempotency-Key` e garante que reenvios não dupliquem registros (chaves em coleção Firestore). No front, nasce `src/lib/offline/` (Dexie sobre IndexedDB): `sync_queue` + motor com retry/backoff e classificação de erro transitório vs definitivo. `pontos-fila.ts` vira fachada sobre o outbox, mantendo a API pública (`baterComFila`/`sincronizar`/`pendentes`) para não tocar nas telas.

**Tech Stack:** NestJS 11 + Jest (back) · React 19 + Vite + Dexie 4 + Vitest + fake-indexeddb (front).

**Repos/branches:**
- Back: `back-360-/` (repo git próprio) — branch nova `feat/idempotencia-ponto`, PR draft próprio.
- Front: branch `docs/spec-offline-first` (PR #70), commits diretos.

---

## Fase 0 — Idempotência no back

### Task 1: Teste do interceptor de idempotência

**Files:**
- Create: `back-360-/src/common/idempotency.interceptor.spec.ts`

- [ ] **Step 1: Criar a branch no repo do back**

```bash
cd back-360- && git checkout main && git pull && git checkout -b feat/idempotencia-ponto
```

- [ ] **Step 2: Escrever o teste que falha**

```ts
// back-360-/src/common/idempotency.interceptor.spec.ts
import { ConflictException } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import type { FirebaseService } from '../config/firebase.service';

function ctxCom(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

function firebaseMock() {
  const doc = {
    create: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const firebase = {
    getFirestore: () => ({ collection: () => ({ doc: () => doc }) }),
  } as unknown as FirebaseService;
  return { firebase, doc };
}

describe('IdempotencyInterceptor', () => {
  it('sem header, passa direto sem tocar o Firestore', async () => {
    const { firebase, doc } = firebaseMock();
    const interceptor = new IdempotencyInterceptor(firebase);
    const next: CallHandler = { handle: () => of({ data: 1 }) };
    const r = await lastValueFrom(interceptor.intercept(ctxCom({}), next));
    expect(r).toEqual({ data: 1 });
    expect(doc.create).not.toHaveBeenCalled();
  });

  it('primeira chamada executa o handler e grava a resposta', async () => {
    const { firebase, doc } = firebaseMock();
    const interceptor = new IdempotencyInterceptor(firebase);
    const next: CallHandler = { handle: () => of({ data: 'novo' }) };
    const r = await lastValueFrom(
      interceptor.intercept(ctxCom({ 'idempotency-key': 'abc' }), next),
    );
    expect(r).toEqual({ data: 'novo' });
    expect(doc.create).toHaveBeenCalled();
    expect(doc.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'concluido', resposta: { data: 'novo' } }),
      { merge: true },
    );
  });

  it('chave repetida concluída devolve a resposta gravada sem reexecutar', async () => {
    const { firebase, doc } = firebaseMock();
    doc.create.mockRejectedValue(new Error('ALREADY_EXISTS'));
    doc.get.mockResolvedValue({
      data: () => ({ status: 'concluido', resposta: { data: 'anterior' } }),
    });
    const interceptor = new IdempotencyInterceptor(firebase);
    const handle = jest.fn(() => of({ data: 'nao-deveria' }));
    const r = await lastValueFrom(
      interceptor.intercept(ctxCom({ 'idempotency-key': 'abc' }), { handle }),
    );
    expect(r).toEqual({ data: 'anterior' });
    expect(handle).not.toHaveBeenCalled();
  });

  it('chave repetida ainda em processamento responde 409', async () => {
    const { firebase, doc } = firebaseMock();
    doc.create.mockRejectedValue(new Error('ALREADY_EXISTS'));
    doc.get.mockResolvedValue({ data: () => ({ status: 'processando' }) });
    const interceptor = new IdempotencyInterceptor(firebase);
    await expect(
      lastValueFrom(
        interceptor.intercept(ctxCom({ 'idempotency-key': 'abc' }), {
          handle: () => of({}),
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('falha do handler libera a chave e propaga o erro', async () => {
    const { firebase, doc } = firebaseMock();
    const interceptor = new IdempotencyInterceptor(firebase);
    const next: CallHandler = { handle: () => throwError(() => new Error('boom')) };
    await expect(
      lastValueFrom(
        interceptor.intercept(ctxCom({ 'idempotency-key': 'abc' }), next),
      ),
    ).rejects.toThrow('boom');
    expect(doc.delete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd back-360- && npx jest src/common/idempotency.interceptor.spec.ts`
Expected: FAIL — `Cannot find module './idempotency.interceptor'`

### Task 2: Implementar o interceptor

**Files:**
- Create: `back-360-/src/common/idempotency.interceptor.ts`

- [ ] **Step 1: Implementação**

```ts
// back-360-/src/common/idempotency.interceptor.ts
import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { from, lastValueFrom, Observable } from 'rxjs';
import { FirebaseService } from '../config/firebase.service';

/**
 * Idempotência para escritas do operador offline (spec offline-outbox).
 * O front gera um uuid por registro e o manda no header `Idempotency-Key`;
 * reenvio (retry do outbox) com a mesma chave devolve a resposta gravada em
 * vez de duplicar. A "reserva" da chave usa `create()` (falha se já existe),
 * o que fecha a corrida entre dois reenvios simultâneos.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private firebase: FirebaseService) {}

  private doc(chave: string) {
    return this.firebase
      .getFirestore()
      .collection('idempotencyKeys')
      .doc(chave);
  }

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const chave = req.headers['idempotency-key'];
    if (!chave || typeof chave !== 'string') return next.handle();
    return from(this.executar(chave, next));
  }

  private async executar(chave: string, next: CallHandler): Promise<unknown> {
    const ref = this.doc(chave);
    try {
      await ref.create({
        status: 'processando',
        criadoEm: new Date().toISOString(),
        // Campo para política de TTL do Firestore (limpeza de chaves velhas).
        expiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    } catch {
      const snap = await ref.get();
      const dados = snap.data() as
        | { status?: string; resposta?: unknown }
        | undefined;
      if (dados?.status === 'concluido') return dados.resposta;
      throw new ConflictException(
        'Requisição idêntica em processamento — tente novamente.',
      );
    }
    try {
      const resposta = await lastValueFrom(next.handle());
      await ref.set(
        { status: 'concluido', resposta: resposta ?? null },
        { merge: true },
      );
      return resposta;
    } catch (e) {
      // Libera a chave: o cliente pode tentar de novo e aí executar de fato.
      await ref.delete().catch(() => undefined);
      throw e;
    }
  }
}
```

- [ ] **Step 2: Rodar o teste e confirmar que passa**

Run: `cd back-360- && npx jest src/common/idempotency.interceptor.spec.ts`
Expected: PASS (5 testes)

- [ ] **Step 3: Commit**

```bash
cd back-360- && git add src/common && git commit -m "feat(idempotencia): interceptor com chave Idempotency-Key"
```

### Task 3: Aplicar no POST /time-records e abrir PR do back

**Files:**
- Modify: `back-360-/src/modules/time-records/time-records.controller.ts:71-79`
- Modify: `back-360-/src/modules/time-records/time-records.module.ts`

- [ ] **Step 1: Registrar o interceptor no módulo**

Em `time-records.module.ts`, adicionar o import e o provider:

```ts
import { IdempotencyInterceptor } from '../../common/idempotency.interceptor';
// ...
providers: [
  TimeRecordsService,
  AfdService,
  AejService,
  FirebaseService,
  IdempotencyInterceptor,
],
```

- [ ] **Step 2: Aplicar na rota de criação**

Em `time-records.controller.ts`, adicionar `UseInterceptors` ao import de `@nestjs/common`, importar o interceptor e decorar o `create`:

```ts
import { IdempotencyInterceptor } from '../../common/idempotency.interceptor';
// ...
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Registrar uma batida de ponto (com foto)' })
```

- [ ] **Step 3: Rodar a suíte inteira e o lint (sem --fix!)**

Run: `cd back-360- && npx jest && npx eslint "src/**/*.ts"`
Expected: todos os testes passam; lint sem erros novos

- [ ] **Step 4: Commit, push e PR draft no repo do back**

```bash
cd back-360- && git add -A && git commit -m "feat(ponto): idempotencia no POST /time-records"
git push -u origin feat/idempotencia-ponto
gh pr create --draft --title "feat: idempotência no registro de ponto (Fase 0 do offline outbox)" --body "Fase 0 da spec offline-outbox (360-repository#70): interceptor que lê Idempotency-Key e impede duplicação em retry do outbox. Chaves em idempotencyKeys com expiraEm p/ TTL."
```

---

## Fase 1 — Outbox no front + migração do ponto

### Task 4: Dependências

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar**

```bash
cd /Users/viniciusaguiar/Development/360-repository
pnpm add dexie && pnpm add -D fake-indexeddb
```

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml && git commit -m "chore: dexie + fake-indexeddb (outbox offline)"
```

### Task 5: Schema (db.ts) e operações do outbox

**Files:**
- Create: `src/lib/offline/db.ts`
- Create: `src/lib/offline/outbox.ts`
- Test: `src/lib/offline/outbox.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/offline/outbox.test.ts
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { offlineDb } from "./db";
import {
  contarPendentes,
  concluir,
  enfileirar,
  listarDevidos,
  marcarAtencao,
  registrarFalha,
} from "./outbox";

afterEach(async () => {
  await offlineDb.sync_queue.clear();
});

describe("outbox", () => {
  it("enfileira com status PENDING e id próprio", async () => {
    const item = await enfileirar("ponto", { a: 1 });
    expect(item.status).toBe("PENDING");
    expect(item.id).toBeTruthy();
    expect(await contarPendentes("ponto")).toBe(1);
  });

  it("aceita id externo (chave de idempotência preservada)", async () => {
    const item = await enfileirar("ponto", { a: 1 }, "id-fixo");
    expect(item.id).toBe("id-fixo");
  });

  it("listarDevidos respeita a ordem de criação e o backoff", async () => {
    const a = await enfileirar("ponto", { n: 1 });
    const b = await enfileirar("ponto", { n: 2 });
    expect((await listarDevidos()).map((i) => i.id)).toEqual([a.id, b.id]);
    await registrarFalha(a.id, "rede caiu");
    // `a` entra em backoff (proximaTentativaEm no futuro) — só `b` está devido.
    expect((await listarDevidos()).map((i) => i.id)).toEqual([b.id]);
    // Num futuro além do backoff, `a` volta a ficar devido.
    const depois = new Date(Date.now() + 60 * 60_000);
    expect((await listarDevidos(depois)).length).toBe(2);
  });

  it("registrarFalha incrementa retryCount e guarda o motivo", async () => {
    const a = await enfileirar("ponto", {});
    await registrarFalha(a.id, "timeout");
    const salvo = await offlineDb.sync_queue.get(a.id);
    expect(salvo?.retryCount).toBe(1);
    expect(salvo?.lastError).toBe("timeout");
    expect(salvo?.status).toBe("PENDING");
  });

  it("marcarAtencao tira da fila de envio mas mantém visível", async () => {
    const a = await enfileirar("ponto", {});
    await marcarAtencao(a.id, "payload inválido");
    expect(await listarDevidos()).toEqual([]);
    expect(await contarPendentes("ponto")).toBe(1);
    expect((await offlineDb.sync_queue.get(a.id))?.status).toBe("NEEDS_ATTENTION");
  });

  it("concluir remove o item", async () => {
    const a = await enfileirar("ponto", {});
    await concluir(a.id);
    expect(await contarPendentes()).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm vitest run src/lib/offline/outbox.test.ts`
Expected: FAIL — módulos `./db` e `./outbox` não existem

- [ ] **Step 3: Implementar db.ts**

```ts
// src/lib/offline/db.ts
/**
 * Banco offline do operador (IndexedDB via Dexie) — spec offline-outbox.
 * `sync_queue` guarda toda escrita feita no campo até o servidor confirmar.
 * Item SYNCED é removido (não há status SYNCED persistido).
 */
import Dexie, { type Table } from "dexie";

export type StatusOutbox = "PENDING" | "SENDING" | "NEEDS_ATTENTION";

export interface ItemOutbox {
  /** uuid gerado no aparelho — vai ao servidor como Idempotency-Key. */
  id: string;
  entity: string;
  action: "create";
  payload: unknown;
  status: StatusOutbox;
  createdAt: string;
  retryCount: number;
  /** Instante a partir do qual pode tentar de novo (backoff exponencial). */
  proximaTentativaEm: string;
  lastError?: string;
}

class OfflineDb extends Dexie {
  sync_queue!: Table<ItemOutbox, string>;

  constructor() {
    super("hu360-offline");
    this.version(1).stores({
      sync_queue: "id, status, entity, createdAt",
    });
  }
}

export const offlineDb = new OfflineDb();
```

- [ ] **Step 4: Implementar outbox.ts**

```ts
// src/lib/offline/outbox.ts
/** Operações da fila de escritas offline (ver db.ts e a spec offline-outbox). */
import { offlineDb, type ItemOutbox } from "./db";

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 30 * 60_000;

/**
 * Timestamp estritamente crescente: duas batidas no mesmo milissegundo não
 * podem embaralhar a ordem de envio (o ledger do ponto é sequencial — NSR).
 */
let ultimoTs = 0;
function agoraMonotonico(): string {
  const t = Math.max(Date.now(), ultimoTs + 1);
  ultimoTs = t;
  return new Date(t).toISOString();
}

export async function enfileirar(
  entity: string,
  payload: unknown,
  id: string = crypto.randomUUID(),
): Promise<ItemOutbox> {
  const agora = agoraMonotonico();
  const item: ItemOutbox = {
    id,
    entity,
    action: "create",
    payload,
    status: "PENDING",
    createdAt: agora,
    retryCount: 0,
    proximaTentativaEm: agora,
  };
  await offlineDb.sync_queue.put(item);
  return item;
}

/** Itens prontos para envio (PENDING e fora do backoff), em ordem de criação. */
export async function listarDevidos(agora = new Date()): Promise<ItemOutbox[]> {
  const fila = await offlineDb.sync_queue
    .where("status")
    .equals("PENDING")
    .sortBy("createdAt");
  const limite = agora.toISOString();
  return fila.filter((i) => i.proximaTentativaEm <= limite);
}

/** Conta tudo que ainda não foi confirmado (inclui NEEDS_ATTENTION). */
export async function contarPendentes(entity?: string): Promise<number> {
  const todos = await offlineDb.sync_queue.toArray();
  return entity ? todos.filter((i) => i.entity === entity).length : todos.length;
}

export async function marcarEnviando(id: string): Promise<void> {
  await offlineDb.sync_queue.update(id, { status: "SENDING" });
}

/** Servidor confirmou — sai da fila. */
export async function concluir(id: string): Promise<void> {
  await offlineDb.sync_queue.delete(id);
}

/** Erro definitivo (validação): sai do envio automático, fica visível. */
export async function marcarAtencao(id: string, erro: string): Promise<void> {
  await offlineDb.sync_queue.update(id, {
    status: "NEEDS_ATTENTION",
    lastError: erro,
  });
}

/** Erro transitório: volta a PENDING com backoff exponencial. */
export async function registrarFalha(id: string, erro: string): Promise<void> {
  const item = await offlineDb.sync_queue.get(id);
  if (!item) return;
  const retryCount = item.retryCount + 1;
  const espera = Math.min(BACKOFF_BASE_MS * 2 ** (retryCount - 1), BACKOFF_MAX_MS);
  await offlineDb.sync_queue.update(id, {
    status: "PENDING",
    retryCount,
    lastError: erro,
    proximaTentativaEm: new Date(Date.now() + espera).toISOString(),
  });
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `pnpm vitest run src/lib/offline/outbox.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 6: Commit**

```bash
git add src/lib/offline && git commit -m "feat(offline): sync_queue em IndexedDB (Dexie) com backoff"
```

### Task 6: Motor de sincronização

**Files:**
- Create: `src/lib/offline/motor.ts`
- Test: `src/lib/offline/motor.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/offline/motor.test.ts
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { offlineDb } from "./db";
import { contarPendentes, enfileirar } from "./outbox";
import { processarFila, registrarEnviador } from "./motor";

function setOnline(v: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value: v,
    configurable: true,
  });
}

afterEach(async () => {
  await offlineDb.sync_queue.clear();
  setOnline(true);
});

describe("processarFila", () => {
  it("envia os itens devidos e remove da fila", async () => {
    const enviar = vi.fn().mockResolvedValue(undefined);
    registrarEnviador("teste-ok", enviar);
    await enfileirar("teste-ok", { n: 1 });
    await enfileirar("teste-ok", { n: 2 });
    const r = await processarFila();
    expect(r.enviados).toBe(2);
    expect(enviar).toHaveBeenCalledTimes(2);
    expect(await contarPendentes()).toBe(0);
  });

  it("offline não tenta nada", async () => {
    setOnline(false);
    const enviar = vi.fn();
    registrarEnviador("teste-off", enviar);
    await enfileirar("teste-off", {});
    const r = await processarFila();
    expect(r).toEqual({ enviados: 0, falhas: 0 });
    expect(enviar).not.toHaveBeenCalled();
  });

  it("erro transitório (rede/5xx) mantém PENDING com backoff", async () => {
    registrarEnviador("teste-5xx", vi.fn().mockRejectedValue(new ApiError(500, "erro")));
    const item = await enfileirar("teste-5xx", {});
    const r = await processarFila();
    expect(r.falhas).toBe(1);
    const salvo = await offlineDb.sync_queue.get(item.id);
    expect(salvo?.status).toBe("PENDING");
    expect(salvo?.retryCount).toBe(1);
  });

  it("erro definitivo (4xx) vira NEEDS_ATTENTION — nunca descarta", async () => {
    registrarEnviador("teste-4xx", vi.fn().mockRejectedValue(new ApiError(400, "inválido")));
    const item = await enfileirar("teste-4xx", {});
    await processarFila();
    const salvo = await offlineDb.sync_queue.get(item.id);
    expect(salvo?.status).toBe("NEEDS_ATTENTION");
    expect(salvo?.lastError).toBe("inválido");
  });

  it("entidade sem enviador registrado fica na fila", async () => {
    await enfileirar("desconhecida", {});
    const r = await processarFila();
    expect(r).toEqual({ enviados: 0, falhas: 0 });
    expect(await contarPendentes()).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm vitest run src/lib/offline/motor.test.ts`
Expected: FAIL — `./motor` não existe

- [ ] **Step 3: Implementar motor.ts**

```ts
// src/lib/offline/motor.ts
/**
 * Motor de sincronização do outbox: percorre os itens devidos, envia pelo
 * enviador registrado da entidade e classifica falhas — transitória (rede,
 * 5xx, 408, 429) volta pra fila com backoff; definitiva (4xx de validação)
 * vira NEEDS_ATTENTION, visível para o operador. Nada é descartado.
 */
import { ApiError } from "../api/client";
import type { ItemOutbox } from "./db";
import {
  concluir,
  listarDevidos,
  marcarAtencao,
  marcarEnviando,
  registrarFalha,
} from "./outbox";

export type Enviador = (item: ItemOutbox) => Promise<void>;

const enviadores = new Map<string, Enviador>();

export function registrarEnviador(entity: string, enviar: Enviador): void {
  enviadores.set(entity, enviar);
}

function erroDefinitivo(e: unknown): boolean {
  return (
    e instanceof ApiError &&
    e.status >= 400 &&
    e.status < 500 &&
    e.status !== 408 &&
    e.status !== 429
  );
}

export async function processarFila(): Promise<{
  enviados: number;
  falhas: number;
}> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { enviados: 0, falhas: 0 };
  }
  let enviados = 0;
  let falhas = 0;
  for (const item of await listarDevidos()) {
    const enviar = enviadores.get(item.entity);
    if (!enviar) continue;
    await marcarEnviando(item.id);
    try {
      await enviar(item);
      await concluir(item.id);
      enviados++;
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      if (erroDefinitivo(e)) await marcarAtencao(item.id, motivo);
      else await registrarFalha(item.id, motivo);
      falhas++;
    }
  }
  return { enviados, falhas };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm vitest run src/lib/offline/motor.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline/motor.ts src/lib/offline/motor.test.ts
git commit -m "feat(offline): motor de sincronização com retry e NEEDS_ATTENTION"
```

### Task 7: Header Idempotency-Key no client e na API de ponto

**Files:**
- Modify: `src/lib/api/client.ts:20-57`
- Modify: `src/lib/api/pontos.ts:89-93`

- [ ] **Step 1: client.ts — aceitar headers extras no POST**

Substituir `request` e `api.post`:

```ts
type Opcoes = { headers?: Record<string, string> };

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: Opcoes,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body != null ? { "Content-Type": "application/json" } : {}),
      ...opts?.headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  // ... (tratamento de erro/JSON permanece idêntico)
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown, opts?: Opcoes) =>
    request<T>("POST", path, body, opts),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
```

- [ ] **Step 2: pontos.ts — `bater` com chave opcional**

```ts
async bater(
  input: BaterPontoInput,
  idempotencyKey?: string,
): Promise<PontoRegistro> {
  const r = await api.post<RespostaCriar>(
    "/time-records",
    input,
    idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined,
  );
  return r.data;
},
```

- [ ] **Step 3: Garantir que nada quebrou**

Run: `pnpm vitest run src/lib/api && pnpm tsc -b --noEmit 2>/dev/null || npx tsc -p tsconfig.app.json --noEmit`
Expected: testes existentes de `src/lib/api` passam; sem erro de tipo

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/client.ts src/lib/api/pontos.ts
git commit -m "feat(api): Idempotency-Key opcional no POST de ponto"
```

### Task 8: Migração da fila legada (localStorage → outbox)

**Files:**
- Create: `src/lib/offline/migrar-fila-ponto.ts`
- Test: `src/lib/offline/migrar-fila-ponto.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/offline/migrar-fila-ponto.test.ts
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { offlineDb } from "./db";
import { contarPendentes } from "./outbox";
import { migrarFilaLegadaPonto } from "./migrar-fila-ponto";

afterEach(async () => {
  await offlineDb.sync_queue.clear();
  localStorage.clear();
});

describe("migrarFilaLegadaPonto", () => {
  it("importa as batidas da fila localStorage e limpa a chave", async () => {
    localStorage.setItem(
      "hu360-ponto-fila",
      JSON.stringify([{ name: "Ana", tipo: "entrada" }, { name: "Ana", tipo: "saida" }]),
    );
    const n = await migrarFilaLegadaPonto();
    expect(n).toBe(2);
    expect(await contarPendentes("ponto")).toBe(2);
    expect(localStorage.getItem("hu360-ponto-fila")).toBeNull();
  });

  it("sem fila legada não faz nada", async () => {
    expect(await migrarFilaLegadaPonto()).toBe(0);
    expect(await contarPendentes()).toBe(0);
  });

  it("fila corrompida não explode", async () => {
    localStorage.setItem("hu360-ponto-fila", "{lixo");
    expect(await migrarFilaLegadaPonto()).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm vitest run src/lib/offline/migrar-fila-ponto.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implementar**

```ts
// src/lib/offline/migrar-fila-ponto.ts
/**
 * Migração única: aparelhos em campo podem ter batidas pendentes na fila
 * legada (localStorage `hu360-ponto-fila`). No primeiro boot da versão nova,
 * importamos tudo para o outbox e removemos a chave — sem perda.
 */
import type { BaterPontoInput } from "../api/pontos";
import { enfileirar } from "./outbox";

const CHAVE_LEGADA = "hu360-ponto-fila";

export async function migrarFilaLegadaPonto(): Promise<number> {
  let fila: BaterPontoInput[] = [];
  try {
    const raw = localStorage.getItem(CHAVE_LEGADA);
    if (!raw) return 0;
    fila = JSON.parse(raw) as BaterPontoInput[];
  } catch {
    return 0;
  }
  for (const batida of fila) {
    await enfileirar("ponto", batida);
  }
  try {
    localStorage.removeItem(CHAVE_LEGADA);
  } catch {
    /* sem acesso ao storage — tenta de novo no próximo boot */
  }
  return fila.length;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `pnpm vitest run src/lib/offline/migrar-fila-ponto.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline/migrar-fila-ponto.ts src/lib/offline/migrar-fila-ponto.test.ts
git commit -m "feat(offline): migra fila legada do ponto para o outbox"
```

### Task 9: pontos-fila sobre o outbox + gatilho periódico

**Files:**
- Modify: `src/lib/api/pontos-fila.ts` (reescrita completa)
- Modify: `src/lib/api/pontos-fila.test.ts` (reescrita completa)
- Modify: `src/pages/checklist-controle/usePontoSync.ts`

A API pública mantém os nomes (`baterComFila`, `sincronizar`, `pendentes`) — `PontoPage.tsx`, `PontosFolha.tsx` e `sincronizar-tudo.ts` não mudam. Única quebra: `pendentes()` passa a ser async (só `usePontoSync` consome).

- [ ] **Step 1: Reescrever o teste**

```ts
// src/lib/api/pontos-fila.test.ts
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pontos", () => ({
  pontosApi: { bater: vi.fn() },
}));

import { ApiError } from "./client";
import { pontosApi, type BaterPontoInput } from "./pontos";
import { offlineDb } from "../offline/db";
import { baterComFila, pendentes, sincronizar } from "./pontos-fila";

const bater = vi.mocked(pontosApi.bater);

const input = {
  name: "Ana",
  photo: "data:,x",
  prefeituraId: "p1",
  timestampOriginal: "2026-06-12T08:00:00Z",
  tipo: "entrada",
} as BaterPontoInput;

function setOnline(v: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    value: v,
    configurable: true,
  });
}

beforeEach(() => {
  bater.mockReset();
  setOnline(true);
});

afterEach(async () => {
  await offlineDb.sync_queue.clear();
  localStorage.clear();
});

describe("baterComFila (outbox)", () => {
  it("online envia direto com chave de idempotência e devolve o registro", async () => {
    bater.mockResolvedValue({ id: "r1", nsr: 7 } as never);
    const r = await baterComFila(input);
    expect(r.sincronizado).toBe(true);
    expect(r.registro).toMatchObject({ nsr: 7 });
    expect(bater).toHaveBeenCalledWith(input, expect.any(String));
    expect(await pendentes()).toBe(0);
  });

  it("offline enfileira sem chamar a API", async () => {
    setOnline(false);
    const r = await baterComFila(input);
    expect(r.sincronizado).toBe(false);
    expect(bater).not.toHaveBeenCalled();
    expect(await pendentes()).toBe(1);
  });

  it("falha de rede enfileira com a MESMA chave do envio direto", async () => {
    bater.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const r = await baterComFila(input);
    expect(r.sincronizado).toBe(false);
    const chaveDireta = bater.mock.calls[0][1];
    bater.mockResolvedValue({ id: "r1" } as never);
    await sincronizar();
    // Reenvio usa a mesma Idempotency-Key — o servidor não duplica.
    expect(bater.mock.calls[1][1]).toBe(chaveDireta);
    expect(await pendentes()).toBe(0);
  });

  it("erro do servidor (ApiError) propaga sem enfileirar", async () => {
    bater.mockRejectedValue(new ApiError(403, "ponto inativo"));
    await expect(baterComFila(input)).rejects.toThrow("ponto inativo");
    expect(await pendentes()).toBe(0);
  });

  it("migra a fila legada do localStorage antes de operar", async () => {
    localStorage.setItem("hu360-ponto-fila", JSON.stringify([input]));
    expect(await pendentes()).toBe(1);
    expect(localStorage.getItem("hu360-ponto-fila")).toBeNull();
  });

  it("sincronizar devolve o nº de enviadas e mantém 4xx visível", async () => {
    setOnline(false);
    await baterComFila(input);
    await baterComFila({ ...input, tipo: "saida" });
    setOnline(true);
    bater
      .mockResolvedValueOnce({ id: "r1" } as never)
      .mockRejectedValueOnce(new ApiError(400, "inválido"));
    expect(await sincronizar()).toBe(1);
    expect(await pendentes()).toBe(1); // o 4xx fica NEEDS_ATTENTION, não some
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `pnpm vitest run src/lib/api/pontos-fila.test.ts`
Expected: FAIL (implementação antiga usa localStorage)

- [ ] **Step 3: Reescrever pontos-fila.ts**

```ts
// src/lib/api/pontos-fila.ts
/**
 * Fila offline de batidas de ponto — agora sobre o outbox (IndexedDB), com
 * chave de idempotência: o id nasce no aparelho ANTES do primeiro envio, e o
 * retry usa a mesma chave, então o servidor nunca duplica (Portaria 671).
 * A fila legada em localStorage é migrada no primeiro uso.
 */
import { ApiError } from "./client";
import { pontosApi, type BaterPontoInput, type PontoRegistro } from "./pontos";
import type { ItemOutbox } from "../offline/db";
import { contarPendentes, enfileirar } from "../offline/outbox";
import { processarFila, registrarEnviador } from "../offline/motor";
import { migrarFilaLegadaPonto } from "../offline/migrar-fila-ponto";

const ENTIDADE = "ponto";

registrarEnviador(ENTIDADE, async (item: ItemOutbox) => {
  await pontosApi.bater(item.payload as BaterPontoInput, item.id);
});

// Serializa chamadas concorrentes; re-checa a cada uso (getItem nulo é barato)
// para não memoizar para sempre — a fila legada pode reaparecer em testes.
let emAndamento: Promise<number> | null = null;
function garantirMigracao(): Promise<number> {
  emAndamento ??= migrarFilaLegadaPonto()
    .catch(() => 0)
    .finally(() => {
      emAndamento = null;
    });
  return emAndamento;
}

function offline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

export async function pendentes(): Promise<number> {
  await garantirMigracao();
  return contarPendentes(ENTIDADE);
}

/**
 * Bate o ponto; se offline/sem rede, enfileira para sincronizar depois.
 * Quando sincroniza na hora, devolve o `registro` selado pelo servidor
 * (NSR + hash) — necessário para emitir o CRPT. Offline não tem NSR ainda.
 */
export async function baterComFila(
  input: BaterPontoInput,
): Promise<{ sincronizado: boolean; registro?: PontoRegistro }> {
  await garantirMigracao();
  const id = crypto.randomUUID();
  if (offline()) {
    await enfileirar(ENTIDADE, input, id);
    return { sincronizado: false };
  }
  try {
    const registro = await pontosApi.bater(input, id);
    return { sincronizado: true, registro };
  } catch (e) {
    // Erro do servidor não é offline — propaga para o usuário ver.
    if (e instanceof ApiError) throw e;
    // Falha de rede: enfileira com a MESMA chave do envio que falhou.
    await enfileirar(ENTIDADE, input, id);
    return { sincronizado: false };
  }
}

/** Tenta reenviar a fila. Retorna quantas batidas foram sincronizadas. */
export async function sincronizar(): Promise<number> {
  await garantirMigracao();
  const r = await processarFila();
  return r.enviados;
}
```

- [ ] **Step 4: Atualizar usePontoSync (pendentes async + gatilho de 5 min)**

```ts
// src/pages/checklist-controle/usePontoSync.ts
import { useCallback, useEffect, useState } from "react";
import { pendentes, sincronizar } from "../../lib/api/pontos-fila";

/**
 * Sincroniza a fila offline de ponto ao montar, quando a conexão volta e a
 * cada 5 minutos com a tela aberta; expõe quantas batidas aguardam envio.
 */
export function usePontoSync() {
  const [qtd, setQtd] = useState(0);

  const atualizar = useCallback(() => {
    void pendentes().then(setQtd);
  }, []);

  useEffect(() => {
    let vivo = true;
    const flush = () => {
      void sincronizar().then(() =>
        pendentes().then((n) => {
          if (vivo) setQtd(n);
        }),
      );
    };
    flush();
    const intervalo = window.setInterval(flush, 5 * 60_000);
    window.addEventListener("online", flush);
    return () => {
      vivo = false;
      window.clearInterval(intervalo);
      window.removeEventListener("online", flush);
    };
  }, []);

  return { pendentes: qtd, atualizar };
}
```

- [ ] **Step 5: Rodar os testes do pacote e confirmar**

Run: `pnpm vitest run src/lib src/pages/checklist-controle`
Expected: PASS — incluindo `sincronizar-tudo.test.ts` (mock de `pontos-fila` segue válido)

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/pontos-fila.ts src/lib/api/pontos-fila.test.ts src/pages/checklist-controle/usePontoSync.ts
git commit -m "feat(ponto): fila offline sobre o outbox com idempotência"
```

### Task 10: Validação final e atualização do PR

- [ ] **Step 1: Suíte completa do front**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: lint sem erros novos; todos os testes passam; build OK

- [ ] **Step 2: Push e atualizar a descrição do PR #70**

```bash
git push
gh pr edit 70 --body "Spec + implementação das Fases 0 e 1 do offline-first do operador.

- Spec: docs/superpowers/specs/2026-06-12-offline-outbox-design.md
- Plano: docs/superpowers/plans/2026-06-12-offline-outbox-fase0-1.md
- Fase 1 (este PR): outbox em IndexedDB (Dexie), motor com retry/backoff e NEEDS_ATTENTION, fila do ponto migrada do localStorage, Idempotency-Key no POST /time-records, gatilho periódico de 5 min.
- Fase 0 (PR no repo back): interceptor de idempotência — ver suportehorautil360/back.

Compatibilidade: aparelhos com batidas pendentes na fila legada migram no primeiro boot, sem perda."
```

- [ ] **Step 3: Smoke manual (opcional, recomendado)**

Run: `pnpm build && pnpm preview` — no DevTools, Application → IndexedDB → `hu360-offline`: bater ponto com "Offline" marcado no DevTools, ver o item em `sync_queue`; desmarcar e ver o item sumir após o sync.

---

## Notas de operação

- A coleção `idempotencyKeys` tem o campo `expiraEm`; configurar a política de
  TTL do Firestore (console) apontando para ele — senão as chaves acumulam.
- O back em produção precisa estar com a Fase 0 no ar **antes** do deploy do
  front da Fase 1 (o header extra é ignorado por backends antigos, então a
  ordem inversa não quebra, mas perde a proteção contra duplicação).
