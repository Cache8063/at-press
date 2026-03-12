---
name: testing
description: "Run tests, write new tests, debug test failures. Use when working with Vitest unit tests or Playwright E2E."
---

## Testing

### Commands

```bash
npm run test                          # All unit tests (91 tests)
npm run test:watch                    # Watch mode
npm test -- tests/unit/pds.test.ts    # Single file
npm run test:e2e                      # Playwright E2E (needs running server)
```

### Test Structure

```
tests/
├── unit/                # Vitest (node env) — 91 tests
│   ├── auth.test.ts     # ATAuth login, ticket verify, isOwner
│   ├── drafts.test.ts   # SQLite CRUD, rkey generation, upsert, blobs
│   ├── pds.test.ts      # PDS fetching, caching, blobs, pagination, draft integration
│   ├── utils.test.ts    # formatDate, excerpt, escapeXml
│   └── rss.test.ts      # RSS XML escaping
└── e2e/                 # Playwright (chromium)
    └── blog.spec.ts     # Homepage, posts, RSS, write auth, 404, mobile
```

### Patterns

**Mock fetch** for PDS calls:
```typescript
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);
mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ records: [] }) });
```

**SQLite in-memory** — set BEFORE imports:
```typescript
process.env.DRAFTS_DB_PATH = ":memory:";
import { saveDraft, getDraft, closeDb } from "../../src/lib/drafts";
beforeEach(() => closeDb());  // Fresh DB each test
```

**Test env vars** in `vitest.config.ts` — **E2E base URL** via `BASE_URL` env var in `playwright.config.ts`

### After making changes

Always run `npm test && npm run build` to verify nothing breaks.
