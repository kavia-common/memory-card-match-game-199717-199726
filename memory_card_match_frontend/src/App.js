import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import MemoryCard from "./components/MemoryCard";
import { createShuffledDeck } from "./utils/gameUtils";
import { soundManager } from "./utils/soundManager";

const GRID_SIZE = 4; // 4x4 grid => 16 cards => 8 pairs
const FLIP_BACK_DELAY_MS = 800;

const THEME_STORAGE_KEY = "mc-theme"; // "light" | "dark"
const MUTE_STORAGE_KEY = "mc-muted"; // "true" | "false"
const BEST_SCORE_STORAGE_KEY = "mc-best-score"; // JSON: { time, moves }

/**
 * Lightweight in-app screens to avoid introducing routing unless needed.
 * - "home": pre-game landing page
 * - "game": the existing game UI
 */
const SCREENS = {
  home: "home",
  game: "game",
};

// PUBLIC_INTERFACE
function App() {
  /** Main entry component for the Memory Card Match game app (Home + Game screens). */
  const [screen, setScreen] = useState(SCREENS.home);

  // Home UI state (placeholder only; not used by game yet)
  const [difficulty, setDifficulty] = useState("normal"); // easy | normal | hard (placeholder)

  // Focus management for accessibility
  const playButtonRef = useRef(null);

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

  // Sound preference: default to sound on (false), use localStorage if present.
  const [isMuted, setIsMuted] = useState(() => {
    const stored = window.localStorage.getItem(MUTE_STORAGE_KEY);
    return stored === "true";
  });

  // Roving focus for keyboard arrow navigation across the grid.
  const [activeIndex, setActiveIndex] = useState(0);

  // Timer state: elapsed time in seconds, whether timer is running, and start timestamp
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerStartRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Best score from localStorage
  const [bestScore, setBestScore] = useState(() => {
    const stored = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  const matchedCount = useMemo(() => deck.filter((c) => c.isMatched).length, [deck]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const totalCards = GRID_SIZE * GRID_SIZE;
  const allMatched = matchedCount === totalCards;

  const columns = GRID_SIZE;
  const rows = Math.ceil(deck.length / columns);

  // Sync theme to local storage
  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Sync mute state to local storage and sound manager
  useEffect(() => {
    soundManager.setMuted(isMuted);
    window.localStorage.setItem(MUTE_STORAGE_KEY, String(isMuted));
  }, [isMuted]);

  // Focus Play button when arriving on home screen
  useEffect(() => {
    if (screen === SCREENS.home && playButtonRef.current) {
      playButtonRef.current.focus();
    }
  }, [screen]);

  // Timer interval: update elapsed time every second when running
  useEffect(() => {
    if (!timerRunning) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      if (timerStartRef.current) {
        const now = Date.now();
        const elapsed = Math.floor((now - timerStartRef.current) / 1000);
        setElapsedTime(elapsed);
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerRunning]);

  useEffect(() => {
    // Handle game win state, sound, and timer stop
    if (allMatched && status !== "won") {
      setStatus("won");
      setTimerRunning(false);
      soundManager.play("win");

      // Check and update best score
      const currentScore = { time: elapsedTime, moves };
      let isNewBest = false;

      if (!bestScore) {
        isNewBest = true;
      } else {
        // Best is determined by time first, then moves as tiebreaker
        if (
          elapsedTime < bestScore.time ||
          (elapsedTime === bestScore.time && moves < bestScore.moves)
        ) {
          isNewBest = true;
        }
      }

      if (isNewBest) {
        setBestScore(currentScore);
        window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, JSON.stringify(currentScore));
      }
    }
  }, [allMatched, status, elapsedTime, moves, bestScore]);

  useEffect(() => {
    if (status === "won") {
      setSrMessage(
        `You win! You matched all pairs in ${moves} moves and ${formatTime(elapsedTime)}.`
      );
    }
  }, [moves, status, elapsedTime]);

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

    // Play sound immediately upon reveal result
    soundManager.play(isMatch ? "match" : "mismatch");

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
        setDeck((prev) =>
          prev.map((c) => (c.pairId === a.pairId ? { ...c, isMatched: true } : c))
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
    setActiveIndex(0);
    setElapsedTime(0);
    setTimerRunning(false);
    timerStartRef.current = null;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setSrMessage(() => {
      srMsgSeqRef.current += 1;
      return "Game reset.";
    });
  };

  // PUBLIC_INTERFACE
  const startGame = () => {
    /** Starts a new game session and navigates from Home to Game. */
    // Ensure any browser audio policies are satisfied by user gesture.
    soundManager.init();
    resetGame();
    setScreen(SCREENS.game);

    // Announce navigation for SR users.
    setSrMessage(() => {
      srMsgSeqRef.current += 1;
      return "Game started. Flip two cards at a time to find matching pairs.";
    });
  };

  // PUBLIC_INTERFACE
  const goHome = () => {
    /** Navigates back to the Home screen; stops timer and clears live announcements. */
    setTimerRunning(false);
    setScreen(SCREENS.home);
    setSrMessage(() => {
      srMsgSeqRef.current += 1;
      return "Returned to home screen.";
    });
  };

  const isCardFlipped = (card) => card.isMatched || flippedIds.includes(card.id);

  const canInteract = status !== "won" && !lockRef.current && flippedIds.length < 2;

  const handleCardAction = (cardId) => {
    if (!canInteract) return;
    if (flippedIds.includes(cardId)) return;

    // Start timer on first flip
    if (!timerRunning && flippedIds.length === 0 && moves === 0) {
      timerStartRef.current = Date.now();
      setTimerRunning(true);
      setElapsedTime(0);
    }

    // Trigger sound on flip
    soundManager.play("flip");

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

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const SettingsControls = () => (
    <div className="mc-actions" aria-label="Display settings">
      <button
        type="button"
        className="mc-btn mc-btn-secondary"
        onClick={toggleMute}
        aria-label={isMuted ? "Unmute sounds" : "Mute sounds"}
        aria-pressed={isMuted}
      >
        {isMuted ? "Unmute" : "Mute"}
      </button>

      <button
        type="button"
        className="mc-btn mc-btn-secondary"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
    </div>
  );

  return (
    <div className={["App", theme === "dark" ? "theme-dark" : ""].join(" ")}>
      <main className="mc-page">
        <section className="mc-surface" aria-label="Memory Card Match app">
          {/* aria-live region for match/mismatch/win announcements + navigation announcements */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {srMessage}
          </div>

          {screen === SCREENS.home ? (
            <>
              <header className="mc-header">
                <div className="mc-titleBlock">
                  <h1 className="mc-title">Memory Card Match</h1>
                  <p className="mc-subtitle">
                    Find all pairs with the fewest moves and the fastest time.
                  </p>
                </div>

                <SettingsControls />
              </header>

              <section className="mc-home" aria-label="Home screen">
                <div className="mc-homeHero">
                  <h2 className="mc-homeTitle">Ready to play?</h2>
                  <p className="mc-homeLead">
                    Flip two cards at a time. If they match, they stay revealed.
                  </p>

                  <div className="mc-homePrimaryActions" aria-label="Start actions">
                    <button
                      ref={playButtonRef}
                      type="button"
                      className="mc-btn mc-btn-primary mc-btn-large"
                      onClick={startGame}
                      aria-label="Start game"
                    >
                      Play
                    </button>

                    <button
                      type="button"
                      className="mc-btn mc-btn-secondary"
                      onClick={() => {
                        // This is a placeholder; do not implement difficulty logic yet.
                        setSrMessage(() => {
                          srMsgSeqRef.current += 1;
                          return "Difficulty selection is a placeholder and does not change gameplay yet.";
                        });
                      }}
                      aria-label="About difficulty (placeholder)"
                    >
                      Difficulty: {difficulty}
                    </button>
                  </div>
                </div>

                <div className="mc-homePanel" aria-label="Quick controls">
                  <div className="mc-homePanelHeader">
                    <h3 className="mc-homePanelTitle">Quick settings</h3>
                    <p className="mc-homePanelSubtitle">
                      Difficulty is a placeholder (not applied to the game yet).
                    </p>
                  </div>

                  <fieldset className="mc-homeFieldset" aria-label="Difficulty selection">
                    <legend className="sr-only">Difficulty (placeholder)</legend>

                    <label className="mc-radio">
                      <input
                        type="radio"
                        name="difficulty"
                        value="easy"
                        checked={difficulty === "easy"}
                        onChange={(e) => setDifficulty(e.target.value)}
                      />
                      <span className="mc-radioLabel">Easy</span>
                    </label>

                    <label className="mc-radio">
                      <input
                        type="radio"
                        name="difficulty"
                        value="normal"
                        checked={difficulty === "normal"}
                        onChange={(e) => setDifficulty(e.target.value)}
                      />
                      <span className="mc-radioLabel">Normal</span>
                    </label>

                    <label className="mc-radio">
                      <input
                        type="radio"
                        name="difficulty"
                        value="hard"
                        checked={difficulty === "hard"}
                        onChange={(e) => setDifficulty(e.target.value)}
                      />
                      <span className="mc-radioLabel">Hard</span>
                    </label>
                  </fieldset>

                  <div className="mc-homeMeta" aria-label="Stats preview">
                    <div className="mc-homeMetaItem">
                      <span className="mc-homeMetaLabel">Best</span>
                      <span className="mc-homeMetaValue">
                        {bestScore ? `${formatTime(bestScore.time)} • ${bestScore.moves} moves` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <footer className="mc-footer">
                <span className="mc-footerHint">Tip: You can use keyboard arrows in the game grid.</span>
              </footer>
            </>
          ) : (
            <>
              <header className="mc-header">
                <div className="mc-titleBlock">
                  <h1 className="mc-title">Memory Card Match</h1>
                  <p className="mc-subtitle">Flip two cards at a time and find all matching pairs.</p>
                </div>

                <dl className="mc-stats" aria-label="Game stats">
                  <div className="mc-stat">
                    <dt className="mc-statLabel">Time</dt>
                    <dd className="mc-statValue">{formatTime(elapsedTime)}</dd>
                  </div>

                  <div className="mc-stat">
                    <dt className="mc-statLabel">Moves</dt>
                    <dd className="mc-statValue">{moves}</dd>
                  </div>

                  <div className="mc-stat">
                    <dt className="mc-statLabel">Matched</dt>
                    <dd className="mc-statValue">
                      {matchedCount}/{totalCards}
                    </dd>
                  </div>
                </dl>

                <div className="mc-actions" aria-label="Top actions">
                  <button
                    type="button"
                    className="mc-btn mc-btn-secondary"
                    onClick={goHome}
                    aria-label="Back to home"
                  >
                    Home
                  </button>
                  <SettingsControls />
                </div>
              </header>

              {status === "won" ? (
                <section
                  className="mc-banner mc-banner-success mc-banner-win"
                  role="status"
                  aria-live="polite"
                  aria-label="Win message"
                >
                  <div className="mc-bannerWinContent">
                    <div className="mc-bannerWinTitleRow">
                      <span className="mc-bannerIcon" aria-hidden="true">
                        🏆
                      </span>
                      <div className="mc-bannerWinTitleBlock">
                        <h2 className="mc-bannerTitle">You win!</h2>
                        <p className="mc-bannerLead">
                          Final score: <strong>{moves}</strong> moves in{" "}
                          <strong>{formatTime(elapsedTime)}</strong>.
                        </p>
                      </div>
                    </div>

                    <dl className="mc-bannerStats" aria-label="Final stats">
                      <div className="mc-bannerStat">
                        <dt className="mc-bannerStatLabel">Moves</dt>
                        <dd className="mc-bannerStatValue">{moves}</dd>
                      </div>
                      <div className="mc-bannerStat">
                        <dt className="mc-bannerStatLabel">Time</dt>
                        <dd className="mc-bannerStatValue">{formatTime(elapsedTime)}</dd>
                      </div>
                      <div className="mc-bannerStat">
                        <dt className="mc-bannerStatLabel">Matched</dt>
                        <dd className="mc-bannerStatValue">
                          {matchedCount}/{totalCards}
                        </dd>
                      </div>
                    </dl>

                    <div className="mc-bannerBest" aria-label="Best score">
                      {bestScore ? (
                        <>
                          <span className="mc-bannerBestLabel">Best</span>
                          <span className="mc-bannerBestValue">
                            {formatTime(bestScore.time)} • {bestScore.moves} moves
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="mc-bannerBestLabel">Best</span>
                          <span className="mc-bannerBestValue">—</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mc-bannerActions" aria-label="Win actions">
                    <button
                      type="button"
                      className="mc-btn mc-btn-primary"
                      onClick={resetGame}
                      aria-label="Play again"
                    >
                      Play again
                    </button>
                  </div>
                </section>
              ) : (
                <section
                  className="mc-banner mc-banner-neutral"
                  role="status"
                  aria-live="polite"
                  aria-label="Game tip"
                >
                  <div className="mc-bannerText">
                    Tip: Try to remember positions—each move flips two cards.
                  </div>
                  <button
                    type="button"
                    className="mc-btn mc-btn-secondary"
                    onClick={resetGame}
                    aria-label="Reset game"
                  >
                    Reset
                  </button>
                </section>
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
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
