import { describe, it, expect, afterEach } from "vitest";
import { checkRateLimit, limitFromEnv } from "./rate-limit";

describe("checkRateLimit", () => {
  it("mengizinkan sampai batas limit, lalu menolak", () => {
    const key = `test-${Math.random()}`;
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
    expect(checkRateLimit(key, 3, 60_000)).toBe(false); // percobaan ke-4, sudah lewat limit
  });

  it("key berbeda punya jatah independen (tidak saling mengunci)", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    expect(checkRateLimit(keyA, 1, 60_000)).toBe(true);
    expect(checkRateLimit(keyA, 1, 60_000)).toBe(false);
    expect(checkRateLimit(keyB, 1, 60_000)).toBe(true); // keyB belum pernah dipakai, tidak ikut kena limit keyA
  });

  it("window yang sudah lewat mereset jatah", async () => {
    const key = `test-window-${Math.random()}`;
    expect(checkRateLimit(key, 1, 10)).toBe(true); // window 10ms
    expect(checkRateLimit(key, 1, 10)).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(checkRateLimit(key, 1, 10)).toBe(true); // window sudah reset
  });
});

describe("limitFromEnv", () => {
  const ENV_NAME = "RATE_LIMIT_TEST_ONLY";
  afterEach(() => {
    delete process.env[ENV_NAME];
  });

  it("jatuh balik ke default kalau env var tidak ada", () => {
    expect(limitFromEnv(ENV_NAME, 5)).toBe(5);
  });

  it("memakai nilai env var kalau ada dan valid", () => {
    process.env[ENV_NAME] = "30";
    expect(limitFromEnv(ENV_NAME, 5)).toBe(30);
  });

  it("jatuh balik ke default kalau env var bukan angka atau <= 0", () => {
    process.env[ENV_NAME] = "bukan-angka";
    expect(limitFromEnv(ENV_NAME, 5)).toBe(5);
    process.env[ENV_NAME] = "0";
    expect(limitFromEnv(ENV_NAME, 5)).toBe(5);
    process.env[ENV_NAME] = "-3";
    expect(limitFromEnv(ENV_NAME, 5)).toBe(5);
  });
});
