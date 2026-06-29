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

  test("renderiza cards com métricas da spec V2 vindas da API", async ({
    page,
  }) => {
    await page.goto(rotaConsumoCusto());

    await expect(
      page.getByRole("heading", { name: "Consumo & Custo por Veículo" }),
    ).toBeVisible();

    await expect(page.getByText("Frota Teste E2E")).toBeVisible();
    await expect(page.getByText("Escavadeira E2E")).toBeVisible();

    const cardFrota = page.locator(".ccu-card", {
      has: page.getByText("Frota Teste E2E"),
    });
    const metricasFrota = cardFrota.locator(".ccu-card-metrics");
    await expect(metricasFrota.getByText("0,15", { exact: true })).toBeVisible();
    await expect(metricasFrota.getByText("MÉDIO L/KM")).toBeVisible();
    await expect(metricasFrota.getByText("0,90", { exact: true })).toBeVisible();
    await expect(metricasFrota.getByText("CUSTO /KM")).toBeVisible();
    await expect(metricasFrota.getByText("269,55")).toBeVisible();

    const cardCampo = page.locator(".ccu-card", {
      has: page.getByText("Escavadeira E2E"),
    });
    const metricasCampo = cardCampo.locator(".ccu-card-metrics");
    await expect(metricasCampo.getByText("43,75", { exact: true })).toBeVisible();
    await expect(metricasCampo.getByText("MÉDIO L/H")).toBeVisible();
    await expect(metricasCampo.getByText("350,000 L")).toBeVisible();
    await expect(
      metricasCampo.locator(".ccu-metric-valor--muted").first(),
    ).toBeVisible();
  });

  test("expandir card exibe intervalo de consumo do backend", async ({
    page,
  }) => {
    await page.goto(rotaConsumoCusto());

    const cardFrota = page.locator(".ccu-card", {
      has: page.getByText("Frota Teste E2E"),
    });

    await cardFrota
      .getByRole("button", { name: /Expandir detalhes de Frota Teste E2E/i })
      .click();

    await expect(cardFrota.getByText("0,15 L/km")).toBeVisible();
    await expect(cardFrota.getByText("R$ 0,90/km")).toBeVisible();
    await expect(cardFrota.getByText("300 km")).toBeVisible();
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
