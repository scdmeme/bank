# Trencher Journal — AI-журнал мемкоин-флипов

Журнал для «тренчеров» (Solana / pump.fun флипперы). Трейдер диктует или пишет
о флипе свободным текстом со сленгом — AI извлекает структуру (токен,
маркеткап входа/выхода, нарратив, источник, размер в SOL, мультипликатор,
результат, ошибку) и строит **Trench Map** с паттернами. Оплата Pro — в крипте.

## Стек

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **Supabase (PostgreSQL)** через **Prisma** — пулинг-строка в `DATABASE_URL`,
  прямая в `DIRECT_URL` (для миграций)
- **Auth.js (next-auth v5)** — email + пароль, JWT-сессии
- **OpenAI** — AI-разбор флипа; без ключа работает встроенный офлайн-mock со
  сленг-эвристиками (тележка → telegram, «5х» → 5x, «30к МК» → $30K и т.д.)
- **Solana Pay** (`@solana/pay`) — оплата подписки в USDC/SOL, проверка
  транзакции on-chain по reference
- **Web Speech API** — голосовой ввод в браузере

## Что извлекает AI из флипа

`tokenSymbol, tokenName, mint, chain, platform, narrative, source, tradeType,
entryMcUsd, exitMcUsd, sizeSol, pnlSol, multiplier, holdTime, outcome
(moon/win/breakeven/loss/rug/holding), emotion, mistake
(paper-hands/held-rug/fomo-top/no-stop/oversized/aped-blind/…), discipline 1–5.`

## Подписка Pro (крипто-оплата)

- Free: логирование флипов + базовая сводка (флипы, винрейт, дисциплина, PnL).
- Pro: **Trench Map** — карта повторяющихся ошибок, PnL по нарративам и
  источникам, средний мультипликатор, тренд дисциплины.
- Оплата: Solana Pay (USDC или SOL) → QR/диплинк в Phantom/Solflare →
  бэкенд проверяет перевод по `reference` и активирует Pro на N дней.

## Настройка Supabase

1. Создай проект на [supabase.com](https://supabase.com).
2. Project Settings → Database → Connection string:
   - **Transaction (pooler, 6543)** → `DATABASE_URL` (добавь `?pgbouncer=true`)
   - **Session/Direct (5432)** → `DIRECT_URL`
3. Применить схему: `npx prisma migrate deploy` (или `migrate dev` локально).

## Локальный запуск

```bash
npm install
cp .env.example .env       # заполни DATABASE_URL/DIRECT_URL, AUTH_SECRET, SOLANA_RECIPIENT
npx prisma generate
npx prisma migrate deploy  # или: npx prisma migrate dev
npm run dev
```

Открой http://localhost:3000 → регистрация → опиши флип.

### Тест оплаты без реальных средств

Поставь `PAYMENTS_DEV_MODE="true"` — на странице `/pro` появится кнопка
«[DEV] Симулировать оплату», которая активирует Pro без on-chain перевода.
В проде установи `PAYMENTS_DEV_MODE="false"`.

### Переменные окружения

| Переменная          | Назначение                                              |
| ------------------- | ------------------------------------------------------- |
| `DATABASE_URL`      | Supabase pooled (6543, `pgbouncer=true`)                |
| `DIRECT_URL`        | Supabase direct (5432) — для миграций                   |
| `AUTH_SECRET`       | Секрет Auth.js (`npx auth secret`)                      |
| `OPENAI_API_KEY`    | Ключ OpenAI (пусто → встроенный mock)                   |
| `SOLANA_RECIPIENT`  | Кошелёк-получатель платежей (base58)                    |
| `SOLANA_RPC_URL`    | RPC для проверки платежей (Helius/QuickNode в проде)    |
| `PRO_PRICE_USDC`    | Цена Pro в USDC                                          |
| `PRO_PRICE_SOL`     | Цена Pro в SOL                                           |
| `PRO_PERIOD_DAYS`   | Срок Pro за один платёж                                  |
| `USDC_MINT`         | Mint USDC (mainnet по умолчанию)                        |
| `PAYMENTS_DEV_MODE` | `true` → разрешает симуляцию оплаты (только локально)   |

## Дальше (roadmap)

1. Whisper/Deepgram для серверной транскрипции аудио (помимо браузерного).
2. Автоподтягивание данных токена по mint (DexScreener/Birdeye).
3. Webhook-проверка платежей + продление подписки, история платежей в UI.
4. Конструктор торговых правил (React Flow) со сверкой по журналу.
5. Деплой на Vercel.
