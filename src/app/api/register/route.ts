import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body === "object" && body && "email" in body ? String((body as { email: unknown }).email) : "";
  const password =
    typeof body === "object" && body && "password" in body ? String((body as { password: unknown }).password) : "";
  const name =
    typeof body === "object" && body && "name" in body ? String((body as { name: unknown }).name) : undefined;

  const normalized = email.toLowerCase().trim();
  if (!EMAIL_RE.test(normalized) || password.length < 8) {
    return NextResponse.json({ error: "Invalid email or password (min 8 chars)" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email: normalized,
      passwordHash,
      name: name?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true });
}
