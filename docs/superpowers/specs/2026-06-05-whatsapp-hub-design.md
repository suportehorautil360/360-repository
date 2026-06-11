# Hub Mestre WhatsApp — Design

**Data:** 2026-06-05
**Telas:** `/admin/whatsapp` (front) + módulo `whatsapp` (back-360-)
**Escopo:** dois repositórios — front (este) e `back-360-` (repo separado, remote `suportehorautil360/back`).

## Contexto e problema

A tela `/admin/whatsapp` é o **canal central de comunicação** da plataforma: é por ela que o número remetente (Baileys, uma sessão para toda a plataforma) se conecta para disparar notificações de emergência a todas as empresas. Hoje a tela é só um cartão "Desconectado / Conectar / gerar QR" + um campo de envio de teste — não reflete a importância operacional da função.

O objetivo é reconstruí-la como um **Hub Mestre de Comunicação** no padrão de SaaS enterprise (KPIs, monitoramento de sessão, histórico de eventos), com **dados reais** (sem números fake), preparando o terreno para evoluções futuras (múltiplas sessões, logs de envio, filas, métricas).

## Decisões tomadas (brainstorming)

1. **Dados:** reais — estender o backend NestJS para fornecer KPIs, metadados da sessão e log de eventos. Nada mockado.
2. **"Enviar teste":** manter e **melhorar a UI/UX** (não remover).
3. **Styling:** Tailwind dark explícito + componentes locais. Não depender dos tokens semânticos claros do shadcn; dar override dark pontual no `Sheet`. Autocontido, zero risco às outras telas do admin.
4. **Disponibilidade:** "% dos últimos 30 dias" calculada a partir do log de eventos (rotulada "desde {data}" enquanto não houver 30 dias completos).
5. **Desconectar:** com confirmação via `Dialog` shadcn antes de executar.
6. **Endpoint:** um endpoint consolidado `GET /whatsapp/overview` retorna status + KPIs + metadados + eventos num único payload (a página faz um polling só).

## Estado atual (levantado no código)

- **Front:**
  - Página: [src/pages/admin/sections/WhatsappSection.tsx](../../../src/pages/admin/sections/WhatsappSection.tsx) — usa CSS à mão (`whatsapp-admin.css`).
  - API client: [src/lib/api/whatsapp.ts](../../../src/lib/api/whatsapp.ts) — `status`/`conectar`/`desconectar`/`enviarTeste`; envia `x-admin-secret`; respostas no formato `{ data, message? }`.
  - UI kit ([src/components/ui/](../../../src/components/ui/)): existem `Sheet`, `Button`, `Dialog`, `Select`, etc. **Não existem** `Card`, `Badge`, `Skeleton`, `Table`.
  - Toasts: **sonner** (`<Toaster richColors />` em `main.tsx`).
  - Tema: admin é **dark** (`.admin-root` com `--bg/--glass/--text/--muted/--primary`); tokens shadcn no `tailwind.css` são **claros** (`--background:#fff`) → por isso o styling dark explícito.
- **Back (`back-360-`):**
  - Serviço: [back-360-/src/modules/whatsapp/whatsapp.service.ts](../../../back-360-/src/modules/whatsapp/whatsapp.service.ts) — Baileys, estado em memória (`status`, `qrAtual`, `tentativas`), creds persistidas no Firestore `whatsappSessions/default`. Métodos `enviarMensagem`/`enviarImagem` são os caminhos reais de envio.
  - Controller: [back-360-/src/modules/whatsapp/whatsapp.controller.ts](../../../back-360-/src/modules/whatsapp/whatsapp.controller.ts) — `GET /status`, `POST /connect`, `POST /logout`, `POST /enviar-teste`, sob `AdminSecretGuard`.
  - Caminho de emergência que envia de verdade: [back-360-/src/modules/emergencies/emergencies.service.ts](../../../back-360-/src/modules/emergencies/emergencies.service.ts) (`notificarWhatsApp`) → chama `enviarMensagem`/`enviarImagem`.
  - Config por empresa: coleção Firestore `configuracoes`, com `alertas.notificacaoWhatsapp` (bool) e `empresa.whatsappNumero` (string).

## Arquitetura — Frontend

### Componentes (`src/components/admin/whatsapp/`)

A página vira um orquestrador fino (busca + polling + composição). Componentes:

