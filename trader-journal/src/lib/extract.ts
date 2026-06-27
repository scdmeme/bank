import OpenAI from "openai";

export type ExtractedTrade = {
  instrument: string | null;
  direction: string | null; // long | short
  thesis: string | null;
  emotion: string | null;
  outcome: string | null; // win | loss | breakeven | open
  mistake: string | null;
  score: number | null; // 1..5 process/discipline quality
};

const SYSTEM_PROMPT = `You are a trading-journal analyst. The user describes a single trade in free form (any language, possibly voice-transcribed and messy). Extract a structured record.

Return ONLY a JSON object with EXACTLY these keys:
- instrument: ticker/asset traded (e.g. "BTC", "AAPL", "EURUSD") or null
- direction: "long" or "short" or null
- thesis: one short sentence — why they entered, or null
- emotion: the entry/management emotion (e.g. "fear", "greed", "fomo", "confident", "revenge") or null
- outcome: one of "win", "loss", "breakeven", "open" or null
- mistake: the key process mistake if any (short), or null
- score: integer 1..5 rating the DISCIPLINE/PROCESS quality of the trade (not the P&L), or null

Keep string values in the SAME language the user wrote in. Do not invent facts that are not implied by the text. Use null when unknown.`;

// Note: JS regex \b is not Unicode-aware, so we avoid word boundaries here to
// keep Cyrillic substring matching working in the offline mock.
const DIRECTION_HINTS: Array<[RegExp, string]> = [
  [/(long|лонг|купил|bought|покупк)/i, "long"],
  [/(short|шорт|продал|sold|продаж)/i, "short"],
];

const OUTCOME_HINTS: Array<[RegExp, string]> = [
  [/(profit|прибыл|плюс|выигра|заработал|\+\d)/i, "win"],
  [/(loss|убыт|минус|слил|потер|stopped out|\-\d)/i, "loss"],
  [/(breakeven|безубыт|в ноль|b\/e)/i, "breakeven"],
  [/(открыт|держу|holding|in position)/i, "open"],
];

const EMOTION_HINTS: Array<[RegExp, string]> = [
  [/(fomo|фомо|упуст)/i, "fomo"],
  [/(fear|страх|боял|испуг)/i, "fear"],
  [/(greed|жадн)/i, "greed"],
  [/(revenge|отыгр|месть|реванш)/i, "revenge"],
  [/(confident|увер|спокой|calm)/i, "confident"],
  [/(panic|паник)/i, "panic"],
];

function firstMatch(text: string, hints: Array<[RegExp, string]>): string | null {
  for (const [re, val] of hints) {
    if (re.test(text)) return val;
  }
  return null;
}

// Heuristic fallback used when no OPENAI_API_KEY is configured, so the
// prototype is fully demoable offline.
export function mockExtract(rawText: string): ExtractedTrade {
  const text = rawText.trim();
  const tickerMatch =
    text.match(/\$([A-Za-z]{2,6})\b/) || text.match(/\b([A-Z]{2,6})\b/);
  const instrument = tickerMatch ? tickerMatch[1].toUpperCase() : null;

  const direction = firstMatch(text, DIRECTION_HINTS);
  const outcome = firstMatch(text, OUTCOME_HINTS);
  const emotion = firstMatch(text, EMOTION_HINTS);

  const mistake =
    /без стоп|no stop|без стопа|передерж|too early|рано|пересиж|overtrade|переторг/i.test(
      text,
    )
      ? "process deviation detected in description"
      : null;

  let score = 3;
  if (emotion && ["fomo", "revenge", "panic", "greed"].includes(emotion)) score -= 1;
  if (mistake) score -= 1;
  if (emotion === "confident") score += 1;
  score = Math.max(1, Math.min(5, score));

  const thesis = text.length > 0 ? text.slice(0, 140) : null;

  return { instrument, direction, thesis, emotion, outcome, mistake, score };
}

function normalize(parsed: Record<string, unknown>): ExtractedTrade {
  const str = (v: unknown) =>
    typeof v === "string" && v.trim().length ? v.trim() : null;
  let score: number | null = null;
  if (typeof parsed.score === "number") score = parsed.score;
  else if (typeof parsed.score === "string" && parsed.score.trim())
    score = Number.parseInt(parsed.score, 10);
  if (score !== null && (Number.isNaN(score) || score < 1 || score > 5))
    score = null;

  return {
    instrument: str(parsed.instrument),
    direction: str(parsed.direction),
    thesis: str(parsed.thesis),
    emotion: str(parsed.emotion),
    outcome: str(parsed.outcome),
    mistake: str(parsed.mistake),
    score,
  };
}

export async function extractTrade(rawText: string): Promise<ExtractedTrade> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return mockExtract(rawText);

  try {
    const client = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: rawText },
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) return mockExtract(rawText);
    return normalize(JSON.parse(content));
  } catch (err) {
    console.error("AI extraction failed, falling back to mock:", err);
    return mockExtract(rawText);
  }
}
