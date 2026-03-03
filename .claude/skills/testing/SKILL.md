---
name: testing
description: "Testing patterns for the blog. Use when writing tests, running test suites, or debugging test failures."
---

## Testing

### Commands

```bash
npm run test          # Vitest unit tests (once)
npm run test:watch    # Watch mode
npm run test:e2e      # Playwright E2E (against live blog.arcnode.xyz)

# Single file
npm test -- tests/unit/pds.test.ts
```

### Test Structure

```
tests/
├── unit/                # Vitest (jsdom/node) — 99 tests
│   ├── auth.test.ts     # ATAuth login, ticket verify, isOwner
│   ├── drafts.test.ts   # SQLite CRUD, rkey generation, upsert, blobs
│   ├── pds.test.ts      # PDS fetching, caching, blobs, pagination, draft integration
│   ├── utils.test.ts    # formatDate, excerpt, escapeXml
│   └── rss.test.ts      # RSS XML escaping
└── e2e/                 # Playwright (chromium)
    └── blog.spec.ts     # Homepage, posts, RSS, write auth, 404, mobile
```

### Unit Tests (Vitest)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("MyModule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should work", () => {
    expect(result).toBe(expected);
  });
});
```

### E2E Tests (Playwright)

Tests run against production `https://blog.arcnode.xyz`.

```typescript
import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
});
```

### Mocking fetch (PDS calls)

```typescript
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ records: [] }),
});
```

### Mocking SQLite drafts (in pds.test.ts)

```typescript
vi.mock("../../src/lib/drafts", () => ({
  listDrafts: vi.fn(() => []),
  getDraft: vi.fn(() => null),
}));
```

### SQLite in-memory tests (drafts.test.ts)

```typescript
// Set BEFORE imports (ES module hoisting)
process.env.DRAFTS_DB_PATH = ":memory:";

import { saveDraft, getDraft, closeDb } from "../../src/lib/drafts";

beforeEach(() => closeDb());  // Fresh DB each test
afterEach(() => closeDb());
```

### CI/CD

Tests run on push to `main` (paths-ignore: `*.md`).
Pipeline: `npm ci` -> `npm test` -> `npm run build` -> deploy.
