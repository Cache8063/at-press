import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete("session_did", { path: "/" });
  cookies.delete("session_handle", { path: "/" });
  return redirect("/", 303);
};
