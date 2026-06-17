# Handoff — Fluxo de Ordem de Serviço (OS)

Documento para outra IA / time de backend continuar a integração.  
Repositório front: **Hora Útil 360** (React + Vite + Firestore legado + API NestJS `back-360`).

---

## 1. Visão geral do fluxo

```
[PREFeitura] criar solicitação OS
       ↓
solicitacoesOS  (até 3 oficinas convidadas)
       ↓
[Oficina] envia orçamento → ordensServico (1 por oficina)
       ↓
[Prefeitura] aprova 1 orçamento → recusa os outros
       ↓
[Oficina] checklist devolução → checklistsDevolucao
       ↓
[Prefeitura] auditoria / relatório CSV
```

---

## 2. O que já está integrado com API (Fase 1 — FEITO no front)

### Base URL

- Dev: `http://localhost:3000` (`src/lib/api/client.ts`, env `VITE_API_URL`)
- Produção: `/api` ou `VITE_API_URL`

### Endpoints consumidos pelo front

| Método | Rota | Uso |
|--------|------|-----|
| `POST` | `/os/solicitacoes` | Criar OS (botão **Salvar OS**) |
| `GET` | `/os/solicitacoes/{prefeituraId}` | Listar OS na tela Abrir OS |

### Arquivos front

| Arquivo | Função |
|---------|--------|
| `src/lib/api/os-solicitacoes.ts` | Client API + mapeamento EN→PT |
| `src/lib/api/os-solicitacoes.test.ts` | Testes unitários |
| `src/pages/prefeitura/sections/AbrirOsFormulario.tsx` | Formulário + `handleSalvar` → POST |
| `src/pages/prefeitura/sections/AbrirOsSection.tsx` | Lista → GET (sem Firestore direto) |
| `src/pages/prefeitura/sections/AbrirOsLista.tsx` | Filtros → query params na API |

### POST criar — body que o front envia

```json
{
  "prefeituraId": "municipio-abc",
  "equipmentId": "firestore-equip-id",
  "operator": "João Silva",
  "report": "caixa hidráulica com vazamento",
  "type": "C",
  "scheduledDate": "2026-06-14"
}
```

**Validação no front antes do POST:** `equipmentId`, `operator`, `report` não vazios.

**O front NÃO envia:** `protocolo`, `oficinas`, `oficinasIds`, `linha`, `horimetro`, `status`.

### POST criar — resposta esperada (201)

```json
{
  "data": {
    "id": "firestore-doc-id",
    "protocol": "OS-2026-048",
    "invitedWorkshops": [
      { "id": "oficinaDoc1", "name": "Avantec" },
      { "id": "oficinaDoc2", "name": "Gava" }
    ],
    "status": "aguardando_orcamento"
  },
  "message": "Service order request created successfully."
}
```

**UX após sucesso:** toast com protocolo + nomes das oficinas; volta para lista e recarrega.

### Erros HTTP — mapeamento no front

| HTTP | Mensagem na UI |
|------|----------------|
| 400 | Equipamento inválido ou sem linha cadastrada. |
| 404 | Equipamento não encontrado. |
| 422 | Nenhuma oficina credenciada para este município. |
| outros | Erro ao criar O.S. Tente novamente. |

### GET listar — query params

| Param | Valores |
|-------|---------|
| `status` | `aguardando_orcamento`, `aguardando_aprovacao`, `aprovado`, `concluido` (omitir se `todos`) |
| `startDate` | `YYYY-MM-DD` |
| `endDate` | `YYYY-MM-DD` |

### GET listar — item da resposta (campos EN + PT compat)

O front aceita **inglês ou português** por item:

| Tela (PT) | API EN | API PT (compat) |
|-----------|--------|-----------------|
| protocolo | protocol | protocolo |
| equipamento | equipment | equipamento |
| linha | line | linha |
| operador | operator | operador |
| relato | report | relato |
| criadoEm | createdAt (ISO) | criadoEm.seconds |

Função de mapeamento: `solicitacaoApiParaTela()` em `os-solicitacoes.ts`.

**Lista sem mocks:** se API retorna `[]`, tela fica vazia (não usa mais `OS_MOCKADAS` na lista).

---

## 3. Lógica legada de criar OS (referência — front antigo)

Antes da refatoração, o front gravava **direto no Firestore** (`addDoc` em `solicitacoesOS`):

