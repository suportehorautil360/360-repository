# Hub Mestre WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir `/admin/whatsapp` como um "Hub Mestre" (KPIs, monitoramento de sessão, histórico de eventos) alimentado por dados reais, estendendo o backend NestJS com um endpoint consolidado.

**Architecture:** Backend (`back-360-`) ganha um módulo de métricas puro + um serviço Firestore (stats/eventos/empresas) e um `GET /whatsapp/overview` que agrega tudo. Frontend (este repo) vira um orquestrador fino que faz polling adaptativo do overview e compõe componentes dark autocontidos em `src/components/admin/whatsapp/`. Lógica testável (disponibilidade, contagem, formatação) fica em funções puras.

**Tech Stack:** Backend: NestJS, Baileys, firebase-admin, Jest/ts-jest. Frontend: React, Vite, TypeScript, TailwindCSS v4, shadcn (Sheet/Dialog/Button), sonner, Vitest + Testing Library.

**Repos (dois):** Frontend = este repo (branch `feat/whatsapp-hub-mestre`). Backend = `back-360-` (repo separado, remote `suportehorautil360/back`). Commit/PR nos dois. Quem mescla na `main` é o dono do projeto.

**Spec:** [docs/superpowers/specs/2026-06-05-whatsapp-hub-design.md](../specs/2026-06-05-whatsapp-hub-design.md)

---

## Contrato de tipos (fonte única — usado em ambos os repos)

```ts
type WhatsAppStatus = "desconectado" | "conectando" | "aguardando_qr" | "conectado";

interface WhatsappSessao {
  numeroConectado: string | null;
  nomeSessao: string | null;
  conectadoDesde: string | null;   // ISO
  ultimaAtividade: string | null;  // ISO
  versaoSessao: string | null;
  ambiente: "dev" | "prod";
}
interface WhatsappDisponibilidade {
  percentual: number;   // 0..100, 1 casa decimal
  desde: string;        // ISO — início do período medido
  janelaCompleta: boolean;
}
interface WhatsappKpis {
  empresasUtilizando: number;
  mensagensHoje: number;
  mensagens30d: number;
  disponibilidade: WhatsappDisponibilidade;
}
type TipoEventoWhats = "sessao_iniciada" | "qr_gerado" | "conectado" | "queda" | "sessao_encerrada";
type StatusEventoWhats = "sucesso" | "aviso" | "erro";
interface EventoWhats {
  id: string;
  tipo: TipoEventoWhats;
  status: StatusEventoWhats;
  timestamp: string; // ISO
}
interface WhatsappOverview {
  status: WhatsAppStatus;
  qrImagem?: string;
  sessao: WhatsappSessao;
  kpis: WhatsappKpis;
  eventos: EventoWhats[];
}
```

---

## File Structure

### Backend (`back-360-/src/modules/whatsapp/`)
- **Create** `whatsapp-metrics.ts` — funções puras: tipos, `contarEmpresasComWhats`, `calcularDisponibilidade`, `ultimosDias`, `montarOverview`.
- **Create** `whatsapp-metrics.spec.ts` — testes das funções puras.
- **Create** `whatsapp-metrics.service.ts` — `WhatsAppMetricsService` (glue Firestore: stats/eventos/empresas).
- **Create** `whatsapp-metrics.service.spec.ts` — testes com `FirebaseService` mockado.
- **Modify** `whatsapp.service.ts` — rastrear metadados da sessão; chamar métricas em transições/envios; `getOverview()`.
- **Modify** `whatsapp.controller.ts` — rota `GET /overview`.
- **Modify** `whatsapp.module.ts` — prover `WhatsAppMetricsService`.

### Frontend (`src/`)
- **Modify** `lib/api/whatsapp.ts` — tipos ricos + `overview()`.
- **Create** `components/admin/whatsapp/format.ts` — formatadores puros.
- **Create** `components/admin/whatsapp/format.test.ts`.
- **Create** `components/admin/whatsapp/ui.tsx` — `HubCard`, `Kpi`, `StatusBadge`, `StatusDot`, `Skeleton`.
- **Create** `components/admin/whatsapp/use-whatsapp-overview.ts` — hook de polling adaptativo.
- **Create** `components/admin/whatsapp/WhatsappHubHeader.tsx`.
- **Create** `components/admin/whatsapp/WhatsappStats.tsx`.
- **Create** `components/admin/whatsapp/WhatsappStatusCard.tsx`.
- **Create** `components/admin/whatsapp/WhatsappEventsTable.tsx`.
- **Create** `components/admin/whatsapp/WhatsappQrSheet.tsx`.
- **Create** `components/admin/whatsapp/WhatsappConnectionCard.tsx`.
- **Modify** `pages/admin/sections/WhatsappSection.tsx` — orquestrador.
- **Create** `pages/admin/sections/WhatsappSection.test.tsx`.
- **Delete (opcional)** `pages/admin/sections/whatsapp-admin.css` — substituído por Tailwind. Manter até confirmar que nada mais importa.

---

# PHASE A — Backend (`back-360-`)

> Todos os comandos desta fase rodam dentro de `back-360-/`. O agente deve `cd back-360-` antes (ou prefixar `--prefix`/caminhos). Os commits desta fase são no repo `back-360-`.

## Task A1: Tipos puros + `contarEmpresasComWhats`

**Files:**
- Create: `back-360-/src/modules/whatsapp/whatsapp-metrics.ts`
- Create: `back-360-/src/modules/whatsapp/whatsapp-metrics.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `back-360-/src/modules/whatsapp/whatsapp-metrics.spec.ts`:

```ts
import { contarEmpresasComWhats } from './whatsapp-metrics';

