import type { APIRoute } from "astro";
import { checkOrigin, checkAuth, parseJsonBody, createPdsSession } from "../../lib/api";
import { isValidRkey, invalidateEntry, invalidateCache } from "../../lib/pds";
import { getDraft, saveDraft, deleteDraft } from "../../lib/drafts";
import { PDS_URL, DID, BLOG_COLLECTION, MAX_TITLE_LENGTH, MAX_CONTENT_LENGTH } from "../../lib/constants";
const VALID_VISIBILITY = ["public", "author"];

export const POST: APIRoute = async ({ request, cookies }) => {
  const originErr = checkOrigin(request);
  if (originErr) return originErr;

  const authErr = checkAuth(cookies);
  if (authErr) return authErr;

  const [body, parseErr] = await parseJsonBody(request);
  if (parseErr) return parseErr;

  const rkey = typeof body.rkey === "string" ? body.rkey : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const visibility = typeof body.visibility === "string" ? body.visibility : "";
  const rawCreatedAt = typeof body.createdAt === "string" ? body.createdAt : "";
  const createdAt = rawCreatedAt && !isNaN(Date.parse(rawCreatedAt))
    ? new Date(rawCreatedAt).toISOString()
    : new Date().toISOString();

  if (!rkey || !isValidRkey(rkey)) {
    return new Response(JSON.stringify({ error: "Invalid rkey" }), { status: 400 });
  }

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

  if (!VALID_VISIBILITY.includes(visibility)) {
    return new Response(
      JSON.stringify({ error: "Visibility must be 'public' or 'author'" }),
      { status: 400 }
    );
  }

  const blobs = Array.isArray(body.blobs) ? body.blobs : [];
  const existingDraft = getDraft(rkey);

  if (existingDraft) {
    // This rkey is a local SQLite draft
    if (visibility === "author") {
      // Draft → Draft: update in SQLite only
      saveDraft({
        rkey,
        title,
        content,
        createdAt,
        blobs: blobs.length > 0 ? blobs : undefined,
      });
      return new Response(JSON.stringify({ success: true, rkey }));
    }

    // Draft → Publish: move from SQLite to PDS
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
          collection: BLOG_COLLECTION,
          rkey,
          record: {
            $type: BLOG_COLLECTION,
            title,
            content,
            createdAt,
            visibility: "public",
            ...(blobs.length > 0 && { blobs }),
          },
        }),
      }
    );

    if (!putRes.ok) {
      const err = await putRes.text();
      console.error("PDS putRecord (publish draft) failed:", err);
      return new Response(
        JSON.stringify({ error: "Failed to publish" }),
        { status: 500 }
      );
    }

    deleteDraft(rkey);
    invalidateCache();
    return new Response(JSON.stringify({ success: true, rkey }));
  }

  // This rkey is a PDS record
  if (visibility === "author") {
    // Published → Unpublish: move from PDS to SQLite
    saveDraft({
      rkey,
      title,
      content,
      createdAt,
      blobs: blobs.length > 0 ? blobs : undefined,
    });

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
      console.warn("PDS deleteRecord (unpublish) failed:", deleteRes.status);
    }

    invalidateEntry(rkey);
    return new Response(JSON.stringify({ success: true, rkey }));
  }

  // Published → Published: update on PDS (existing behavior)
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
        collection: BLOG_COLLECTION,
        rkey,
        record: {
          $type: BLOG_COLLECTION,
          title,
          content,
          createdAt,
          visibility,
          ...(blobs.length > 0 && { blobs }),
        },
      }),
    }
  );

  if (!putRes.ok) {
    const err = await putRes.text();
    console.error("PDS putRecord failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to update entry" }),
      { status: 500 }
    );
  }

  invalidateEntry(rkey);

  return new Response(JSON.stringify({ success: true, rkey }));
};
