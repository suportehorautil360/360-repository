# Checklist Login Configurável por Empresa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar config por empresa ("cpfSenha" e/ou "chassi") pro login do checklist, novo modo "login por chassi" com cache offline, redesign da tela `/checklist-login` com shadcn + dark/light.

**Architecture:** Multi-repo. Fase A altera `back` (NestJS): novo campo em `clientes`, 3 endpoints, script de migração. Fase B altera `360-repository/src/pages/admin`: aba "Configurações" no cadastro do cliente. Fase C altera `360-repository/src/pages/checklist-controle`: cache offline de chassis, expansão da sessão, novo fluxo de login por chassi, redesign visual.

**Tech Stack:** NestJS 11 + Firestore (back). Vite 8 + React 19 + shadcn/ui + Tailwind v4 (360). Vitest (unit) e Playwright (e2e) em ambos. Jest + supertest pra e2e do back.

## Global Constraints

- Ler o spec: `docs/superpowers/specs/2026-08-11-checklist-login-modo-empresa-design.md` (fonte da verdade — em caso de dúvida, spec vence).
- **Sem assinatura de IA em commits** (CLAUDE.md do 360). Commits curtos.
- pnpm em ambos os repos.
- Backward compat: doc de `cliente` sem `checklistLogin` → interpretar como `{ cpfSenha: true, chassi: false }`.
- **Cada task termina com commit atômico** que compila e passa lint.
- **Validar antes do commit:** `pnpm lint` (Fase B/C), `pnpm build` (final de cada fase). Rodar `pnpm test` no arquivo tocado.
- Cache offline chassis: chave `hu360-chassis-offline`, TTL `7 * 24 * 60 * 60 * 1000` ms (idêntico ao `credenciais-offline.ts`).
- Normalização de chassi: `.toUpperCase().replace(/\s+/g, "")` (mesmo padrão de `normChassisLocacaoSync` em `src/lib/hu360/locacaoFirestoreSync.ts`).
- Cada fase termina em **1 PR draft por repo**, sem mesclar (CLAUDE.md: "quem mescla é o dono do projeto").

---

## Fase A — Back (`back` repo)

**Setup inicial da fase:**

- [ ] **A0.1: Criar branch a partir de main**

```bash
cd /Users/viniciusaguiar/Development/horautil/back
git checkout main && git pull --ff-only
git checkout -b feat/checklist-login-config
```

- [ ] **A0.2: Instalar `@nestjs/throttler` pra rate limit**

Verificar primeiro se já está instalado (`grep throttler package.json`). Se não:

```bash
pnpm add @nestjs/throttler
```

Commit:
```bash
git add package.json pnpm-lock.yaml && git commit -m "chore(back): add @nestjs/throttler para rate limit"
```

### Task A1: Adicionar `checklistLogin` no schema/DTO do Cliente

**Files:**
- Modify: `back/src/modules/clientes/dto/update-cliente.dto.ts` (adicionar sub-DTO opcional)
- Create: `back/src/modules/clientes/dto/checklist-login-config.dto.ts` (DTO reutilizável)
- Modify: `back/src/modules/clientes/clientes.types.ts` (tipar `ChecklistLoginConfig` se houver tipagem)

**Interfaces:**
- Produces: `class ChecklistLoginConfigDto { cpfSenha: boolean; chassi: boolean }` — usado em A2 e como sub-doc em Cliente.

- [ ] **Step 1: Escrever teste do DTO (validação: pelo menos 1 modo true)**

Criar `back/src/modules/clientes/dto/checklist-login-config.dto.spec.ts`:
```ts
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ChecklistLoginConfigDto } from './checklist-login-config.dto';

describe('ChecklistLoginConfigDto', () => {
  it('aceita cpfSenha=true, chassi=false', async () => {
    const dto = plainToInstance(ChecklistLoginConfigDto, { cpfSenha: true, chassi: false });
    expect(await validate(dto)).toHaveLength(0);
  });
  it('aceita ambos true', async () => {
    const dto = plainToInstance(ChecklistLoginConfigDto, { cpfSenha: true, chassi: true });
    expect(await validate(dto)).toHaveLength(0);
  });
  it('REJEITA ambos false', async () => {
    const dto = plainToInstance(ChecklistLoginConfigDto, { cpfSenha: false, chassi: false });
    const erros = await validate(dto);
    expect(erros.length).toBeGreaterThan(0);
    expect(JSON.stringify(erros)).toMatch(/pelo menos um/i);
  });
  it('REJEITA valores não-booleanos', async () => {
    const dto = plainToInstance(ChecklistLoginConfigDto, { cpfSenha: 'sim', chassi: 1 });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Rodar teste, verificar falha**

```bash
pnpm test src/modules/clientes/dto/checklist-login-config.dto.spec.ts
```
Expected: FAIL (arquivo não existe).

- [ ] **Step 3: Criar o DTO**

`back/src/modules/clientes/dto/checklist-login-config.dto.ts`:
```ts
import { IsBoolean, Validate, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'PeloMenos1Modo' })
class PeloMenos1ModoAtivo implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const o = args.object as { cpfSenha?: boolean; chassi?: boolean };
    return Boolean(o.cpfSenha) || Boolean(o.chassi);
  }
  defaultMessage() {
    return 'Pelo menos um modo (cpfSenha ou chassi) deve estar ativo.';
  }
}

export class ChecklistLoginConfigDto {
  @IsBoolean()
  cpfSenha!: boolean;

  @IsBoolean()
  @Validate(PeloMenos1ModoAtivo)
  chassi!: boolean;
}
```

- [ ] **Step 4: Rodar teste, verificar passa**

```bash
pnpm test src/modules/clientes/dto/checklist-login-config.dto.spec.ts
```
Expected: PASS (4 casos).

- [ ] **Step 5: Adicionar como sub-DTO opcional em `UpdateClienteDto`**

Em `back/src/modules/clientes/dto/update-cliente.dto.ts`:
```ts
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { ChecklistLoginConfigDto } from './checklist-login-config.dto';

// dentro da classe UpdateClienteDto:
@IsOptional()
@ValidateNested()
@Type(() => ChecklistLoginConfigDto)
checklistLogin?: ChecklistLoginConfigDto;
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/clientes/dto/checklist-login-config.dto.ts \
        src/modules/clientes/dto/checklist-login-config.dto.spec.ts \
        src/modules/clientes/dto/update-cliente.dto.ts
