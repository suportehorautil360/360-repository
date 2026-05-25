import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAdminSession,
  isAdminAuthenticated,
  setAdminAuthenticated,
} from "./adminSession";

const ADMIN_SESSION_KEY = "hu360_admin_ok";
const ADMIN_PERSISTED_SESSION_KEY = "hu360_admin_session";

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
});

describe("adminSession", () => {
  it("persiste a sessão admin em chave própria para novas abas", () => {
    vi.setSystemTime(new Date("2026-05-24T12:00:00Z"));

    setAdminAuthenticated();

    expect(sessionStorage.getItem(ADMIN_SESSION_KEY)).toBe("1");
    expect(isAdminAuthenticated()).toBe(true);

    sessionStorage.clear();

    expect(isAdminAuthenticated()).toBe(true);
    expect(localStorage.getItem(ADMIN_PERSISTED_SESSION_KEY)).toContain(
      '"authenticated":true',
    );
  });

  it("remove sessão admin persistida quando expira", () => {
    vi.setSystemTime(new Date("2026-05-24T12:00:00Z"));
    setAdminAuthenticated();
    sessionStorage.clear();

    vi.setSystemTime(new Date("2026-05-25T12:00:01Z"));

    expect(isAdminAuthenticated()).toBe(false);
    expect(localStorage.getItem(ADMIN_PERSISTED_SESSION_KEY)).toBeNull();
  });

  it("limpa sessão volátil e persistida no logout", () => {
    setAdminAuthenticated();
    localStorage.setItem("hu360_session", "{}");
    localStorage.setItem("hu360_hub_ctx_posto", "{}");
    sessionStorage.setItem("hu360_hub_ctx_pref", "tl-ms");

    clearAdminSession();

    expect(sessionStorage.getItem(ADMIN_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem(ADMIN_PERSISTED_SESSION_KEY)).toBeNull();
    expect(localStorage.getItem("hu360_session")).toBeNull();
    expect(localStorage.getItem("hu360_hub_ctx_posto")).toBeNull();
    expect(sessionStorage.getItem("hu360_hub_ctx_pref")).toBeNull();
    expect(isAdminAuthenticated()).toBe(false);
  });
});