| Arquivo | Responsabilidade |
|---|---|
| `WhatsappHubHeader.tsx` | Título "Hub Mestre WhatsApp", subtítulo e badge de status global (🟢 Online / 🔴 Desconectado). |
| `WhatsappStats.tsx` | Grade de KPIs `grid-cols-1 md:grid-cols-2 xl:grid-cols-4`: Empresas utilizando, Mensagens hoje, Status da sessão, Disponibilidade. |
| `WhatsappConnectionCard.tsx` | Card principal (coluna `2fr`). Desconectado → empty-state + "Conectar WhatsApp" (abre Sheet). Conectado → número/nome/data de conexão/última atividade + botões Reconectar/Desconectar + o "enviar teste" repaginado. |
| `WhatsappStatusCard.tsx` | Painel lateral (coluna `1fr`): número conectado, conectado desde, último ping, **tempo de sessão atual** (duração, derivada de `conectadoDesde` no cliente — não confundir com o KPI "Disponibilidade", que é o % de 30 dias), versão da sessão, ambiente. |
| `WhatsappEventsTable.tsx` | Histórico de eventos (Data / Evento / Status), com empty-state quando vazio. |
| `WhatsappQrSheet.tsx` | `<Sheet side="right">` com o fluxo do QR (estados: Skeleton → QR → Spinner → sucesso → fecha sozinho). |
| `ui.tsx` | Primitivos dark locais: `HubCard`, `Kpi`, `StatusBadge`, `StatusDot`, `Skeleton`. Reaproveita `Button` e `Sheet` (+ override dark). |

Layout da área principal: `grid lg:grid-cols-[2fr_1fr]` (conexão à esquerda, status à direita); histórico abaixo, largura cheia.

### Styling

Classes Tailwind dark explícitas, p.ex.: superfícies `bg-white/[0.03]`, bordas `border-white/10`, texto `text-slate-100` / muted `text-slate-400`, primário `bg-[#f97316] text-[#1a1205]`, sucesso `text-emerald-400`, alerta `text-amber-400`, erro `text-red-400`. `Sheet` recebe `className="bg-[#0e1424] border-white/10 text-slate-100"`. Raio `rounded-xl`/`rounded-2xl`.

### Camada de dados (front)

[src/lib/api/whatsapp.ts](../../../src/lib/api/whatsapp.ts):
- Nova função `overview(): Promise<WhatsappOverview>` → `GET /whatsapp/overview`.
- Mantém `conectar`/`desconectar`/`enviarTeste`.
- Novo tipo `WhatsappOverview` (ver contrato abaixo).

Hook `useWhatsappOverview()` (novo, p.ex. `src/components/admin/whatsapp/use-whatsapp-overview.ts`):
- Faz o fetch e expõe `{ data, carregando, erro, recarregar }`.
- **Polling adaptativo:** ~2,5s enquanto `aguardando_qr`/`conectando`; ~20s quando `conectado`/`desconectado`.
- Em erro de fetch: mantém o último dado bom, sinaliza `erro`, **nunca derruba a tela**.

## Arquitetura — Backend (`back-360-`)

### Contrato `GET /whatsapp/overview`

Resposta `{ data: WhatsappOverview, message }`, com `WhatsappOverview`:

```ts
{
  status: 'desconectado' | 'conectando' | 'aguardando_qr' | 'conectado';
  qrImagem?: string;                 // dataURL, só quando aguardando_qr
  sessao: {
    numeroConectado: string | null;  // sock.user?.id normalizado
    nomeSessao: string | null;       // sock.user?.name ?? 'Hora Útil 360'
    conectadoDesde: string | null;   // ISO; marca em connection 'open'
    ultimaAtividade: string | null;  // ISO; último envio/evento
    versaoSessao: string | null;     // ex. "2.3000.x" (fetchLatestBaileysVersion)
    ambiente: 'dev' | 'prod';        // process.env.NODE_ENV
  };
  kpis: {
    empresasUtilizando: number;      // configuracoes com toggle on + número
    mensagensHoje: number;
    mensagens30d: number;
    disponibilidade: {
      percentual: number;            // 0..100, do log de eventos
      desde: string;                 // ISO — início do registro (rótulo "desde {data}")
      janelaCompleta: boolean;       // true quando já há 30 dias de histórico
    };
  };
  eventos: Array<{
    id: string;
    tipo: 'sessao_iniciada' | 'qr_gerado' | 'conectado' | 'queda' | 'sessao_encerrada';
    status: 'sucesso' | 'aviso' | 'erro';
    timestamp: string;               // ISO
  }>;                                // ~20 mais recentes, desc
}
```