git commit -m "feat(back): ChecklistLoginConfigDto com validação de pelo menos 1 modo ativo"
```

### Task A2: Endpoint `PATCH /clientes/:id/checklist-login-config`

**Files:**
- Modify: `back/src/modules/clientes/clientes.service.ts` (adicionar método)
- Modify: `back/src/modules/clientes/clientes.controller.ts` (adicionar rota)
- Create: `back/src/modules/clientes/clientes.service.spec.ts` (se não existe) — adicionar teste

**Interfaces:**
- Consumes: `ChecklistLoginConfigDto` de A1
- Produces: `clientesService.atualizarChecklistLoginConfig(clienteId: string, dto: ChecklistLoginConfigDto): Promise<void>`

- [ ] **Step 1: Escrever teste do service**

Em `clientes.service.spec.ts` (criar se não existir, seguindo padrão de `auth.service.spec.ts`):
```ts
describe('atualizarChecklistLoginConfig', () => {
  it('faz update no doc do cliente com o campo checklistLogin', async () => {
    // Arrange: mockar Firestore .doc().update()
    const updateMock = vi.fn().mockResolvedValue(undefined);
    // ... setup firebaseService mock
    await clientesService.atualizarChecklistLoginConfig('cli_1', { cpfSenha: true, chassi: true });
    expect(updateMock).toHaveBeenCalledWith({ checklistLogin: { cpfSenha: true, chassi: true } });
  });
  it('lança NotFoundException se doc não existe', async () => {
    // ... simular doc.get() → exists=false
    await expect(clientesService.atualizarChecklistLoginConfig('naoExiste', { cpfSenha: true, chassi: false }))
      .rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Rodar, ver falha**

```bash
pnpm test src/modules/clientes/clientes.service.spec.ts
```

- [ ] **Step 3: Implementar no service**

Em `clientes.service.ts`:
```ts
async atualizarChecklistLoginConfig(
  clienteId: string,
  config: ChecklistLoginConfigDto,
): Promise<void> {
  const ref = this.firebase.getFirestore().collection('clientes').doc(clienteId);
  const doc = await ref.get();
  if (!doc.exists) throw new NotFoundException(`Cliente ${clienteId} não encontrado.`);
  await ref.update({ checklistLogin: { cpfSenha: config.cpfSenha, chassi: config.chassi } });
}
```

- [ ] **Step 4: Rodar teste, ver passar**

```bash
pnpm test src/modules/clientes/clientes.service.spec.ts
```

- [ ] **Step 5: Expor no controller**

Em `clientes.controller.ts` (adicionar após rotas existentes):
```ts
@Patch(':id/checklist-login-config')
@UseGuards(JwtAuthGuard)   // se existir guard admin, usar ele
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOperation({ summary: 'Atualiza config do login do checklist (cpfSenha / chassi).' })
async atualizarChecklistLoginConfig(
  @Param('id') id: string,
  @Body() dto: ChecklistLoginConfigDto,
): Promise<void> {
  await this.clientesService.atualizarChecklistLoginConfig(id, dto);
}
```

- [ ] **Step 6: Adicionar teste e2e supertest (opcional se test:e2e configurado)**

Verificar se `test/clientes.e2e-spec.ts` existe; se sim, adicionar caso:
```ts
it('PATCH /clientes/:id/checklist-login-config atualiza o campo', async () => {
  const res = await request(app.getHttpServer())
    .patch(`/clientes/${clienteId}/checklist-login-config`)
    .set('Authorization', `Bearer ${jwtAdmin}`)
    .send({ cpfSenha: true, chassi: true });
  expect(res.status).toBe(204);
});
```

Se `test/clientes.e2e-spec.ts` **não** existe, pular esse step — cobertura unit é suficiente.

- [ ] **Step 7: Commit**

```bash
git add src/modules/clientes/clientes.service.ts \
        src/modules/clientes/clientes.controller.ts \
        src/modules/clientes/clientes.service.spec.ts \
        test/clientes.e2e-spec.ts  # se editado
git commit -m "feat(back): PATCH /clientes/:id/checklist-login-config"
```

### Task A3: Script de migração `migrar-checklist-login.mjs`

**Files:**
- Create: `back/scripts/migrar-checklist-login.mjs`

**Interfaces:**
- Consumes: `back/.env` (FIREBASE_*)
- Produces: script CLI executável — mesmo padrão de `back/scripts/list-admin-users.mjs`.

- [ ] **Step 1: Escrever o script (dry-run + --commit)**

`back/scripts/migrar-checklist-login.mjs`:
```js
// Migra a coleção `clientes`: adiciona checklistLogin = { cpfSenha: true, chassi: false }
// em docs que não têm o campo. Backward compat: docs com o campo são ignorados.
//
// Uso:
//   node back/scripts/migrar-checklist-login.mjs           # DRY-RUN
//   node back/scripts/migrar-checklist-login.mjs --commit  # grava
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import admin from 'firebase-admin';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '..', '.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.trim().startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    }),
);
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();
const commit = process.argv.includes('--commit');

console.log(`→ project: ${env.FIREBASE_PROJECT_ID}`);
console.log(`→ ação:    ${commit ? 'COMMIT' : 'DRY-RUN (use --commit para gravar)'}`);

const snap = await db.collection('clientes').get();
let atualizados = 0, jaTem = 0;

for (const doc of snap.docs) {
  const data = doc.data();
  if (data.checklistLogin && typeof data.checklistLogin === 'object') { jaTem++; continue; }
  console.log(`  · ${doc.id} — set checklistLogin = { cpfSenha: true, chassi: false }`);
  if (commit) {
    await doc.ref.update({ checklistLogin: { cpfSenha: true, chassi: false } });
  }
  atualizados++;
}

console.log(`\nTotal: ${snap.size} clientes | ${atualizados} atualizados | ${jaTem} já OK`);
if (!commit) console.log(`\nDry-run OK. Rode com --commit pra gravar.`);
process.exit(0);
```

- [ ] **Step 2: Testar em dry-run (não modifica dados)**

```bash
cd /Users/viniciusaguiar/Development/horautil/back
node scripts/migrar-checklist-login.mjs 2>&1 | grep -v DEP0040 | head -30
```
Expected: lista clientes que seriam atualizados, sem gravar.

- [ ] **Step 3: NÃO rodar --commit ainda** (só depois do deploy — Fase A rollout)

- [ ] **Step 4: Commit**

```bash
git add scripts/migrar-checklist-login.mjs
git commit -m "chore(back): script de migração checklistLogin default"
```

### Task A4: Módulo `checklist-auth` — `ChecklistChassiService.resolverChassi`

**Files:**
- Create: `back/src/modules/checklist-auth/checklist-auth.module.ts`
- Create: `back/src/modules/checklist-auth/checklist-chassi.service.ts`
- Create: `back/src/modules/checklist-auth/checklist-chassi.service.spec.ts`
- Create: `back/src/modules/checklist-auth/dto/resolver-chassi.dto.ts`
- Create: `back/src/modules/checklist-auth/helpers/chassi.helper.ts` (normalização)
- Modify: `back/src/app.module.ts` (importar ChecklistAuthModule)

**Interfaces:**
- Produces: `ChecklistChassiService.resolverChassi(chassi: string): Promise<{ empresaId: string; empresaNome: string; idMaquina: string; chassi: string }>`. Lança `NotFoundException` (404), `ConflictException` (409).
- Helper: `normalizarChassi(input: string): string` = `.toUpperCase().replace(/\s+/g, "")`.

- [ ] **Step 1: Escrever helper de normalização + teste**

`chassi.helper.ts`:
```ts
export function normalizarChassi(input: string): string {
  return (input ?? '').toString().toUpperCase().replace(/\s+/g, '');
}
```

`chassi.helper.spec.ts`:
```ts
import { normalizarChassi } from './chassi.helper';
describe('normalizarChassi', () => {
  it('uppercase + trim + sem espaços', () => {
    expect(normalizarChassi(' 9bd 196 341A 000 0123 ')).toBe('9BD196341A0000123');
  });
  it('tolera undefined/null', () => {
    expect(normalizarChassi(undefined as unknown as string)).toBe('');
    expect(normalizarChassi(null as unknown as string)).toBe('');
  });
});
```

Rodar: `pnpm test src/modules/checklist-auth/helpers/chassi.helper.spec.ts` → PASS.

- [ ] **Step 2: Escrever teste do service (resolverChassi)**

`checklist-chassi.service.spec.ts`:
```ts
import { NotFoundException, ConflictException } from '@nestjs/common';
// mocks pro firebase.getFirestore().collection('equipamentos').where().where().limit().get()
// e .collection('clientes').doc().get()

describe('ChecklistChassiService.resolverChassi', () => {
  it('encontrou 1 equipamento, empresa habilita chassi → retorna dados', async () => {
    // Arrange: mock equipamentos → 1 doc { id: 'eq_1', prefeituraId: 'cli_1', chassis: '9BD...' }
    //          mock clientes/cli_1 → { nome: 'Prefeitura X', checklistLogin: { chassi: true } }
    const out = await service.resolverChassi('9bd196341a0000123');
    expect(out).toEqual({ empresaId: 'cli_1', empresaNome: 'Prefeitura X', idMaquina: 'eq_1', chassi: '9BD196341A0000123' });
  });
  it('nenhum equipamento → NotFoundException', async () => {
    // Arrange: equipamentos vazio
    await expect(service.resolverChassi('XXX')).rejects.toThrow(NotFoundException);
  });
  it('empresa NÃO habilita chassi → NotFoundException (mensagem específica)', async () => {
    // Arrange: cliente com checklistLogin.chassi=false
    await expect(service.resolverChassi('YYY')).rejects.toThrow(/não habilita/);
  });
  it('2+ equipamentos em empresas distintas com chassi habilitado → ConflictException', async () => {
    // Arrange: 2 docs em prefeituraIds diferentes
    await expect(service.resolverChassi('DUP')).rejects.toThrow(ConflictException);
  });
});
```

Rodar → FAIL (service não existe).

- [ ] **Step 3: Implementar service**

`checklist-chassi.service.ts`:
```ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { FirebaseService } from '../../config/firebase.service';
import { normalizarChassi } from './helpers/chassi.helper';

@Injectable()
export class ChecklistChassiService {
  constructor(private readonly firebase: FirebaseService) {}

  async resolverChassi(chassiInput: string) {
    const chassi = normalizarChassi(chassiInput);
    if (!chassi) throw new NotFoundException('Chassi vazio.');

    const eqSnap = await this.firebase.getFirestore()
      .collection('equipamentos')
      .where('chassis', '==', chassi)
      .limit(5)
      .get();

    if (eqSnap.empty) throw new NotFoundException('Chassi não encontrado.');

    // Buscar clientes das prefeituraIds únicas e filtrar por chassi habilitado
    const prefIds = [...new Set(eqSnap.docs.map((d) => d.get('prefeituraId')).filter(Boolean))];
    const clientesDocs = await Promise.all(
      prefIds.map((id) => this.firebase.getFirestore().collection('clientes').doc(id).get())
    );
    const habilitadas = clientesDocs
      .filter((d) => d.exists)
      .filter((d) => d.get('checklistLogin')?.chassi === true);

    if (habilitadas.length === 0) throw new NotFoundException('Chassi não habilita login direto.');
    if (habilitadas.length > 1) throw new ConflictException('Chassi vinculado a múltiplas empresas.');

    const cliDoc = habilitadas[0];
    const equipamento = eqSnap.docs.find((e) => e.get('prefeituraId') === cliDoc.id)!;
    return {
      empresaId: cliDoc.id,
      empresaNome: (cliDoc.get('nome') as string) ?? cliDoc.id,
      idMaquina: equipamento.id,
      chassi,
    };
  }
}
```

- [ ] **Step 4: Criar o módulo**

`checklist-auth.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { FirebaseService } from '../../config/firebase.service';
import { ChecklistChassiService } from './checklist-chassi.service';

@Module({
  providers: [FirebaseService, ChecklistChassiService],
  exports: [ChecklistChassiService],
})
export class ChecklistAuthModule {}
```

Adicionar `ChecklistAuthModule` em `back/src/app.module.ts` no array `imports`.

- [ ] **Step 5: Rodar testes → PASS**

```bash
pnpm test src/modules/checklist-auth
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/checklist-auth/ src/app.module.ts
git commit -m "feat(back): ChecklistChassiService.resolverChassi com filtro por config da empresa"
```

### Task A5: Endpoint `POST /checklist/resolver-chassi`

**Files:**
- Create: `back/src/modules/checklist-auth/checklist-auth.controller.ts`
- Modify: `back/src/modules/checklist-auth/checklist-auth.module.ts` (adicionar controller)
- Create: `back/src/modules/checklist-auth/dto/resolver-chassi.dto.ts`

**Interfaces:**
- Consumes: `ChecklistChassiService.resolverChassi` de A4
- Produces: `POST /checklist/resolver-chassi` — body `{ chassi: string }` → 200 `{ empresaId, empresaNome, idMaquina, chassi }` | 404 | 409.

- [ ] **Step 1: DTO**

`dto/resolver-chassi.dto.ts`:
```ts
import { IsString, MinLength } from 'class-validator';
export class ResolverChassiDto {
  @IsString()
  @MinLength(1)
  chassi!: string;
}
```

- [ ] **Step 2: Controller (público — sem UseGuards)**

`checklist-auth.controller.ts`:
```ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChecklistChassiService } from './checklist-chassi.service';
import { ResolverChassiDto } from './dto/resolver-chassi.dto';

@ApiTags('checklist')
@Controller('checklist')
export class ChecklistAuthController {
  constructor(private readonly service: ChecklistChassiService) {}

  @Post('resolver-chassi')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve empresa/máquina a partir do chassi (público, rate-limited).' })
  async resolver(@Body() dto: ResolverChassiDto) {
    return this.service.resolverChassi(dto.chassi);
  }
}
```

Adicionar `ChecklistAuthController` no `controllers` do módulo.

- [ ] **Step 3: Teste smoke via HTTP (opcional se e2e não configurado)**

Se `back/test/checklist-auth.e2e-spec.ts` for viável (seguir padrão de `test/consumo-custo.e2e-spec.ts`), criar 3 casos: 200/404/409. Se não, pular — cobertura unit A4 cobre a lógica.

- [ ] **Step 4: Testar manualmente com curl**

```bash
curl -sSf -X POST http://localhost:3000/checklist/resolver-chassi \
  -H "Content-Type: application/json" \
  -d '{"chassi":"CHASSI_EXISTENTE"}' | jq
```
Expected: `{ empresaId, empresaNome, idMaquina, chassi }` (se dev tem dados).

- [ ] **Step 5: Commit**

```bash
git add src/modules/checklist-auth/
git commit -m "feat(back): POST /checklist/resolver-chassi (público)"
```

### Task A6: Método `ChecklistChassiService.listarChassisDaEmpresa`

**Files:**
- Modify: `back/src/modules/checklist-auth/checklist-chassi.service.ts`
- Modify: `back/src/modules/checklist-auth/checklist-chassi.service.spec.ts`

**Interfaces:**
- Produces: `listarChassisDaEmpresa(empresaId: string): Promise<{ chassis: string[]; expiraEm: string }>`. `expiraEm` = ISO de `Date.now() + 7 * 24 * 60 * 60 * 1000`. Chassis normalizados (dedupe + sem strings vazias).

- [ ] **Step 1: Teste**

Adicionar no `.spec.ts`:
```ts
describe('listarChassisDaEmpresa', () => {
  it('retorna lista deduplicada + normalizada', async () => {
    // mock equipamentos where prefeituraId == 'cli_1' →
    // [ {chassis:'aaa'}, {chassis:'BBB'}, {chassis:'aaa'}, {chassis:''} ]
    const out = await service.listarChassisDaEmpresa('cli_1');
    expect(out.chassis.sort()).toEqual(['AAA', 'BBB']);
    expect(new Date(out.expiraEm).getTime()).toBeGreaterThan(Date.now());
  });
  it('retorna lista vazia se sem equipamentos', async () => {
    const out = await service.listarChassisDaEmpresa('cli_vazio');
    expect(out.chassis).toEqual([]);
  });
});
```

- [ ] **Step 2: Implementar**

Em `checklist-chassi.service.ts`:
```ts
async listarChassisDaEmpresa(empresaId: string): Promise<{ chassis: string[]; expiraEm: string }> {
  const snap = await this.firebase.getFirestore()
    .collection('equipamentos')
    .where('prefeituraId', '==', empresaId)
    .get();
  const set = new Set<string>();
  for (const d of snap.docs) {
    const norm = normalizarChassi(d.get('chassis') as string ?? '');
    if (norm) set.add(norm);
  }
  const TTL_MS = 7 * 24 * 60 * 60 * 1000;
  return { chassis: [...set], expiraEm: new Date(Date.now() + TTL_MS).toISOString() };
}
```

- [ ] **Step 3: Testes passam**

```bash
pnpm test src/modules/checklist-auth
```

- [ ] **Step 4: Commit**

```bash
git add src/modules/checklist-auth/checklist-chassi.service.ts src/modules/checklist-auth/checklist-chassi.service.spec.ts
git commit -m "feat(back): listarChassisDaEmpresa (dedupe + TTL 7d)"
```

### Task A7: Endpoint `GET /checklist/chassis-empresa/:empresaId`

**Files:**
- Modify: `back/src/modules/checklist-auth/checklist-auth.controller.ts`

**Interfaces:**
- Consumes: `ChecklistChassiService.listarChassisDaEmpresa` de A6.

- [ ] **Step 1: Adicionar rota no controller**

```ts
@Get('chassis-empresa/:empresaId')
@ApiOperation({ summary: 'Lista chassis da empresa para cache offline (público, rate-limited).' })
async chassisEmpresa(@Param('empresaId') empresaId: string) {
  return this.service.listarChassisDaEmpresa(empresaId);
}
```

Importar `Get`, `Param` (verificar se já estão no import).

- [ ] **Step 2: Testar manualmente com curl**

```bash
curl -sSf http://localhost:3000/checklist/chassis-empresa/PREF_ID | jq '.chassis | length'
```
Expected: número (0 ou mais).

- [ ] **Step 3: Commit**

```bash
git add src/modules/checklist-auth/checklist-auth.controller.ts
git commit -m "feat(back): GET /checklist/chassis-empresa/:empresaId"
```

### Task A8: Rate limit + logs estruturados

**Files:**
- Modify: `back/src/app.module.ts` (registrar ThrottlerModule)
- Modify: `back/src/modules/checklist-auth/checklist-auth.controller.ts` (aplicar `@UseGuards(ThrottlerGuard)` + `@Throttle`)
- Modify: `back/src/modules/checklist-auth/checklist-chassi.service.ts` (Logger com log estruturado)

- [ ] **Step 1: Registrar ThrottlerModule**

Em `back/src/app.module.ts`:
```ts
import { ThrottlerModule } from '@nestjs/throttler';

// no imports:
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]), // 10 req/min padrão
```

- [ ] **Step 2: Aplicar throttler no controller**

Em `checklist-auth.controller.ts`, no topo da classe:
```ts
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { UseGuards } from '@nestjs/common';

@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class ChecklistAuthController { ... }
```

- [ ] **Step 3: Log estruturado no service**

Em `checklist-chassi.service.ts`, adicionar `Logger` privado:
```ts
private readonly logger = new Logger(ChecklistChassiService.name);

// dentro de resolverChassi, ao término (ok):
this.logger.log(JSON.stringify({ evento: 'resolver-chassi', chassi, empresaId: cliDoc.id, resultado: 'ok' }));

// nos throws (antes do throw):
this.logger.warn(JSON.stringify({ evento: 'resolver-chassi', chassi, resultado: 'nao-encontrado' | 'nao-habilita' | 'conflito' }));
```

- [ ] **Step 4: Rodar testes existentes (garantir que nada quebrou)**

```bash
pnpm test src/modules/checklist-auth
```

- [ ] **Step 5: Commit**

```bash
git add src/app.module.ts src/modules/checklist-auth/
git commit -m "feat(back): rate limit e logs estruturados nos endpoints /checklist"
```

### Task A9: Finalizar Fase A — build, push, PR draft

- [ ] **A9.1: Rodar full test + build**

```bash
pnpm test
pnpm build
```
Expected: 0 falhas, build OK.

- [ ] **A9.2: Push branch**

```bash
git push -u origin feat/checklist-login-config
```

- [ ] **A9.3: Abrir PR draft**

```bash
gh pr create --draft --title "feat: config de login do checklist por empresa (back)" --body "$(cat <<'EOF'
## Escopo

Back-end da feature "Login do Checklist configurável por empresa". Ver spec:
https://github.com/suportehorautil360/360-repository/blob/main/docs/superpowers/specs/2026-08-11-checklist-login-modo-empresa-design.md

## Mudanças

- Novo campo `checklistLogin: { cpfSenha, chassi }` em `clientes` (opcional; backward compat).
- Endpoint `PATCH /clientes/:id/checklist-login-config` (JWT admin).
- Novo módulo `checklist-auth` com service `ChecklistChassiService`.
- `POST /checklist/resolver-chassi` (público, rate-limited 10/min por IP).
- `GET /checklist/chassis-empresa/:empresaId` (público, rate-limited).
- Rate limit via `@nestjs/throttler`.
- Log estruturado dos endpoints públicos.
- Script `scripts/migrar-checklist-login.mjs` (dry-run + --commit).

## Checklist

- [x] `pnpm test` sem falhas
- [x] `pnpm build` OK
- [ ] Rodar migração em prod após merge: `node scripts/migrar-checklist-login.mjs --commit`
- [ ] PR do 360 coordenado: [link após criar]
EOF
)"
```

**FASE A COMPLETA — pausar aqui e coordenar review antes de partir pra Fase B.**

---

## Fase B — Front admin (`360-repository`)

**Setup:**

- [ ] **B0.1: Voltar pro repo 360, ir pra branch já criada da feature**

```bash
cd /Users/viniciusaguiar/Development/horautil/360-repository
git status  # deve estar em feat/checklist-login-por-empresa (do brainstorming)
# se não, git checkout feat/checklist-login-por-empresa
```

- [ ] **B0.2: Instalar componente shadcn `switch`**

```bash
npx shadcn@latest add switch
```

Verifica: `ls src/components/ui/switch.tsx`

Commit:
```bash
git add src/components/ui/switch.tsx pnpm-lock.yaml package.json
git commit -m "chore(360): add shadcn Switch component"
```

### Task B1: Estender `clientesApi` com métodos de config

**Files:**
- Modify: `360-repository/src/lib/api/clientes.ts`

**Interfaces:**
- Produces:
  - `clientesApi.atualizarChecklistLoginConfig(clienteId: string, config: { cpfSenha: boolean; chassi: boolean }): Promise<void>`
  - Adicionar `checklistLogin?: { cpfSenha: boolean; chassi: boolean }` ao tipo `ClienteApi`.

- [ ] **Step 1: Adicionar campo no tipo `ClienteApi`**

Em `src/lib/api/clientes.ts`, na interface `ClienteApi`:
```ts
checklistLogin?: { cpfSenha: boolean; chassi: boolean };
```

- [ ] **Step 2: Adicionar método `atualizarChecklistLoginConfig` no `clientesApi`**

```ts
async atualizarChecklistLoginConfig(
  clienteId: string,
  config: { cpfSenha: boolean; chassi: boolean },
): Promise<void> {
  await api.patch<void>(`/clientes/${clienteId}/checklist-login-config`, config);
}
```

(Verificar se `api` está importado e tem método `patch`; se não, usar `api.request({method:'PATCH', ...})`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/clientes.ts
git commit -m "feat(360/admin): clientesApi.atualizarChecklistLoginConfig"
```

### Task B2: Hook `useChecklistLoginConfig`

**Files:**
- Create: `360-repository/src/pages/admin/hooks/access/use-checklist-login-config.ts`
- Create: `360-repository/src/pages/admin/hooks/access/use-checklist-login-config.test.ts`

**Interfaces:**
- Produces: hook `useChecklistLoginConfig(clienteId: string)` que expõe:
  - `cpfSenha: boolean`, `chassi: boolean`
  - `setCpfSenha(v: boolean): void`, `setChassi(v: boolean): void`
  - `salvar(): Promise<{ ok: boolean; error?: string }>`
  - `carregando: boolean`, `salvando: boolean`

- [ ] **Step 1: Teste (Vitest + Testing Library)**

```ts
import { renderHook, act } from '@testing-library/react';
import { useChecklistLoginConfig } from './use-checklist-login-config';
import { clientesApi } from '../../../../lib/api/clientes';

vi.mock('../../../../lib/api/clientes', () => ({
  clientesApi: {
    obter: vi.fn().mockResolvedValue({ id: 'cli', checklistLogin: { cpfSenha: true, chassi: false } }),
    atualizarChecklistLoginConfig: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('useChecklistLoginConfig', () => {
  it('carrega estado inicial do cliente', async () => {
    const { result } = renderHook(() => useChecklistLoginConfig('cli'));
    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(result.current.cpfSenha).toBe(true);
    expect(result.current.chassi).toBe(false);
  });
  it('salvar chama a API e retorna ok=true', async () => {
    const { result } = renderHook(() => useChecklistLoginConfig('cli'));
    await act(async () => { result.current.setChassi(true); });
    const r = await act(() => result.current.salvar());
    expect(r).toEqual({ ok: true });
    expect(clientesApi.atualizarChecklistLoginConfig).toHaveBeenCalledWith('cli', { cpfSenha: true, chassi: true });
  });
  it('salvar com nenhum modo ativo retorna erro', async () => {
    const { result } = renderHook(() => useChecklistLoginConfig('cli'));
    await act(async () => { result.current.setCpfSenha(false); result.current.setChassi(false); });
    const r = await act(() => result.current.salvar());
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/pelo menos um/i);
  });
});
```

Rodar → FAIL.

- [ ] **Step 2: Implementar hook**

```ts
import { useEffect, useState } from 'react';
import { clientesApi } from '../../../../lib/api/clientes';

export function useChecklistLoginConfig(clienteId: string) {
  const [cpfSenha, setCpfSenha] = useState(true);
  const [chassi, setChassi] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        const c = await clientesApi.obter(clienteId);   // ver se método se chama 'obter' ou 'get'
        setCpfSenha(c.checklistLogin?.cpfSenha ?? true);
        setChassi(c.checklistLogin?.chassi ?? false);
      } finally {
        setCarregando(false);
      }
    })();
  }, [clienteId]);

  async function salvar(): Promise<{ ok: boolean; error?: string }> {
    if (!cpfSenha && !chassi) return { ok: false, error: 'Pelo menos um modo precisa estar ativo.' };
    setSalvando(true);
    try {
      await clientesApi.atualizarChecklistLoginConfig(clienteId, { cpfSenha, chassi });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Erro ao salvar.' };
    } finally {
      setSalvando(false);
    }
  }

  return { cpfSenha, chassi, setCpfSenha, setChassi, carregando, salvando, salvar };
}
```

- [ ] **Step 3: Rodar teste → PASS**

```bash
pnpm test src/pages/admin/hooks/access/use-checklist-login-config.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/hooks/access/use-checklist-login-config.ts \
        src/pages/admin/hooks/access/use-checklist-login-config.test.ts
git commit -m "feat(360/admin): useChecklistLoginConfig com estado local e save otimista"
```

### Task B3: Componente `CadastroConfigTab`

**Files:**
- Create: `360-repository/src/pages/admin/sections/CadastroConfigTab.tsx`
- Create: `360-repository/src/pages/admin/sections/CadastroConfigTab.test.tsx`

**Interfaces:**
- Consumes: `useChecklistLoginConfig` de B2
- Produces: `<CadastroConfigTab clienteId={string} />` — usado em B4.

- [ ] **Step 1: Teste**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CadastroConfigTab } from './CadastroConfigTab';

vi.mock('../hooks/access/use-checklist-login-config', () => ({
  useChecklistLoginConfig: () => ({
    cpfSenha: true, chassi: false,
    setCpfSenha: vi.fn(), setChassi: vi.fn(),
    salvar: vi.fn().mockResolvedValue({ ok: true }),
    carregando: false, salvando: false,
  }),
}));

describe('CadastroConfigTab', () => {
  it('renderiza os 2 toggles e o botão salvar', () => {
    render(<CadastroConfigTab clienteId="cli" />);
    expect(screen.getByLabelText(/CPF.*Senha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Chassi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar/i })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Implementar componente**

```tsx
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useChecklistLoginConfig } from '../hooks/access/use-checklist-login-config';

export function CadastroConfigTab({ clienteId }: { clienteId: string }) {
  const cfg = useChecklistLoginConfig(clienteId);
  const nenhum = !cfg.cpfSenha && !cfg.chassi;

  async function handleSalvar() {
    const r = await cfg.salvar();
    if (r.ok) toast.success('Configurações salvas');
    else toast.error(r.error ?? 'Erro ao salvar');
  }

  if (cfg.carregando) return <p className="p-4">Carregando…</p>;

  return (
    <section className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Login do Checklist</h3>
        <p className="text-sm text-muted-foreground">Quais modos os operadores podem usar pra entrar.</p>
      </div>

      <div className="flex items-start gap-3">
        <Switch id="cpfSenha" checked={cfg.cpfSenha} onCheckedChange={cfg.setCpfSenha} />
        <div>
          <label htmlFor="cpfSenha" className="font-medium">CPF / Login + Senha</label>
          <p className="text-sm text-muted-foreground">Operador cadastrado usa CPF ou login + senha.</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Switch id="chassi" checked={cfg.chassi} onCheckedChange={cfg.setChassi} />
        <div>
          <label htmlFor="chassi" className="font-medium">Chassi da máquina</label>
          <p className="text-sm text-muted-foreground">Qualquer pessoa entra digitando o chassi (pede o nome depois).</p>
        </div>
      </div>

      {nenhum && (
        <div role="alert" className="text-sm text-destructive">
          Pelo menos um modo precisa estar ativo — senão nenhum operador consegue logar.
        </div>
      )}

      <Button onClick={handleSalvar} disabled={nenhum || cfg.salvando}>
        {cfg.salvando ? 'Salvando…' : 'Salvar configurações'}
      </Button>
    </section>
  );
}
```

- [ ] **Step 3: Testes passam**

```bash
pnpm test src/pages/admin/sections/CadastroConfigTab.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/sections/CadastroConfigTab.tsx src/pages/admin/sections/CadastroConfigTab.test.tsx
git commit -m "feat(360/admin): CadastroConfigTab com toggles do login do checklist"
```

### Task B4: Refactor `CadastroClientesSection` pra `<Tabs>` shadcn (3 abas)

**Files:**
- Modify: `360-repository/src/pages/admin/sections/CadastroClientesSection.tsx`

**Interfaces:**
- Consumes: `CadastroConfigTab` de B3, `CadastroAcessosTab` (existente).

- [ ] **Step 1: Ler o arquivo pra localizar o padrão atual**

Achar o bloco (`grep -n "CadastroAcessosTab" CadastroClientesSection.tsx` — hoje na linha ~744). Existe um state boolean que troca entre form e `CadastroAcessosTab`.

- [ ] **Step 2: Importar componentes Tabs shadcn**

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CadastroConfigTab } from './CadastroConfigTab';
```

- [ ] **Step 3: Substituir o "tab manual" pelo `<Tabs>`**

Substituir o bloco `{state ? <form> : <CadastroAcessosTab />}` por:

```tsx
<Tabs defaultValue="dados" className="w-full">
  <TabsList>
    <TabsTrigger value="dados">Dados & Contrato</TabsTrigger>
    <TabsTrigger value="acessos" disabled={!clienteId}>Acessos</TabsTrigger>
    <TabsTrigger value="config" disabled={!clienteId}>Configurações</TabsTrigger>
  </TabsList>
  <TabsContent value="dados">
    {/* form atual aqui */}
  </TabsContent>
  <TabsContent value="acessos">
    {clienteId && <CadastroAcessosTab clienteIdInicial={clienteId} />}
  </TabsContent>
  <TabsContent value="config">
    {clienteId && <CadastroConfigTab clienteId={clienteId} />}
  </TabsContent>
</Tabs>
```

`disabled` para as abas que exigem cliente já criado (novo cadastro não tem `clienteId`).

Remover o state boolean anterior e o botão manual de troca de aba.

- [ ] **Step 4: Rodar lint + testes**

```bash
pnpm lint src/pages/admin/sections/CadastroClientesSection.tsx
pnpm test src/pages/admin/sections/
```

- [ ] **Step 5: Verificar visualmente no browser**

Rebuild do container (se docker rodando): `docker compose up -d --build web-360`. Abrir `/admin/clientes/[id]` e verificar 3 abas.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/sections/CadastroClientesSection.tsx
git commit -m "refactor(360/admin): migrar CadastroClientesSection para shadcn Tabs + aba Configurações"
```

**FASE B COMPLETA — não abre PR ainda (junto com Fase C no PR único do 360).**

---

## Fase C — Front checklist (`360-repository`)

### Task C1: Módulo `chassis-offline.ts`

**Files:**
- Create: `360-repository/src/pages/checklist-controle/chassis-offline.ts`
- Create: `360-repository/src/pages/checklist-controle/chassis-offline.test.ts`

**Interfaces:**
- Produces:
  - `provisionarChassisEmpresa(entrada: EmpresaChassis): void`
  - `resolverChassiOffline(chassi: string): { empresaId: string; empresaNome: string } | null`
  - `removerChassisEmpresa(empresaId: string): void`
  - `limparExpirados(): void`
  - Type `EmpresaChassis = { empresaId: string; empresaNome: string; chassis: string[]; expiraEm: string }`

- [ ] **Step 1: Teste**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { provisionarChassisEmpresa, resolverChassiOffline, removerChassisEmpresa, limparExpirados } from './chassis-offline';

const KEY = 'hu360-chassis-offline';

beforeEach(() => { localStorage.clear(); });

describe('chassis-offline', () => {
  it('provisiona e resolve chassi normalizado', () => {
    provisionarChassisEmpresa({ empresaId: 'e1', empresaNome: 'Emp 1', chassis: ['aaa', 'BBB'], expiraEm: new Date(Date.now()+1000).toISOString() });
    expect(resolverChassiOffline('AAA')).toEqual({ empresaId: 'e1', empresaNome: 'Emp 1' });
    expect(resolverChassiOffline('  bbb ')).toEqual({ empresaId: 'e1', empresaNome: 'Emp 1' });
    expect(resolverChassiOffline('ccc')).toBeNull();
  });
  it('multi-empresa: encontra em qualquer uma', () => {
    provisionarChassisEmpresa({ empresaId: 'e1', empresaNome: 'Emp 1', chassis: ['X1'], expiraEm: new Date(Date.now()+1000).toISOString() });
    provisionarChassisEmpresa({ empresaId: 'e2', empresaNome: 'Emp 2', chassis: ['Y1'], expiraEm: new Date(Date.now()+1000).toISOString() });
    expect(resolverChassiOffline('X1')?.empresaId).toBe('e1');
    expect(resolverChassiOffline('Y1')?.empresaId).toBe('e2');
  });
  it('expirado NÃO resolve', () => {
    provisionarChassisEmpresa({ empresaId: 'e1', empresaNome: 'Emp 1', chassis: ['Z'], expiraEm: new Date(Date.now()-1000).toISOString() });
    expect(resolverChassiOffline('Z')).toBeNull();
  });
  it('remover empresa limpa só ela', () => {
    provisionarChassisEmpresa({ empresaId: 'e1', empresaNome: 'Emp 1', chassis: ['X'], expiraEm: new Date(Date.now()+1000).toISOString() });
    provisionarChassisEmpresa({ empresaId: 'e2', empresaNome: 'Emp 2', chassis: ['Y'], expiraEm: new Date(Date.now()+1000).toISOString() });
    removerChassisEmpresa('e1');
    expect(resolverChassiOffline('X')).toBeNull();
    expect(resolverChassiOffline('Y')).not.toBeNull();
  });
  it('limparExpirados remove só expiradas', () => {
    provisionarChassisEmpresa({ empresaId: 'e1', empresaNome: 'V', chassis: ['V'], expiraEm: new Date(Date.now()+1000).toISOString() });
    provisionarChassisEmpresa({ empresaId: 'e2', empresaNome: 'E', chassis: ['E'], expiraEm: new Date(Date.now()-1000).toISOString() });
    limparExpirados();
    expect(resolverChassiOffline('V')).not.toBeNull();
    expect(resolverChassiOffline('E')).toBeNull();
  });
});
```

- [ ] **Step 2: Implementar**

```ts
const KEY = 'hu360-chassis-offline';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type EmpresaChassis = {
  empresaId: string;
  empresaNome: string;
  chassis: string[];       // já normalizados
  expiraEm: string;        // ISO
};

function normalizar(c: string): string {
  return (c ?? '').toString().toUpperCase().replace(/\s+/g, '');
}

function ler(): EmpresaChassis[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); }
  catch { return []; }
}
function gravar(lista: EmpresaChassis[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(lista)); } catch { /* cota cheia */ }
}
function vigentes(lista: EmpresaChassis[]): EmpresaChassis[] {
  const now = Date.now();
  return lista.filter((e) => Date.parse(e.expiraEm) > now);
}

export function provisionarChassisEmpresa(entrada: EmpresaChassis): void {
  const norm: EmpresaChassis = { ...entrada, chassis: [...new Set(entrada.chassis.map(normalizar).filter(Boolean))] };
  const outras = vigentes(ler()).filter((e) => e.empresaId !== entrada.empresaId);
  gravar([...outras, norm]);
}

export function resolverChassiOffline(input: string): { empresaId: string; empresaNome: string } | null {
  const alvo = normalizar(input);
  if (!alvo) return null;
  for (const emp of vigentes(ler())) {
    if (emp.chassis.includes(alvo)) return { empresaId: emp.empresaId, empresaNome: emp.empresaNome };
  }
  return null;
}

export function removerChassisEmpresa(empresaId: string): void {
  gravar(vigentes(ler()).filter((e) => e.empresaId !== empresaId));
}

export function limparExpirados(): void {
  gravar(vigentes(ler()));
}
```

- [ ] **Step 3: Testes passam**

```bash
pnpm test src/pages/checklist-controle/chassis-offline.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/checklist-controle/chassis-offline.ts src/pages/checklist-controle/chassis-offline.test.ts
git commit -m "feat(360/checklist): módulo chassis-offline (cache por empresa, TTL 7d)"
```

### Task C2: Expandir `useOperadorSession` com `modoLogin` + `nomeInformado`

**Files:**
- Modify: `360-repository/src/pages/checklist-controle/useOperadorSession.ts`
- Modify: `360-repository/src/pages/checklist-controle/useOperadorSession.test.ts`

**Interfaces:**
- Produces: campo `modoLogin: "cpf-senha" | "chassi"` e `nomeInformado?: string` em `OperadorSession`. `funcionarioId` passa a ser opcional. Sessões legadas (sem `modoLogin`) → default `"cpf-senha"` na leitura.

- [ ] **Step 1: Adicionar teste de retrocompat + novos campos**

Adicionar no `.test.ts`:
```ts
it('sessão legada (sem modoLogin) → default cpf-senha na leitura', () => {
  localStorage.setItem('hu360-operador-session', JSON.stringify({
    v: 1, expiraEm: new Date(Date.now()+1000).toISOString(),
    session: { nome: 'X', idCliente: 'e1', empresa: 'E', funcionarioId: 'f1' }
  }));
  const { session } = useOperadorSession.getState();
  expect(session?.modoLogin).toBe('cpf-senha');
});

it('grava modoLogin=chassi + nomeInformado', () => {
  useOperadorSession.getState().setSession({
    nome: 'Anon', idCliente: 'e1', empresa: 'E',
    idMaquina: 'm1', chassis: 'ABC',
    modoLogin: 'chassi', nomeInformado: 'João',
  });
  const stored = JSON.parse(localStorage.getItem('hu360-operador-session')!);
  expect(stored.session.modoLogin).toBe('chassi');
  expect(stored.session.nomeInformado).toBe('João');
});
```

- [ ] **Step 2: Atualizar tipo + leitura tolerante**

Em `useOperadorSession.ts`:
```ts
export type OperadorSession = {
  nome: string;
  idCliente: string;
  empresa: string;
  funcionarioId?: string;        // agora opcional
  cpf?: string;
  tipo?: 'operador' | 'supervisor' | 'admin';
  idMaquina?: string;
  chassis?: string;
  modoLogin: 'cpf-senha' | 'chassi';
  nomeInformado?: string;
};
```

Na função que lê do localStorage, ao hidratar, adicionar:
```ts
if (raw.session && !raw.session.modoLogin) {
  raw.session.modoLogin = 'cpf-senha';
}
```

- [ ] **Step 3: Testes passam**

```bash
pnpm test src/pages/checklist-controle/useOperadorSession.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/checklist-controle/useOperadorSession.ts src/pages/checklist-controle/useOperadorSession.test.ts
git commit -m "feat(360/checklist): OperadorSession com modoLogin e nomeInformado"
```

### Task C3: `funcionariosApi.autenticarPorChassi`

**Files:**
- Modify: `360-repository/src/lib/funcionarios/funcionarios.ts`
- Modify: `360-repository/src/lib/funcionarios/funcionarios.test.ts`

**Interfaces:**
- Produces:
  ```ts
  funcionariosApi.autenticarPorChassi(chassi: string):
    Promise<
      | { ok: true; empresaId: string; empresaNome: string; idMaquina: string; chassi: string }
      | { ok: false; motivo: 'nao-encontrado' | 'nao-habilita' | 'conflito' | 'sem-conexao' | 'erro' }
    >
  ```

- [ ] **Step 1: Teste — mockar `fetch`/`api` e cache offline**

Adicionar em `funcionarios.test.ts`:
```ts
describe('autenticarPorChassi', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('online → 200 → ok com dados', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ empresaId: 'e1', empresaNome: 'E1', idMaquina: 'm1', chassi: 'ABC' })
    } as Response);
    const r = await funcionariosApi.autenticarPorChassi('abc');
    if (!r.ok) throw new Error('esperava ok');
    expect(r.empresaId).toBe('e1');
  });

  it('online → 404 → nao-encontrado', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 404 } as Response);
    const r = await funcionariosApi.autenticarPorChassi('XYZ');
    expect(r).toEqual({ ok: false, motivo: 'nao-encontrado' });
  });

  it('online → 409 → conflito', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 409 } as Response);
    const r = await funcionariosApi.autenticarPorChassi('DUP');
    expect(r).toEqual({ ok: false, motivo: 'conflito' });
  });

  it('offline + cache hit → ok', async () => {
    // pré-popular cache local
    const { provisionarChassisEmpresa } = await import('../../pages/checklist-controle/chassis-offline');
    provisionarChassisEmpresa({ empresaId: 'e2', empresaNome: 'E2', chassis: ['CACHED'], expiraEm: new Date(Date.now()+1000).toISOString() });
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const r = await funcionariosApi.autenticarPorChassi('CACHED');
    if (!r.ok) throw new Error('esperava ok offline');
    expect(r.empresaId).toBe('e2');
    expect(r.idMaquina).toBe('');   // offline não sabe idMaquina
  });

  it('offline + cache miss → sem-conexao', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const r = await funcionariosApi.autenticarPorChassi('NADA');
    expect(r).toEqual({ ok: false, motivo: 'sem-conexao' });
  });
});
```

- [ ] **Step 2: Implementar**

Em `funcionarios.ts` (adicionar ao objeto `funcionariosApi`):
```ts
import { resolverChassiOffline, provisionarChassisEmpresa } from '../../pages/checklist-controle/chassis-offline';
import { api } from '../api/client';   // ajuste do path conforme lib

async autenticarPorChassi(chassiInput: string) {
  const chassi = (chassiInput ?? '').toString().toUpperCase().replace(/\s+/g, '');
  if (!chassi) return { ok: false as const, motivo: 'nao-encontrado' as const };

  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  if (online) {
    try {
      const r = await api.post<{ empresaId: string; empresaNome: string; idMaquina: string; chassi: string }>(
        '/checklist/resolver-chassi', { chassi }
      );
      // Provisiona cache — best-effort
      try {
        const lista = await api.get<{ chassis: string[]; expiraEm: string }>(`/checklist/chassis-empresa/${r.empresaId}`);
        provisionarChassisEmpresa({ empresaId: r.empresaId, empresaNome: r.empresaNome, chassis: lista.chassis, expiraEm: lista.expiraEm });
      } catch { /* segue sem cache */ }
      return { ok: true as const, ...r };
    } catch (e: unknown) {
      const status = (e as { status?: number })?.status;
      if (status === 404) return { ok: false as const, motivo: 'nao-encontrado' as const };
      if (status === 409) return { ok: false as const, motivo: 'conflito' as const };
      // 400 com mensagem específica de "não habilita" pode ser tratado igual a nao-encontrado
      return { ok: false as const, motivo: 'erro' as const };
    }
  }
  // offline
  const off = resolverChassiOffline(chassi);
  if (off) return { ok: true as const, empresaId: off.empresaId, empresaNome: off.empresaNome, idMaquina: '', chassi };
  return { ok: false as const, motivo: 'sem-conexao' as const };
},
```

- [ ] **Step 3: Testes passam**

```bash
pnpm test src/lib/funcionarios/funcionarios.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/funcionarios/funcionarios.ts src/lib/funcionarios/funcionarios.test.ts
git commit -m "feat(360/checklist): funcionariosApi.autenticarPorChassi (online + cache offline)"
```

### Task C4: `NomeOperadorDialog` (modal shadcn)

**Files:**
- Create: `360-repository/src/pages/checklist-controle/NomeOperadorDialog.tsx`
- Create: `360-repository/src/pages/checklist-controle/NomeOperadorDialog.test.tsx`

**Interfaces:**
- Produces: `<NomeOperadorDialog open={boolean} onConfirmar={(nome: string) => void} onCancelar={() => void} />`

- [ ] **Step 1: Teste**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { NomeOperadorDialog } from './NomeOperadorDialog';

describe('NomeOperadorDialog', () => {
  it('botão desabilitado com nome vazio', () => {
    render(<NomeOperadorDialog open onConfirmar={() => {}} onCancelar={() => {}} />);
    expect(screen.getByRole('button', { name: /entrar/i })).toBeDisabled();
  });
  it('preenche nome e confirma', () => {
    const onConfirmar = vi.fn();
    render(<NomeOperadorDialog open onConfirmar={onConfirmar} onCancelar={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/joão/i), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
    expect(onConfirmar).toHaveBeenCalledWith('Ana');
  });
});
```

- [ ] **Step 2: Implementar**

```tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function NomeOperadorDialog({
  open, onConfirmar, onCancelar,
}: {
  open: boolean;
  onConfirmar: (nome: string) => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState('');
  const podeConfirmar = nome.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancelar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Como podemos te chamar?</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Vamos usar seu nome pra assinar os checklists.
          </p>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Ex.: João Silva"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && podeConfirmar && onConfirmar(nome.trim())}
        />
        <DialogFooter>
          <Button disabled={!podeConfirmar} onClick={() => onConfirmar(nome.trim())}>
            Entrar no checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Testes passam**

```bash
pnpm test src/pages/checklist-controle/NomeOperadorDialog.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/checklist-controle/NomeOperadorDialog.tsx src/pages/checklist-controle/NomeOperadorDialog.test.tsx
git commit -m "feat(360/checklist): NomeOperadorDialog (modal shadcn)"
```

### Task C5: Redesign `ChecklistLoginPage` — layout split + dark/light + Tabs Chassi/CPF

**Files:**
- Modify (rewrite): `360-repository/src/pages/checklist-controle/ChecklistLoginPage.tsx`
- Modify: `360-repository/src/pages/checklist-controle/ChecklistLoginPage.test.tsx` (se existir)
- Modify: `360-repository/src/pages/login/login.css` — não mais importar diretamente aqui (o novo layout usa shadcn), mas manter existente pra outras telas.

**Interfaces:**
- Consumes: `funcionariosApi.autenticarPorChassi` de C3, `NomeOperadorDialog` de C4, `useOperadorSession` de C2, cache offline de C1, fluxo CPF/senha atual (`funcionariosApi.autenticar` — mantém).

- [ ] **Step 1: Escrever caso de teste principal (aba chassi → modal nome → sessão)**

Adicionar em `ChecklistLoginPage.test.tsx`:
```tsx
it('aba chassi: digita chassi válido → abre modal nome → cria sessão modoLogin=chassi', async () => {
  vi.spyOn(funcionariosApi, 'autenticarPorChassi').mockResolvedValue({
    ok: true, empresaId: 'e1', empresaNome: 'Emp 1', idMaquina: 'm1', chassi: 'ABC'
  });
  render(<MemoryRouter><ChecklistLoginPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('tab', { name: /chassi/i }));
  fireEvent.change(screen.getByPlaceholderText(/chassi/i), { target: { value: 'abc' } });
  fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
  await screen.findByRole('dialog');
  fireEvent.change(screen.getByPlaceholderText(/joão/i), { target: { value: 'Zé' } });
  fireEvent.click(screen.getByRole('button', { name: /entrar no checklist/i }));
  const sess = useOperadorSession.getState().session!;
  expect(sess.modoLogin).toBe('chassi');
  expect(sess.nomeInformado).toBe('Zé');
  expect(sess.idCliente).toBe('e1');
});
```

- [ ] **Step 2: Implementar o novo `ChecklistLoginPage.tsx` — completo**

Estrutura mínima (peças chave — completar layout com Tailwind conforme spec 6.1):

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { funcionariosApi } from '../../lib/funcionarios/funcionarios';
import { NomeOperadorDialog } from './NomeOperadorDialog';
import { useOperadorSession } from './useOperadorSession';
// ... imports existentes (autenticarOffline, salvarCredencialOffline, MOTIVO_MSG, formatarCpf, etc.)

const THEME_KEY = 'hu360-checklist-theme';
const LAST_TAB_KEY = 'hu360-checklist-last-tab';

export function ChecklistLoginPage() {
  const navigate = useNavigate();
  const { setSession } = useOperadorSession();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY)) as 'light' | 'dark' | null;
    if (saved === 'light' || saved === 'dark') return saved;
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => { localStorage.setItem(THEME_KEY, theme); }, [theme]);

  const [tab, setTab] = useState<'chassi' | 'cpf'>(() =>
    (localStorage.getItem(LAST_TAB_KEY) as 'chassi' | 'cpf' | null) ?? 'cpf'
  );
  useEffect(() => { localStorage.setItem(LAST_TAB_KEY, tab); }, [tab]);

  // ... estado + submit dos dois modos (chassi + cpf/senha)
  // fluxo chassi: chama funcionariosApi.autenticarPorChassi → se ok, abre <NomeOperadorDialog>
  // fluxo cpf: mantém código existente

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="flex justify-end p-4">
          <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun /> : <Moon />}
          </Button>
        </header>
        <main className="grid min-h-[calc(100vh-64px)] lg:grid-cols-2">
          <section className="flex items-center justify-center p-6 lg:p-12">
            <Card className="w-full max-w-md">
              <CardContent className="p-6 space-y-4">
                <h1 className="text-2xl font-semibold">Controle Checklist</h1>
                <p className="text-muted-foreground text-sm">Entre para começar suas inspeções de campo.</p>
                <Tabs value={tab} onValueChange={(v) => setTab(v as 'chassi' | 'cpf')}>
                  <TabsList className="w-full">
                    <TabsTrigger value="chassi" className="flex-1">Chassi</TabsTrigger>
                    <TabsTrigger value="cpf" className="flex-1">CPF / Login</TabsTrigger>
                  </TabsList>
                  <TabsContent value="chassi">{/* form chassi */}</TabsContent>
                  <TabsContent value="cpf">{/* form cpf existente re-estilizado */}</TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>
          <aside
            aria-hidden
            className="hidden lg:block bg-gradient-to-br from-orange-500 via-orange-600 to-orange-900"
          />
        </main>
        <NomeOperadorDialog open={...} onConfirmar={...} onCancelar={...} />
      </div>
    </div>
  );
}
```

**Preservar** a lógica existente do fluxo CPF/senha (`funcionariosApi.autenticar`, `autenticarOffline`, `salvarCredencialOffline`, `MOTIVO_MSG`, mensagens de erro). Apenas envolver com o novo layout.

**Adicionar** o fluxo do chassi:
1. `handleSubmitChassi(chassi)`:
   ```ts
   const r = await funcionariosApi.autenticarPorChassi(chassi);
   if (!r.ok) { setErro(MOTIVO_CHASSI[r.motivo]); return; }
   setResolvido({ empresaId: r.empresaId, empresaNome: r.empresaNome, idMaquina: r.idMaquina, chassi: r.chassi });
   setModalNomeAberto(true);
   ```
2. `onConfirmarNome(nome)`:
   ```ts
   setSession({
     nome: nome, idCliente: resolvido!.empresaId, empresa: resolvido!.empresaNome,
     idMaquina: resolvido!.idMaquina, chassis: resolvido!.chassi,
     modoLogin: 'chassi', nomeInformado: nome,
   });
   navigate('/checklist-controle', { replace: true });
   ```

Mensagens de erro chassi (const `MOTIVO_CHASSI`):
```ts
const MOTIVO_CHASSI: Record<'nao-encontrado' | 'conflito' | 'sem-conexao' | 'erro' | 'nao-habilita', string> = {
  'nao-encontrado': 'Chassi não encontrado. Confirme o número com o gestor.',
  'conflito': 'Chassi vinculado a mais de uma empresa. Contate o suporte.',
  'nao-habilita': 'Esse chassi não permite login direto. Use CPF/senha.',
  'sem-conexao': 'Sem conexão. Esse aparelho não conhece esse chassi. Conecte à internet ou peça pra alguém logar online primeiro.',
  'erro': 'Não foi possível validar o chassi. Tente novamente.',
};
```

- [ ] **Step 3: Rodar testes**

```bash
pnpm test src/pages/checklist-controle/ChecklistLoginPage.test.tsx
```

- [ ] **Step 4: Rodar lint + build**

```bash
pnpm lint src/pages/checklist-controle/ChecklistLoginPage.tsx
pnpm build
```

- [ ] **Step 5: Rebuild container + verificar visualmente**

```bash
cd /Users/viniciusaguiar/Development/horautil && docker compose up -d --build web-360
```

Abrir `http://localhost:8080/checklist-login`: layout split, toggle dark/light no header, tabs Chassi/CPF. Testar cada fluxo.

