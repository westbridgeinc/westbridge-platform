import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logger.error can be called with a message", () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
    logger.error("fail");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("fail");
  });

  it("logger.warn can be called with a message", () => {
    const spy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    logger.warn("warn msg");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("warn msg");
  });

  it("logger.info can be called with a message", () => {
    const spy = vi.spyOn(logger, "info").mockImplementation(() => {});
    logger.info("info msg");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("info msg");
  });

  it("passes meta context as second argument", () => {
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
    logger.error("e", { requestId: "abc" });
    expect(spy).toHaveBeenCalledWith("e", { requestId: "abc" });
  });
});
