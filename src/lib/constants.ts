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

// Cache TTLs (milliseconds)
export const PROFILE_TTL = 3600_000; // 1 hour
export const ENTRIES_TTL = 300_000; // 5 minutes
export const ENTRY_TTL = 600_000; // 10 minutes
export const ABOUT_TTL = 3600_000; // 1 hour
export const MAX_ENTRY_CACHE = 200;
