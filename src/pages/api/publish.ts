import type { APIRoute } from "astro";
import { checkOrigin, checkAuth, parseJsonBody, createPdsSession } from "../../lib/api";
import { invalidateCache } from "../../lib/pds";
import { saveDraft } from "../../lib/drafts";
import { PDS_URL, DID, BLOG_COLLECTION, MAX_TITLE_LENGTH, MAX_CONTENT_LENGTH } from "../../lib/constants";

export const POST: APIRoute = async ({ request, cookies }) => {
  const originErr = checkOrigin(request);
  if (originErr) return originErr;

  const authErr = checkAuth(cookies);
  if (authErr) return authErr;

  const [body, parseErr] = await parseJsonBody(request);
  if (parseErr) return parseErr;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!title || title.length > MAX_TITLE_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Title is required and must be under ${MAX_TITLE_LENGTH} characters` }),
      { status: 400 }
    );
  }

  if (!content || content.length > MAX_CONTENT_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Content is required and must be under ${MAX_CONTENT_LENGTH} characters` }),
      { status: 400 }
    );
  }

  const blobs = Array.isArray(body.blobs) ? body.blobs : [];

  // Drafts go to local SQLite — never touch PDS
  if (body.visibility === "author") {
    const rkey = saveDraft({
      title,
      content,
      blobs: blobs.length > 0 ? blobs : undefined,
    });
    return new Response(JSON.stringify({ success: true, rkey }));
  }

  // Published posts go to PDS
  const [accessJwt, sessionErr] = await createPdsSession();
  if (sessionErr) return sessionErr;

  const createRes = await fetch(
    `${PDS_URL}/xrpc/com.atproto.repo.createRecord`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessJwt}`,
      },
      body: JSON.stringify({
        repo: DID,
        collection: BLOG_COLLECTION,
        record: {
          $type: BLOG_COLLECTION,
          title,
          content,
          createdAt: new Date().toISOString(),
          visibility: "public",
          ...(blobs.length > 0 && { blobs }),
        },
      }),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error("PDS createRecord failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to create entry" }),
      { status: 500 }
    );
  }

  const record = (await createRes.json()) as { uri: string; cid: string };
  const rkey = record.uri.split("/").pop();

  invalidateCache();

  return new Response(JSON.stringify({ success: true, rkey }));
};
