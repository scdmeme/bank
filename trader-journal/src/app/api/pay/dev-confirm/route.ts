import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { activatePro, payConfig } from "@/lib/payments";

// DEV ONLY: simulate a confirmed on-chain payment so the flow is testable
// without real funds. Disabled unless PAYMENTS_DEV_MODE=true.
const schema = z.object({ reference: z.string().min(10) });

export async function POST(req: Request) {
  if (!payConfig.devMode) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

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
    return NextResponse.json({ error: "Invalid reference" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: { reference: parsed.data.reference },
  });
  if (!payment || payment.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (payment.status !== "confirmed") {
    await activatePro(payment.userId, payment.periodDays);
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "confirmed",
        txSignature: "DEV-SIMULATED",
        confirmedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ status: "confirmed" });
}
