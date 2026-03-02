import type { AstroCookies } from "astro";
import { isOwner } from "./auth";
import { BLOG_URL, PDS_URL, DID } from "./constants";

export function checkOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin || origin !== BLOG_URL) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }
  return null;
}

export function checkAuth(cookies: AstroCookies): Response | null {
  const sessionDid = cookies.get("session_did")?.value;
  if (!sessionDid || !isOwner(sessionDid)) {
    return new Response(JSON.stringify({ error: "Not authorized" }), { status: 403 });
  }
  return null;
}

export async function parseJsonBody(
  request: Request
): Promise<[Record<string, unknown>, null] | [null, Response]> {
  try {
    const body = await request.json();
    return [body as Record<string, unknown>, null];
  } catch {
    return [
      null,
      new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 }),
    ];
  }
}

export async function createPdsSession(): Promise<[string, null] | [null, Response]> {
  const pdsPassword = process.env.PDS_APP_PASSWORD;
  if (!pdsPassword) {
    return [
      null,
      new Response(JSON.stringify({ error: "PDS credentials not configured" }), { status: 500 }),
    ];
  }

  const sessionRes = await fetch(
    `${PDS_URL}/xrpc/com.atproto.server.createSession`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: DID, password: pdsPassword }),
    }
  );

  if (!sessionRes.ok) {
    console.error("PDS createSession failed:", sessionRes.status);
    return [
      null,
      new Response(JSON.stringify({ error: "PDS auth failed" }), { status: 500 }),
    ];
  }

  const session = (await sessionRes.json()) as { accessJwt: string };
  return [session.accessJwt, null];
}
