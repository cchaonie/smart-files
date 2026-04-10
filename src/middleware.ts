import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.startsWith("/files")) {
    return Response.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/files/:path*"],
};
