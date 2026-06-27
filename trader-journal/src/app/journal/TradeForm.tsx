"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function TradeForm() {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  async function submit() {
    if (rawText.trim().length < 3) {
      setError("Опиши сделку (минимум несколько слов)");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Не удалось сохранить сделку");
      return;
    }
    setRawText("");
    router.refresh();
  }

  function toggleVoice() {
    // Browser-native speech-to-text (no external service needed for the demo).
    const SpeechRecognition =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(
        "Голосовой ввод не поддерживается в этом браузере. Напиши текстом.",
      );
      return;
    }
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: {
      results: ArrayLike<ArrayLike<{ transcript: string }>>;
    }) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setRawText((prev) => (prev ? prev + " " : "") + text);
    };
    recognition.onend = () => setRecording(false);
    recognition.onerror = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <label className="block text-sm font-medium text-neutral-300">
        Расскажи о сделке
      </label>
      <p className="mt-1 text-xs text-neutral-500">
        Например: «Зашёл в лонг по BTC на пробое, думал продолжится тренд, но
        запаниковал и закрыл рано в небольшой плюс».
      </p>
      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        rows={4}
        placeholder="Диктуй или печатай свободным текстом…"
        className="mt-3 w-full resize-y rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 outline-none focus:border-emerald-500"
      />

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={loading}
          className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-60 transition"
        >
          {loading ? "AI разбирает…" : "Разобрать и сохранить"}
        </button>
        <button
          onClick={toggleVoice}
          type="button"
          className={`rounded-lg border px-4 py-2 font-medium transition ${
            recording
              ? "border-red-500 text-red-400"
              : "border-neutral-700 hover:bg-neutral-800"
          }`}
        >
          {recording ? "● Стоп" : "🎤 Голос"}
        </button>
      </div>
    </div>
  );
}
