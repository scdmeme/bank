import OpenAI from "openai";

export type ExtractedTrade = {
  tokenSymbol: string | null;
  tokenName: string | null;
  mint: string | null;
  chain: string | null;
  platform: string | null;
  narrative: string | null;
  source: string | null;
  tradeType: string | null;
  entryMcUsd: number | null;
  exitMcUsd: number | null;
  sizeSol: number | null;
  pnlSol: number | null;
  multiplier: number | null;
  holdTime: string | null;
  outcome: string | null;
  emotion: string | null;
  mistake: string | null;
  discipline: number | null;
};

const SYSTEM_PROMPT = `You are an analyst for a memecoin "trencher" (Solana / pump.fun flipper) trading journal. The user describes a single memecoin flip in free form (any language, slang allowed, possibly voice-transcribed and messy). Extract a structured record.

Return ONLY a JSON object with EXACTLY these keys (use null when unknown — do NOT invent):
- tokenSymbol: ticker, e.g. "WIF", "PNUT" (no $)
- tokenName: full token name if mentioned
- mint: Solana mint/contract address if present
- chain: "solana" | "base" | "eth" | "bsc" (default "solana" if clearly memecoin context)
- platform: launch venue: "pump.fun" | "raydium" | "letsbonk" | "moonshot" | "believe" | other
- narrative: the meta/category: "animal" | "ai-agent" | "political" | "celebrity" | "brainrot" | "tiktok" | "frog" | other short tag
- source: how they found it: "ct" (crypto twitter) | "telegram" | "tiktok" | "scanner" | "kol" | "friend"
- tradeType: "snipe" | "early" | "momentum" | "swing" | "ape" | "fomo-late"
- entryMcUsd: market cap at entry in USD as a number (convert "50k"->50000, "1.2m"->1200000)
- exitMcUsd: market cap at exit in USD as a number
- sizeSol: position size in SOL as a number
- pnlSol: realized profit/loss in SOL (negative for loss)
- multiplier: realized multiple as a number (e.g. "did a 5x" -> 5, "down 80%" -> 0.2)
- holdTime: short human string like "30s","5m","3h","2d"
- outcome: "moon" (huge win) | "win" | "breakeven" | "loss" | "rug" | "holding"
- emotion: "fomo" | "greed" | "fear" | "revenge" | "euphoria" | "tilt" | "conviction"
- mistake: one of "paper-hands" (sold too early) | "held-rug" | "fomo-top" | "no-stop" | "oversized" | "aped-blind" | "revenge-trade" | "chased" | "no-tp" | "round-tripped" — or null
- discipline: integer 1..5 rating PROCESS quality (not P&L)

Keep tokenName/free strings in the user's language. Numbers must be plain numbers, no formatting.`;

type Hint = [RegExp, string];

const PLATFORM_HINTS: Hint[] = [
  [/(pump\.?fun|пампфан|памп\.?фан)/i, "pump.fun"],
  [/(raydium|рейдиум)/i, "raydium"],
  [/(letsbonk|bonk\.?fun|летсбонк)/i, "letsbonk"],
  [/(moonshot|муншот)/i, "moonshot"],
  [/(believe|билив)/i, "believe"],
];

const NARRATIVE_HINTS: Hint[] = [
  [/(ai[ -]?agent|ai[ -]?агент|ai токен)/i, "ai-agent"],
  [/(brainrot|брейнрот|брэйнрот|italian)/i, "brainrot"],
  [/(polit|трамп|trump|maga|election|выбор)/i, "political"],
  [/(celebr|знаменит|kanye|elon|маск)/i, "celebrity"],
  [/(tiktok|тикток)/i, "tiktok"],
  [/(frog|лягуш|pepe|пепе)/i, "frog"],
  [/(dog|собак|cat|кош|animal|животн|inu|wif)/i, "animal"],
];

const SOURCE_HINTS: Hint[] = [
  [/(crypto twitter|\bct\b|твиттер|twitter|\bx\b)/i, "ct"],
  [/(telegram|телег|тележ|тг|tg)/i, "telegram"],
  [/(tiktok|тикток)/i, "tiktok"],
  [/(scanner|сканер|gmgn|photon|axiom|bullx|trojan|bot|бот)/i, "scanner"],
  [/(kol|коол|инфлюенс|caller|колл)/i, "kol"],
  [/(friend|друг|подсказал|кореш)/i, "friend"],
];

