import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/journal");

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <p className="text-sm uppercase tracking-widest text-emerald-400 mb-4">
          MVP · AI trading journal
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold leading-tight">
          Веди журнал сделок голосом и текстом
        </h1>
        <p className="mt-5 text-neutral-400 text-lg">
          Опиши сделку свободным текстом — AI сам вытащит инструмент, тезис,
          эмоцию входа, результат и ошибку. Никаких таблиц вручную.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-emerald-500 px-5 py-3 font-medium text-neutral-950 hover:bg-emerald-400 transition"
          >
            Начать
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-neutral-700 px-5 py-3 font-medium hover:bg-neutral-900 transition"
          >
            Войти
          </Link>
        </div>
      </div>
    </main>
  );
}
