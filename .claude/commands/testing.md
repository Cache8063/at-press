---
name: testing
description: "Run tests, write new tests, debug test failures."
---

## Testing

### Commands

```bash
npm run test          # Vitest unit tests
npm run test:watch    # Watch mode
npm run test:e2e      # Playwright E2E (start dev server first)
npm test -- tests/unit/pds.test.ts  # Single file
```

### Test Structure

```
tests/
├── unit/           # Vitest (node env)
│   ├── auth.test.ts, drafts.test.ts, pds.test.ts, utils.test.ts, rss.test.ts
└── e2e/
    └── blog.spec.ts  # Homepage, posts, RSS, write auth, 404, mobile
```

### Key Patterns

- **Mock fetch** for PDS calls: `vi.stubGlobal("fetch", mockFetch)`
- **SQLite in-memory**: Set `process.env.DRAFTS_DB_PATH = ":memory:"` BEFORE imports
- **Test env vars** configured in `vitest.config.ts` (BLOG_URL, PDS_URL, DID, HANDLE)
- **E2E base URL** configurable via `BASE_URL` env var in `playwright.config.ts`
