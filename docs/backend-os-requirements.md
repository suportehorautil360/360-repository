# Backend — Requisitos API de Ordem de Serviço (OS)

Especificação para o time **back-360** (NestJS).  
Front: **Hora Útil 360** — já consome Fase 1; demais fluxos ainda usam Firestore direto.

**Persistência:** Firestore (coleções existentes). O backend é a camada de regras de negócio + validação + transações.

---

## Índice

1. [Coleções Firestore](#1-coleções-firestore)
2. [Máquina de estados](#2-máquina-de-estados)
3. [Fase 1 — Criar e listar solicitação](#3-fase-1--criar-e-listar-solicitação) ✅ front integrado
4. [Regra das 3 oficinas](#4-regra-das-3-oficinas)
5. [Fase 2 — Oficina: listar e enviar orçamento](#5-fase-2--oficina-listar-e-enviar-orçamento)
6. [Fase 3 — Prefeitura: aprovar orçamento](#6-fase-3--prefeitura-aprovar-orçamento)
7. [Fase 4 — Devolução e auditoria](#7-fase-4--devolução-e-auditoria)
8. [Fase 5 — Preventiva (futuro)](#8-fase-5--preventiva-futuro)
9. [Segurança e índices](#9-segurança-e-índices)
10. [Formato padrão de resposta](#10-formato-padrão-de-resposta)
11. [Checklist de implementação](#11-checklist-de-implementação)

---

## 1. Coleções Firestore

### `equipamentos` (leitura)

Usado na criação da OS.

| Campo | Tipo | Uso |
|-------|------|-----|
| `prefeituraId` | string | Validar pertencimento |
| `descricao` / `label` | string | → `solicitacoesOS.equipamento` |
| `linha` ou `tipo` | string | Match com oficinas + gravar em `linha` |
| `medicaoAtual` | number | → `horimetro` (formatar com unidade) |
| `unidadeRevisao` | string | `"h"` ou km |

### `oficinas` (leitura)

| Campo | Tipo | Uso |
|-------|------|-----|
| `prefeituraId` | string | |
| `nome` | string | → `oficinas[]` na solicitação |
| `especialidade` | string | Match com linha do equipamento |
| `status` | `"Ativa"` \| `"Suspensa"` | Só `"Ativa"` entra no sorteio |

### `solicitacoesOS` (escrita Fase 1+)

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `protocolo` | string | sim | `OS-{ano}-{seq}` sequencial por prefeitura/ano |
| `prefeituraId` | string | sim | |
| `equipmentId` | string | recomendado | ID do equipamento (front já envia) |
| `equipamento` | string | sim | Nome/descrição denormalizado |
| `linha` | string | sim | |
| `operador` | string | sim | |
| `horimetro` | string | não | Ex.: `"4552,5 h"` |
| `relato` | string | sim | |
| `tipoOs` | string | não | `"C"` corretiva (default), `"P"` preventiva (futuro) |
| `dataAgendamento` | string | não | `YYYY-MM-DD` |
| `oficinas` | string[] | sim | Nomes |
| `oficinasIds` | string[] | sim | **Doc IDs** — oficina filtra por isso |
| `oficinasResponderam` | string[] | não | `arrayUnion` ao enviar orçamento |
| `status` | string | sim | Ver seção 2 |
| `criadoEm` | timestamp | sim | |

### `ordensServico` (escrita Fase 2+)

Orçamento de **uma** oficina para **uma** solicitação.

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `protocolo` | string | sim — protocolo do orçamento (oficina gera) |
| `prefeituraId` | string | sim |
| `solicitacaoOsId` | string | sim — FK `solicitacoesOS` |
| `oficinaId` | string | sim |
| `oficinaNome` | string | sim |
| `operador` | string | não — hoje espelha nome oficina |
| `equipamento` | string | sim — cópia da solicitação |
| `defeito` | string | sim — cópia do `relato` |
| `itens` | `{ descricao: string, valor: number }[]` | sim |
| `valorTotal` | number | sim — soma dos itens |
| `status` | string | `aguardando_aprovacao` → `aprovado` \| `recusado` |
| `criadoEm` | timestamp | sim |

### `checklistsDevolucao` (escrita Fase 4)

| Campo | Tipo |
|-------|------|
| `id` | string |
| `prefeituraId` | string |
| `oficinaId` | string |
| `oficinaNome` | string |
| `equipamento` | string |
| `relatorio` | string |
| `ordemServicoId` | string \| null |
| `fotoNovaUrl` | string (base64 ou URL Storage) |
| `fotoVelhaUrl` | string |
| `fotoProntoUrl` | string |
| `criadoEm` | timestamp |

---

## 2. Máquina de estados

### `solicitacoesOS.status`

```
aguardando_orcamento
    │  (cada oficina convidada envia orçamento → oficinasResponderam++)
    │  quando len(oficinasResponderam) >= len(oficinasIds)
    ▼
aguardando_aprovacao
    │  (prefeitura PATCH aprovar → escolhe 1 ordensServico)
    ▼
aprovado
    │  (serviço executado + devolução — futuro)
    ▼
concluido          ← previsto; nenhum código grava hoje
```

### `ordensServico.status`

```
aguardando_aprovacao  →  aprovado | recusado
```

Na aprovação: **exatamente 1** `aprovado` por `solicitacaoOsId`; demais `aguardando_aprovacao` → `recusado`.

---

## 3. Fase 1 — Criar e listar solicitação

**Status:** front já integrado (`src/lib/api/os-solicitacoes.ts`).

### `POST /os/solicitacoes`

Cria documento em `solicitacoesOS`.

**Request body:**

```json
{
  "prefeituraId": "string",
  "equipmentId": "string",
  "operator": "string",
  "report": "string",
  "type": "C",
  "scheduledDate": "2026-06-14"
}
```

| Campo | Obrigatório | Validação |
|-------|-------------|-----------|
| `prefeituraId` | sim | não vazio |
| `equipmentId` | sim | doc existe em `equipamentos` e `prefeituraId` bate |
| `operator` | sim | trim, não vazio |
| `report` | sim | trim, não vazio |
| `type` | não | default `"C"` |
| `scheduledDate` | não | ISO date `YYYY-MM-DD` |

**Processamento interno:**

1. Buscar equipamento por `equipmentId`
2. Extrair `linha` = `equipamento.linha` ?? `equipamento.tipo`
3. Se linha vazia → **400** `Equipment has no line...`
4. Se `equipamento.prefeituraId !== prefeituraId` → **400**
5. Executar [regra das 3 oficinas](#4-regra-das-3-oficinas)
6. Gerar `protocolo` sequencial (ver abaixo)
7. Montar `horimetro` a partir de `medicaoAtual` + unidade
8. `add` em `solicitacoesOS` com `status: "aguardando_orcamento"`, `oficinasResponderam: []`

**Geração de protocolo:**

```
OS-{ano}-{seq}
seq = incremento atômico por (prefeituraId, ano), 3 dígitos mínimo
Ex.: OS-2026-001, OS-2026-048
```

Não usar random/timestamp (legado fraco no front).

**Response 201:**

```json
{
  "data": {
    "id": "<firestore-doc-id>",
    "protocol": "OS-2026-048",
    "invitedWorkshops": [
      { "id": "oficinaDoc1", "name": "Avantec" }
    ],
    "status": "aguardando_orcamento"
  },
  "message": "Service order request created successfully."
}
```

**Erros:**

| HTTP | Quando | message (exemplo) |
|------|--------|---------------------|
| 400 | Equipamento sem linha ou prefeitura errada | `Equipment has no line...` |
| 404 | `equipmentId` não existe | `Equipment not found` |
| 422 | Nenhuma oficina ativa no município | `No active workshops...` |
| 500 | Falha Firestore | `Could not create...` |

---

### `GET /os/solicitacoes/:prefeituraId`

Lista solicitações do município.

**Query params:**

| Param | Tipo | Descrição |
|-------|------|-----------|
| `status` | string | `aguardando_orcamento`, `aguardando_aprovacao`, `aprovado`, `concluido` — omitir = todos |
| `startDate` | `YYYY-MM-DD` | Filtro `criadoEm >=` |
| `endDate` | `YYYY-MM-DD` | Filtro `criadoEm <=` fim do dia |

**Response 200:**

```json
{
  "data": [
    {
      "id": "doc-id",
      "protocol": "OS-2026-048",
      "equipment": "Sany SYL956H",
      "line": "Amarela",
      "operator": "João Silva",
      "report": "caixa hidráulica",
      "workshops": ["Avantec", "Gava"],
      "workshopIds": ["doc1", "doc2"],
      "status": "aguardando_orcamento",
      "statusLabel": "Aguard. Orçamento",
      "dateLabel": "15/05/2026",
      "createdAt": "2026-05-15T14:30:00.000Z",
      "protocolo": "OS-2026-048",
      "equipamento": "Sany SYL956H",
      "linha": "Amarela",
      "operador": "João Silva",
      "relato": "caixa hidráulica",
      "oficinas": ["Avantec", "Gava"],
      "oficinasIds": ["doc1", "doc2"],
      "criadoEm": { "seconds": 1747319400 }
    }
  ],
  "message": "Service order requests loaded successfully."
}
```

**Importante:** incluir campos **EN e PT** (compatibilidade front).  
`statusLabel` em português para badge na tabela.

**Ordenação:** `criadoEm` descendente.

---

## 4. Regra das 3 oficinas

Função usada em `POST /os/solicitacoes`.

```typescript
function normEsp(s: string): string {
  return s.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim();
}

function linhaCompat(equipLine: string, oficinaEsp: string): boolean {
  const a = normEsp(equipLine);
  const b = normEsp(oficinaEsp);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}
```

**Algoritmo:**

```
1. candidates = oficinas WHERE prefeituraId = X AND status = "Ativa"

2. matches = candidates.filter(o => linhaCompat(equipamento.linha, o.especialidade))

3. SE matches.length === 0:
     pool = candidates          // fallback: todas ativas do município
   SENÃO:
     pool = matches

4. SE pool.length === 0 → throw 422

5. shuffle(pool) e pegar slice(0, 3)

6. RETORNAR { ids, nomes }
```

**Notas:**

- Máximo **3** convites; mínimo **1**
- Sorteio aleatório (sem peso por carga/distância) — pode evoluir depois
- `oficinaId` no array deve ser o **document ID** Firestore (mesmo ID do login da oficina)

---

## 5. Fase 2 — Oficina: listar e enviar orçamento

**Status:** front ainda usa Firestore em `OficinaPage.tsx`.

### `GET /os/solicitacoes/oficina/:oficinaId`

OS pendentes para a oficina logada.

**Query:**

```
status = aguardando_orcamento  (default)
prefeituraId = optional filter
```

**Lógica Firestore equivalente:**

```
solicitacoesOS
  WHERE oficinasIds array-contains oficinaId
  AND status == "aguardando_orcamento"
```

**Filtro pós-query:** excluir se `oficinaId ∈ oficinasResponderam` (oficina já respondeu).

**Response:** mesmo shape do GET prefeitura (lista de solicitações).

**Autorização:** usuário autenticado deve ser a oficina `oficinaId` ou admin.

---

### `POST /os/orcamentos`

Oficina envia proposta.

**Request:**

```json
{
  "solicitacaoOsId": "string",
  "oficinaId": "string",
  "protocol": "2026-123",
  "items": [
    { "description": "Kit reparo", "value": 4200 },
    { "description": "Mão de obra", "value": 1800 }
  ]
}
```

| Validação | Regra |
|-----------|-------|
| Solicitação existe | |
| `solicitacao.status === "aguardando_orcamento"` | |
| `oficinaId ∈ solicitacao.oficinasIds` | |
| `oficinaId ∉ solicitacao.oficinasResponderam` | |
| Cada item: `description` e `value > 0` | |
| Não existe `ordensServico` duplicada (mesma solicitação + oficina) | |

**Transação atômica:**

```
1. add ordensServico {
     protocolo, prefeituraId, solicitacaoOsId, oficinaId, oficinaNome,
     equipamento: sol.equipamento, defeito: sol.relato,
     itens, valorTotal, status: "aguardando_aprovacao", criadoEm
   }

2. oficinasResponderam' = arrayUnion(oficinaId)

3. SE len(oficinasResponderam') >= len(oficinasIds):
     solicitacao.status = "aguardando_aprovacao"

4. update solicitacoesOS
```

**Response 201:**

```json
{
  "data": {
    "id": "<ordem-doc-id>",
    "protocol": "2026-123",
    "valorTotal": 6000,
    "solicitacaoStatus": "aguardando_orcamento"
  },
  "message": "Quote submitted successfully."
}
```

---

### `GET /os/orcamentos/oficina/:oficinaId`

Lista orçamentos enviados pela oficina (substitui query direta em `OficinaPage`).

**Query:** `status`, `prefeituraId`, paginação opcional.

---

### `PATCH /os/orcamentos/:id`

Atualizar `valorTotal` (oficina edita orçamento antes da aprovação).

Legado: `OficinaPage.handleAtualizarValorOrcamento`.

---

## 6. Fase 3 — Prefeitura: aprovar orçamento

**Status:** front usa `writeBatch` em `OrcamentosAprovacoesSection.tsx`.

### `GET /os/solicitacoes/:prefeituraId/com-orcamentos`

Lista solicitações **com** orçamentos aninhados (tela Orçamentos e Aprovações).

**Response:**

```json
{
  "data": [
    {
      "id": "sol-id",
      "protocol": "OS-2026-047",
      "equipment": "Sany SYL956H",
      "line": "Amarela",
      "status": "aguardando_aprovacao",
      "createdAt": "...",
      "invitedCount": 3,
      "quotesReceived": 3,
      "quotes": [
        {
          "id": "ordem-id",
          "protocol": "ORC-047-A",
          "workshopName": "Avantec",
          "defect": "caixa hidráulica",
          "totalValue": 6000,
          "status": "aguardando_aprovacao",
          "items": [{ "description": "...", "value": 4200 }]
        }
      ]
    }
  ]
}
```

Incluir campos PT compat (`protocolo`, `equipamento`, etc.).

---

### `PATCH /os/solicitacoes/:solicitacaoId/aprovar`

Prefeitura escolhe **um** orçamento.

**Request:**

```json
{
  "ordemServicoId": "string"
}
```

**Validações:**

- Solicitação pertence à prefeitura do usuário
- `ordem.solicitacaoOsId === solicitacaoId`
- `ordem.status === "aguardando_aprovacao"`
- Solicitação não está `aprovado` ainda

**Transação atômica:**

```
1. ordensServico[ordemServicoId].status = "aprovado"

2. Para cada outra ordem da mesma solicitacaoOsId com status aguardando_aprovacao:
     status = "recusado"

3. solicitacoesOS[solicitacaoId].status = "aprovado"
```

**Response 200:**

```json
{
  "data": {
    "solicitacaoId": "...",
    "approvedOrdemId": "...",
    "status": "aprovado"
  },
  "message": "Quote approved successfully."
}
```

---

## 7. Fase 4 — Devolução e auditoria

### `POST /os/devolucoes`

Substitui `setDoc checklistsDevolucao` na oficina.

**Request (multipart ou JSON):**

```json
{
  "prefeituraId": "string",
  "oficinaId": "string",
  "equipamento": "string",
  "relatorio": "string",
  "ordemServicoId": "string | null",
  "fotos": {
    "nova": "<base64 ou upload ref>",
    "velha": "<base64>",
    "pronto": "<base64>"
  }
}
```

**Melhorias recomendadas:**

- Validar `ordemServicoId` contra `ordensServico` aprovada
- Fotos em **Firebase Storage** + URL no doc (não base64 no Firestore)
- Ao salvar, opcionalmente `solicitacoesOS.status = "concluido"` se vinculado

---

### `GET /os/auditoria-devolucao/:prefeituraId`

Substitui join manual no front (`AuditoriaDevolucaoSection`).

**Query params:**

| Param | Valores |
|-------|---------|
| `startDate` | `YYYY-MM-DD` |
| `endDate` | `YYYY-MM-DD` |
| `workshopId` | id oficina ou omitir |
| `equipment` | nome ou `todos` |
| `status` | `aprovado`, `aguardando_orcamento`, `concluido`, `todos` |

**Response:** linhas para tabela/CSV:

```json
{
  "data": [
    {
      "protocol": "OS-2026-047",
      "equipment": "Sany SYL956H",
      "line": "Amarela",
      "workshop": "Avantec",
      "defect": "caixa hidráulica",
      "totalValue": 6000,
      "date": "15/05/2026",
      "status": "aprovado"
    }
  ]
}
```

**Fonte:** join `ordensServico` + `solicitacoesOS` (como front faz hoje); futuro incluir `checklistsDevolucao`.

---

### `GET /os/auditoria-devolucao/:prefeituraId/export.csv`

Mesmos filtros; retorna `text/csv` com BOM UTF-8 (`;` separador — padrão Excel BR).

---

## 8. Fase 5 — Preventiva (futuro)

Não implementar agora; documentar para roadmap.

| Requisito | Descrição |
|-----------|-----------|
| `tipoOs: "P"` | Na criação |
| `cicloId` | Referência ao plano preventivo |
| `descricao` auto | Montada a partir da matriz do ciclo |
| Coleção `planosPreventivos` | `{ prefeituraId, ciclos[], linhas[] }` |

---

## 9. Segurança e índices

### Autorização (sugestão)

| Papel | Permissões |
|-------|------------|
| Prefeitura | CRUD solicitações do seu `prefeituraId`; aprovar orçamentos |
| Oficina | Ler solicitações onde `oficinaId ∈ oficinasIds`; criar orçamento próprio; devolução |
| Admin | Leitura cross-tenant conforme regra existente |

### Índices Firestore compostos (prováveis)

```
solicitacoesOS: (prefeituraId, status, criadoEm desc)
solicitacoesOS: (oficinasIds array-contains, status)
ordensServico: (prefeituraId, criadoEm desc)
ordensServico: (solicitacaoOsId, status)
ordensServico: (oficinaId, status)
```

### CORS

Liberar origem do Vite em dev: `http://localhost:5173` (ou porta configurada).

### Banco Firestore

O front usa banco nomeado **`"default"`** (não o `(default)` global). Backend deve usar o mesmo.

---

## 10. Formato padrão de resposta

Padrão NestJS já usado pelo front:

```typescript
// Sucesso
{ data: T, message: string }

// Erro (ValidationPipe / HttpException)
{ statusCode: number, message: string | string[], error?: string }
```

O front lê `message` em erros (`ApiError` em `src/lib/api/client.ts`).

---

## 11. Checklist de implementação

### Fase 1 — obrigatório (front já chama)

- [ ] `POST /os/solicitacoes`
- [ ] `GET /os/solicitacoes/:prefeituraId`
- [ ] Geração protocolo sequencial
- [ ] Sorteio oficinas (seção 4)
- [ ] Campos EN + PT na listagem
- [ ] Erros 400 / 404 / 422
- [ ] CORS dev
- [ ] Firestore database `"default"`

### Fase 2 — oficina

- [ ] `GET /os/solicitacoes/oficina/:oficinaId`
- [ ] `POST /os/orcamentos` (transação)
- [ ] `GET /os/orcamentos/oficina/:oficinaId`
- [ ] `PATCH /os/orcamentos/:id` (editar valor)

### Fase 3 — aprovação

- [ ] `GET /os/solicitacoes/:prefeituraId/com-orcamentos`
- [ ] `PATCH /os/solicitacoes/:id/aprovar` (transação batch)

### Fase 4 — devolução / auditoria

- [ ] `POST /os/devolucoes`
- [ ] `GET /os/auditoria-devolucao/:prefeituraId`
- [ ] Export CSV
- [ ] Status `concluido` na solicitação

### Fase 5 — preventiva

- [ ] Plano preventivo persistido
- [ ] OS tipo `P` + descrição por ciclo

---

## Anexo — Exemplo completo `solicitacoesOS` após criação

```json
{
  "protocolo": "OS-2026-048",
  "prefeituraId": "municipio-abc",
  "equipmentId": "eq-firestore-id",
  "equipamento": "Sany SYL956H",
  "linha": "Amarela",
  "operador": "João Silva",
  "horimetro": "4.552,5 h",
  "relato": "caixa hidráulica com vazamento",
  "tipoOs": "C",
  "dataAgendamento": "2026-06-14",
  "oficinas": ["Avantec Mecânica", "Gava Diesel"],
  "oficinasIds": ["oficinaDoc1", "oficinaDoc2"],
  "oficinasResponderam": [],
  "status": "aguardando_orcamento",
  "criadoEm": "<Firestore Timestamp>"
}
```

---

*Documento backend — Hora Útil 360 / back-360. Complementa `docs/handoff-os-solicitacoes.md` (visão front + legado).*
