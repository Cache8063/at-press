import type { APIRoute } from "astro";
import { getBlogEntries, getProfile } from "../lib/pds";
import { BLOG_URL, HANDLE } from "../lib/constants";
import { escapeXml, excerpt } from "../lib/utils";

export const GET: APIRoute = async () => {
  const [entries, profile] = await Promise.all([
    getBlogEntries(),
    getProfile(),
  ]);

  const items = entries.slice(0, 20).map((entry) => {
    const pubDate = new Date(entry.createdAt).toUTCString();
    const desc = excerpt(entry.content, 300);

    return `    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${BLOG_URL}/${escapeXml(entry.rkey)}</link>
      <guid isPermaLink="true">${BLOG_URL}/${escapeXml(entry.rkey)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(desc)}</description>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(profile.displayName)} — writing</title>
    <link>${BLOG_URL}</link>
    <description>${escapeXml(profile.description || `Writing by @${HANDLE}`)}</description>
    <language>en</language>
    <atom:link href="${BLOG_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
