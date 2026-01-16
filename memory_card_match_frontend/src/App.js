import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import MemoryCard from "./components/MemoryCard";
import { createShuffledDeck } from "./utils/gameUtils";

const GRID_SIZE = 4; // 4x4 grid => 16 cards => 8 pairs
const FLIP_BACK_DELAY_MS = 800;

const THEME_STORAGE_KEY = "mc-theme"; // "light" | "dark"

// PUBLIC_INTERFACE
function App() {
  /** Main entry component for the Memory Card Match game. */
  const [deck, setDeck] = useState(() =>
    createShuffledDeck({ pairCount: (GRID_SIZE * GRID_SIZE) / 2 })
  );
  const [flippedIds, setFlippedIds] = useState([]); // holds up to 2 ids
  const [moves, setMoves] = useState(0);
  const [status, setStatus] = useState("playing"); // playing | won
  const lockRef = useRef(false); // prevents clicks while resolving two flipped cards

  // a11y: aria-live announcements (kept separate from visible banner text)
  const [srMessage, setSrMessage] = useState("");
  const srMsgSeqRef = useRef(0);

  // Theme: default to system preference, then use localStorage override if present.
  const [theme, setTheme] = useState(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;

    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    return prefersDark ? "dark" : "light";
  });

  // Roving focus for keyboard arrow navigation across the grid.
  const [activeIndex, setActiveIndex] = useState(0);

  const matchedCount = useMemo(() => deck.filter((c) => c.isMatched).length, [deck]);

  const totalCards = GRID_SIZE * GRID_SIZE;
  const allMatched = matchedCount === totalCards;

  const columns = GRID_SIZE;
  const rows = Math.ceil(deck.length / columns);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (allMatched) setStatus("won");
  }, [allMatched]);

  useEffect(() => {
    if (status === "won") {
      setSrMessage(`You win! You matched all pairs in ${moves} moves.`);
    }
  }, [moves, status]);

  useEffect(() => {
    // When two cards are flipped, resolve match/non-match after a short delay.
    if (flippedIds.length !== 2) return;

    const [aId, bId] = flippedIds;
    const a = deck.find((c) => c.id === aId);
    const b = deck.find((c) => c.id === bId);

    // Safety: if not found (shouldn't happen), just reset selection.
    if (!a || !b) {
      setFlippedIds([]);
      return;
    }

    // A move is every time two cards are flipped.
    setMoves((m) => m + 1);
    lockRef.current = true;

    const isMatch = a.pairId === b.pairId;

    // Announce outcome without leaking unrevealed identities. Only reveal the label when cards are currently revealed.
    if (isMatch) {
      setSrMessage(() => {
        srMsgSeqRef.current += 1;
        return `Match found: ${a.label}.`;
      });
    } else {
      setSrMessage(() => {
        srMsgSeqRef.current += 1;
        return "Not a match.";
      });
    }

    const timer = window.setTimeout(() => {
      if (isMatch) {
        setDeck((prev) => prev.map((c) => (c.pairId === a.pairId ? { ...c, isMatched: true } : c)));
      }
      // For both match and non-match, clear selection (matched cards will remain visible via isMatched flag).
      setFlippedIds([]);
      lockRef.current = false;
    }, isMatch ? 350 : FLIP_BACK_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [deck, flippedIds]);

  // PUBLIC_INTERFACE
  const resetGame = () => {
    /** Resets the game state and shuffles a new deck. */
    lockRef.current = false;
    setDeck(createShuffledDeck({ pairCount: totalCards / 2 }));
    setFlippedIds([]);
    setMoves(0);
    setStatus("playing");
    setActiveIndex(0);
    setSrMessage(() => {
      srMsgSeqRef.current += 1;
      return "Game reset.";
    });
  };

  const isCardFlipped = (card) => card.isMatched || flippedIds.includes(card.id);

  const canInteract = status !== "won" && !lockRef.current && flippedIds.length < 2;

  const handleCardAction = (cardId) => {
    if (!canInteract) return;
    if (flippedIds.includes(cardId)) return;

    setFlippedIds((prev) => {
      if (prev.length >= 2) return prev;
      return [...prev, cardId];
    });
  };

  const focusCardAtIndex = (nextIndex) => {
    const clamped = Math.max(0, Math.min(deck.length - 1, nextIndex));
    setActiveIndex(clamped);
  };

  const handleCardNavigate = (index, key) => {
    const currentRow = Math.floor(index / columns);
    const currentCol = index % columns;

    let nextIndex = index;

    switch (key) {
      case "ArrowLeft":
        nextIndex = currentCol > 0 ? index - 1 : index;
        break;
      case "ArrowRight":
        nextIndex = currentCol < columns - 1 && index + 1 < deck.length ? index + 1 : index;
        break;
      case "ArrowUp":
        nextIndex = currentRow > 0 ? index - columns : index;
        break;
      case "ArrowDown":
        nextIndex = currentRow < rows - 1 && index + columns < deck.length ? index + columns : index;
        break;
      default:
        nextIndex = index;
    }

    if (nextIndex !== index) {
      focusCardAtIndex(nextIndex);
    }
  };

  const toggleTheme = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };

  return (
    <div className={["App", theme === "dark" ? "theme-dark" : ""].join(" ")}>
      <main className="mc-page">
        <section className="mc-surface" aria-label="Memory Card Match game">
          {/* aria-live region for match/mismatch/win announcements */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {srMessage}
          </div>

          <header className="mc-header">
            <div className="mc-titleBlock">
              <h1 className="mc-title">Memory Card Match</h1>
              <p className="mc-subtitle">Flip two cards at a time and find all matching pairs.</p>
            </div>

            <div className="mc-stats" aria-label="Game stats">
              <div className="mc-stat">
                <span className="mc-statLabel">Moves</span>
                <span className="mc-statValue">{moves}</span>
              </div>
              <div className="mc-stat">
                <span className="mc-statLabel">Matched</span>
                <span className="mc-statValue">
                  {matchedCount}/{totalCards}
                </span>
              </div>
            </div>

            <div className="mc-actions" aria-label="Display settings">
              <button
                type="button"
                className="mc-btn mc-btn-secondary"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
            </div>
          </header>

          {status === "won" ? (
            <div className="mc-banner mc-banner-success" role="status" aria-live="polite">
              <div className="mc-bannerText">
                <strong>You win!</strong> You matched all pairs in <strong>{moves}</strong> moves.
              </div>
              <button
                type="button"
                className="mc-btn mc-btn-primary"
                onClick={resetGame}
                aria-label="Play again"
              >
                Play again
              </button>
            </div>
          ) : (
            <div className="mc-banner mc-banner-neutral" role="status" aria-live="polite">
              <div className="mc-bannerText">Tip: Try to remember positions—each move flips two cards.</div>
              <button
                type="button"
                className="mc-btn mc-btn-secondary"
                onClick={resetGame}
                aria-label="Reset game"
              >
                Reset
              </button>
            </div>
          )}

          <section className="mc-grid" aria-label={`${GRID_SIZE} by ${GRID_SIZE} card grid`}>
            {deck.map((card, index) => (
              <MemoryCard
                key={card.id}
                card={card}
                index={index}
                totalCards={deck.length}
                isFlipped={isCardFlipped(card)}
                isMatched={card.isMatched}
                disabled={!canInteract}
                onAction={() => handleCardAction(card.id)}
                onNavigate={(key) => handleCardNavigate(index, key)}
                isActive={index === activeIndex}
                setActive={() => setActiveIndex(index)}
              />
            ))}
          </section>

          <footer className="mc-footer">
            <span className="mc-footerHint">Responsive layout: try resizing the window.</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default App;
