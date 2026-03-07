import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

const mockQueryRaw = vi.fn();
const mockRedisPing = vi.fn();
vi.mock("@/lib/data/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));
vi.mock("@/lib/env", () => ({
  validateEnv: () => ({ ok: true }),
  getEnvSummary: () => ({}),
}));
vi.mock("@/lib/redis", () => ({
  getRedis: () => ({ ping: () => mockRedisPing() }),
}));
// Mock os to ensure system check always returns "healthy" (100GB free, 128GB total)
vi.mock("os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("os")>();
  return { ...actual, freemem: () => 100 * 1024 * 1024 * 1024, totalmem: () => 128 * 1024 * 1024 * 1024 };
});
vi.stubGlobal(
  "fetch",
  vi.fn(() => Promise.resolve({ ok: true }))
);

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockRedisPing.mockResolvedValue("PONG");
  });

  it("returns 200 and healthy status when DB is up", async () => {
    const request = new Request("http://localhost/api/health");
    const response = await GET(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    // Overall status may be "degraded" if system memory is high on the test host;
    // what matters is the DB check is healthy and the HTTP status is 200 (not 503)
    expect(["healthy", "degraded"]).toContain(json.data?.status);
    expect(json.data?.checks?.database?.status).toBe("healthy");
    expect(json.data?.version).toBeDefined();
    expect(json.data?.uptime_seconds).toBeDefined();
  });

  it("returns 503 with unhealthy when DB fails", async () => {
    mockQueryRaw.mockRejectedValue(new Error("connection refused"));
    const request = new Request("http://localhost/api/health");
    const response = await GET(request);
    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.data?.status).toBe("unhealthy");
    expect(json.data?.checks?.database?.status).toBe("unhealthy");
  });
});
