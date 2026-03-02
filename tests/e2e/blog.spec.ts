import { test, expect } from "@playwright/test";

test.describe("Blog public pages", () => {
  test("homepage loads and shows blog title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/bkb/);
    await expect(page.locator("header a").first()).toBeVisible();
  });

  test("homepage shows blog entries or empty state", async ({ page }) => {
    await page.goto("/");
    const entries = page.locator("article");
    const emptyState = page.locator("text=No entries yet");
    // Either entries exist or empty state shows
    const hasEntries = (await entries.count()) > 0;
    const isEmpty = await emptyState.isVisible().catch(() => false);
    expect(hasEntries || isEmpty).toBe(true);
  });

  test("homepage has profile section with avatar", async ({ page }) => {
    await page.goto("/");
    const avatar = page.locator("img[alt]").first();
    await expect(avatar).toBeVisible();
  });

  test("navigation links are present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('nav a[href="/write"]')).toBeVisible();
    await expect(page.locator('nav a[href="/rss.xml"]')).toBeVisible();
    await expect(page.locator('nav a[href*="bsky.app"]')).toBeVisible();
  });

  test("clicking a post navigates to post page", async ({ page }) => {
    await page.goto("/");
    const firstPost = page.locator("article a").first();
    if (await firstPost.isVisible()) {
      const href = await firstPost.getAttribute("href");
      await firstPost.click();
      await page.waitForURL(`**${href}`);
      await expect(page.locator("article h1")).toBeVisible();
    }
  });

  test("post page shows title, date, content, and footer", async ({ page }) => {
    await page.goto("/");
    const firstPost = page.locator("article a").first();
    if (await firstPost.isVisible()) {
      await firstPost.click();
      await expect(page.locator("article header time")).toBeVisible();
      await expect(page.locator("article h1")).toBeVisible();
      await expect(page.locator(".prose")).toBeVisible();
      await expect(page.locator("article footer")).toBeVisible();
      await expect(page.locator('text=view record')).toBeVisible();
      await expect(page.locator('text=all posts')).toBeVisible();
    }
  });

  test("post page 'all posts' link navigates home", async ({ page }) => {
    await page.goto("/");
    const firstPost = page.locator("article a").first();
    if (await firstPost.isVisible()) {
      await firstPost.click();
      await page.locator('a:text("all posts")').click();
      await page.waitForURL("/");
    }
  });
});

test.describe("RSS feed", () => {
  test("returns valid XML with correct content-type", async ({ request }) => {
    const res = await request.get("/rss.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/rss+xml");

    const body = await res.text();
    expect(body).toContain('<?xml version="1.0"');
    expect(body).toContain("<rss");
    expect(body).toContain("<channel>");
    expect(body).toContain("<title>");
  });

  test("RSS feed contains entry items", async ({ request }) => {
    const res = await request.get("/rss.xml");
    const body = await res.text();
    // Should have at least one item if blog has posts
    if (body.includes("<item>")) {
      expect(body).toContain("<link>");
      expect(body).toContain("<guid");
      expect(body).toContain("<pubDate>");
    }
  });
});

test.describe("Write page (unauthenticated)", () => {
  test("shows sign-in prompt when not authenticated", async ({ page }) => {
    await page.goto("/write");
    await expect(page.locator("text=Sign in to write")).toBeVisible();
    await expect(page.locator('a:text("Sign in with AT Protocol")')).toBeVisible();
  });

  test("sign-in link points to atauth", async ({ page }) => {
    await page.goto("/write");
    const signIn = page.locator('a:text("Sign in with AT Protocol")');
    const href = await signIn.getAttribute("href");
    expect(href).toContain("/auth/proxy/login");
    expect(href).toContain("rd=");
  });

  test("does not show editor when unauthenticated", async ({ page }) => {
    await page.goto("/write");
    await expect(page.locator("#editor-form")).not.toBeVisible();
  });
});

test.describe("API endpoints (unauthenticated)", () => {
  test("POST /api/publish returns 403 without session", async ({ request }) => {
    const res = await request.post("/api/publish", {
      data: { title: "Test", content: "Test content" },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Not authorized");
  });

  test("POST /api/delete returns 403 without session", async ({ request }) => {
    const res = await request.post("/api/delete", {
      data: { rkey: "test123" },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Not authorized");
  });

  test("GET /api/logout redirects to home", async ({ request }) => {
    const res = await request.get("/api/logout", {
      maxRedirects: 0,
    });
    // 303 redirect to /
    expect([303, 302]).toContain(res.status());
    expect(res.headers()["location"]).toBe("/");
  });
});

test.describe("404 handling", () => {
  test("returns 404 for nonexistent post", async ({ request }) => {
    const res = await request.get("/nonexistent-rkey-99999");
    expect(res.status()).toBe(404);
  });
});

test.describe("Mobile responsiveness", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("homepage renders properly on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator("header a").first()).toBeVisible();
    // Nav links should still be visible
    await expect(page.locator('nav a[href="/write"]')).toBeVisible();
  });

  test("post page is readable on mobile", async ({ page }) => {
    await page.goto("/");
    const firstPost = page.locator("article a").first();
    if (await firstPost.isVisible()) {
      await firstPost.click();
      await expect(page.locator("article h1")).toBeVisible();
      await expect(page.locator(".prose")).toBeVisible();
      // Content should not overflow horizontally
      const prose = page.locator(".prose");
      const box = await prose.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(375);
      }
    }
  });
});

test.describe("Footer", () => {
  test("footer shows AT Protocol and arcnode links", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('footer a[href="https://atproto.com"]')).toBeVisible();
    await expect(page.locator('footer a[href="https://arcnode.xyz"]')).toBeVisible();
  });
});