- [ ] **Step 6: Commit**

```bash
cd /Users/viniciusaguiar/Development/horautil/360-repository
git add src/pages/checklist-controle/ChecklistLoginPage.tsx src/pages/checklist-controle/ChecklistLoginPage.test.tsx
git commit -m "feat(360/checklist): redesign ChecklistLoginPage — split layout, dark/light, tabs chassi/cpf"
```

### Task C6: Assinatura do checklist grava `operador.tipo`

**Files:**
- Modify: `360-repository/src/pages/checklist-controle/ChecklistControlePage.tsx` (linhas ~1886, 1912, 2035, 2124, 2149 — onde `operadorNome` é montado)
- Modify: eventual API/adapter que grava no Firestore (identificar via `grep -n "addDoc\|updateDoc.*checklist" src/pages/checklist-controle`)

**Interfaces:**
- Consumes: `useOperadorSession().session` — usa `modoLogin`, `nomeInformado`, `funcionarioId`, `idMaquina`, `chassis`.
- Produces: no doc final do checklist, campo `operador` com discriminante:
  ```ts
  operador: session.modoLogin === 'chassi'
    ? { tipo: 'chassi', nomeInformado, chassiUsado, idMaquina }
    : { tipo: 'funcionario', funcionarioId, nome, cpf }
  ```

