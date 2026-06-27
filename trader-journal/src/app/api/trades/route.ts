import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractTrade } from "@/lib/extract";

const schema = z.object({
  rawText: z.string().min(3).max(4000),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trades = await prisma.trade.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ trades });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Опишите сделку (минимум несколько слов)" },
      { status: 400 },
    );
  }

  const extracted = await extractTrade(parsed.data.rawText);

  const trade = await prisma.trade.create({
    data: {
      userId: session.user.id,
      rawText: parsed.data.rawText,
      ...extracted,
    },
  });

  return NextResponse.json({ trade }, { status: 201 });
}
