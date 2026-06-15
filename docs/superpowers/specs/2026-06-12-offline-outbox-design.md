# Spec — Offline-first do operador: outbox + cache de leitura

Data: 2026-06-12
Status: proposta (aguardando aprovação)
Escopo: app do operador de campo (checklist/ponto/emergência) no `360-repository` + suporte no `back-360-` (NestJS)

## Contexto e problema

Hoje o app tem **dois sistemas offline convivendo**:

1. **Firestore direto** (checklist, emergência): offline robusto de graça — o SDK
   guarda em IndexedDB, enfileira escritas e sincroniza sozinho.
2. **Chamadas ao NestJS** (ponto, workflow, escala, abonos, configurações):
   offline improvisado — três mecanismos diferentes em localStorage
   (`pontos-fila.ts`, `workflow-fila.ts`, `ponto-cache.ts`).

Como a direção do projeto é migrar o acesso a dados para o NestJS
(`vehicles`/Firestore direto sendo aposentados), o lado robusto encolhe e o lado
frágil vira o padrão. Fragilidades concretas do lado frágil:

- **localStorage tem ~5 MB** — estoura com fotos (base64) e poda dados antigos
  sem avisar o operador.
- **Sem idempotência**: retry da fila do ponto pode **duplicar batida**
  (obrigação legal — Portaria 671).
- **Descarte silencioso**: erro de validação do backend descarta o item da fila
  de workflow (perda de respostas "Não").
- **Reenvio só em primeiro plano**: filas só tentam ao montar a tela certa ou no
  evento `online`; sem retry contínuo.
- **Fotos em base64 dentro do doc** do Firestore: doc pode passar de 1 MiB e a
  sincronização falha silenciosamente.
- **Dados do NestJS somem offline**: escala, abonos e configurações não têm
  cache estruturado.
- **Falhas invisíveis**: o operador não tem onde ver o que está pendente, o que
  sincronizou e o que falhou (só o badge do checklist).

## Decisão

Construir uma **camada offline única** (`src/lib/offline/`) sobre o NestJS,
replicando o que o SDK do Firestore faz, mas apontando para o nosso backend:

> **Outbox em IndexedDB + idempotência no backend + estado visível.**

Toda escrita do operador grava primeiro no aparelho (confirmação imediata na
UI), e um motor único leva ao servidor quando der. Toda leitura do escopo do
operador vem primeiro do cache local (prefetch), atualizado por trás quando há
rede.

## Arquitetura

### 1. Outbox (caminho de escrita)

Store `sync_queue` no IndexedDB (via Dexie.js):

```ts
{
  id: string;          // uuid gerado no aparelho — é a chave de idempotência
  entity: 'ponto' | 'checklist' | 'emergencia' | 'workflow' | 'foto';
  action: 'create' | 'update';
  payload: object;     // corpo da requisição
  fotos?: Blob[];      // binário de verdade, fora do payload
  status: 'PENDING' | 'SENDING' | 'NEEDS_ATTENTION' | 'SYNCED';
  createdAt: string;
  retryCount: number;
  lastError?: string;  // motivo legível da última falha
}
```

**Motor de sincronização** (um só para todas as entidades):

- Gatilhos: abrir o app, evento `online`, ao finalizar um registro, botão
  manual "Sincronizar", intervalo periódico com o app aberto (a cada 5 min).
- Envio em ordem (`createdAt`), com **backoff exponencial** entre tentativas.
- Classificação de erro:
  - **Transitório** (sem rede, timeout, 5xx): mantém `PENDING`, tenta de novo.
    Nada é descartado, sem limite de tentativas.
  - **Definitivo** (4xx de validação): vira `NEEDS_ATTENTION` — sai do caminho
    da fila (não entope) mas fica **visível** para o operador/encarregado agir.
- `SYNCED` remove o item da fila e decrementa o badge.

### 2. Idempotência (backend NestJS)

- Endpoints de escrita do operador aceitam o `id` do cliente (header
  `Idempotency-Key`).
- Interceptor global: se a chave já foi processada, responde o resultado
  anterior (HTTP 200) em vez de gravar de novo. Chaves guardadas em coleção
  própria com TTL (ex.: 30 dias).
- Resolve o cenário "servidor gravou mas a resposta se perdeu" — o reenvio
  não duplica.

### 3. Cache de leitura (prefetch do escopo)

