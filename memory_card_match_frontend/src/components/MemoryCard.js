import React, { useEffect, useRef } from "react";

/**
 * Single memory game card. Renders a button that visually flips between face-down and face-up states.
 *
 * Accessibility notes:
 * - Uses roving tab index (only one card in the grid is tabbable) for easy arrow-key navigation.
 * - Enter/Space activates the card.
 * - Does NOT leak hidden card identity when face-down (SR label is generic + position).
 *
 * Note: The parent (game) owns all state; this component is purely presentational.
 */
// PUBLIC_INTERFACE
export default function MemoryCard({
  card,
  index,
  totalCards,
  isFlipped,
  isMatched,
  onAction,
  onNavigate,
  disabled,
  isActive,
  setActive,
}) {
  /** This is a public component. */
  const btnRef = useRef(null);

  // When this card becomes the active roving target, focus it.
  useEffect(() => {
    if (isActive && btnRef.current) {
      btnRef.current.focus();
    }
  }, [isActive]);

  const canActivate = !disabled && !isFlipped && !isMatched;

  const positionLabel = `Card ${index + 1} of ${totalCards}`;

  const accessibleName = (() => {
    if (isMatched) return `Matched card, ${positionLabel}, ${card.label}`;
    if (isFlipped) return `Revealed card, ${positionLabel}, ${card.label}`;
    return `Card face down, ${positionLabel}`;
  })();

  const handleKeyDown = (e) => {
    const { key } = e;

    if (key === "Enter" || key === " ") {
      e.preventDefault(); // prevent scrolling on Space
      if (canActivate) onAction();
      return;
    }

    if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault();
      onNavigate(key);
    }
  };

  return (
    <button
      ref={btnRef}
      type="button"
      className={["mc-card", isFlipped ? "is-flipped" : "", isMatched ? "is-matched" : ""].join(" ")}
      onClick={canActivate ? onAction : undefined}
      // Keep focusable even when temporarily disabled so arrow navigation still works.
      disabled={false}
      aria-disabled={disabled ? "true" : "false"}
      aria-label={accessibleName}
      aria-pressed={isFlipped || isMatched}
      tabIndex={isActive ? 0 : -1}
      onFocus={setActive}
      onKeyDown={handleKeyDown}
    >
      {/* Visual faces are hidden from SR; accessibleName communicates state */}
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
