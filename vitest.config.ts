import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    env: {
      BLOG_URL: "https://test.example.com",
      PDS_URL: "https://pds.example.com",
      DID: "did:plc:test123456",
      HANDLE: "test.example.com",
    },
  },
});
