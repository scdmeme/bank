"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 transition"
    >
      Выйти
    </button>
  );
}
