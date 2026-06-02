import { afterEach, describe, expect, it, vi } from "vitest";
import { obterLocalizacao } from "./geolocalizacao";

const navAny = navigator as unknown as { geolocation?: unknown };
const original = navAny.geolocation;

function setGeolocation(value: unknown) {
  Object.defineProperty(navigator, "geolocation", {
    value,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  setGeolocation(original);
  vi.restoreAllMocks();
});

describe("obterLocalizacao", () => {
  it("sem suporte: texto vazio + aviso", async () => {
    setGeolocation(undefined);
    const r = await obterLocalizacao();
    expect(r.texto).toBe("");
    expect(r.aviso).toMatch(/não suportada/i);
  });

  it("sucesso: formata lat, lng com 6 casas", async () => {
    setGeolocation({
      getCurrentPosition: (ok: PositionCallback) =>
        ok({
          coords: { latitude: -20.751234, longitude: -51.678999, accuracy: 12 },
        } as GeolocationPosition),
    });
    const r = await obterLocalizacao();
    expect(r.texto).toBe("-20.751234, -51.678999");
    expect(r.aviso).toBe("");
  });

  it("precisão baixa: ainda devolve o texto, com aviso", async () => {
    setGeolocation({
      getCurrentPosition: (ok: PositionCallback) =>
        ok({
          coords: { latitude: 1, longitude: 2, accuracy: 300 },
        } as GeolocationPosition),
    });
    const r = await obterLocalizacao();
    expect(r.texto).toBe("1.000000, 2.000000");
    expect(r.aviso).toMatch(/precis/i);
  });

  it("permissão negada: texto vazio + aviso", async () => {
    setGeolocation({
      getCurrentPosition: (_ok: PositionCallback, err: PositionErrorCallback) =>
        err({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError),
    });
    const r = await obterLocalizacao();
    expect(r.texto).toBe("");
    expect(r.aviso).toMatch(/negada/i);
  });
});
