import { NextResponse } from "next/server";
import { z } from "zod";
import { Keypair } from "@solana/web3.js";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { payConfig, priceFor, type Currency } from "@/lib/payments";

const schema = z.object({
  currency: z.enum(["USDC", "SOL"]),
});

function buildSolanaPayUrl(opts: {
  recipient: string;
  amount: number;
  reference: string;
  currency: Currency;
}): string {
  const params = new URLSearchParams();
  params.set("amount", String(opts.amount));
  params.set("reference", opts.reference);
  params.set("label", "Trencher Journal Pro");
  params.set("message", "Подписка Pro — Trencher Journal");
  if (opts.currency === "USDC") params.set("spl-token", payConfig.usdcMint);
  return `solana:${opts.recipient}?${params.toString()}`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!payConfig.recipient) {
    return NextResponse.json(
      { error: "Платежи не настроены: задайте SOLANA_RECIPIENT" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
  }

  const currency = parsed.data.currency;
  const amount = priceFor(currency);
  const reference = Keypair.generate().publicKey.toBase58();

  const payment = await prisma.payment.create({
    data: {
      userId: session.user.id,
      reference,
      recipient: payConfig.recipient,
      amount,
      currency,
      plan: "pro",
      periodDays: payConfig.periodDays,
    },
  });

  const url = buildSolanaPayUrl({
    recipient: payConfig.recipient,
    amount,
    reference,
    currency,
  });
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 280 });

  return NextResponse.json({
    reference: payment.reference,
    amount,
    currency,
    recipient: payConfig.recipient,
    periodDays: payConfig.periodDays,
    url,
    qr,
    devMode: payConfig.devMode,
  });
}
