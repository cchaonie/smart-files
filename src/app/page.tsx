import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/files");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-24 dark:bg-zinc-950">
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Smart Files</h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
          Upload and manage files per account. Supports chunked uploads with resume and range downloads.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-full border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Register
        </Link>
      </div>
    </div>
  );
}