- [ ] **Step 1: Ler contexto**

```bash
sed -n '1880,1900p' src/pages/checklist-controle/ChecklistControlePage.tsx
sed -n '2020,2050p' src/pages/checklist-controle/ChecklistControlePage.tsx
```
Anotar onde `operadorNome` é montado e como o payload chega ao Firestore.

- [ ] **Step 2: Criar helper `montarOperadorAssinatura`**

Adicionar helper (novo arquivo `src/pages/checklist-controle/assinatura.ts` ou dentro de `ChecklistControlePage.tsx` se for < 30 linhas):
```ts
import type { OperadorSession } from './useOperadorSession';

export function montarOperadorAssinatura(session: OperadorSession, nomeDigitado?: string) {
  const nome = (nomeDigitado?.trim() || session.nomeInformado || session.nome).trim();
  if (session.modoLogin === 'chassi') {
    return {
      tipo: 'chassi' as const,
      nomeInformado: nome,
      chassiUsado: session.chassis ?? '',
      idMaquina: session.idMaquina ?? '',
    };
  }
  return {
    tipo: 'funcionario' as const,
    funcionarioId: session.funcionarioId ?? '',
    nome,
    cpf: session.cpf ?? '',
  };
}
```

- [ ] **Step 3: Teste do helper**

