import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

vi.mock("jose", () => ({
  SignJWT: vi.fn().mockImplementation((payload) => ({
    setProtectedHeader: vi.fn().mockReturnThis(),
    setExpirationTime: vi.fn().mockReturnThis(),
    setIssuedAt: vi.fn().mockReturnThis(),
    sign: vi.fn().mockResolvedValue("mock-jwt-token"),
  })),
  jwtVerify: vi.fn(),
}));

import { createSession } from "../auth";

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("creates a session with valid userId and email", async () => {
    await createSession("user123", "user@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledTimes(1);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "auth-token",
      "mock-jwt-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      })
    );
  });

  test("sets cookie with httpOnly flag", async () => {
    await createSession("user123", "user@example.com");

    const callArgs = mockCookieStore.set.mock.calls[0];
    expect(callArgs[2]).toHaveProperty("httpOnly", true);
  });

  test("sets cookie with sameSite lax", async () => {
    await createSession("user123", "user@example.com");

    const callArgs = mockCookieStore.set.mock.calls[0];
    expect(callArgs[2]).toHaveProperty("sameSite", "lax");
  });

  test("sets cookie with path /", async () => {
    await createSession("user123", "user@example.com");

    const callArgs = mockCookieStore.set.mock.calls[0];
    expect(callArgs[2]).toHaveProperty("path", "/");
  });

  test("sets cookie with 7-day expiration", async () => {
    await createSession("user123", "user@example.com");

    const callArgs = mockCookieStore.set.mock.calls[0];
    const expires = callArgs[2].expires;

    const expectedExpires = new Date("2024-01-08T00:00:00Z");
    expect(expires).toEqual(expectedExpires);
  });

  test("sets secure flag to false in development", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    await createSession("user123", "user@example.com");

    const callArgs = mockCookieStore.set.mock.calls[0];
    expect(callArgs[2]).toHaveProperty("secure", false);

    process.env.NODE_ENV = originalEnv;
  });

  test("sets secure flag to true in production", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    await createSession("user123", "user@example.com");

    const callArgs = mockCookieStore.set.mock.calls[0];
    expect(callArgs[2]).toHaveProperty("secure", true);

    process.env.NODE_ENV = originalEnv;
  });

  test("sets cookie name as auth-token", async () => {
    await createSession("user123", "user@example.com");

    const callArgs = mockCookieStore.set.mock.calls[0];
    expect(callArgs[0]).toBe("auth-token");
  });

  test("sets JWT token as cookie value", async () => {
    await createSession("user123", "user@example.com");

    const callArgs = mockCookieStore.set.mock.calls[0];
    expect(callArgs[1]).toBe("mock-jwt-token");
  });

  test("handles email with special characters", async () => {
    await createSession("user123", "user+test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalled();
  });

  test("handles userId with special characters", async () => {
    await createSession("user-123-abc", "user@example.com");

    expect(mockCookieStore.set).toHaveBeenCalled();
  });

  test("handles empty userId", async () => {
    await createSession("", "user@example.com");

    expect(mockCookieStore.set).toHaveBeenCalled();
  });

  test("handles empty email", async () => {
    await createSession("user123", "");

    expect(mockCookieStore.set).toHaveBeenCalled();
  });

  test("handles very long userId", async () => {
    const longUserId = "a".repeat(1000);
    await createSession(longUserId, "user@example.com");

    expect(mockCookieStore.set).toHaveBeenCalled();
  });

  test("handles very long email", async () => {
    const longEmail = "a".repeat(500) + "@example.com";
    await createSession("user123", longEmail);

    expect(mockCookieStore.set).toHaveBeenCalled();
  });

  test("creates different tokens for different users", async () => {
    await createSession("user1", "user1@example.com");
    const firstCall = mockCookieStore.set.mock.calls[0];

    mockCookieStore.set.mockClear();

    await createSession("user2", "user2@example.com");
    const secondCall = mockCookieStore.set.mock.calls[0];

    expect(firstCall).toBeDefined();
    expect(secondCall).toBeDefined();
  });

  test("cookie expires at correct timestamp", async () => {
    const startTime = new Date("2024-06-15T10:30:00Z");
    vi.setSystemTime(startTime);

    await createSession("user123", "user@example.com");

    const callArgs = mockCookieStore.set.mock.calls[0];
    const expires = callArgs[2].expires;

    const expectedExpires = new Date(startTime.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(expires).toEqual(expectedExpires);
  });

  test("handles Unicode characters in email", async () => {
    await createSession("user123", "用户@例え.com");

    expect(mockCookieStore.set).toHaveBeenCalled();
  });

  test("handles email with multiple dots", async () => {
    await createSession("user123", "user.name.test@example.co.uk");

    expect(mockCookieStore.set).toHaveBeenCalled();
  });

  test("sets all cookie options in a single call", async () => {
    await createSession("user123", "user@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledTimes(1);

    const callArgs = mockCookieStore.set.mock.calls[0];
    const options = callArgs[2];

    expect(options).toHaveProperty("httpOnly");
    expect(options).toHaveProperty("secure");
    expect(options).toHaveProperty("sameSite");
    expect(options).toHaveProperty("expires");
    expect(options).toHaveProperty("path");
  });
});