- **Escopo local do operador** (nunca o banco inteiro): escala, abonos,
  configurações da empresa, definições de checklist, frota da prefeitura,
  credenciais offline e registros recentes do próprio operador.
- **Retenção por entidade**: registros recentes limitados no tempo — padrão
  **60 dias**, ajustável por entidade se alguma precisar de mais ou menos.
- v1: pull completo do escopo (volume pequeno). Evolução: `/sync/pull` com
  delta por `updatedAt` (só o que mudou desde o último sync).
- Leitura **stale-while-revalidate**: a tela lê o cache local primeiro
  (instantâneo, funciona offline) e atualiza por trás quando há rede.
- Substitui os caches manuais (`ponto-cache.ts`, cache de definições) por um
  mecanismo único.

### 4. Fotos

- Fotos viram **Blobs na fila** (IndexedDB aguenta gigabytes) com upload
  separado para o Supabase Storage via `/uploads` (back#35).
- O payload do registro referencia as URLs após o upload.
- Elimina: base64 dentro do doc (limite de 1 MiB) e fotos no localStorage
  (limite de 5 MB).

### 5. Visibilidade

- Badge global de pendências (evolução do `useSyncPendencias`).
- Tela "Sincronização": lista por tipo com status, horário, motivo de falha
  (`lastError`) e ações (reenviar agora, ver detalhes do item rejeitado).

### 6. Conflitos

- Os fluxos do operador são **append-only** (criam registros, não editam dados
  compartilhados) → v1 usa "última escrita vence" por registro próprio.
- Entidades ganham `updatedAt`/`version` no backend para habilitar o delta sync
  e evolução futura de resolução de conflito, se necessário.

## O que NÃO entra (decidido)

- **PostgreSQL** como banco online — o banco é o Firestore; trocar de banco é
  outra migração, fora deste escopo.
- **Redis / BullMQ** — otimizações de servidor, não de offline; BullMQ exige
  worker 24/7 (incompatível com o deploy serverless atual do back).
- **Reescrita do front em Next.js** — o app do operador existente (Vite +
  React) continua.
- **Background Sync API** — sem suporte no iOS/Safari, e esconderia o estado da
  fila dentro do service worker.

## Fases (cada fase ≈ um PR entregável)

| Fase | Repo | Entrega | Critério de aceite |
|---|---|---|---|
| 0 | back | Interceptor de idempotência + store de chaves | Reenvio com mesma `Idempotency-Key` não duplica registro |
| 1 | front | `src/lib/offline/` (Dexie + sync_queue + motor) e migração do **ponto** | Batida offline sincroniza sozinha, sem duplicar; pendências da fila antiga migradas |
| 2 | front+back | Checklist, emergência e workflow via outbox (requer endpoints NestJS para registros de checklist/emergência) | Erro de validação vira `NEEDS_ATTENTION`, nunca descarte silencioso |
| 3 | front | Fotos como Blob + fila de upload | Nenhum base64 em doc/localStorage; doc nunca estoura 1 MiB |
| 4 | front+back | Prefetch ampliado (escala/abonos/config) + tela de pendências; depois delta sync | Folha/escala visíveis offline; operador vê e age sobre pendências |

A ordem começa pelo ponto (Fase 1) porque é onde perda/duplicação tem
consequência legal.

## Testes

- **Unit (Vitest, front)**: transições de estado do motor (PENDING → SENDING →
  SYNCED/NEEDS_ATTENTION), backoff, classificação de erros, migração das filas
  legadas de localStorage.
- **Unit (Jest, back)**: interceptor de idempotência (primeira chamada grava,
  reenvio responde resultado anterior).
- **E2E (Playwright)**: registrar offline → voltar rede → sincroniza sem ação
  do usuário; resposta 4xx aparece como pendência visível.

## Riscos e decisões em aberto

1. **Endpoints novos no Nest** para registros de checklist/emergência (hoje vão
   ao Firestore direto) — precisa alinhar com a migração geral de dados e com
   as Security Rules.
2. **Migração das filas atuais**: pendências em localStorage de aparelhos em
   campo precisam ser importadas para o outbox no primeiro boot da versão nova
   (sem perda).
3. **Eviction de storage**: solicitar `navigator.storage.persist()` no app do
   operador para reduzir risco de o navegador despejar o IndexedDB.
4. **iOS**: storage do PWA instalado é separado do Safari — manter orientação
   de campo de usar o app instalado.
