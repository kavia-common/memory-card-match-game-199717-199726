import React from "react";

/**
 * Single memory game card. Renders a button that visually flips between face-down and face-up states.
 *
 * Note: The parent (game) owns all state; this component is purely presentational.
 */
// PUBLIC_INTERFACE
export default function MemoryCard({ card, isFlipped, isMatched, onClick, disabled }) {
  /** This is a public component. */
  const isInteractable = !disabled && !isFlipped && !isMatched;

  return (
    <button
      type="button"
      className={[
        "mc-card",
        isFlipped ? "is-flipped" : "",
        isMatched ? "is-matched" : "",
      ].join(" ")}
      onClick={isInteractable ? onClick : undefined}
      disabled={!isInteractable}
      aria-label={
        isMatched
          ? `Matched card ${card.label}`
          : isFlipped
            ? `Revealed card ${card.label}`
            : "Face down card"
      }
      aria-pressed={isFlipped || isMatched}
    >
      <span className="mc-card-inner" aria-hidden="true">
        <span className="mc-card-face mc-card-front">
          <span className="mc-card-symbol">{card.symbol}</span>
        </span>
        <span className="mc-card-face mc-card-back">
          <span className="mc-card-back-dot" />
          <span className="mc-card-back-dot" />
          <span className="mc-card-back-dot" />
        </span>
      </span>
    </button>
  );
}
