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
    it("returns null when ATAUTH_PUBLIC_URL is not set", () => {
      const url = getLoginUrl();
      expect(url).toBeNull();
    });
  });

  describe("verifyProxyTicket", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("returns null when GATEWAY_URL is not configured", async () => {
      const result = await verifyProxyTicket("any-ticket");
      expect(result).toBeNull();
    });
  });
});
