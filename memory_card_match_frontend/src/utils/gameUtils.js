/**
 * Utility functions for creating and shuffling a memory card deck.
 */

const DEFAULT_SYMBOLS = [
  "🍓",
  "🍊",
  "🍋",
  "🍏",
  "🍇",
  "🍒",
  "🥝",
  "🍍",
];

// PUBLIC_INTERFACE
export function createShuffledDeck({ pairCount = 8 } = {}) {
  /** Creates a new shuffled deck containing `pairCount` pairs. */
  const symbols = DEFAULT_SYMBOLS.slice(0, pairCount);

  // Create two cards per symbol
  const deck = symbols
    .flatMap((symbol) => [
      { id: cryptoRandomId(), pairId: symbol, symbol, label: `Symbol ${symbol}` },
      { id: cryptoRandomId(), pairId: symbol, symbol, label: `Symbol ${symbol}` },
    ])
    .map((card) => ({
      ...card,
      isMatched: false,
    }));

  return shuffle(deck);
}

function shuffle(arr) {
  // Fisher–Yates shuffle
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cryptoRandomId() {
  // Prefer crypto.randomUUID when available; fallback to a simple random string.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
