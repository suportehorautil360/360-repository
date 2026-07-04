import { expect, test } from "@playwright/test";

import { consumoCustoApiMock } from "./fixtures/consumo-custo-api";
import {
  prefeituraE2EId,
  rotaConsumoCusto,
  seedPrefeituraSession,
} from "./helpers/prefeitura-session";

test.describe("Consumo / Custo (prefeitura)", () => {
  test.beforeEach(async ({ page }) => {
    await seedPrefeituraSession(page);

    await page.route("**/feature-flags/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { abastecimento: true, ponto: false },
        }),
      });
    });

    await page.route("**/movimentacoes/consumo-custo/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(consumoCustoApiMock),
      });
    });
  });

  test("renderiza tabela com métricas da spec V2 vindas da API", async ({
    page,
  }) => {
    await page.goto(rotaConsumoCusto());

    await expect(
      page.getByRole("heading", { name: "Consumo & Custo por Veículo" }),
    ).toBeVisible();

    await expect(page.getByText("Frota Teste E2E")).toBeVisible();
    await expect(page.getByText("Escavadeira E2E")).toBeVisible();

    const tabela = page.locator(".ccu-table").first();
    await expect(tabela.getByText("0,15 L/km")).toBeVisible();
    await expect(tabela.getByText("R$ 0,90/km")).toBeVisible();
    await expect(tabela.getByText("350,000 L")).toBeVisible();
  });

  test("expandir linha exibe intervalo de consumo do backend", async ({
    page,
  }) => {
    await page.goto(rotaConsumoCusto());

    const linhaFrota = page.locator(".ccu-row--clicavel", {
      has: page.getByText("Frota Teste E2E"),
    });

    await linhaFrota.click();

    await expect(page.getByText("Histórico de intervalos")).toBeVisible();
    await expect(page.getByText("0,15 L/km")).toBeVisible();
    await expect(page.getByText("R$ 0,90/km")).toBeVisible();
    await expect(page.getByText("300 km")).toBeVisible();
  });

  test("botão Atualizar dispara nova chamada à API", async ({ page }) => {
    let chamadas = 0;
    await page.route("**/movimentacoes/consumo-custo/**", async (route) => {
      chamadas += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(consumoCustoApiMock),
      });
    });

    await page.goto(rotaConsumoCusto());
    await expect(page.getByText("Frota Teste E2E")).toBeVisible({
      timeout: 15_000,
    });

    const antes = chamadas;
    await page.getByRole("button", { name: "Atualizar" }).click();
    await expect.poll(() => chamadas).toBeGreaterThan(antes);
  });

  test("menu Abastecimento leva à rota consumo-custo", async ({ page }) => {
    await page.goto(`/prefeitura/${prefeituraE2EId}/dashboard`);

    await page.getByRole("button", { name: "Abastecimento" }).click();
    await page.getByRole("link", { name: "Consumo / Custo" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/prefeitura/${prefeituraE2EId}/consumo-custo`),
    );
    await expect(
      page.getByRole("heading", { name: "Consumo & Custo por Veículo" }),
    ).toBeVisible();
    await expect(page.getByText("Frota Teste E2E")).toBeVisible({
      timeout: 15_000,
    });
  });
});
