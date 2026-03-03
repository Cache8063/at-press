import { defineMiddleware } from "astro:middleware";
import { migratePdsDraftsToSqlite } from "./lib/drafts";

let migrated = false;

export const onRequest = defineMiddleware(async (_context, next) => {
  if (!migrated) {
    migrated = true;
    try {
      await migratePdsDraftsToSqlite();
    } catch (err) {
      console.error("[migration] Failed:", err);
    }
  }

  const response = await next();
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://arcnode.xyz; connect-src 'self'; frame-ancestors 'none'"
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
});
