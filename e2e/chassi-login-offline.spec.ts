import { test, expect } from '@playwright/test';

test('login por chassi offline com cache pré-populado', async ({ page, context }) => {
  // Navega para a página de login
  await page.goto('/checklist-login');

  // Pré-popula o cache local no localStorage
  await page.evaluate(() => {
    localStorage.setItem(
      'hu360-chassis-offline',
      JSON.stringify([
        {
          empresaId: 'e1',
          empresaNome: 'Emp Offline',
          chassis: ['OFFLINE1'],
          expiraEm: new Date(Date.now() + 3600_000).toISOString(),
        },
      ])
    );
  });

  // Ativa o modo offline
  await context.setOffline(true);

  // Recarrega a página
  await page.reload();

  // Clica na aba Chassi
  await page.getByRole('tab', { name: /chassi/i }).click();

  // Preenche o chassi
  await page.getByPlaceholder(/9BWZZZ/i).fill('OFFLINE1');

  // Clica em "Entrar"
  await page.getByRole('button', { name: /entrar/i }).click();

  // Aguarda o modal de nome estar visível
  await expect(page.getByRole('dialog')).toBeVisible();

  // Preenche o nome no modal
  await page.getByPlaceholder(/joão/i).fill('Offline Tester');

  // Clica em "Entrar no checklist"
  await page.getByRole('button', { name: /entrar no checklist/i }).click();

  // Valida que foi redirecionado para /checklist-controle
  await expect(page).toHaveURL(/\/checklist-controle/);
});
