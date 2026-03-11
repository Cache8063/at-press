export function formatDate(iso: string, opts?: { weekday?: boolean }): string {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  if (opts?.weekday) options.weekday = "long";
  return new Date(iso).toLocaleDateString("en-US", options);
}

import { DEFAULT_EXCERPT_LENGTH } from "./constants";

export function excerpt(content: string, maxLen = DEFAULT_EXCERPT_LENGTH): string {
  const plain = content
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/~~~[\s\S]*?~~~/g, "")
    .replace(/\n+/g, " ")
    .trim();
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen).replace(/\s+\S*$/, "") + "\u2026";
}

export function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return formatDate(iso);
}

export function bskyPostUrl(uri: string, handle: string): string {
  // at://did:plc:.../app.bsky.feed.post/rkey -> https://bsky.app/profile/handle/post/rkey
  const rkey = uri.split("/").pop() || "";
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
