import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const sp = await searchParams;
  const raw = sp.callbackUrl;
  const callbackUrl = typeof raw === "string" && raw.startsWith("/") ? raw : "/files";
  return <LoginForm callbackUrl={callbackUrl} />;
}
