import { test, expect } from '@playwright/test';

test('login por chassi (online) → abre modal nome → entra em /checklist-controle', async ({ page }) => {
  // Mock do endpoint público de resolver-chassi
  await page.route('**/checklist/resolver-chassi', (route) =>
    route.fulfill({
      json: {
        empresaId: 'e1',
        empresaNome: 'Prefeitura Teste',
        idMaquina: 'm1',
        chassi: 'TEST123',
      },
    })
  );

  // Mock do endpoint para provisionar cache offline
  await page.route('**/checklist/chassis-empresa/**', (route) =>
    route.fulfill({
      json: {
        chassis: ['TEST123'],
        expiraEm: new Date(Date.now() + 3600_000).toISOString(),
      },
    })
  );

  // Navega para a página de login
  await page.goto('/checklist-login');

  // Clica na aba Chassi
  await page.getByRole('tab', { name: /chassi/i }).click();

  // Preenche o chassi
  await page.getByPlaceholder(/9BWZZZ/i).fill('TEST123');

  // Clica em "Entrar"
  await page.getByRole('button', { name: /entrar/i }).click();

  // Aguarda o modal de nome estar visível
  await expect(page.getByRole('dialog')).toBeVisible();

  // Preenche o nome no modal
  await page.getByPlaceholder(/joão/i).fill('E2E Tester');

  // Clica em "Entrar no checklist"
  await page.getByRole('button', { name: /entrar no checklist/i }).click();

  // Valida que foi redirecionado para /checklist-controle
  await expect(page).toHaveURL(/\/checklist-controle/);
});
