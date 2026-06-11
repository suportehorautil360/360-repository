/**
 * Stub de "virtual:pwa-register/react" para os testes (o vitest.config roda
 * sem o plugin PWA, então o módulo virtual não existe). Os testes que
 * precisam controlar needRefresh fazem vi.mock por cima deste stub.
 */
type Par = [boolean, (v: boolean) => void];

export function useRegisterSW(_opts?: unknown): {
  offlineReady: Par;
  needRefresh: Par;
  updateServiceWorker: (reload?: boolean) => Promise<void>;
} {
  return {
    offlineReady: [false, () => {}],
    needRefresh: [false, () => {}],
    updateServiceWorker: async () => {},
  };
}
