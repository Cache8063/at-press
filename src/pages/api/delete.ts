import type { APIRoute } from "astro";
import { checkOrigin, checkAuth, parseJsonBody, createPdsSession } from "../../lib/api";
import { isValidRkey, invalidateEntry } from "../../lib/pds";
import { getDraft, deleteDraft } from "../../lib/drafts";
import { PDS_URL, DID, BLOG_COLLECTION } from "../../lib/constants";

export const POST: APIRoute = async ({ request, cookies }) => {
  const originErr = checkOrigin(request);
  if (originErr) return originErr;

  const authErr = checkAuth(cookies);
  if (authErr) return authErr;

  const [body, parseErr] = await parseJsonBody(request);
  if (parseErr) return parseErr;

  const rkey = typeof body.rkey === "string" ? body.rkey : "";

  if (!rkey || !isValidRkey(rkey)) {
    return new Response(JSON.stringify({ error: "Invalid rkey" }), { status: 400 });
  }

  // Check if this is a local draft
  if (getDraft(rkey)) {
    deleteDraft(rkey);
    return new Response(JSON.stringify({ success: true }));
  }

  // Otherwise delete from PDS
  const [accessJwt, sessionErr] = await createPdsSession();
  if (sessionErr) return sessionErr;

  const deleteRes = await fetch(
    `${PDS_URL}/xrpc/com.atproto.repo.deleteRecord`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessJwt}`,
      },
      body: JSON.stringify({
        repo: DID,
        collection: BLOG_COLLECTION,
        rkey,
      }),
    }
  );

  if (!deleteRes.ok) {
    const err = await deleteRes.text();
    console.error("PDS deleteRecord failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to delete entry" }),
      { status: 500 }
    );
  }

  invalidateEntry(rkey);

  return new Response(JSON.stringify({ success: true }));
};
