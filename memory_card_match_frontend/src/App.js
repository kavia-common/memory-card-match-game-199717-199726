import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import MemoryCard from "./components/MemoryCard";
import { createShuffledDeck } from "./utils/gameUtils";

const GRID_SIZE = 4; // 4x4 grid => 16 cards => 8 pairs
const FLIP_BACK_DELAY_MS = 800;

// PUBLIC_INTERFACE
function App() {
  /** Main entry component for the Memory Card Match game. */
  const [deck, setDeck] = useState(() => createShuffledDeck({ pairCount: (GRID_SIZE * GRID_SIZE) / 2 }));
  const [flippedIds, setFlippedIds] = useState([]); // holds up to 2 ids
  const [moves, setMoves] = useState(0);
  const [status, setStatus] = useState("playing"); // playing | won
  const lockRef = useRef(false); // prevents clicks while resolving two flipped cards

  const matchedCount = useMemo(
    () => deck.filter((c) => c.isMatched).length,
    [deck]
  );

  const totalCards = GRID_SIZE * GRID_SIZE;
  const allMatched = matchedCount === totalCards;

  useEffect(() => {
    if (allMatched) setStatus("won");
  }, [allMatched]);

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

    const timer = window.setTimeout(() => {
      if (isMatch) {
        setDeck((prev) =>
          prev.map((c) =>
            c.pairId === a.pairId ? { ...c, isMatched: true } : c
          )
        );
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
  };

  const isCardFlipped = (card) => card.isMatched || flippedIds.includes(card.id);

  const canInteract = status !== "won" && !lockRef.current && flippedIds.length < 2;

  const handleCardClick = (cardId) => {
    if (!canInteract) return;
    if (flippedIds.includes(cardId)) return;

    setFlippedIds((prev) => {
      if (prev.length >= 2) return prev;
      return [...prev, cardId];
    });
  };

  return (
    <div className="App">
      <main className="mc-page">
        <section className="mc-surface" aria-label="Memory Card Match game">
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
          </header>

          {status === "won" ? (
            <div className="mc-banner mc-banner-success" role="status" aria-live="polite">
              <div className="mc-bannerText">
                <strong>You win!</strong> You matched all pairs in <strong>{moves}</strong> moves.
              </div>
              <button type="button" className="mc-btn mc-btn-primary" onClick={resetGame}>
                Play again
              </button>
            </div>
          ) : (
            <div className="mc-banner mc-banner-neutral" role="status" aria-live="polite">
              <div className="mc-bannerText">
                Tip: Try to remember positions—each move flips two cards.
              </div>
              <button type="button" className="mc-btn mc-btn-secondary" onClick={resetGame}>
                Reset
              </button>
            </div>
          )}

          <section
            className="mc-grid"
            aria-label={`${GRID_SIZE} by ${GRID_SIZE} card grid`}
          >
            {deck.map((card) => (
              <MemoryCard
                key={card.id}
                card={card}
                isFlipped={isCardFlipped(card)}
                isMatched={card.isMatched}
                disabled={!canInteract}
                onClick={() => handleCardClick(card.id)}
              />
            ))}
          </section>

          <footer className="mc-footer">
            <span className="mc-footerHint">
              Responsive layout: try resizing the window.
            </span>
          </footer>
        </section>
      </main>
    </div>
  );
}

export default App;
