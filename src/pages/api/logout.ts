import type { APIRoute } from "astro";
import { SESSION_DID_COOKIE, SESSION_HANDLE_COOKIE } from "../../lib/constants";

export const GET: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(SESSION_DID_COOKIE, { path: "/" });
  cookies.delete(SESSION_HANDLE_COOKIE, { path: "/" });
  return redirect("/", 303);
};