### Mudanças no `whatsapp.service.ts`

- **Metadados em memória + persistência:** `conectadoDesde`, `versaoSessao`, `ultimaAtividade`. `conectadoDesde`/sessão salvos em `whatsappSessions/default` (sobrevive a restart). `versaoSessao` capturada do `fetchLatestBaileysVersion()`.
- **Contador de mensagens:** incrementar em `enviarMensagem` e `enviarImagem` (cobre emergência real + teste). Persistir em `whatsappStats/{AAAA-MM-DD}` (campo `mensagens`, incremento atômico). `mensagensHoje` = doc de hoje; `mensagens30d` = soma dos últimos 30 docs. Atualizar `ultimaAtividade` a cada envio.
- **Log de eventos:** append em `whatsappEvents` nas transições: `sessao_iniciada` (connect manual), `qr_gerado` (chega o QR), `conectado` (open), `queda` (close não-logout), `sessao_encerrada` (logout/loggedOut). Cada doc: `{ tipo, status, timestamp }`. Leitura dos ~20 mais recentes.
- **Disponibilidade (30d):** função **pura** que recebe os eventos e a janela e calcula a fração de tempo "conectado" (intervalos `conectado`→`queda`/`sessao_encerrada`) sobre a janela. Exata para a sessão atual; `janelaCompleta=false` e `desde={primeiro evento}` enquanto < 30 dias.
- **Empresas utilizando:** consulta `configuracoes` e conta onde `alertas.notificacaoWhatsapp === true` e `empresa.whatsappNumero` não vazio.
- **`getOverview()`:** monta o `WhatsappOverview` agregando tudo.

### Mudanças no `whatsapp.controller.ts`

- Nova rota `GET /whatsapp/overview` → `getOverview()`, sob o `AdminSecretGuard` existente. Demais rotas inalteradas.

## Fluxos, estados e interações

- **Conectar:** clique → `POST /connect` → abre `WhatsappQrSheet` → Sheet faz polling até o QR aparecer → ao `conectado`: toast de sucesso + fecha o Sheet + recarrega overview.
- **Reconectar:** mesmo caminho do conectar (reabre o fluxo de QR/sessão).
- **Desconectar:** abre `Dialog` shadcn de confirmação ("As empresas param de receber notificações") → confirma → `POST /logout` → toast + recarrega.
- **Enviar teste (melhorado):** visível só quando conectado, dentro do card de conexão — input de telefone com dica de formato, botão com estado de loading, validação por toast (número vazio), e indicador discreto "última enviada há Xs". Mantém `POST /enviar-teste`.
- **Estados de carregamento:** Skeletons nos KPIs, cards e tabela no primeiro load.
- **Erro de overview:** mantém último dado bom + aviso discreto inline; nunca quebra.
- **Eventos vazios:** linha de empty-state "Nenhum evento registrado ainda."

## UX guidelines (do spec)

- Usar: `Sheet` para o QR, `Skeleton` para loading, badges para status, toasts para feedback, empty-states informativos, cards para agrupamento.
- Não usar: modal para QR, `alert()`/`confirm()` nativos, layouts centralizados vazios. (Confirmação de desconectar é via `Dialog` shadcn, não `confirm()` nativo.)

## Testes

- **Front (Vitest + Testing Library):** mockar `whatsappApi` e `../lib/firebase/firebase`. Cobrir: skeleton de carregando; empty-state desconectado; metadados + KPIs + tabela de eventos quando conectado; validação do enviar-teste; abertura do Dialog de confirmação no desconectar.
- **Back (Jest):** teste da função pura de disponibilidade (vários cenários de log); incremento do contador de mensagens; formato do payload de `getOverview`; contagem de empresas utilizando — Firestore mockado (estilo `phone.spec.ts`).
- **E2E (Playwright):** não estender (admin/whatsapp fica fora do precache do PWA).

## Fora de escopo (futuro)

Múltiplas sessões, histórico de mensagens detalhado, filas de processamento, monitoramento em tempo real (websocket), integrações externas. O contrato do `overview` e o log de eventos já deixam o terreno preparado.

## Entrega / repositórios

- Front (este repo): componentes, hook, extensão do api client, página, testes.
- `back-360-` (repo separado): serviço, controller, função de disponibilidade, testes. Commit/PR nos **dois** repos. Quem mescla na `main` é o dono do projeto.