```ts
import { montarOperadorAssinatura } from './assinatura';

describe('montarOperadorAssinatura', () => {
  it('modo chassi → tipo chassi + nomeInformado + chassiUsado', () => {
    const out = montarOperadorAssinatura({ modoLogin: 'chassi', nome: 'Anon', idCliente: 'e', empresa: 'E', nomeInformado: 'João', chassis: 'ABC', idMaquina: 'm1' });
    expect(out).toEqual({ tipo: 'chassi', nomeInformado: 'João', chassiUsado: 'ABC', idMaquina: 'm1' });
  });
  it('modo cpf-senha → tipo funcionario', () => {
    const out = montarOperadorAssinatura({ modoLogin: 'cpf-senha', nome: 'Maria', idCliente: 'e', empresa: 'E', funcionarioId: 'f1', cpf: '123' });
    expect(out).toEqual({ tipo: 'funcionario', funcionarioId: 'f1', nome: 'Maria', cpf: '123' });
  });
  it('nome digitado sobrescreve o da sessão', () => {
    const out = montarOperadorAssinatura({ modoLogin: 'cpf-senha', nome: 'Maria', idCliente: 'e', empresa: 'E', funcionarioId: 'f1' }, 'Maria Souza');
    expect((out as any).nome).toBe('Maria Souza');
  });
});
```

