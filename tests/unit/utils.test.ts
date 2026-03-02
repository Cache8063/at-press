import { describe, it, expect } from "vitest";
import { formatDate, excerpt, escapeXml } from "../../src/lib/utils";

describe("utils", () => {
  describe("formatDate", () => {
    it("formats ISO date to readable string", () => {
      const result = formatDate("2025-06-15T12:00:00Z");
      expect(result).toContain("June");
      expect(result).toContain("15");
      expect(result).toContain("2025");
    });

    it("includes weekday when option set", () => {
      const result = formatDate("2025-06-15T12:00:00Z", { weekday: true });
      expect(result).toContain("Sunday");
    });

    it("omits weekday by default", () => {
      const result = formatDate("2025-06-15T12:00:00Z");
      expect(result).not.toContain("Sunday");
    });
  });

  describe("excerpt", () => {
    it("returns short content as-is", () => {
      expect(excerpt("Hello world")).toBe("Hello world");
    });

    it("truncates long content with ellipsis", () => {
      const long = "word ".repeat(50);
      const result = excerpt(long, 40);
      expect(result.length).toBeLessThanOrEqual(41); // 40 + ellipsis char
      expect(result).toMatch(/\u2026$/);
    });

    it("strips markdown headings", () => {
      expect(excerpt("# Title\nBody text")).toBe("Title Body text");
    });

    it("strips bold markdown", () => {
      expect(excerpt("Some **bold** text")).toBe("Some bold text");
    });

    it("strips italic markdown", () => {
      expect(excerpt("Some *italic* text")).toBe("Some italic text");
    });

    it("strips inline code", () => {
      expect(excerpt("Use `const x = 1` here")).toBe("Use const x = 1 here");
    });

    it("strips fenced code blocks", () => {
      expect(excerpt("Before\n~~~\ncode\n~~~\nAfter")).toBe("Before After");
    });

    it("collapses newlines to spaces", () => {
      expect(excerpt("Line 1\n\nLine 2\nLine 3")).toBe("Line 1 Line 2 Line 3");
    });

    it("uses default maxLen of 160", () => {
      const long = "a ".repeat(200);
      const result = excerpt(long);
      expect(result.length).toBeLessThanOrEqual(161);
    });

    it("handles empty string", () => {
      expect(excerpt("")).toBe("");
    });
  });

  describe("escapeXml", () => {
    it("escapes ampersands", () => {
      expect(escapeXml("foo & bar")).toBe("foo &amp; bar");
    });

    it("escapes angle brackets", () => {
      expect(escapeXml("<script>")).toBe("&lt;script&gt;");
    });

    it("escapes double quotes", () => {
      expect(escapeXml('He said "hi"')).toBe("He said &quot;hi&quot;");
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
  });
});