const TRADETYPE_HINTS: Hint[] = [
  [/(snipe|снайп|снип)/i, "snipe"],
  [/(fomo|фомо|на хае|на хайпе|late|поздно|на верах)/i, "fomo-late"],
  [/(swing|свинг|держал долго|hold)/i, "swing"],
  [/(momentum|моментум|на пробое|breakout)/i, "momentum"],
  [/(early|рано|на старте|early)/i, "early"],
  [/(ape|апнул|заапил|апаю|зашел сразу)/i, "ape"],
];

const OUTCOME_HINTS: Hint[] = [
  [/(rug|раг|сруг|заруг|слили ликвид)/i, "rug"],
  [/(moon|мун|улетел|иксанул|x1\d|x[5-9]\d|100x|джекпот)/i, "moon"],
  [/(holding|холд|держу|moonbag|мунбаг)/i, "holding"],
  [/(breakeven|безубыт|в ноль|б\/у)/i, "breakeven"],
  [/(profit|прибыл|плюс|заработал|поднял|x[2-9]|икс)/i, "win"],
  [/(loss|убыт|минус|слил|потер|стоп|down|просел)/i, "loss"],
];

const EMOTION_HINTS: Hint[] = [
  [/(fomo|фомо|упуст)/i, "fomo"],
  [/(revenge|отыгр|месть|реванш|тильт|tilt)/i, "revenge"],
  [/(greed|жадн|зажал)/i, "greed"],
  [/(euphori|эйфор|на эмоци|кайф)/i, "euphoria"],
  [/(fear|страх|боял|испуг|паник)/i, "fear"],
  [/(confident|увер|conviction|конвикш|спокой)/i, "conviction"],
];

const MISTAKE_HINTS: Hint[] = [
  [/(paper hand|джит|jeet|продал рано|слил рано|рано вышел|закрыл рано)/i, "paper-hands"],
  [/(держал руг|held.*rug|пересидел руг|остался в руге)/i, "held-rug"],
  [/(на хае|fomo.*top|купил на верах|на хайпе зашел|на пике)/i, "fomo-top"],
  [/(без стоп|no stop|без стопа)/i, "no-stop"],
  [/(перезалож|oversiz|слишком большой|весь банк|all in|олл ин)/i, "oversized"],
  [/(без анализа|aped|апнул не глядя|не проверил|без дд|без due)/i, "aped-blind"],
  [/(отыгр|revenge|реванш|на эмоциях докуп)/i, "revenge-trade"],
  [/(догон|chase|вдогон|запрыгнул)/i, "chased"],
  [/(не зафикс|no tp|без тейк|не взял профит)/i, "no-tp"],
  [/(round.?trip|откатил в ноль|вернулось к входу|прокатал)/i, "round-tripped"],
];

function firstMatch(text: string, hints: Hint[]): string | null {
  for (const [re, val] of hints) if (re.test(text)) return val;
  return null;
}

// Market-cap mentions: a label (мк/cap/при/на…) followed by a number + unit.
// A unit is required so SOL amounts like "2 сола" are not misread as a cap.
const MC_RE =
  /(?:мк|mc|кап|cap|маркеткап|при|на)\s*\$?\s*(\d+(?:[.,]\d+)?)\s*(кк|млн|k|к|m|м|b|б)/gi;

function unitMul(unit: string): number {
  const u = unit.toLowerCase();
  if (u === "k" || u === "к") return 1_000;
  if (u === "кк" || u === "млн" || u === "m" || u === "м") return 1_000_000;
  if (u === "b" || u === "б") return 1_000_000_000;
  return 1;
}

function parseAllMc(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(MC_RE)) {
    out.push(Math.round(parseFloat(m[1].replace(",", ".")) * unitMul(m[2])));
  }
  return out;
}

function parseSol(text: string): number | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s?(sol|сол|солан)/i);
  if (!m) return null;
  return parseFloat(m[1].replace(",", "."));
}

