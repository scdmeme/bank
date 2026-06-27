"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Неверный email или пароль");
      return;
    }
    router.push("/journal");
    router.refresh();
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-900 p-8"
      >
        <h1 className="text-2xl font-semibold">Вход</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Войди, чтобы открыть свой журнал.
        </p>

        <label className="mt-6 block text-sm text-neutral-300">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-emerald-500"
        />

        <label className="mt-4 block text-sm text-neutral-300">Пароль</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-emerald-500"
        />

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-emerald-500 py-2.5 font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-60 transition"
        >
          {loading ? "Входим…" : "Войти"}
        </button>

        <p className="mt-4 text-center text-sm text-neutral-400">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-emerald-400 hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </form>
    </main>
  );
}
