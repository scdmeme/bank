import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPro } from "@/lib/payments";
import { TradeForm } from "./TradeForm";
import { SignOutButton } from "./SignOutButton";

const OUTCOME_LABEL: Record<string, string> = {
  moon: "MOON",
  win: "профит",
  breakeven: "безубыток",
  loss: "убыток",
  rug: "RUG",
  holding: "холд",
};

const OUTCOME_STYLE: Record<string, string> = {
  moon: "bg-fuchsia-500/15 text-fuchsia-300",
  win: "bg-emerald-500/15 text-emerald-400",
  breakeven: "bg-neutral-500/15 text-neutral-300",
  loss: "bg-red-500/15 text-red-400",
  rug: "bg-red-700/25 text-red-300",
  holding: "bg-sky-500/15 text-sky-400",
};

const MISTAKE_LABEL: Record<string, string> = {
  "paper-hands": "продал рано (paper hands)",
  "held-rug": "пересидел руг",
  "fomo-top": "купил на хае (FOMO-топ)",
  "no-stop": "без стопа",
  oversized: "перезаложился",
  "aped-blind": "апнул без анализа",
  "revenge-trade": "отыгрыш (revenge)",
  chased: "догонял пампу",
  "no-tp": "не зафиксировал профит",
  "round-tripped": "прокатал в ноль",
};