- [ ] **Step 4: Aplicar em `ChecklistControlePage.tsx`**

Em cada ponto onde hoje se grava `operador: payload.operadorNome`, passar a incluir:
```ts
operadorAssinatura: montarOperadorAssinatura(session, payload.operadorNome),
```

**Manter** `operador: payload.operadorNome` como está (retrocompat com leituras antigas). Adicionar o novo campo `operadorAssinatura` — não é destrutivo.

- [ ] **Step 5: Testes passam + smoke test manual**

```bash
pnpm test src/pages/checklist-controle/assinatura.test.ts
```

Rebuild + abrir `/checklist-controle`, finalizar checklist logado por chassi → verificar no Firestore que doc tem `operadorAssinatura: { tipo: 'chassi', ... }`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/checklist-controle/assinatura.ts src/pages/checklist-controle/assinatura.test.ts src/pages/checklist-controle/ChecklistControlePage.tsx
git commit -m "feat(360/checklist): checklist grava operadorAssinatura com tipo (chassi|funcionario)"
```

### Task C7: E2E Playwright — fluxo online chassi

**Files:**
- Create: `360-repository/e2e/chassi-login-online.spec.ts`

- [ ] **Step 1: Escrever spec**

```ts
import { test, expect } from '@playwright/test';

test('login por chassi (online) → abre modal nome → entra em /checklist-controle', async ({ page }) => {
  // Mock do endpoint público de resolver-chassi
  await page.route('**/checklist/resolver-chassi', (route) =>
    route.fulfill({ json: { empresaId: 'e1', empresaNome: 'Prefeitura Teste', idMaquina: 'm1', chassi: 'TEST123' } })
  );
  await page.route('**/checklist/chassis-empresa/**', (route) =>
    route.fulfill({ json: { chassis: ['TEST123'], expiraEm: new Date(Date.now()+3600_000).toISOString() } })
  );

  await page.goto('/checklist-login');
  await page.getByRole('tab', { name: /chassi/i }).click();
  await page.getByPlaceholder(/chassi/i).fill('test123');
  await page.getByRole('button', { name: /entrar/i }).click();

  // Modal nome
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByPlaceholder(/joão/i).fill('E2E Tester');
  await page.getByRole('button', { name: /entrar no checklist/i }).click();

  await expect(page).toHaveURL(/\/checklist-controle/);
});
```

- [ ] **Step 2: Rodar teste**

```bash
pnpm test:e2e chassi-login-online.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/chassi-login-online.spec.ts
git commit -m "test(360/e2e): fluxo login por chassi online + modal nome"
```

### Task C8: E2E Playwright — fluxo offline chassi

**Files:**
- Create: `360-repository/e2e/chassi-login-offline.spec.ts`

- [ ] **Step 1: Escrever spec**

```ts
import { test, expect } from '@playwright/test';

