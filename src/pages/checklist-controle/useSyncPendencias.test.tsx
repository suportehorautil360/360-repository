import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

let resolverPending: () => void;
const waitForPendingWrites = vi.fn(
  () => new Promise<void>((res) => (resolverPending = res)),
);
vi.mock("firebase/firestore", () => ({
  waitForPendingWrites: () => waitForPendingWrites(),
}));
vi.mock("../../lib/firebase/firebase", () => ({ db: {} }));

import { useSyncPendencias } from "./useSyncPendencias";
import { marcarPendente, contarPendentes } from "./sync-pendencias";

function setOnline(v: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(v);
}

beforeEach(() => {
  localStorage.clear();
  waitForPendingWrites.mockClear();
  setOnline(true);
});
afterEach(() => vi.restoreAllMocks());

describe("useSyncPendencias", () => {
  it("reflete a contagem inicial e reage a novas pendências", () => {
    marcarPendente("c1", "checklist");
    const { result } = renderHook(() => useSyncPendencias());
    expect(result.current.pendentes).toBe(1);
    act(() => marcarPendente("c2", "checklist"));
    expect(result.current.pendentes).toBe(2);
  });

  it("ao montar com pendências, reconcilia: waitForPendingWrites limpa os ids", async () => {
    marcarPendente("c1", "checklist");
    renderHook(() => useSyncPendencias());
    expect(waitForPendingWrites).toHaveBeenCalled();
    // O SDK confirma o lote → os pendentes do início são removidos.
    act(() => resolverPending());
    await waitFor(() => expect(contarPendentes()).toBe(0));
  });

  it("sem pendências, não chama waitForPendingWrites", () => {
    renderHook(() => useSyncPendencias());
    expect(waitForPendingWrites).not.toHaveBeenCalled();
  });
});