function fmtMc(v: number | null): string | null {
  if (v == null) return null;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v}`;
}

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

function topEntries(map: Map<string, number>, n = 5) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export default async function JournalPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, trades] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.trade.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const pro = user ? isPro(user) : false;

  // --- Aggregations ---
  const closed = trades.filter((t) =>
    ["moon", "win", "breakeven", "loss", "rug"].includes(t.outcome ?? ""),
  );
  const wins = trades.filter((t) => ["moon", "win"].includes(t.outcome ?? ""));
  const rugs = trades.filter((t) => t.outcome === "rug");
  const winRate =
    closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : null;

  const scored = trades.filter((t) => t.discipline != null);
  const avgDiscipline =
    scored.length > 0
      ? (
          scored.reduce((s, t) => s + (t.discipline ?? 0), 0) / scored.length
        ).toFixed(1)
      : "—";

  const mults = trades.filter((t) => t.multiplier != null);
  const avgMult =
    mults.length > 0
      ? (
          mults.reduce((s, t) => s + (t.multiplier ?? 0), 0) / mults.length
        ).toFixed(2)
      : "—";

  const totalPnlSol = trades.reduce((s, t) => s + (t.pnlSol ?? 0), 0);

  const mistakeCounts = new Map<string, number>();
  const narrativePnl = new Map<string, number>();
  const sourcePnl = new Map<string, number>();
  const emotionCounts = new Map<string, number>();
  for (const t of trades) {
    if (t.mistake)
      mistakeCounts.set(t.mistake, (mistakeCounts.get(t.mistake) ?? 0) + 1);
    if (t.emotion)
      emotionCounts.set(t.emotion, (emotionCounts.get(t.emotion) ?? 0) + 1);
    if (t.narrative)
      narrativePnl.set(
        t.narrative,
        (narrativePnl.get(t.narrative) ?? 0) + (t.pnlSol ?? 0),
      );
    if (t.source)
      sourcePnl.set(t.source, (sourcePnl.get(t.source) ?? 0) + (t.pnlSol ?? 0));
  }

  return (
    <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Trench Journal</h1>
          <p className="text-sm text-neutral-400">{session.user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {pro ? (
            <span className="rounded-lg bg-fuchsia-500/15 px-3 py-1.5 text-sm text-fuchsia-300">
              PRO
            </span>
          ) : (
            <Link
              href="/pro"
              className="rounded-lg bg-fuchsia-500 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-fuchsia-400"
            >
              Апгрейд Pro
            </Link>
          )}
          <SignOutButton />
        </div>
      </header>

      {trades.length > 0 && (
        <section className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Флипов" value={String(trades.length)} />
          <Stat label="Винрейт" value={winRate != null ? `${winRate}%` : "—"} />
          <Stat label="Дисциплина" value={`${avgDiscipline}/5`} />
          <Stat
            label="PnL (SOL)"
            value={`${totalPnlSol >= 0 ? "+" : ""}${totalPnlSol.toFixed(2)}`}
            accent={totalPnlSol >= 0 ? "pos" : "neg"}
          />
        </section>
      )}

      <div className="mt-6">
        <TradeForm />
      </div>

      {/* Trench Map — Pro analytics */}
      {trades.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Trench Map</h2>
            {!pro && (
              <Link href="/pro" className="text-sm text-fuchsia-400 hover:underline">
                Открыть в Pro →
              </Link>
            )}
          </div>

          {pro ? (
            <div className="mt-3 grid sm:grid-cols-2 gap-3">
              <AnalyticsCard title="Повторяющиеся ошибки">
                {mistakeCounts.size === 0 ? (
                  <Empty />
                ) : (
                  topEntries(mistakeCounts).map(([k, c]) => (
                    <Row
                      key={k}
                      left={MISTAKE_LABEL[k] ?? k}
                      right={`${c}×`}
                    />
                  ))
                )}
              </AnalyticsCard>

              <AnalyticsCard title="PnL по нарративам (SOL)">
                {narrativePnl.size === 0 ? (
                  <Empty />
                ) : (
                  topEntries(narrativePnl).map(([k, v]) => (
                    <Row
                      key={k}
                      left={k}
                      right={`${v >= 0 ? "+" : ""}${v.toFixed(2)}`}
                      positive={v >= 0}
                    />
                  ))
                )}
              </AnalyticsCard>

              <AnalyticsCard title="PnL по источникам (SOL)">
                {sourcePnl.size === 0 ? (
                  <Empty />
                ) : (
                  topEntries(sourcePnl).map(([k, v]) => (
                    <Row
                      key={k}
                      left={k}
                      right={`${v >= 0 ? "+" : ""}${v.toFixed(2)}`}
                      positive={v >= 0}
                    />
                  ))
                )}
              </AnalyticsCard>

              <AnalyticsCard title="Сводка">
                <Row left="Средний мультипликатор" right={`${avgMult}x`} />
                <Row left="Раги поймано" right={`${rugs.length}`} />
                <Row
                  left="Частые эмоции"
                  right={
                    topEntries(emotionCounts, 3)
                      .map(([e]) => e)
                      .join(", ") || "—"
                  }
                />
              </AnalyticsCard>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-dashed border-fuchsia-700/50 bg-fuchsia-500/5 p-6 text-center">
              <p className="text-neutral-300">
                🔒 Аналитика паттернов доступна в Pro
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Разбор ошибок, винрейт по нарративам/источникам, тренд
                дисциплины.
              </p>
              <Link
                href="/pro"
                className="mt-4 inline-block rounded-lg bg-fuchsia-500 px-5 py-2.5 font-medium text-neutral-950 hover:bg-fuchsia-400"
              >
                Разблокировать за крипту
              </Link>
            </div>
          )}
        </section>
      )}

      <section className="mt-8 space-y-4">
        {trades.length === 0 && (
          <p className="text-center text-neutral-500 py-10">
            Пока нет флипов. Опиши первый — AI всё разложит по полочкам.
          </p>
        )}

        {trades.map((t) => {
          const entry = fmtMc(t.entryMcUsd);
          const exit = fmtMc(t.exitMcUsd);
          const mc = entry && exit ? `${entry} → ${exit}` : (entry ?? exit);
          return (
            <article
              key={t.id}
              className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">
                    ${t.tokenSymbol ?? "—"}
                  </span>
                  {t.outcome && (
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        OUTCOME_STYLE[t.outcome] ?? "bg-neutral-500/15"
                      }`}
                    >
                      {OUTCOME_LABEL[t.outcome] ?? t.outcome}
                    </span>
                  )}
                  {t.multiplier != null && (
                    <span className="text-xs text-neutral-400">
                      {t.multiplier}x
                    </span>
                  )}
                  {t.pnlSol != null && (
                    <span
                      className={`text-xs ${
                        t.pnlSol >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {t.pnlSol >= 0 ? "+" : ""}
                      {t.pnlSol} SOL
                    </span>
                  )}
                </div>
                {t.discipline != null && (
                  <span className="shrink-0 text-xs text-neutral-400">
                    дисциплина {t.discipline}/5
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Маркеткап" value={mc} />
                <Field label="Платформа" value={t.platform} />
                <Field label="Нарратив" value={t.narrative} />
                <Field label="Источник" value={t.source} />
                <Field label="Тип" value={t.tradeType} />
                <Field label="Холд" value={t.holdTime} />
                <Field label="Эмоция" value={t.emotion} />
                <Field
                  label="Ошибка"
                  value={t.mistake ? (MISTAKE_LABEL[t.mistake] ?? t.mistake) : null}
                />
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
          );
        })}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "pos" | "neg";
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          accent === "pos"
            ? "text-emerald-400"
            : accent === "neg"
              ? "text-red-400"
              : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function AnalyticsCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{title}</p>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function Row({
  left,
  right,
  positive,
}: {
  left: string;
  right: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-neutral-300">{left}</span>
      <span
        className={
          positive === undefined
            ? "text-neutral-200"
            : positive
              ? "text-emerald-400"
              : "text-red-400"
        }
      >
        {right}
      </span>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-neutral-600">Недостаточно данных</p>;
}