function parseMultiplier(text: string): number | null {
  // Latin x and Cyrillic х, plus "икс".
  const x = text.match(
    /(?:^|\D)[xх]\s?(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s?[xх]|(\d+)\s?икс/i,
  );
  if (x) return parseFloat((x[1] || x[2] || x[3]).replace(",", "."));
  const downPct = text.match(/(?:down|минус|просел|-)\s?(\d{1,3})\s?%/i);
  if (downPct) return Math.max(0, 1 - parseInt(downPct[1], 10) / 100);
  const upPct = text.match(/(?:up|плюс|\+)\s?(\d{1,4})\s?%/i);
  if (upPct) return 1 + parseInt(upPct[1], 10) / 100;
  return null;
}

function parseHoldTime(text: string): string | null {
  const m = text.match(/(\d+)\s?(секунд|сек|s\b|минут|мин|m\b|час|ч\b|h\b|дн|day|d\b)/i);
  if (!m) return null;
  const n = m[1];
  const u = m[2].toLowerCase();
  if (/сек|s/.test(u)) return `${n}s`;
  if (/мин|m/.test(u)) return `${n}m`;
  if (/час|ч|h/.test(u)) return `${n}h`;
  return `${n}d`;
}

export function mockExtract(rawText: string): ExtractedTrade {
  const text = rawText.trim();

  const tickerMatch = text.match(/\$([A-Za-z][A-Za-z0-9]{1,9})\b/);
  const upperMatch = !tickerMatch ? text.match(/\b([A-Z]{2,8})\b/) : null;
  const tokenSymbol = tickerMatch
    ? tickerMatch[1].toUpperCase()
    : upperMatch
      ? upperMatch[1].toUpperCase()
      : null;

  const mintMatch = text.match(/\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/);
  const mint = mintMatch ? mintMatch[1] : null;

  const platform = firstMatch(text, PLATFORM_HINTS);
  const narrative = firstMatch(text, NARRATIVE_HINTS);
  const source = firstMatch(text, SOURCE_HINTS);
  const tradeType = firstMatch(text, TRADETYPE_HINTS);
  const outcome = firstMatch(text, OUTCOME_HINTS);
  const emotion = firstMatch(text, EMOTION_HINTS);
  const mistake = firstMatch(text, MISTAKE_HINTS);

  const multiplier = parseMultiplier(text);
  const sizeSol = parseSol(text);
  const holdTime = parseHoldTime(text);

  // Two market caps if present (entry then exit).
  const mcAll = parseAllMc(text);
  const entryMcUsd = mcAll[0] ?? null;
  const exitMcUsd = mcAll[1] ?? null;

  let pnlSol: number | null = null;
  if (sizeSol != null && multiplier != null) {
    pnlSol = Math.round(sizeSol * (multiplier - 1) * 100) / 100;
  }

  let discipline = 3;
  if (mistake) discipline -= 1;
  if (["fomo", "revenge", "tilt", "euphoria"].includes(emotion ?? "")) discipline -= 1;
  if (outcome === "rug" && mistake === "held-rug") discipline -= 1;
  if (emotion === "conviction" || tradeType === "swing") discipline += 1;
  discipline = Math.max(1, Math.min(5, discipline));

  return {
    tokenSymbol,
    tokenName: null,
    mint,
    chain: "solana",
    platform,
    narrative,
    source,
    tradeType,
    entryMcUsd,
    exitMcUsd,
    sizeSol,
    pnlSol,
    multiplier,
    holdTime,
    outcome,
    emotion,
    mistake,
    discipline,
  };
}

function normalize(parsed: Record<string, unknown>): ExtractedTrade {
  const str = (v: unknown) =>
    typeof v === "string" && v.trim().length ? v.trim() : null;
  const num = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.replace(/[, ]/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  let discipline = num(parsed.discipline);
  if (discipline != null) {
    discipline = Math.round(discipline);
    if (discipline < 1 || discipline > 5) discipline = null;
  }
  return {
    tokenSymbol: str(parsed.tokenSymbol)?.replace(/^\$/, "") ?? null,
    tokenName: str(parsed.tokenName),
    mint: str(parsed.mint),
    chain: str(parsed.chain) ?? "solana",
    platform: str(parsed.platform),
    narrative: str(parsed.narrative),
    source: str(parsed.source),
    tradeType: str(parsed.tradeType),
    entryMcUsd: num(parsed.entryMcUsd),
    exitMcUsd: num(parsed.exitMcUsd),
    sizeSol: num(parsed.sizeSol),
    pnlSol: num(parsed.pnlSol),
    multiplier: num(parsed.multiplier),
    holdTime: str(parsed.holdTime),
    outcome: str(parsed.outcome),
    emotion: str(parsed.emotion),
    mistake: str(parsed.mistake),
    discipline,
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
