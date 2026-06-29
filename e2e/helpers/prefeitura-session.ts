import type { Page } from "@playwright/test";

const PREFEITURA_ID = "tl-ms";

/** Injeta sessão de usuário prefeitura + flag de abastecimento antes do app montar. */
export async function seedPrefeituraSession(page: Page) {
  await page.addInitScript((prefId) => {
    localStorage.setItem(
      "login-store",
      JSON.stringify({
        state: {
          user: {
            id: "e2e-prefeitura",
            usuario: "e2e.prefeitura",
            type: "prefeitura",
            prefeituraId: prefId,
          },
        },
        version: 0,
      }),
    );
    localStorage.setItem(
      `hu360-flags:${prefId}`,
      JSON.stringify({ abastecimento: true, ponto: false }),
    );
  }, PREFEITURA_ID);
}

export const prefeituraE2EId = PREFEITURA_ID;

export function rotaConsumoCusto(prefeituraId = PREFEITURA_ID) {
  return `/prefeitura/${prefeituraId}/consumo-custo`;
}