```typescript
// Pseudocódigo da lógica antiga (AbrirOsSection.tsx pré-feat/OS)

// 1. Buscar oficinas
oficinas = query(oficinas, prefeituraId == X, status == "Ativa")

// 2. Filtrar por linha do equipamento (match ESTRITO)
matches = oficinas.filter(o =>
  normEsp(o.especialidade) === normEsp(equipamento.linha)
)

// 3. Sortear até 3
oficinasEnvio = shuffle(matches).slice(0, 3)
// Se matches vazio → ERRO (não criava OS)

// 4. Gravar
addDoc(solicitacoesOS, {
  protocolo,           // OS-{ano}-{3 dígitos aleatórios}
  prefeituraId,
  equipamento,         // string (nome)
  linha,
  operador,
  horimetro,           // string fixa "4.552,5 h"
  relato,
  oficinas: nomes[],
  oficinasIds: ids[],
  status: "aguardando_orcamento",
  criadoEm: serverTimestamp()
})
```

### normEsp (normalização linha ↔ especialidade)

```typescript
function normEsp(s: string): string {
  return s.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim();
}
```

### Regra das 3 oficinas — o que o BACK documentou (diferente do legado)

1. Buscar oficinas `prefeituraId` + status `"Ativa"`
2. Filtrar por especialidade compatível com **linha ou tipo** do equipamento
3. Match **flexível**: igualdade OU `includes` (ex.: `"Amarela"` ↔ `"Linha Amarela"`)
4. Se nenhuma bater → **sorteia entre todas as ativas** do município (fallback)
5. Sorteia até **3** (pode ser 1 ou 2)
6. Aba Oficina do form (1 oficina + box) → **ignorar na criação** (fase 1)

---

## 4. Schema Firestore — `solicitacoesOS`

Documento-mãe da OS. Hoje escrito pelo **backend** na Fase 1; antes era o front.

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `protocolo` | string | sim | Ex.: `OS-2026-048` — sequencial no back |
| `prefeituraId` | string | sim | |
| `equipamento` | string | sim | Nome/descrição (sem `equipamentoId` no doc legado) |
| `linha` | string | sim | Classificação do equipamento |
| `operador` | string | sim | |
| `horimetro` | string | não | Legado usava string; form novo lê número do equipamento |
| `relato` | string | sim | Defeito/descrição |
| `oficinas` | string[] | sim | Nomes das convidadas |
| `oficinasIds` | string[] | sim | **IDs doc** coleção `oficinas` — crítico |
| `oficinasResponderam` | string[] | não | Preenchido quando oficina envia orçamento |
| `status` | string | sim | Ver máquina de estados |
| `criadoEm` | timestamp | sim | |

### Máquina de estados

```
aguardando_orcamento     → OS criada, oficinas podem orçar
aguardando_aprovacao     → todas convidadas responderam
aprovado                 → prefeitura escolheu um orçamento
concluido                → previsto; ninguém grava ainda
```

---

## 5. Schema Firestore — `ordensServico` (orçamento da oficina)

**Ainda gravado direto pelo front da oficina** (`OficinaPage.tsx`).

| Campo | Tipo |
|-------|------|
| `protocolo` | string (protocolo do orçamento, gerado na oficina) |
| `prefeituraId` | string |
| `solicitacaoOsId` | string \| null — **FK para solicitacoesOS** |
| `oficinaId` | string |
| `oficinaNome` | string |
| `equipamento` | string |
| `defeito` | string (cópia do relato) |
| `itens` | `{ descricao, valor }[]` |
| `valorTotal` | number |
| `status` | `aguardando_aprovacao` → `aprovado` \| `recusado` |
| `criadoEm` | timestamp |

### Ao enviar orçamento (oficina)

```typescript
addDoc(ordensServico, { ... status: "aguardando_aprovacao" })

updateDoc(solicitacoesOS, {
  oficinasResponderam: arrayUnion(oficinaId),
  ...(todasResponderam ? { status: "aguardando_aprovacao" } : {})
})
```

### Oficina vê quais OS?

```typescript
query(solicitacoesOS,
  where("oficinasIds", "array-contains-any", [minhaOficinaId]),
  where("status", "==", "aguardando_orcamento")
)
// + filtro client: minhaOficinaId NOT IN oficinasResponderam
```

---

## 6. Schema Firestore — `oficinas` (cadastro admin)

| Campo | Tipo |
|-------|------|
| `prefeituraId` | string |
| `nome` | string |
| `especialidade` | string — comparada com linha do equipamento |
| `status` | `"Ativa"` \| `"Suspensa"` |

Cadastro: `src/pages/admin/hooks/oficinas/use-oficinas.ts`

---

## 7. Schema Firestore — `checklistsDevolucao`

| Campo | Tipo |
|-------|------|
| `prefeituraId`, `oficinaId`, `oficinaNome` | string |
| `equipamento` | string |
| `relatorio` | string (texto livre) |
| `ordemServicoId` | string \| null — **manual hoje** |
| `fotoNovaUrl`, `fotoVelhaUrl`, `fotoProntoUrl` | string (JPEG base64) |
| `criadoEm` | timestamp |

