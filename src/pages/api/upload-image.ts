import type { APIRoute } from "astro";
import { checkOrigin, checkAuth, createPdsSession } from "../../lib/api";
import { blobUrl } from "../../lib/pds";
import { PDS_URL, DID } from "../../lib/constants";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const POST: APIRoute = async ({ request, cookies }) => {
  const originErr = checkOrigin(request);
  if (originErr) return originErr;

  const authErr = checkAuth(cookies);
  if (authErr) return authErr;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid form data" }),
      { status: 400 }
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return new Response(
      JSON.stringify({ error: "No file provided" }),
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return new Response(
      JSON.stringify({ error: "Only PNG, JPEG, and WebP images are accepted" }),
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return new Response(
      JSON.stringify({ error: "Image must be under 5 MB" }),
      { status: 400 }
    );
  }

  const [accessJwt, sessionErr] = await createPdsSession();
  if (sessionErr) return sessionErr;

  const bytes = await file.arrayBuffer();

  const uploadRes = await fetch(
    `${PDS_URL}/xrpc/com.atproto.repo.uploadBlob`,
    {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        Authorization: `Bearer ${accessJwt}`,
      },
      body: bytes,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    console.error("PDS uploadBlob failed:", err);
    return new Response(
      JSON.stringify({ error: "Failed to upload image" }),
      { status: 500 }
    );
  }

  const { blob } = (await uploadRes.json()) as {
    blob: { $type: "blob"; ref: { $link: string }; mimeType: string; size: number };
  };

  const url = blobUrl(DID, blob.ref.$link);

  return new Response(JSON.stringify({ blob, url }));
};
