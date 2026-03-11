export const BLOG_URL = "https://blog.arcnode.xyz";
export const PDS_URL = "https://arcnode.xyz";
export const DID = "did:plc:k23ujfuppr3hr4pxvtaz7jro";
export const HANDLE = "bkb.arcnode.xyz";
export const BLOG_COLLECTION = "com.whtwnd.blog.entry";
export const ABOUT_COLLECTION = "xyz.arcnode.blog.about";
export const ABOUT_RKEY = "self";

// Content limits
export const MAX_TITLE_LENGTH = 300;
export const MAX_CONTENT_LENGTH = 100_000;
export const MAX_ABOUT_LENGTH = 5_000;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

// Session
export const SESSION_DID_COOKIE = "session_did";
export const SESSION_HANDLE_COOKIE = "session_handle";
export const SESSION_MAX_AGE = 86400 * 7; // 7 days

// RSS
export const RSS_MAX_ITEMS = 20;
export const RSS_EXCERPT_LENGTH = 300;
export const DEFAULT_EXCERPT_LENGTH = 160;

// Theme
export const THEME_STORAGE_KEY = "blog-theme";
export const THEME_COLORS: Record<string, string> = {
  default: "#0f172a",
  parchment: "#d9ccb4",
  moss: "#dde6d5",
  slate: "#eef0f3",
  rose: "#f0e2e4",
  eink: "#e5e1dc",
};
export const DEFAULT_THEME_COLOR = "#0f172a";

// Cache TTLs (milliseconds)
export const PROFILE_TTL = 3600_000; // 1 hour
export const ENTRIES_TTL = 300_000; // 5 minutes
export const ENTRY_TTL = 600_000; // 10 minutes
export const ABOUT_TTL = 3600_000; // 1 hour
export const MAX_ENTRY_CACHE = 200;