describe('whatsapp-metrics/contarEmpresasComWhats', () => {
  it('conta só quem tem toggle on e número preenchido', () => {
    const configs = [
      { alertas: { notificacaoWhatsapp: true }, empresa: { whatsappNumero: '67 99999-9999' } },
      { alertas: { notificacaoWhatsapp: true }, empresa: { whatsappNumero: '   ' } }, // número vazio
      { alertas: { notificacaoWhatsapp: false }, empresa: { whatsappNumero: '11 98888-7777' } }, // toggle off
      { empresa: { whatsappNumero: '11 97777-6666' } }, // sem alertas
      {}, // vazio
    ];
    expect(contarEmpresasComWhats(configs)).toBe(1);
  });

  it('retorna 0 para lista vazia', () => {
    expect(contarEmpresasComWhats([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back-360- && npx jest src/modules/whatsapp/whatsapp-metrics.spec.ts`
Expected: FAIL — `Cannot find module './whatsapp-metrics'`.

- [ ] **Step 3: Write minimal implementation**

Create `back-360-/src/modules/whatsapp/whatsapp-metrics.ts`:

```ts
/** Funções puras de métricas do Hub WhatsApp (sem I/O — fáceis de testar). */

export type WhatsAppStatus =
  | 'desconectado'
  | 'conectando'
  | 'aguardando_qr'
  | 'conectado';

export type TipoEventoWhats =
  | 'sessao_iniciada'
  | 'qr_gerado'
  | 'conectado'
  | 'queda'
  | 'sessao_encerrada';

export type StatusEventoWhats = 'sucesso' | 'aviso' | 'erro';

export interface EventoWhats {
  id: string;
  tipo: TipoEventoWhats;
  status: StatusEventoWhats;
  timestamp: string;
}

export interface ConfigWhats {
  alertas?: { notificacaoWhatsapp?: boolean };
  empresa?: { whatsappNumero?: string };
}

/** Conta empresas com a notificação de emergência ligada E número cadastrado. */
export function contarEmpresasComWhats(configs: ConfigWhats[]): number {
  return configs.filter(
    (c) =>
      c.alertas?.notificacaoWhatsapp === true &&
      (c.empresa?.whatsappNumero ?? '').trim() !== '',
  ).length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd back-360- && npx jest src/modules/whatsapp/whatsapp-metrics.spec.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
cd back-360- && git add src/modules/whatsapp/whatsapp-metrics.ts src/modules/whatsapp/whatsapp-metrics.spec.ts && git commit -m "feat(whatsapp): contagem de empresas com whatsapp ativo"
```

---

## Task A2: `calcularDisponibilidade`

**Files:**
- Modify: `back-360-/src/modules/whatsapp/whatsapp-metrics.ts`
- Modify: `back-360-/src/modules/whatsapp/whatsapp-metrics.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `whatsapp-metrics.spec.ts`:

```ts
import { calcularDisponibilidade } from './whatsapp-metrics';

describe('whatsapp-metrics/calcularDisponibilidade', () => {
  const agora = new Date('2026-06-05T12:00:00.000Z');

  it('sem eventos → 0%, janela incompleta', () => {
    const r = calcularDisponibilidade([], agora, 30);
    expect(r.percentual).toBe(0);
    expect(r.janelaCompleta).toBe(false);
    expect(r.desde).toBe(agora.toISOString());
  });

  it('conectado metade do período medido → 50%', () => {
    // primeiro evento há 1 dia; conectado por 12h das 24h
    const eventos = [
      { tipo: 'conectado' as const, timestamp: '2026-06-04T12:00:00.000Z' },
      { tipo: 'queda' as const, timestamp: '2026-06-05T00:00:00.000Z' },
    ];
    const r = calcularDisponibilidade(eventos, agora, 30);
    expect(r.percentual).toBe(50);
    expect(r.janelaCompleta).toBe(false); // só 1 dia de histórico < 30
    expect(r.desde).toBe('2026-06-04T12:00:00.000Z');
  });

  it('conectado e ainda aberto até agora → 100%', () => {
    const eventos = [
      { tipo: 'conectado' as const, timestamp: '2026-06-04T12:00:00.000Z' },
    ];
    const r = calcularDisponibilidade(eventos, agora, 30);
    expect(r.percentual).toBe(100);
  });

  it('janelaCompleta quando há evento mais antigo que a janela', () => {
    const eventos = [
      { tipo: 'conectado' as const, timestamp: '2026-04-01T00:00:00.000Z' },
    ];
    const r = calcularDisponibilidade(eventos, agora, 30);
    expect(r.janelaCompleta).toBe(true);
    expect(r.desde).toBe('2026-05-06T12:00:00.000Z'); // agora - 30d
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back-360- && npx jest src/modules/whatsapp/whatsapp-metrics.spec.ts`
Expected: FAIL — `calcularDisponibilidade is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `whatsapp-metrics.ts`:

```ts
const MS_DIA = 86_400_000;

export interface WhatsappDisponibilidade {
  percentual: number;
  desde: string;
  janelaCompleta: boolean;
}

/**
 * % de tempo "conectado" no período medido, a partir do log de eventos.
 * Assume desconectado antes do primeiro evento dentro da janela (a precisão
 * cresce conforme o histórico acumula — ver spec). `agora` é injetado p/ teste.
 */
export function calcularDisponibilidade(
  eventos: { tipo: TipoEventoWhats; timestamp: string }[],
  agora: Date,
  janelaDias = 30,
): WhatsappDisponibilidade {
  const fimMs = agora.getTime();
  const janelaInicioMs = fimMs - janelaDias * MS_DIA;

  // Só eventos de transição que abrem/fecham conexão, ordenados asc.
  const transicoes = eventos
    .filter((e) => ['conectado', 'queda', 'sessao_encerrada'].includes(e.tipo))
    .map((e) => ({ tipo: e.tipo, ms: new Date(e.timestamp).getTime() }))
    .filter((e) => Number.isFinite(e.ms))
    .sort((a, b) => a.ms - b.ms);

  if (transicoes.length === 0) {
    return { percentual: 0, desde: agora.toISOString(), janelaCompleta: false };
  }

  const primeiroMs = transicoes[0].ms;
  const janelaCompleta = primeiroMs <= janelaInicioMs;
  const inicioMedicaoMs = Math.max(primeiroMs, janelaInicioMs);
  const totalMs = Math.max(fimMs - inicioMedicaoMs, 1);

  let conectadoMs = 0;
  let aberturaMs: number | null = null;
  for (const t of transicoes) {
    const pontoMs = Math.max(t.ms, inicioMedicaoMs);
    if (t.tipo === 'conectado') {
      if (aberturaMs === null) aberturaMs = pontoMs;
    } else if (aberturaMs !== null) {
      conectadoMs += Math.max(pontoMs - aberturaMs, 0);
      aberturaMs = null;
    }
  }
  // Conexão ainda aberta no fim da janela.
  if (aberturaMs !== null) conectadoMs += Math.max(fimMs - aberturaMs, 0);

  const percentual = Math.round((conectadoMs / totalMs) * 1000) / 10;
  return {
    percentual: Math.min(percentual, 100),
    desde: new Date(inicioMedicaoMs).toISOString(),
    janelaCompleta,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd back-360- && npx jest src/modules/whatsapp/whatsapp-metrics.spec.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
cd back-360- && git add src/modules/whatsapp/whatsapp-metrics.ts src/modules/whatsapp/whatsapp-metrics.spec.ts && git commit -m "feat(whatsapp): cálculo de disponibilidade a partir do log de eventos"
```

---

## Task A3: `ultimosDias` + `montarOverview`

**Files:**
- Modify: `back-360-/src/modules/whatsapp/whatsapp-metrics.ts`
- Modify: `back-360-/src/modules/whatsapp/whatsapp-metrics.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `whatsapp-metrics.spec.ts`:

```ts
import { ultimosDias, montarOverview } from './whatsapp-metrics';

describe('whatsapp-metrics/ultimosDias', () => {
  it('gera N ids YYYY-MM-DD terminando hoje (desc)', () => {
    const dias = ultimosDias(3, new Date('2026-06-05T12:00:00.000Z'));
    expect(dias).toEqual(['2026-06-05', '2026-06-04', '2026-06-03']);
  });
});

describe('whatsapp-metrics/montarOverview', () => {
  it('monta o payload completo', () => {
    const ov = montarOverview({
      status: 'conectado',
      qrImagem: undefined,
      numeroConectado: '5567999999999',
      nomeSessao: 'Hora Útil 360',
      conectadoDesde: '2026-06-05T09:42:00.000Z',
      ultimaAtividade: '2026-06-05T11:58:00.000Z',
      versaoSessao: '2.3000.1',
      ambiente: 'prod',
      empresasUtilizando: 14,
      mensagensHoje: 234,
      mensagens30d: 5120,
      disponibilidade: { percentual: 99.8, desde: '2026-05-06T12:00:00.000Z', janelaCompleta: true },
      eventos: [{ id: 'e1', tipo: 'conectado', status: 'sucesso', timestamp: '2026-06-05T09:42:00.000Z' }],
    });
    expect(ov.status).toBe('conectado');
    expect(ov.sessao.numeroConectado).toBe('5567999999999');
    expect(ov.kpis.empresasUtilizando).toBe(14);
    expect(ov.kpis.disponibilidade.percentual).toBe(99.8);
    expect(ov.eventos).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back-360- && npx jest src/modules/whatsapp/whatsapp-metrics.spec.ts`
Expected: FAIL — `ultimosDias is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `whatsapp-metrics.ts`:

```ts
export interface WhatsappSessao {
  numeroConectado: string | null;
  nomeSessao: string | null;
  conectadoDesde: string | null;
  ultimaAtividade: string | null;
  versaoSessao: string | null;
  ambiente: 'dev' | 'prod';
}
export interface WhatsappKpis {
  empresasUtilizando: number;
  mensagensHoje: number;
  mensagens30d: number;
  disponibilidade: WhatsappDisponibilidade;
}
export interface WhatsappOverview {
  status: WhatsAppStatus;
  qrImagem?: string;
  sessao: WhatsappSessao;
  kpis: WhatsappKpis;
  eventos: EventoWhats[];
}

/** Lista de `count` ids de dia (YYYY-MM-DD, UTC), terminando em `ref`, desc. */
export function ultimosDias(count: number, ref: Date): string[] {
  const dias: string[] = [];
  for (let i = 0; i < count; i++) {
    dias.push(new Date(ref.getTime() - i * MS_DIA).toISOString().slice(0, 10));
  }
  return dias;
}

export interface MontarOverviewArgs extends WhatsappSessao {
  status: WhatsAppStatus;
  qrImagem?: string;
  empresasUtilizando: number;
  mensagensHoje: number;
  mensagens30d: number;
  disponibilidade: WhatsappDisponibilidade;
  eventos: EventoWhats[];
}

export function montarOverview(a: MontarOverviewArgs): WhatsappOverview {
  return {
    status: a.status,
    qrImagem: a.qrImagem,
    sessao: {
      numeroConectado: a.numeroConectado,
      nomeSessao: a.nomeSessao,
      conectadoDesde: a.conectadoDesde,
      ultimaAtividade: a.ultimaAtividade,
      versaoSessao: a.versaoSessao,
      ambiente: a.ambiente,
    },
    kpis: {
      empresasUtilizando: a.empresasUtilizando,
      mensagensHoje: a.mensagensHoje,
      mensagens30d: a.mensagens30d,
      disponibilidade: a.disponibilidade,
    },
    eventos: a.eventos,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd back-360- && npx jest src/modules/whatsapp/whatsapp-metrics.spec.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
cd back-360- && git add src/modules/whatsapp/whatsapp-metrics.ts src/modules/whatsapp/whatsapp-metrics.spec.ts && git commit -m "feat(whatsapp): helpers ultimosDias e montarOverview"
```

---

## Task A4: `WhatsAppMetricsService` (glue Firestore)

**Files:**
- Create: `back-360-/src/modules/whatsapp/whatsapp-metrics.service.ts`
- Create: `back-360-/src/modules/whatsapp/whatsapp-metrics.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `back-360-/src/modules/whatsapp/whatsapp-metrics.service.spec.ts`:

```ts
import { WhatsAppMetricsService } from './whatsapp-metrics.service';

function fakeFirebase() {
  const setMensagens = jest.fn().mockResolvedValue(undefined);
  const addEvento = jest.fn().mockResolvedValue(undefined);
  const configsData = [
    { alertas: { notificacaoWhatsapp: true }, empresa: { whatsappNumero: '67 99999-9999' } },
    { alertas: { notificacaoWhatsapp: false }, empresa: { whatsappNumero: '11 90000-0000' } },
  ];
  const db = {
    collection: jest.fn((name: string) => {
      if (name === 'whatsappStats') {
        return { doc: () => ({ set: setMensagens, get: async () => ({ data: () => ({ mensagens: 7 }) }) }) };
      }
      if (name === 'whatsappEvents') {
        return { add: addEvento };
      }
      if (name === 'configuracoes') {
        return { get: async () => ({ docs: configsData.map((d) => ({ data: () => d })) }) };
      }
      throw new Error('coleção inesperada: ' + name);
    }),
  };
  const firebase = {
    getFirestore: () => db,
    FieldValue: { increment: (n: number) => ({ __inc: n }) },
  } as any;
  return { firebase, setMensagens, addEvento };
}

describe('WhatsAppMetricsService', () => {
  it('incrementarMensagens faz set merge com increment', async () => {
    const { firebase, setMensagens } = fakeFirebase();
    const svc = new WhatsAppMetricsService(firebase);
    await svc.incrementarMensagens(2);
    expect(setMensagens).toHaveBeenCalledWith(
      { mensagens: { __inc: 2 } },
      { merge: true },
    );
  });

  it('mensagensHoje lê o doc do dia', async () => {
    const { firebase } = fakeFirebase();
    const svc = new WhatsAppMetricsService(firebase);
    await expect(svc.mensagensHoje()).resolves.toBe(7);
  });

  it('registrarEvento grava na coleção de eventos', async () => {
    const { firebase, addEvento } = fakeFirebase();
    const svc = new WhatsAppMetricsService(firebase);
    await svc.registrarEvento('conectado', 'sucesso');
    expect(addEvento).toHaveBeenCalledTimes(1);
    const arg = addEvento.mock.calls[0][0];
    expect(arg.tipo).toBe('conectado');
    expect(arg.status).toBe('sucesso');
    expect(typeof arg.timestamp).toBe('string');
  });

  it('contarEmpresasUtilizando aplica o filtro', async () => {
    const { firebase } = fakeFirebase();
    const svc = new WhatsAppMetricsService(firebase);
    await expect(svc.contarEmpresasUtilizando()).resolves.toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd back-360- && npx jest src/modules/whatsapp/whatsapp-metrics.service.spec.ts`
Expected: FAIL — `Cannot find module './whatsapp-metrics.service'`.

- [ ] **Step 3: Write minimal implementation**

Create `back-360-/src/modules/whatsapp/whatsapp-metrics.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../../config/firebase.service';
import {
  contarEmpresasComWhats,
  ultimosDias,
  type ConfigWhats,
  type EventoWhats,
  type StatusEventoWhats,
  type TipoEventoWhats,
} from './whatsapp-metrics';

/** Persistência das métricas do Hub WhatsApp (stats diários, eventos, empresas). */
@Injectable()
export class WhatsAppMetricsService {
  constructor(private firebase: FirebaseService) {}

  private get db() {
    return this.firebase.getFirestore();
  }

  private diaId(d = new Date()): string {
    return d.toISOString().slice(0, 10);
  }

  async incrementarMensagens(qtd = 1): Promise<void> {
    await this.db
      .collection('whatsappStats')
      .doc(this.diaId())
      .set(
        { mensagens: this.firebase.FieldValue.increment(qtd) },
        { merge: true },
      );
  }

  async mensagensHoje(): Promise<number> {
    const snap = await this.db
      .collection('whatsappStats')
      .doc(this.diaId())
      .get();
    return (snap.data() as { mensagens?: number } | undefined)?.mensagens ?? 0;
  }

  async mensagens30d(agora = new Date()): Promise<number> {
    const refs = ultimosDias(30, agora).map((d) =>
      this.db.collection('whatsappStats').doc(d),
    );
    const snaps = await this.db.getAll(...refs);
    return snaps.reduce(
      (acc, s) =>
        acc + ((s.data() as { mensagens?: number } | undefined)?.mensagens ?? 0),
      0,
    );
  }

  async registrarEvento(
    tipo: TipoEventoWhats,
    status: StatusEventoWhats,
  ): Promise<void> {
    await this.db.collection('whatsappEvents').add({
      tipo,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  async eventosRecentes(limite = 20): Promise<EventoWhats[]> {
    const snap = await this.db
      .collection('whatsappEvents')
      .orderBy('timestamp', 'desc')
      .limit(limite)
      .get();
    return snap.docs.map((d) => {
      const data = d.data() as Omit<EventoWhats, 'id'>;
      return { id: d.id, ...data };
    });
  }

  async eventosJanela(
    janelaDias = 30,
    agora = new Date(),
  ): Promise<{ tipo: TipoEventoWhats; timestamp: string }[]> {
    const desde = new Date(
      agora.getTime() - janelaDias * 86_400_000,
    ).toISOString();
    const snap = await this.db
      .collection('whatsappEvents')
      .where('timestamp', '>=', desde)
      .orderBy('timestamp', 'asc')
      .get();
    return snap.docs.map((d) => {
      const data = d.data() as { tipo: TipoEventoWhats; timestamp: string };
      return { tipo: data.tipo, timestamp: data.timestamp };
    });
  }

  async contarEmpresasUtilizando(): Promise<number> {
    const snap = await this.db.collection('configuracoes').get();
    return contarEmpresasComWhats(snap.docs.map((d) => d.data() as ConfigWhats));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd back-360- && npx jest src/modules/whatsapp/whatsapp-metrics.service.spec.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
cd back-360- && git add src/modules/whatsapp/whatsapp-metrics.service.ts src/modules/whatsapp/whatsapp-metrics.service.spec.ts && git commit -m "feat(whatsapp): serviço de métricas (stats, eventos, empresas)"
```

---

## Task A5: Integrar métricas no `whatsapp.service.ts` + `getOverview()`

**Files:**
- Modify: `back-360-/src/modules/whatsapp/whatsapp.service.ts`
- Modify: `back-360-/src/modules/whatsapp/whatsapp.module.ts`

> Sem teste unitário próprio (depende do socket Baileys, difícil de mockar). A validação é via `getOverview` no controller (Task A6) e o build. A lógica testável já está coberta nas Tasks A1–A4.

- [ ] **Step 1: Prover o `WhatsAppMetricsService` no módulo**

Edit `back-360-/src/modules/whatsapp/whatsapp.module.ts` — adicionar o import e incluir `WhatsAppMetricsService` nos `providers`. O arquivo atual é exatamente:

```ts
import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { AdminSecretGuard } from './admin-secret.guard';
import { FirebaseService } from '../../config/firebase.service';

@Module({
  controllers: [WhatsAppController],
  providers: [WhatsAppService, AdminSecretGuard, FirebaseService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
```

Editar para:

```ts
import { Module } from '@nestjs/common';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppMetricsService } from './whatsapp-metrics.service';
import { AdminSecretGuard } from './admin-secret.guard';
import { FirebaseService } from '../../config/firebase.service';

@Module({
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    WhatsAppMetricsService,
    AdminSecretGuard,
    FirebaseService,
  ],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
```

(O `FirebaseService` já é provido aqui, então o `WhatsAppMetricsService` recebe a injeção sem mudanças extras.)

- [ ] **Step 2: Injetar o serviço e rastrear metadados no `whatsapp.service.ts`**

Em `whatsapp.service.ts`:

(a) Imports e injeção:

```ts
import { WhatsAppMetricsService } from './whatsapp-metrics.service';
import { calcularDisponibilidade, montarOverview, type WhatsappOverview } from './whatsapp-metrics';
```

```ts
constructor(
  private firebase: FirebaseService,
  private metrics: WhatsAppMetricsService,
) {}
```

(b) Novos campos de estado (junto dos existentes):

```ts
private conectadoDesde: string | null = null;
private ultimaAtividade: string | null = null;
private versaoSessao: string | null = null;
```

(c) No `connect()`, após `const { version } = await fetchLatestBaileysVersion();`:

```ts
this.versaoSessao = version.join('.');
void this.metrics.registrarEvento('sessao_iniciada', 'sucesso');
```

(d) No handler `connection.update`, dentro de `if (qr) { ... }` (após `this.status = 'aguardando_qr';`):

```ts
void this.metrics.registrarEvento('qr_gerado', 'sucesso');
```

dentro de `if (connection === 'open') { ... }`:

```ts
this.conectadoDesde = new Date().toISOString();
this.ultimaAtividade = this.conectadoDesde;
void this.persistirSessao();
void this.metrics.registrarEvento('conectado', 'sucesso');
```

no ramo `else if (connection === 'close')`: para logout usar `sessao_encerrada`, para queda usar `queda`:

```ts
if (loggedOut) {
  this.status = 'desconectado';
  this.conectadoDesde = null;
  void this.metrics.registrarEvento('sessao_encerrada', 'aviso');
  this.logger.warn('WhatsApp deslogado — sessão encerrada.');
  void this.limparSessao();
  return;
}
void this.metrics.registrarEvento('queda', 'aviso');
```

(e) Atualizar `ultimaAtividade` nos envios — no início de `enviarMensagem` e `enviarImagem`, após a checagem de conexão e antes/depois do `sendMessage` adicionar:

```ts
this.ultimaAtividade = new Date().toISOString();
await this.metrics.incrementarMensagens(1);
```

(coloque o `incrementarMensagens` após o `await this.sock.sendMessage(...)` ter sucesso).

(f) Persistir metadados da sessão (novo método privado):

```ts
private async persistirSessao(): Promise<void> {
  try {
    await this.docRef.set(
      { conectadoDesde: this.conectadoDesde, versaoSessao: this.versaoSessao },
      { merge: true },
    );
  } catch {
    /* best-effort */
  }
}
```

(g) No `onModuleInit`, ao reconectar, recuperar `conectadoDesde`/`versaoSessao` do doc se presentes:

```ts
const data = snap.data() as { conectadoDesde?: string; versaoSessao?: string } | undefined;
if (data?.conectadoDesde) this.conectadoDesde = data.conectadoDesde;
if (data?.versaoSessao) this.versaoSessao = data.versaoSessao;
```

(h) Helpers de número/nome e ambiente:

```ts
private numeroConectado(): string | null {
  const id = this.sock?.user?.id;
  return id ? id.split(':')[0].split('@')[0] : null;
}
private nomeSessao(): string | null {
  return this.sock?.user?.name ?? (this.sock ? 'Hora Útil 360' : null);
}
private ambiente(): 'dev' | 'prod' {
  return process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
}
```

- [ ] **Step 3: Adicionar `getOverview()`**

```ts
async getOverview(): Promise<WhatsappOverview> {
  const agora = new Date();
  const base = await this.getStatus(); // status + qrImagem
  const [empresas, hoje, mes, eventos, eventosJanela] = await Promise.all([
    this.metrics.contarEmpresasUtilizando(),
    this.metrics.mensagensHoje(),
    this.metrics.mensagens30d(agora),
    this.metrics.eventosRecentes(20),
    this.metrics.eventosJanela(30, agora),
  ]);
  return montarOverview({
    status: base.status,
    qrImagem: base.qrImagem,
    numeroConectado: this.numeroConectado(),
    nomeSessao: this.nomeSessao(),
    conectadoDesde: this.conectadoDesde,
    ultimaAtividade: this.ultimaAtividade,
    versaoSessao: this.versaoSessao,
    ambiente: this.ambiente(),
    empresasUtilizando: empresas,
    mensagensHoje: hoje,
    mensagens30d: mes,
    disponibilidade: calcularDisponibilidade(eventosJanela, agora, 30),
    eventos,
  });
}
```

- [ ] **Step 4: Verificar build/tipos**

Run: `cd back-360- && npx tsc --noEmit`
Expected: sem erros de tipo. (Se o `whatsapp.module.ts` não importava `FirebaseService`/`FirebaseModule`, garantir que está disponível — o `WhatsAppService` já injeta `FirebaseService`, então o módulo já provê.)

- [ ] **Step 5: Commit**

```bash
cd back-360- && git add src/modules/whatsapp/whatsapp.service.ts src/modules/whatsapp/whatsapp.module.ts && git commit -m "feat(whatsapp): rastreia sessão/eventos/mensagens e monta overview"
```

---

## Task A6: Rota `GET /whatsapp/overview`

**Files:**
- Modify: `back-360-/src/modules/whatsapp/whatsapp.controller.ts`

- [ ] **Step 1: Adicionar a rota**

Em `whatsapp.controller.ts`, dentro da classe (junto das outras rotas):

```ts
@Get('overview')
@ApiOperation({ summary: 'Visão consolidada do Hub WhatsApp (status, KPIs, eventos)' })
async overview() {
  return { data: await this.wa.getOverview(), message: 'Overview do WhatsApp.' };
}
```

- [ ] **Step 2: Verificar build**

Run: `cd back-360- && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
cd back-360- && git add src/modules/whatsapp/whatsapp.controller.ts && git commit -m "feat(whatsapp): endpoint GET /whatsapp/overview"
```

---

## Task A7: Validação final do backend

- [ ] **Step 1: Rodar todos os testes do módulo + build**

Run: `cd back-360- && npx jest src/modules/whatsapp && npx tsc --noEmit`
Expected: todos os testes PASS; build sem erros.

- [ ] **Step 2: (Sanidade) Lint, se houver**

Run: `cd back-360- && npm run lint --if-present`
Expected: sem erros novos.

> NÃO subir o servidor (porta 3000) — restrição do projeto. A validação é por testes + build.

---

# PHASE B — Frontend (este repo)

> Comandos desta fase rodam na raiz do repo (este). Branch `feat/whatsapp-hub-mestre`.

## Task B1: Estender o API client (`overview` + tipos)

**Files:**
- Modify: `src/lib/api/whatsapp.ts`

- [ ] **Step 1: Adicionar tipos e a função `overview`**

Em `src/lib/api/whatsapp.ts`, adicionar (após as interfaces existentes) os tipos ricos e a função no objeto `whatsappApi`:

```ts
export interface WhatsappSessao {
  numeroConectado: string | null;
  nomeSessao: string | null;
  conectadoDesde: string | null;
  ultimaAtividade: string | null;
  versaoSessao: string | null;
  ambiente: "dev" | "prod";
}
export interface WhatsappDisponibilidade {
  percentual: number;
  desde: string;
  janelaCompleta: boolean;
}
export interface WhatsappKpis {
  empresasUtilizando: number;
  mensagensHoje: number;
  mensagens30d: number;
  disponibilidade: WhatsappDisponibilidade;
}
export type TipoEventoWhats =
  | "sessao_iniciada"
  | "qr_gerado"
  | "conectado"
  | "queda"
  | "sessao_encerrada";
export type StatusEventoWhats = "sucesso" | "aviso" | "erro";
export interface EventoWhats {
  id: string;
  tipo: TipoEventoWhats;
  status: StatusEventoWhats;
  timestamp: string;
}
export interface WhatsappOverview {
  status: WhatsAppStatus;
  qrImagem?: string;
  sessao: WhatsappSessao;
  kpis: WhatsappKpis;
  eventos: EventoWhats[];
}
```

E no objeto `whatsappApi`, adicionar:

```ts
  overview: () => req<WhatsappOverview>("GET", "/overview"),
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/whatsapp.ts && git commit -m "feat(whatsapp): tipos do overview + chamada GET /overview no client"
```

---

## Task B2: Formatadores puros (`format.ts`)

**Files:**
- Create: `src/components/admin/whatsapp/format.ts`
- Create: `src/components/admin/whatsapp/format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/whatsapp/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatarDuracao, tempoRelativo, formatarDataHora } from "./format";

const agora = new Date("2026-06-05T12:00:00.000Z");

describe("formatarDuracao", () => {
  it("dias e horas", () => {
    expect(formatarDuracao("2026-06-02T08:00:00.000Z", agora)).toBe("3d 4h");
  });
  it("horas e minutos", () => {
    expect(formatarDuracao("2026-06-05T09:47:00.000Z", agora)).toBe("2h 13min");
  });
  it("só minutos", () => {
    expect(formatarDuracao("2026-06-05T11:55:00.000Z", agora)).toBe("5min");
  });
  it("nulo → traço", () => {
    expect(formatarDuracao(null, agora)).toBe("—");
  });
});

describe("tempoRelativo", () => {
  it("segundos", () => {
    expect(tempoRelativo("2026-06-05T11:59:48.000Z", agora)).toBe("há 12s");
  });
  it("minutos", () => {
    expect(tempoRelativo("2026-06-05T11:57:00.000Z", agora)).toBe("há 3min");
  });
  it("nulo → traço", () => {
    expect(tempoRelativo(null, agora)).toBe("—");
  });
});

describe("formatarDataHora", () => {
  it("nulo → traço", () => {
    expect(formatarDataHora(null)).toBe("—");
  });
  it("formata data válida", () => {
    expect(formatarDataHora("2026-06-05T09:42:00.000Z")).toMatch(/2026/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/whatsapp/format.test.ts`
Expected: FAIL — módulo `./format` não existe.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/admin/whatsapp/format.ts`:

```ts
/** Formatadores puros do Hub WhatsApp. `agora` é injetável p/ testes. */

export function formatarDuracao(
  desdeIso: string | null,
  agora: Date = new Date(),
): string {
  if (!desdeIso) return "—";
  const ms = agora.getTime() - new Date(desdeIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  const dias = Math.floor(min / 1440);
  const horas = Math.floor((min % 1440) / 60);
  const mins = min % 60;
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${mins}min`;
  return `${mins}min`;
}

export function tempoRelativo(
  iso: string | null,
  agora: Date = new Date(),
): string {
  if (!iso) return "—";
  const ms = agora.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const seg = Math.floor(ms / 1000);
  if (seg < 60) return `há ${seg}s`;
  const min = Math.floor(seg / 60);
  if (min < 60) return `há ${min}min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas}h`;
  return `há ${Math.floor(horas / 24)}d`;
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/whatsapp/format.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/whatsapp/format.ts src/components/admin/whatsapp/format.test.ts && git commit -m "feat(whatsapp): formatadores de duração/tempo/data do hub"
```

---

## Task B3: Primitivos visuais dark (`ui.tsx`)

**Files:**
- Create: `src/components/admin/whatsapp/ui.tsx`

> Componentes de apresentação dark explícitos. Sem teste próprio (cobertos indiretamente pelo teste de integração da página).

- [ ] **Step 1: Criar os primitivos**

Create `src/components/admin/whatsapp/ui.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Cartão base do hub (superfície dark translúcida). */
export function HubCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.03] p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Card de KPI: rótulo, valor grande e legenda. */
export function Kpi({
  rotulo,
  valor,
  legenda,
  carregando,
}: {
  rotulo: string;
  valor: ReactNode;
  legenda?: string;
  carregando?: boolean;
}) {
  return (
    <HubCard>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {rotulo}
      </p>
      {carregando ? (
        <Skeleton className="mt-2 h-8 w-20" />
      ) : (
        <p className="mt-1 text-3xl font-semibold text-slate-100">{valor}</p>
      )}
      {legenda && !carregando && (
        <p className="mt-1 text-xs text-slate-500">{legenda}</p>
      )}
    </HubCard>
  );
}

type Tom = "ok" | "warn" | "off";

const TOM_DOT: Record<Tom, string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  off: "bg-red-400",
};
const TOM_TEXTO: Record<Tom, string> = {
  ok: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  warn: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  off: "text-red-300 border-red-400/30 bg-red-400/10",
};

export function StatusDot({ tom }: { tom: Tom }) {
  return (
    <span className={cn("inline-block h-2.5 w-2.5 rounded-full", TOM_DOT[tom])} />
  );
}

export function StatusBadge({
  tom,
  children,
}: {
  tom: Tom;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
        TOM_TEXTO[tom],
      )}
    >
      <StatusDot tom={tom} />
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-white/10", className)}
      aria-hidden
    />
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/whatsapp/ui.tsx && git commit -m "feat(whatsapp): primitivos visuais dark do hub (card, kpi, badge, skeleton)"
```

---

## Task B4: Hook de polling adaptativo (`use-whatsapp-overview.ts`)

**Files:**
- Create: `src/components/admin/whatsapp/use-whatsapp-overview.ts`

- [ ] **Step 1: Criar o hook**

Create `src/components/admin/whatsapp/use-whatsapp-overview.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { whatsappApi, type WhatsappOverview } from "@/lib/api/whatsapp";

const INTERVALO_RAPIDO = 2500; // aguardando_qr / conectando
const INTERVALO_LENTO = 20000; // conectado / desconectado

export interface UseWhatsappOverview {
  data: WhatsappOverview | null;
  carregando: boolean;
  erro: boolean;
  recarregar: () => Promise<void>;
}

export function useWhatsappOverview(): UseWhatsappOverview {
  const [data, setData] = useState<WhatsappOverview | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const timer = useRef<number | null>(null);

  const recarregar = useCallback(async () => {
    try {
      const ov = await whatsappApi.overview();
      setData(ov);
      setErro(false);
    } catch {
      setErro(true); // mantém o último dado bom
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // Polling adaptativo conforme o status atual.
  useEffect(() => {
    const status = data?.status;
    const intervalo =
      status === "aguardando_qr" || status === "conectando"
        ? INTERVALO_RAPIDO
        : INTERVALO_LENTO;
    timer.current = window.setInterval(() => void recarregar(), intervalo);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [data?.status, recarregar]);

  return { data, carregando, erro, recarregar };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/whatsapp/use-whatsapp-overview.ts && git commit -m "feat(whatsapp): hook de overview com polling adaptativo"
```

---

## Task B5: Header do hub (`WhatsappHubHeader.tsx`)

**Files:**
- Create: `src/components/admin/whatsapp/WhatsappHubHeader.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import type { WhatsAppStatus } from "@/lib/api/whatsapp";
import { StatusBadge } from "./ui";

export function WhatsappHubHeader({
  status,
  carregando,
}: {
  status: WhatsAppStatus | undefined;
  carregando: boolean;
}) {
  const online = status === "conectado";
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">
          Hub Mestre WhatsApp
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Canal central de comunicação responsável pelo envio de notificações,
          alertas e mensagens automáticas da plataforma.
        </p>
      </div>
      {!carregando && (
        <StatusBadge tom={online ? "ok" : "off"}>
          {online ? "Online" : "Desconectado"}
        </StatusBadge>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/whatsapp/WhatsappHubHeader.tsx && git commit -m "feat(whatsapp): header do hub com badge de status global"
```

---

## Task B6: KPIs (`WhatsappStats.tsx`)

**Files:**
- Create: `src/components/admin/whatsapp/WhatsappStats.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import type { WhatsappOverview } from "@/lib/api/whatsapp";
import { Kpi } from "./ui";

const STATUS_TXT: Record<string, string> = {
  conectado: "Online",
  aguardando_qr: "Aguardando QR",
  conectando: "Conectando",
  desconectado: "Offline",
};

export function WhatsappStats({
  data,
  carregando,
}: {
  data: WhatsappOverview | null;
  carregando: boolean;
}) {
  const k = data?.kpis;
  const disp = k?.disponibilidade;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Kpi
        rotulo="Empresas utilizando"
        valor={k?.empresasUtilizando ?? 0}
        legenda="Com notificação ativa"
        carregando={carregando}
      />
      <Kpi
        rotulo="Mensagens hoje"
        valor={k?.mensagensHoje ?? 0}
        legenda={`${k?.mensagens30d ?? 0} nos últimos 30 dias`}
        carregando={carregando}
      />
      <Kpi
        rotulo="Status da sessão"
        valor={STATUS_TXT[data?.status ?? "desconectado"] ?? "—"}
        legenda="Conexão do remetente"
        carregando={carregando}
      />
      <Kpi
        rotulo="Disponibilidade"
        valor={disp ? `${disp.percentual}%` : "—"}
        legenda={
          disp?.janelaCompleta
            ? "Últimos 30 dias"
            : "Desde o início do registro"
        }
        carregando={carregando}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/whatsapp/WhatsappStats.tsx && git commit -m "feat(whatsapp): grade de KPIs do hub"
```

---

## Task B7: Painel de status lateral (`WhatsappStatusCard.tsx`)

**Files:**
- Create: `src/components/admin/whatsapp/WhatsappStatusCard.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import type { WhatsappOverview } from "@/lib/api/whatsapp";
import { HubCard, Skeleton } from "./ui";
import { formatarDataHora, formatarDuracao, tempoRelativo } from "./format";

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2.5 last:border-0">
      <span className="text-xs uppercase tracking-wide text-slate-500">
        {rotulo}
      </span>
      <span className="text-right text-sm font-medium text-slate-200">
        {valor}
      </span>
    </div>
  );
}

export function WhatsappStatusCard({
  data,
  carregando,
}: {
  data: WhatsappOverview | null;
  carregando: boolean;
}) {
  const s = data?.sessao;
  return (
    <HubCard>
      <h3 className="text-sm font-semibold text-slate-200">Status da sessão</h3>
      {carregando ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <Linha rotulo="Número" valor={s?.numeroConectado ?? "—"} />
          <Linha rotulo="Sessão" valor={s?.nomeSessao ?? "—"} />
          <Linha
            rotulo="Conectado desde"
            valor={formatarDataHora(s?.conectadoDesde ?? null)}
          />
          <Linha
            rotulo="Último ping"
            valor={tempoRelativo(s?.ultimaAtividade ?? null)}
          />
          <Linha
            rotulo="Tempo de sessão"
            valor={formatarDuracao(s?.conectadoDesde ?? null)}
          />
          <Linha rotulo="Versão" valor={s?.versaoSessao ?? "—"} />
          <Linha rotulo="Ambiente" valor={s?.ambiente ?? "—"} />
        </div>
      )}
    </HubCard>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/whatsapp/WhatsappStatusCard.tsx && git commit -m "feat(whatsapp): painel lateral de status da sessão"
```

---

## Task B8: Histórico de eventos (`WhatsappEventsTable.tsx`)

**Files:**
- Create: `src/components/admin/whatsapp/WhatsappEventsTable.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import type { EventoWhats, WhatsappOverview } from "@/lib/api/whatsapp";
import { HubCard, Skeleton, StatusDot } from "./ui";
import { formatarDataHora } from "./format";

const EVENTO_TXT: Record<EventoWhats["tipo"], string> = {
  sessao_iniciada: "Sessão iniciada",
  qr_gerado: "QR gerado",
  conectado: "Conectado",
  queda: "Queda de conexão",
  sessao_encerrada: "Sessão encerrada",
};
const STATUS_TOM: Record<EventoWhats["status"], "ok" | "warn" | "off"> = {
  sucesso: "ok",
  aviso: "warn",
  erro: "off",
};
const STATUS_TXT: Record<EventoWhats["status"], string> = {
  sucesso: "Sucesso",
  aviso: "Aviso",
  erro: "Erro",
};

export function WhatsappEventsTable({
  data,
  carregando,
}: {
  data: WhatsappOverview | null;
  carregando: boolean;
}) {
  const eventos = data?.eventos ?? [];
  return (
    <HubCard className="p-0">
      <h3 className="px-5 pt-5 text-sm font-semibold text-slate-200">
        Histórico de eventos
      </h3>
      {carregando ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : eventos.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          Nenhum evento registrado ainda.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2 font-medium">Data</th>
                <th className="px-5 py-2 font-medium">Evento</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => (
                <tr key={e.id} className="border-b border-white/5 last:border-0">
                  <td className="px-5 py-3 text-slate-400">
                    {formatarDataHora(e.timestamp)}
                  </td>
                  <td className="px-5 py-3 text-slate-200">
                    {EVENTO_TXT[e.tipo] ?? e.tipo}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2 text-slate-300">
                      <StatusDot tom={STATUS_TOM[e.status]} />
                      {STATUS_TXT[e.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HubCard>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/whatsapp/WhatsappEventsTable.tsx && git commit -m "feat(whatsapp): tabela de histórico de eventos"
```

---

## Task B9: Sheet do QR (`WhatsappQrSheet.tsx`)

**Files:**
- Create: `src/components/admin/whatsapp/WhatsappQrSheet.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { WhatsAppStatus } from "@/lib/api/whatsapp";
import { Skeleton } from "./ui";

export function WhatsappQrSheet({
  aberto,
  onAbertoChange,
  status,
  qrImagem,
  onConectado,
}: {
  aberto: boolean;
  onAbertoChange: (v: boolean) => void;
  status: WhatsAppStatus | undefined;
  qrImagem: string | undefined;
  onConectado: () => void;
}) {
  // Fecha sozinho ao conectar.
  useEffect(() => {
    if (aberto && status === "conectado") {
      onConectado();
      onAbertoChange(false);
    }
  }, [aberto, status, onConectado, onAbertoChange]);

  return (
    <Sheet open={aberto} onOpenChange={onAbertoChange}>
      <SheetContent
        side="right"
        className="border-white/10 bg-[#0e1424] text-slate-100"
      >
        <SheetHeader>
          <SheetTitle className="text-slate-100">Conectar WhatsApp</SheetTitle>
          <SheetDescription className="text-slate-400">
            Escaneie o QR Code utilizando o WhatsApp Business responsável pela
            operação da plataforma.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
          {status === "aguardando_qr" && qrImagem ? (
            <>
              <img
                src={qrImagem}
                alt="QR code do WhatsApp"
                className="h-60 w-60 rounded-lg bg-white p-2"
              />
              <p className="text-sm text-slate-400">Expira em ~60 segundos</p>
              <p className="text-xs text-slate-500">Aguardando leitura…</p>
            </>
          ) : status === "conectando" || status === "aguardando_qr" ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Gerando QR…</p>
            </div>
          ) : status === "conectado" ? (
            <p className="text-sm text-emerald-300">Conectado com sucesso!</p>
          ) : (
            <Skeleton className="h-60 w-60" />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. (`lucide-react` exporta `Loader2` — confirmado neste repo.)

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/whatsapp/WhatsappQrSheet.tsx && git commit -m "feat(whatsapp): sheet de conexão com fluxo de QR"
```

---

## Task B10: Card de conexão + enviar teste + Dialog de desconexão (`WhatsappConnectionCard.tsx`)

**Files:**
- Create: `src/components/admin/whatsapp/WhatsappConnectionCard.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { whatsappApi, type WhatsappOverview } from "@/lib/api/whatsapp";
import { HubCard, Skeleton } from "./ui";
import { formatarDataHora, tempoRelativo } from "./format";

export function WhatsappConnectionCard({
  data,
  carregando,
  onConectar,
  onMudou,
}: {
  data: WhatsappOverview | null;
  carregando: boolean;
  onConectar: () => void; // abre o Sheet e dispara o connect
  onMudou: () => void; // recarrega o overview
}) {
  const status = data?.status;
  const conectado = status === "conectado";
  const [numeroTeste, setNumeroTeste] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [ultimoTeste, setUltimoTeste] = useState<string | null>(null);

  async function enviarTeste() {
    const num = numeroTeste.trim();
    if (num.replace(/\D/g, "").length < 10) {
      toast.error("Informe um número válido com DDD.");
      return;
    }
    setEnviando(true);
    try {
      await whatsappApi.enviarTeste(num);
      setUltimoTeste(new Date().toISOString());
      toast.success("Mensagem de teste enviada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar o teste.");
    } finally {
      setEnviando(false);
    }
  }

  async function desconectar() {
    setDesconectando(true);
    try {
      await whatsappApi.desconectar();
      toast.success("WhatsApp desconectado.");
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao desconectar.");
    } finally {
      setDesconectando(false);
    }
  }

  if (carregando) {
    return (
      <HubCard>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-4 h-10 w-40" />
      </HubCard>
    );
  }

  if (!conectado) {
    return (
      <HubCard className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            WhatsApp Desconectado
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Nenhuma sessão ativa encontrada. Sem uma sessão ativa, as empresas da
            plataforma não conseguirão enviar notificações automáticas.
          </p>
        </div>
        <Button
          onClick={onConectar}
          className="w-fit bg-[#f97316] text-[#1a1205] hover:bg-[#f97316]/90"
        >
          Conectar WhatsApp
        </Button>
      </HubCard>
    );
  }

  return (
    <HubCard className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">
          WhatsApp Conectado
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <Campo rotulo="Número" valor={data?.sessao.numeroConectado ?? "—"} />
          <Campo rotulo="Sessão" valor={data?.sessao.nomeSessao ?? "—"} />
          <Campo
            rotulo="Conectado desde"
            valor={formatarDataHora(data?.sessao.conectadoDesde ?? null)}
          />
          <Campo
            rotulo="Última atividade"
            valor={tempoRelativo(data?.sessao.ultimaAtividade ?? null)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={onConectar}
          className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
        >
          Reconectar
        </Button>
        <Dialog>
          <DialogTriggerButton desconectando={desconectando} />
          <DialogContent className="border-white/10 bg-[#0e1424] text-slate-100">
            <DialogHeader>
              <DialogTitle className="text-slate-100">
                Desconectar WhatsApp?
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                As empresas param de receber notificações automáticas até uma
                nova conexão. Tem certeza?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  variant="outline"
                  className="border-white/15 bg-white/5 text-slate-100 hover:bg-white/10"
                >
                  Cancelar
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="destructive"
                  disabled={desconectando}
                  onClick={() => void desconectar()}
                >
                  Desconectar
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Enviar mensagem de teste
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            type="tel"
            inputMode="tel"
            placeholder="Número com DDD (ex.: 67 99999-9999)"
            value={numeroTeste}
            onChange={(e) => setNumeroTeste(e.target.value)}
            className="flex-1 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#f97316] focus:outline-none"
          />
          <Button
            onClick={() => void enviarTeste()}
            disabled={enviando}
            className="bg-[#f97316] text-[#1a1205] hover:bg-[#f97316]/90"
          >
            {enviando ? "Enviando…" : "Enviar teste"}
          </Button>
        </div>
        {ultimoTeste && (
          <p className="mt-2 text-xs text-slate-500">
            Última enviada {tempoRelativo(ultimoTeste)}.
          </p>
        )}
      </div>
    </HubCard>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{rotulo}</p>
      <p className="text-sm font-medium text-slate-200">{valor}</p>
    </div>
  );
}

// Botão que dispara o Dialog (precisa de asChild no DialogTrigger).
import { DialogTrigger } from "@/components/ui/dialog";
function DialogTriggerButton({ desconectando }: { desconectando: boolean }) {
  return (
    <DialogTrigger asChild>
      <Button
        variant="outline"
        disabled={desconectando}
        className="border-red-400/40 bg-transparent text-red-300 hover:bg-red-400/10"
      >
        Desconectar
      </Button>
    </DialogTrigger>
  );
}
```

> Nota: mover o `import { DialogTrigger }` para o topo do arquivo junto dos outros imports de dialog (deixei inline só para destacar). Consolidar todos os imports no topo.

- [ ] **Step 2: Verificar tipos/lint**

Run: `npx tsc --noEmit`
Expected: sem erros. Ajustar os imports para o topo do arquivo (lint pode reclamar de import no meio do arquivo).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/whatsapp/WhatsappConnectionCard.tsx && git commit -m "feat(whatsapp): card de conexão com enviar-teste e dialog de desconexão"
```

---

## Task B11: Orquestrador (`WhatsappSection.tsx`)

**Files:**
- Modify (reescrever): `src/pages/admin/sections/WhatsappSection.tsx`

- [ ] **Step 1: Reescrever a página**

Substituir todo o conteúdo de `src/pages/admin/sections/WhatsappSection.tsx` por:

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { whatsappApi } from "@/lib/api/whatsapp";
import { useWhatsappOverview } from "@/components/admin/whatsapp/use-whatsapp-overview";
import { WhatsappHubHeader } from "@/components/admin/whatsapp/WhatsappHubHeader";
import { WhatsappStats } from "@/components/admin/whatsapp/WhatsappStats";
import { WhatsappConnectionCard } from "@/components/admin/whatsapp/WhatsappConnectionCard";
import { WhatsappStatusCard } from "@/components/admin/whatsapp/WhatsappStatusCard";
import { WhatsappEventsTable } from "@/components/admin/whatsapp/WhatsappEventsTable";
import { WhatsappQrSheet } from "@/components/admin/whatsapp/WhatsappQrSheet";

export function WhatsappSection() {
  const { data, carregando, erro, recarregar } = useWhatsappOverview();
  const [sheetAberto, setSheetAberto] = useState(false);

  async function conectar() {
    setSheetAberto(true);
    try {
      await whatsappApi.conectar();
      await recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao conectar.");
      setSheetAberto(false);
    }
  }

  return (
    <section className="flex flex-col gap-6 pb-10">
      <WhatsappHubHeader status={data?.status} carregando={carregando} />

      {erro && (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
          Não foi possível atualizar agora — exibindo os últimos dados
          conhecidos.
        </p>
      )}

      <WhatsappStats data={data} carregando={carregando} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <WhatsappConnectionCard
          data={data}
          carregando={carregando}
          onConectar={() => void conectar()}
          onMudou={() => void recarregar()}
        />
        <WhatsappStatusCard data={data} carregando={carregando} />
      </div>

      <WhatsappEventsTable data={data} carregando={carregando} />

      <WhatsappQrSheet
        aberto={sheetAberto}
        onAbertoChange={setSheetAberto}
        status={data?.status}
        qrImagem={data?.qrImagem}
        onConectado={() => {
          toast.success("WhatsApp conectado.");
          void recarregar();
        }}
      />
    </section>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/sections/WhatsappSection.tsx && git commit -m "feat(whatsapp): página vira orquestrador do hub mestre"
```

---

## Task B12: Teste de integração da página (`WhatsappSection.test.tsx`)

**Files:**
- Create: `src/pages/admin/sections/WhatsappSection.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/pages/admin/sections/WhatsappSection.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { WhatsappOverview } from "@/lib/api/whatsapp";

const overviewMock = vi.fn();
vi.mock("@/lib/api/whatsapp", () => ({
  whatsappApi: {
    overview: () => overviewMock(),
    conectar: vi.fn(),
    desconectar: vi.fn(),
    enviarTeste: vi.fn(),
  },
}));

import { WhatsappSection } from "./WhatsappSection";

function ovConectado(): WhatsappOverview {
  return {
    status: "conectado",
    sessao: {
      numeroConectado: "5567999999999",
      nomeSessao: "Hora Útil 360",
      conectadoDesde: "2026-06-05T09:42:00.000Z",
      ultimaAtividade: "2026-06-05T11:58:00.000Z",
      versaoSessao: "2.3000.1",
      ambiente: "prod",
    },
    kpis: {
      empresasUtilizando: 14,
      mensagensHoje: 234,
      mensagens30d: 5120,
      disponibilidade: { percentual: 99.8, desde: "2026-05-06T12:00:00.000Z", janelaCompleta: true },
    },
    eventos: [
      { id: "e1", tipo: "conectado", status: "sucesso", timestamp: "2026-06-05T09:42:00.000Z" },
    ],
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WhatsappSection", () => {
  it("renderiza KPIs e metadados quando conectado", async () => {
    overviewMock.mockResolvedValue(ovConectado());
    render(<WhatsappSection />);

    expect(await screen.findByText("14")).toBeInTheDocument(); // empresas
    expect(screen.getByText("234")).toBeInTheDocument(); // mensagens hoje
    expect(screen.getByText("99.8%")).toBeInTheDocument(); // disponibilidade
    expect(screen.getByText("WhatsApp Conectado")).toBeInTheDocument();
    expect(screen.getByText("5567999999999")).toBeInTheDocument();
    expect(screen.getByText("Conectado")).toBeInTheDocument(); // evento na tabela
  });

  it("mostra empty-state desconectado", async () => {
    overviewMock.mockResolvedValue({
      status: "desconectado",
      sessao: {
        numeroConectado: null, nomeSessao: null, conectadoDesde: null,
        ultimaAtividade: null, versaoSessao: null, ambiente: "dev",
      },
      kpis: {
        empresasUtilizando: 0, mensagensHoje: 0, mensagens30d: 0,
        disponibilidade: { percentual: 0, desde: "2026-06-05T12:00:00.000Z", janelaCompleta: false },
      },
      eventos: [],
    } satisfies WhatsappOverview);

    render(<WhatsappSection />);
    expect(await screen.findByText("WhatsApp Desconectado")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Conectar WhatsApp" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhum evento registrado ainda.")).toBeInTheDocument();
  });

  it("mantém a tela em pé se o overview falhar", async () => {
    overviewMock.mockRejectedValue(new Error("rede"));
    render(<WhatsappSection />);
    await waitFor(() =>
      expect(screen.getByText("Hub Mestre WhatsApp")).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails (or passes)**

Run: `npx vitest run src/pages/admin/sections/WhatsappSection.test.tsx`
Expected: depois de B11 já implementado, deve PASSAR. Se algum seletor falhar (ex.: texto exato), ajustar o teste/UI até verde. (O propósito do passo é provar que os estados renderizam.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/sections/WhatsappSection.test.tsx && git commit -m "test(whatsapp): integração da página do hub (conectado/desconectado/erro)"
```

---

## Task B13: Limpeza do CSS antigo + validação final do frontend

**Files:**
- Delete: `src/pages/admin/sections/whatsapp-admin.css` (somente se nada mais o importar)

- [ ] **Step 1: Confirmar que o CSS antigo não é mais importado**

Run: `grep -rn "whatsapp-admin.css" src`
Expected: nenhuma referência (a antiga estava em `WhatsappSection.tsx`, removida em B11). Se vazio, deletar o arquivo:

```bash
git rm src/pages/admin/sections/whatsapp-admin.css
```

- [ ] **Step 2: Rodar a suíte completa do frontend**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: lint sem erros novos; testes PASS; build OK.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore(whatsapp): remove CSS antigo do hub e valida build"
```

---

## Self-Review (preenchido pelo autor do plano)

**Spec coverage:**
- Header + badge global → B5. KPIs (4) → B6. Card de conexão (conectado/desconectado) → B10. Reconectar/Desconectar (+Dialog) → B10. Enviar teste melhorado → B10. QR via Sheet (estados) → B9. Painel lateral de status → B7. Histórico de eventos → B8. Polling/erro/loading → B4 + B11. Backend overview + métricas reais (empresas, mensagens, disponibilidade, eventos, metadados) → A1–A6. Testes front/back → A1–A4, B2, B12. ✔ Sem lacunas.

**Placeholder scan:** Sem TBD/TODO; todo passo tem código real e comandos com expectativa.

**Type consistency:** `WhatsappOverview`/`WhatsappSessao`/`WhatsappKpis`/`EventoWhats`/`WhatsappDisponibilidade` idênticos no contrato, no backend (`whatsapp-metrics.ts`) e no front (`lib/api/whatsapp.ts`). Funções: `contarEmpresasComWhats`, `calcularDisponibilidade(eventos, agora, janelaDias)`, `ultimosDias(count, ref)`, `montarOverview(args)`, `formatarDuracao/tempoRelativo/formatarDataHora`, `useWhatsappOverview()` → nomes consistentes entre tasks.

**Notas de risco:**
- `lucide-react` exporta `Loader2` (verificado neste repo).
- `DialogTrigger` deve ficar importado no topo em B10 (a nota já alerta).
- Backend: não subir o servidor; validação por testes + build.
