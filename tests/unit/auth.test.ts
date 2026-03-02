import { describe, it, expect, vi, beforeEach } from "vitest";
import { isOwner, getLoginUrl, verifyProxyTicket } from "../../src/lib/auth";
import { DID } from "../../src/lib/constants";

describe("auth", () => {
  describe("isOwner", () => {
    it("returns true for the allowed DID", () => {
      expect(isOwner(DID)).toBe(true);
    });

    it("returns false for a different DID", () => {
      expect(isOwner("did:plc:someone-else")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isOwner("")).toBe(false);
    });
  });

  describe("getLoginUrl", () => {
    it("returns a URL pointing to atauth proxy login", () => {
      const url = getLoginUrl();
      expect(url).toContain("/auth/proxy/login");
      expect(url).toContain("rd=");
    });

    it("includes encoded redirect to /write", () => {
      const url = getLoginUrl();
      expect(url).toContain(encodeURIComponent("https://blog.arcnode.xyz/write"));
    });
  });

  describe("verifyProxyTicket", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("returns user when gateway returns 200 with DID headers", async () => {
      const headers = new Headers();
      headers.set("x-auth-did", "did:plc:test123");
      headers.set("x-auth-handle", "test.handle");

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, { status: 200, headers })
      );

      const result = await verifyProxyTicket("valid-ticket");
      expect(result).toEqual({ did: "did:plc:test123", handle: "test.handle" });
    });

    it("returns null when gateway returns non-200", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, { status: 401 })
      );

      const result = await verifyProxyTicket("bad-ticket");
      expect(result).toBeNull();
    });

    it("returns null when DID header is missing", async () => {
      const headers = new Headers();
      headers.set("x-auth-handle", "test.handle");

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, { status: 200, headers })
      );

      const result = await verifyProxyTicket("no-did-ticket");
      expect(result).toBeNull();
    });

    it("returns null when handle header is missing", async () => {
      const headers = new Headers();
      headers.set("x-auth-did", "did:plc:test123");

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, { status: 200, headers })
      );

      const result = await verifyProxyTicket("no-handle-ticket");
      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

      const result = await verifyProxyTicket("error-ticket");
      expect(result).toBeNull();
    });

    it("returns null when handle contains invalid characters", async () => {
      const headers = new Headers();
      headers.set("x-auth-did", "did:plc:test123");
      headers.set("x-auth-handle", '<script>alert("xss")</script>');

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, { status: 200, headers })
      );

      const result = await verifyProxyTicket("bad-handle-ticket");
      expect(result).toBeNull();
    });

    it("accepts valid handle format", async () => {
      const headers = new Headers();
      headers.set("x-auth-did", "did:plc:test123");
      headers.set("x-auth-handle", "user.bsky.social");

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, { status: 200, headers })
      );

      const result = await verifyProxyTicket("valid-handle-ticket");
      expect(result).toEqual({ did: "did:plc:test123", handle: "user.bsky.social" });
    });

    it("sends correct headers to gateway", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(null, { status: 401 })
      );

      await verifyProxyTicket("test-ticket");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, opts] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain("/auth/verify");
      expect(opts?.headers).toHaveProperty("X-Original-URL");
      expect(opts?.headers).toHaveProperty("X-Forwarded-Proto", "https");
      expect(opts?.headers).toHaveProperty("X-Forwarded-Host", "blog.arcnode.xyz");
    });
  });
});
