import type { APIRoute } from "astro";
import { checkOrigin, checkAuth, parseJsonBody, createPdsSession } from "../../lib/api";
import { invalidateAbout } from "../../lib/pds";
import { PDS_URL, DID, ABOUT_COLLECTION, ABOUT_RKEY } from "../../lib/constants";

const MAX_CONTENT_LENGTH = 5_000;

export const POST: APIRoute = async ({ request, cookies }) => {
  const originErr = checkOrigin(request);
  if (originErr) return originErr;

  const authErr = checkAuth(cookies);
  if (authErr) return authErr;

  const [body, parseErr] = await parseJsonBody(request);
  if (parseErr) return parseErr;

  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content || content.length > MAX_CONTENT_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Content is required and must be under ${MAX_CONTENT_LENGTH} characters` }),
      { status: 400 }
    );
  }

  const [accessJwt, sessionErr] = await createPdsSession();
  if (sessionErr) return sessionErr;

  const putRes = await fetch(
    `${PDS_URL}/xrpc/com.atproto.repo.putRecord`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessJwt}`,
      },
      body: JSON.stringify({
        repo: DID,
        collection: ABOUT_COLLECTION,
        rkey: ABOUT_RKEY,
        record: {
          $type: ABOUT_COLLECTION,
          content,
        },
      }),
    }
  );

  if (!putRes.ok) {
    const err = await putRes.text();
    console.error("PDS putRecord (about) failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to save about content" }),
      { status: 500 }
    );
  }

  invalidateAbout();

  return new Response(JSON.stringify({ success: true }));
};
