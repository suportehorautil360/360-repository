import { expect, test } from "@playwright/test";

// Regressão: o painel de checklist não pode estourar a largura no mobile.
// (Bug original: .hu360-brand com width:100% + padding sem box-sizing.)
test.use({ viewport: { width: 390, height: 844 } });

test("checklist não tem overflow horizontal no mobile", async ({ page }) => {
  // Injeta uma sessão de operador válida antes do app montar (pula o login).
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "hu360-operador-session",
      JSON.stringify({
        nome: "Teste",
        idMaquina: "M1",
        idCliente: "BR1",
        empresa: "Hora Util",
        chassis: "X",
      }),
    );
  });

  await page.goto("/checklist-controle");
  await page.waitForTimeout(1000);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