Gravado: `OficinaPage.tsx` (aba checklist-dev).  
Lido: `FinalizarOsSection.tsx`, `AuditoriaDevolucaoSection.tsx`.

---

## 8. O que o FRONT tem de UI mas NÃO persiste

| Tela / campo | Arquivo | Estado |
|--------------|---------|--------|
| Tipo OS Preventiva (`tipoOs: "P"`) | `AbrirOsFormulario.tsx` | Só `"C"` hoje |
| Aba Oficina (1 oficina + box) | `AbrirOsAbaOficina.tsx` | Estado local; ignorado no POST |
| Máquina parada | `AbrirOsAbaMaquinaParada.tsx` | Mock |
| Garantia | `AbrirOsAbaGarantia.tsx` | Tabela vazia |
| Insumos, Etapas, Sintomas, Ocorrências | `AbrirOsPainelGeral.tsx` | Mock |
| Plano preventivo | `PlanoPreventivoSection.tsx` | Estado React local |
| Alertas garantia nos orçamentos | `OrcamentosAprovacoesSection.tsx` | Não implementado |

---

## 9. O que ainda usa Firestore direto (próximas fases API)

| Fluxo | Arquivo | Operação |
|-------|---------|----------|
| Oficina lista OS pendentes | `OficinaPage.tsx` | `getDocs solicitacoesOS` |
| Oficina envia orçamento | `OficinaPage.tsx` | `addDoc ordensServico` + `updateDoc solicitacoesOS` |
| Prefeitura aprova orçamento | `OrcamentosAprovacoesSection.tsx` | `writeBatch` ordens + solicitação |
| Auditoria devolução (relatório) | `AuditoriaDevolucaoSection.tsx` | `getDocs ordensServico` + join |
| Checklist devolução | `OficinaPage.tsx` | `setDoc checklistsDevolucao` |

---

## 10. Endpoints sugeridos — fases seguintes (backend)

### Fase 2 — Oficina

```
GET  /os/solicitacoes/oficina/{oficinaId}?status=aguardando_orcamento
POST /os/orcamentos
     body: { solicitacaoOsId, oficinaId, protocolo, itens[], valorTotal }
```

### Fase 3 — Aprovação prefeitura

```
GET  /os/solicitacoes/{prefeituraId}/com-orcamentos
PATCH /os/solicitacoes/{id}/aprovar
      body: { ordemServicoId }
```

### Fase 4 — Devolução / conclusão

```
POST /os/devolucoes
PATCH /os/solicitacoes/{id}/concluir
GET  /os/auditoria-devolucao/{prefeituraId}?filters...
```

---

## 11. Requisitos técnicos para rodar Fase 1

1. Backend NestJS em `http://localhost:3000`
2. **CORS** liberado para origem do Vite (ex. `http://localhost:5173`)
3. Equipamentos no Firestore com `linha` ou `tipo` preenchido
4. Oficinas cadastradas com `status: "Ativa"` e `especialidade` coerente
5. Opcional: `VITE_API_URL` no `.env` do front

---

## 12. Branch e commits relevantes

- Branch: `feat/OS`
- Commit com telas OS + auditoria + orçamentos: `e2ef70b`
- Integração API Fase 1: alterações locais em `os-solicitacoes.ts`, `AbrirOsFormulario.tsx`, `AbrirOsSection.tsx` (podem não estar commitadas ainda)

---

## 13. Checklist para a outra IA

### Backend (se ainda falta algo na Fase 1)

- [ ] `POST /os/solicitacoes` grava em `solicitacoesOS` com campos da seção 4
- [ ] Protocolo sequencial `OS-{ano}-{seq}` por prefeitura
- [ ] Sorteio oficinas (regra flexível seção 3)
- [ ] `GET /os/solicitacoes/:prefeituraId` com filtros e campos PT+EN
- [ ] CORS + validações 400/404/422
- [ ] `equipmentId` resolve equipamento no Firestore e valida `prefeituraId`

### Front (já feito na Fase 1)

- [x] `src/lib/api/os-solicitacoes.ts`
- [x] Salvar OS → POST
- [x] Lista → GET com filtros
- [x] Sem `addDoc`/`getDocs` direto em `AbrirOsSection` / formulário
- [ ] Commit + PR pendente

### Próximo passo natural

Migrar **OficinaPage** (enviar orçamento) e **OrcamentosAprovacoesSection** (aprovar) para API, mantendo compatibilidade com `oficinasIds` / `solicitacaoOsId` existentes no Firestore.

---

## 14. Código de referência — normEsp e sorteio (legado)

```typescript
function normEsp(s: string): string {
  return s.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim();
}

function sortearAte<T>(arr: T[], max: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, max);
}
```

---

*Gerado para handoff entre times — Hora Útil 360, fluxo OS.*
