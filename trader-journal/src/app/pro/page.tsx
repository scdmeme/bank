"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Currency = "USDC" | "SOL";

type PaymentInfo = {
  reference: string;
  amount: number;
  currency: Currency;
  recipient: string;
  periodDays: number;
  url: string;
  qr: string;
  devMode: boolean;
};

export default function ProPage() {
  const router = useRouter();
  const [currency, setCurrency] = useState<Currency>("USDC");
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "confirmed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function startPayment() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/pay/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Не удалось создать платёж");
      return;
    }
    const info: PaymentInfo = await res.json();
    setPayment(info);
    setStatus("pending");
    startPolling(info.reference);
  }

  function startPolling(reference: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const res = await fetch(
        `/api/pay/status?reference=${encodeURIComponent(reference)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (data.status === "confirmed") {
        if (pollRef.current) clearInterval(pollRef.current);
        setStatus("confirmed");
        setTimeout(() => {
          router.push("/journal");
          router.refresh();
        }, 1500);
      }
    }, 4000);
  }

  async function devConfirm() {
    if (!payment) return;
    await fetch("/api/pay/dev-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference: payment.reference }),
    });
  }

  return (
    <main className="flex-1 w-full max-w-lg mx-auto px-6 py-10">
      <Link href="/journal" className="text-sm text-neutral-400 hover:underline">
        ← В журнал
      </Link>

      <h1 className="mt-4 text-3xl font-semibold">Trencher Journal Pro</h1>
      <p className="mt-2 text-neutral-400">
        Полная Trench-аналитика: разбор твоих ошибок, эффективность по
        нарративам, винрейт, тренд дисциплины. Оплата в крипте.
      </p>

      <ul className="mt-5 space-y-2 text-sm text-neutral-300">
        <li>• Карта повторяющихся ошибок (paper hands, FOMO-топ, held-rug…)</li>
        <li>• Винрейт и средний мультипликатор</li>
        <li>• Какие нарративы и источники приносят тебе плюс</li>
        <li>• Тренд дисциплины во времени</li>
      </ul>

      {status === "confirmed" ? (
        <div className="mt-8 rounded-2xl border border-emerald-700 bg-emerald-500/10 p-6 text-center">
          <p className="text-emerald-400 font-medium">Оплата получена! ✅</p>
          <p className="text-sm text-neutral-400 mt-1">
            Pro активирован. Переходим в журнал…
          </p>
        </div>
      ) : !payment ? (
        <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
          <p className="text-sm text-neutral-300">Выбери валюту:</p>
          <div className="mt-3 flex gap-2">
            {(["USDC", "SOL"] as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`rounded-lg border px-4 py-2 text-sm transition ${
                  currency === c
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                    : "border-neutral-700 hover:bg-neutral-800"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <button
            onClick={startPayment}
            disabled={loading}
            className="mt-5 w-full rounded-lg bg-emerald-500 py-3 font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-60 transition"
          >
            {loading ? "Создаём счёт…" : `Оплатить в ${currency}`}
          </button>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center">
          <p className="text-sm text-neutral-400">
            Отсканируй в кошельке (Phantom/Solflare) или открой ссылку
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={payment.qr}
            alt="Solana Pay QR"
            className="mx-auto mt-4 rounded-lg bg-white p-2"
            width={240}
            height={240}
          />
          <p className="mt-4 text-2xl font-semibold">
            {payment.amount} {payment.currency}
          </p>
          <p className="text-xs text-neutral-500">
            за {payment.periodDays} дней Pro
          </p>
          <a
            href={payment.url}
            className="mt-4 inline-block rounded-lg border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
          >
            Открыть в кошельке
          </a>
          <p className="mt-4 text-sm text-amber-400 animate-pulse">
            Ожидаем подтверждение в сети…
          </p>

          {payment.devMode && (
            <button
              onClick={devConfirm}
              className="mt-4 w-full rounded-lg border border-dashed border-neutral-700 py-2 text-xs text-neutral-500 hover:bg-neutral-800"
            >
              [DEV] Симулировать оплату
            </button>
          )}
        </div>
      )}
    </main>
  );
}
