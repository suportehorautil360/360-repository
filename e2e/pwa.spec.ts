import { expect, test } from "@playwright/test";

test.describe("PWA", () => {
  test("expõe um manifest válido e instalável", async ({ page }) => {
    await page.goto("/");

    const href = await page.getAttribute('link[rel="manifest"]', "href");
    expect(href).toBeTruthy();

    const res = await page.request.get(href!);
    expect(res.ok()).toBeTruthy();

    const manifest = JSON.parse(await res.text());
    expect(manifest.name).toBe("Hora Útil 360");
    expect(manifest.display).toBe("standalone");
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test("registra e ativa o service worker", async ({ page }) => {
    await page.goto("/checklist-login");

    const hasActiveSW = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return Boolean(reg.active);
    });
    expect(hasActiveSW).toBe(true);
  });

  test("o app continua carregando offline (app shell em cache)", async ({
    page,
    context,
  }) => {
    // 1) Carrega online e espera o SW ativar (precache concluído).
    await page.goto("/checklist-login");
    await page.evaluate(() => navigator.serviceWorker.ready);

    // 2) Corta a rede e recarrega: deve vir do cache do service worker.
    await context.setOffline(true);
    await page.reload();

    // 3) O título e o conteúdo do app shell ainda aparecem.
    await expect(page).toHaveTitle(/Horautil360/i);
    await expect(page.locator("#root")).not.toBeEmpty();

    await context.setOffline(false);
  });
});
