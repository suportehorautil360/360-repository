/**
 * Upload das fotos do checklist para o backend (Supabase Storage).
 * Online, as fotos saem do doc do Firestore (base64) e viram URLs.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { dataUrlParaBlob, uploadChecklistFotos } from "./uploads-api";

// 1x1 px JPEG não é necessário — qualquer payload base64 serve para o teste.
const DATA_URL = `data:image/jpeg;base64,${btoa("foto-fake")}`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dataUrlParaBlob", () => {
  it("converte data URL em Blob com o mime e o conteúdo originais", async () => {
    const blob = dataUrlParaBlob(DATA_URL);
    expect(blob.type).toBe("image/jpeg");
    expect(await blob.text()).toBe("foto-fake");
  });

  it("rejeita string que não é data URL", () => {
    expect(() => dataUrlParaBlob("https://exemplo.com/foto.jpg")).toThrow();
  });
});

describe("uploadChecklistFotos", () => {
  it("envia multipart com checklistId e fotos e devolve as URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: ["https://cdn/x/horimetro.jpg"], message: "ok" }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const urls = await uploadChecklistFotos("chk-1", [
      { nome: "horimetro", dataUrl: DATA_URL },
    ]);

    expect(urls).toEqual(["https://cdn/x/horimetro.jpg"]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/uploads/checklist-fotos");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const form = init.body as FormData;
    expect(form.get("checklistId")).toBe("chk-1");
    const arquivo = form.getAll("fotos")[0] as File;
    expect(arquivo.name).toBe("horimetro.jpg");
  });

  it("lança erro quando o backend responde com falha", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "sem config" }), {
          status: 503,
        }),
      ),
    );
    await expect(
      uploadChecklistFotos("chk-1", [{ nome: "horimetro", dataUrl: DATA_URL }]),
    ).rejects.toThrow();
  });
});
