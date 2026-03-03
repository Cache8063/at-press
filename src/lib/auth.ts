import { DID, BLOG_URL } from "./constants";

const GATEWAY_URL =
  process.env.ATAUTH_GATEWAY_URL || "https://apricot.workingtitle.zip";
const ATAUTH_PUBLIC_URL =
  process.env.ATAUTH_PUBLIC_URL || "https://apricot.workingtitle.zip";

interface ProxyUser {
  did: string;
  handle: string;
}

export function getLoginUrl(): string {
  return `${ATAUTH_PUBLIC_URL}/auth/proxy/login?rd=${encodeURIComponent(`${BLOG_URL}/write`)}`;
}

export async function verifyProxyTicket(
  ticket: string
): Promise<ProxyUser | null> {
  try {
    const verifyUrl = `${GATEWAY_URL}/auth/verify`;
    const originalUrl = `${BLOG_URL}/write?_atauth_ticket=${encodeURIComponent(ticket)}`;

    const res = await fetch(verifyUrl, {
      headers: {
        "X-Original-URL": originalUrl,
        "X-Forwarded-Proto": "https",
        "X-Forwarded-Host": new URL(BLOG_URL).host,
      },
    });

    if (res.status !== 200) return null;

    const did = res.headers.get("x-auth-did");
    const handle = res.headers.get("x-auth-handle");
    if (!did || !handle) return null;

    // Validate handle format (alphanumeric, dots, hyphens)
    if (!/^[a-zA-Z0-9.-]+$/.test(handle)) return null;

    return { did, handle };
  } catch {
    return null;
  }
}

export function isOwner(did: string): boolean {
  return did === DID;
}
