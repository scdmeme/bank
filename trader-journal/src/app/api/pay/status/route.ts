import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import {
  findReference,
  validateTransfer,
  FindReferenceError,
} from "@solana/pay";
import BigNumber from "bignumber.js";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getConnection } from "@/lib/solana";
import { activatePro, payConfig } from "@/lib/payments";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reference = new URL(req.url).searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment || payment.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (payment.status === "confirmed") {
    return NextResponse.json({ status: "confirmed" });
  }

  // Verify the transfer on-chain via the Solana Pay reference.
  try {
    const connection = getConnection();
    const refKey = new PublicKey(reference);
    const found = await findReference(connection, refKey, {
      finality: "confirmed",
    });

    await validateTransfer(
      connection,
      found.signature,
      {
        recipient: new PublicKey(payment.recipient),
        amount: new BigNumber(payment.amount),
        splToken:
          payment.currency === "USDC"
            ? new PublicKey(payConfig.usdcMint)
            : undefined,
        reference: refKey,
      },
      { commitment: "confirmed" },
    );

    const proUntil = await activatePro(payment.userId, payment.periodDays);
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "confirmed",
        txSignature: found.signature,
        confirmedAt: new Date(),
      },
    });

    return NextResponse.json({ status: "confirmed", proUntil });
  } catch (err) {
    if (err instanceof FindReferenceError) {
      return NextResponse.json({ status: "pending" });
    }
    console.error("payment verification error", err);
    return NextResponse.json(
      { status: "pending", error: "verification_failed" },
      { status: 200 },
    );
  }
}