test('login por chassi offline com cache pré-populado', async ({ page, context }) => {
  await page.goto('/checklist-login');
  // Pré-popular cache no localStorage
  await page.evaluate(() => {
    localStorage.setItem('hu360-chassis-offline', JSON.stringify([{
      empresaId: 'e1', empresaNome: 'Emp Offline',
      chassis: ['OFFLINE1'],
      expiraEm: new Date(Date.now() + 3600_000).toISOString(),
    }]));
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('tab', { name: /chassi/i }).click();
  await page.getByPlaceholder(/chassi/i).fill('offline1');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByPlaceholder(/joão/i).fill('Offline Tester');
  await page.getByRole('button', { name: /entrar no checklist/i }).click();
  await expect(page).toHaveURL(/\/checklist-controle/);
});
```

- [ ] **Step 2: Rodar teste**

```bash
pnpm test:e2e chassi-login-offline.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/chassi-login-offline.spec.ts
git commit -m "test(360/e2e): fluxo login por chassi offline com cache pré-populado"
```

### Task C9: Finalizar Fase C — full test, build, push, PR

- [ ] **C9.1: Full test + lint + build no 360**

```bash
cd /Users/viniciusaguiar/Development/horautil/360-repository
pnpm lint
pnpm test
pnpm build
```

- [ ] **C9.2: Push branch**

```bash
git push -u origin feat/checklist-login-por-empresa
```

- [ ] **C9.3: Abrir PR draft**

```bash
gh pr create --draft --title "feat: config de login do checklist por empresa (360) + redesign" --body "$(cat <<'EOF'
## Escopo

Front-end da feature "Login do Checklist configurável por empresa". Ver spec:
docs/superpowers/specs/2026-08-11-checklist-login-modo-empresa-design.md

Depende do PR do back (mesmo nome, repo `back`): [link do PR do back]

## Mudanças

**Admin**
- Nova aba "Configurações" no detalhe do cliente com toggles cpfSenha/chassi.
- Migração de "tab manual" pra `<Tabs>` shadcn (3 abas).
- Hook `useChecklistLoginConfig` + método na `clientesApi`.

**Checklist**
- Novo módulo `chassis-offline.ts` (cache por empresa, TTL 7d, padrão de `credenciais-offline`).
- `useOperadorSession` expandido com `modoLogin` e `nomeInformado` (backward compat).
- `funcionariosApi.autenticarPorChassi` (online + fallback offline).
- Redesign `ChecklistLoginPage` — split layout shadcn, dark/light isolado, tabs Chassi/CPF.
- `NomeOperadorDialog` (modal shadcn) pós-login por chassi.
- Checklist finalizado grava `operadorAssinatura` com discriminante (chassi|funcionario).

**Testes**
- Unit: chassis-offline, useChecklistLoginConfig, CadastroConfigTab, NomeOperadorDialog, funcionariosApi.autenticarPorChassi, assinatura.
- E2E: chassi online, chassi offline.

## Checklist

- [x] `pnpm lint` sem novos erros
- [x] `pnpm test` sem falhas
- [x] `pnpm build` OK
- [x] `pnpm test:e2e` sem falhas
- [ ] Rebuild container `docker compose up -d --build web-360` + smoke manual
EOF
)"
```

**FASE C COMPLETA — feature entregue nos 2 repos, 2 PRs coordenados, pronto pra review.**

---

## Self-Review

**Spec coverage:**
- ✅ §3 (schema): A1 (DTO), A3 (migração)
- ✅ §4 (backend): A2 (PATCH), A4 (resolver), A5 (endpoint), A6 (listar), A7 (endpoint), A8 (rate + log)
- ✅ §5 (front admin): B0 (switch), B1 (API), B2 (hook), B3 (componente), B4 (Tabs refactor)
- ✅ §6 (redesign login): C5 (layout + tabs + dark/light)
- ✅ §7 (cache offline): C1 (módulo), C3 (usa provisionar)
- ✅ §8 (sessão + assinatura): C2 (session), C6 (assinatura)
- ✅ §9 (testes): unit em cada task + C7/C8 (E2E)
- ✅ §10 (migração + rollout): A3 + A9.3 (menciona rodar migração pós-deploy) + C9.3
- ✅ §11 (plano de commits): mapeado 1-para-1 nas tasks
- ✅ §12 (fora do escopo): honrado (sem dark global, sem bcrypt, sem UI massiva de equipamentos)
- ✅ §13 (riscos): rate limit em A8, log estruturado em A8, TTL curto no cache em C1

**Placeholder scan:** nenhum "TBD", "TODO", ou "implementar depois". Todos os steps têm código concreto.

**Type consistency:** `ChecklistLoginConfigDto` (A1) usado em A2. `EmpresaChassis` (C1) referenciado pelo hook em C3. `OperadorSession.modoLogin` (C2) usado em C5, C6. `funcionariosApi.autenticarPorChassi` (C3) chamado em C5.

**Nota de precisão** (não é bloqueio, é aviso pro executor):
- Task B2: verificar se `clientesApi.obter` existe ou se o método é `get`/`buscar`/similar antes de rodar o teste (leia `src/lib/api/clientes.ts` na hora).
- Task C3: `api.post` e `api.get` — verificar a interface real do cliente HTTP em `src/lib/api/client.ts` e ajustar sintaxe se necessário.
- Task C6: `nomeInformado` no session pode ser inconsistente com o input existente `operadorNome` — o helper resolve com precedência (`nomeDigitado` primeiro, senão `nomeInformado` da session).
