import { prisma } from "@/lib/prisma";

export const payConfig = {
  recipient: process.env.SOLANA_RECIPIENT ?? "",
  usdcMint:
    process.env.USDC_MINT ?? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  priceUsdc: Number(process.env.PRO_PRICE_USDC ?? "19"),
  priceSol: Number(process.env.PRO_PRICE_SOL ?? "0.1"),
  periodDays: Number(process.env.PRO_PERIOD_DAYS ?? "30"),
  devMode: process.env.PAYMENTS_DEV_MODE === "true",
};

export type Currency = "USDC" | "SOL";

export function priceFor(currency: Currency): number {
  return currency === "USDC" ? payConfig.priceUsdc : payConfig.priceSol;
}

export function isPro(user: {
  plan: string;
  proUntil: Date | null;
}): boolean {
  return (
    user.plan === "pro" && !!user.proUntil && user.proUntil.getTime() > Date.now()
  );
}

// Extend (or start) the user's Pro period. Stacks on remaining time.
export async function activatePro(
  userId: string,
  periodDays: number,
): Promise<Date> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const now = new Date();
  const base =
    user?.proUntil && user.proUntil > now ? user.proUntil : now;
  const proUntil = new Date(base.getTime() + periodDays * 86_400_000);
  await prisma.user.update({
    where: { id: userId },
    data: { plan: "pro", proUntil },
  });
  return proUntil;
}
