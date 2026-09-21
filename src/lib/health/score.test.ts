import { describe, it, expect } from "vitest";
import {
  computePulse,
  computeMomentum,
  computeBalance,
  computeForecast,
  composeHealth,
  computeAlerts,
} from "./score";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-29T00:00:00Z");
const daysAgoDate = (n: number) => new Date(NOW.getTime() - n * DAY_MS);

describe("computePulse", () => {
  it("0 kalau tidak ada aktivitas", () => {
    expect(computePulse([], NOW)).toBe(0);
  });

  it("mengabaikan aktivitas di luar jendela 7 hari", () => {
    const activities = [
      { weight: 5, createdAt: daysAgoDate(10), actorId: "a" },
    ];
    expect(computePulse(activities, NOW)).toBe(0);
  });

  it("aktivitas baru berkontribusi lebih besar daripada aktivitas lama (peluruhan)", () => {
    const recent = computePulse(
      [{ weight: 5, createdAt: daysAgoDate(0), actorId: "a" }],
      NOW,
    );
    const older = computePulse(
      [{ weight: 5, createdAt: daysAgoDate(6), actorId: "a" }],
      NOW,
    );
    expect(recent).toBeGreaterThan(older);
  });

  it("dibatasi maksimum 100 walau aktivitas jauh melebihi A_target", () => {
    const activities = Array.from({ length: 20 }, () => ({
      weight: 5,
      createdAt: daysAgoDate(0),
      actorId: "a",
    }));
    expect(computePulse(activities, NOW)).toBe(100);
  });
});

describe("computeMomentum", () => {
  it("50 (datar) kalau tidak ada aktivitas sama sekali", () => {
    expect(computeMomentum([], NOW)).toBe(50);
  });

  it("> 50 kalau minggu ini lebih aktif dari minggu lalu", () => {
    const activities = [
      { weight: 10, createdAt: daysAgoDate(1), actorId: "a" }, // minggu ini
      { weight: 2, createdAt: daysAgoDate(10), actorId: "a" }, // minggu lalu
    ];
    expect(computeMomentum(activities, NOW)).toBeGreaterThan(50);
  });

  it("< 50 kalau minggu ini melambat dibanding minggu lalu", () => {
    const activities = [
      { weight: 2, createdAt: daysAgoDate(1), actorId: "a" },
      { weight: 10, createdAt: daysAgoDate(10), actorId: "a" },
    ];
    expect(computeMomentum(activities, NOW)).toBeLessThan(50);
  });
});

describe("computeBalance", () => {
  it("100 kalau tidak ada anggota atau belum ada kontribusi", () => {
    expect(computeBalance([])).toBe(100);
    expect(computeBalance([0, 0, 0])).toBe(100);
  });

  it("100 kalau kontribusi rata sempurna", () => {
    expect(computeBalance([5, 5, 5])).toBe(100);
  });

  it("turun tajam kalau satu anggota mendominasi seluruh kontribusi", () => {
    const balance = computeBalance([20, 0, 0]);
    expect(balance).toBeLessThan(60);
  });
});

describe("computeForecast", () => {
  it("0 kalau tenggat lewat dan masih ada sisa pekerjaan", () => {
    expect(computeForecast(5, 0, [1, 2])).toBe(0);
    expect(computeForecast(5, -3, [1, 2])).toBe(0);
  });

  it("100 kalau tenggat lewat tapi tidak ada sisa pekerjaan", () => {
    expect(computeForecast(0, -3, [1, 2])).toBe(100);
  });

  it("0 kalau belum pernah ada penyelesaian sama sekali", () => {
    expect(computeForecast(10, 5, [])).toBe(0);
  });

  it("100 kalau kecepatan aktual sama atau lebih cepat dari kebutuhan (rho>=1)", () => {
    // vReq = 10/5 = 2/hari, dailyCompletedWeights EMA seed dari elemen pertama = 5 (>= vReq)
    expect(computeForecast(10, 5, [5, 5, 5])).toBe(100);
  });

  it("di bawah 100 kalau kecepatan aktual lebih lambat dari kebutuhan", () => {
    // vReq = 10/2 = 5/hari, kecepatan aktual jauh di bawah itu
    const forecast = computeForecast(10, 2, [1, 1, 1]);
    expect(forecast).toBeGreaterThan(0);
    expect(forecast).toBeLessThan(100);
  });
});

describe("composeHealth", () => {
  it("mengklasifikasikan status sesuai ambang batas", () => {
    expect(composeHealth(100, 100, 100, 100).status).toBe("SEHAT");
    expect(composeHealth(70, 70, 70, 70).status).toBe("PERLU_PERHATIAN");
    expect(composeHealth(50, 50, 50, 50).status).toBe("BERISIKO");
    expect(composeHealth(10, 10, 10, 10).status).toBe("KRITIS");
  });
});

describe("computeAlerts", () => {
  it("tidak ada alert kalau semua indikator sehat", () => {
    expect(computeAlerts({ balance: 90, forecast: 90 })).toHaveLength(0);
  });

  it("alert LOW_BALANCE HANYA ditujukan ke OWNER_ONLY, tidak pernah WHOLE_TEAM", () => {
    const alerts = computeAlerts({ balance: 40 });
    const balanceAlert = alerts.find((a) => a.trigger === "LOW_BALANCE");
    expect(balanceAlert?.to).toBe("OWNER_ONLY");
  });

  it("memicu MILESTONE_LATE saat terlambat >= 2 hari, tidak saat 1 hari", () => {
    expect(computeAlerts({ milestoneDaysLate: 1 })).toHaveLength(0);
    const alerts = computeAlerts({ milestoneDaysLate: 3 });
    expect(alerts.find((a) => a.trigger === "MILESTONE_LATE")).toBeDefined();
  });

  it("memicu DORMANT setelah 21 hari tanpa aktivitas", () => {
    const alerts = computeAlerts({ daysSinceLastActivity: 21 });
    expect(alerts.find((a) => a.trigger === "DORMANT")).toBeDefined();
  });
});
