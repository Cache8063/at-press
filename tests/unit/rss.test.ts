import { describe, it, expect } from "vitest";
import { escapeXml } from "../../src/lib/utils";

describe("RSS feed utilities", () => {
  describe("escapeXml", () => {
    it("escapes ampersands", () => {
      expect(escapeXml("foo & bar")).toBe("foo &amp; bar");
    });

    it("escapes angle brackets", () => {
      expect(escapeXml("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&apos;xss&apos;)&lt;/script&gt;"
      );
    });

    it("escapes quotes", () => {
      expect(escapeXml('He said "hello"')).toBe("He said &quot;hello&quot;");
    });

    it("escapes single quotes", () => {
      expect(escapeXml("it's")).toBe("it&apos;s");
    });

    it("handles empty string", () => {
      expect(escapeXml("")).toBe("");
    });

    it("handles string with no special characters", () => {
      expect(escapeXml("plain text")).toBe("plain text");
    });

    it("escapes multiple special chars in sequence", () => {
      expect(escapeXml("a&b<c>d\"e'f")).toBe(
        "a&amp;b&lt;c&gt;d&quot;e&apos;f"
      );
    });
  });
});
