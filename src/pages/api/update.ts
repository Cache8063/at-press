import type { APIRoute } from "astro";
import { checkOrigin, checkAuth, parseJsonBody, createPdsSession } from "../../lib/api";
import { isValidRkey, invalidateEntry } from "../../lib/pds";
import { PDS_URL, DID, BLOG_COLLECTION } from "../../lib/constants";

const MAX_TITLE_LENGTH = 300;
const MAX_CONTENT_LENGTH = 100_000;
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
  const createdAt = typeof body.createdAt === "string" ? body.createdAt : new Date().toISOString();

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
