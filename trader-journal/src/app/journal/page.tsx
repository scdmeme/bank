import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TradeForm } from "./TradeForm";
import { SignOutButton } from "./SignOutButton";

const OUTCOME_LABEL: Record<string, string> = {
  win: "профит",
  loss: "убыток",
  breakeven: "безубыток",
  open: "открыта",
};

const OUTCOME_STYLE: Record<string, string> = {
  win: "bg-emerald-500/15 text-emerald-400",
  loss: "bg-red-500/15 text-red-400",
  breakeven: "bg-neutral-500/15 text-neutral-300",
  open: "bg-sky-500/15 text-sky-400",
};

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <p className="text-sm text-neutral-200">{value}</p>
    </div>
  );
}

export default async function JournalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const trades = await prisma.trade.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  // Simple psychological map: top recurring emotions/mistakes.
  const emotionCounts = new Map<string, number>();
  for (const t of trades) {
    if (t.emotion) emotionCounts.set(t.emotion, (emotionCounts.get(t.emotion) ?? 0) + 1);
  }
  const topEmotions = [...emotionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const avgScore =
    trades.length > 0
      ? (
          trades.reduce((s, t) => s + (t.score ?? 0), 0) /
          trades.filter((t) => t.score != null).length || 0
        ).toFixed(1)
      : "—";

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Журнал сделок</h1>
          <p className="text-sm text-neutral-400">
            {session.user.email}
          </p>
        </div>
        <SignOutButton />
      </header>

      {trades.length > 0 && (
        <section className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Сделок
            </p>
            <p className="mt-1 text-2xl font-semibold">{trades.length}</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Средний скор дисциплины
            </p>
            <p className="mt-1 text-2xl font-semibold">{avgScore}</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 col-span-2 sm:col-span-1">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Частые эмоции
            </p>
            <p className="mt-1 text-sm">
              {topEmotions.length
                ? topEmotions.map(([e, c]) => `${e} (${c})`).join(", ")
                : "—"}
            </p>
          </div>
        </section>
      )}

      <div className="mt-6">
        <TradeForm />
      </div>

      <section className="mt-8 space-y-4">
        {trades.length === 0 && (
          <p className="text-center text-neutral-500 py-10">
            Пока нет сделок. Опиши первую — AI всё структурирует.
          </p>
        )}

        {trades.map((t) => (
          <article
            key={t.id}
            className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {t.instrument ?? "—"}
                </span>
                {t.direction && (
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      t.direction === "long"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {t.direction === "long" ? "LONG" : "SHORT"}
                  </span>
                )}
                {t.outcome && (
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      OUTCOME_STYLE[t.outcome] ?? "bg-neutral-500/15"
                    }`}
                  >
                    {OUTCOME_LABEL[t.outcome] ?? t.outcome}
                  </span>
                )}
              </div>
              {t.score != null && (
                <span className="text-xs text-neutral-400">
                  дисциплина {t.score}/5
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Тезис" value={t.thesis} />
              <Field label="Эмоция" value={t.emotion} />
              <Field label="Ошибка" value={t.mistake} />
            </div>

            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-300">
                Исходный текст
              </summary>
              <p className="mt-2 text-sm text-neutral-400 whitespace-pre-wrap">
                {t.rawText}
              </p>
            </details>

            <p className="mt-3 text-xs text-neutral-600">
              {new Date(t.createdAt).toLocaleString("ru-RU")}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
