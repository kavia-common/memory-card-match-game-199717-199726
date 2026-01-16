import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders game title", () => {
  render(<App />);
  const title = screen.getByRole("heading", { name: /memory card match/i });
  expect(title).toBeInTheDocument();
});

test("renders theme toggle button with accessible label", () => {
  render(<App />);
  const toggle = screen.getByRole("button", { name: /switch to (dark|light) mode/i });
  expect(toggle).toBeInTheDocument();
});

test("renders face-down cards with accessible names", () => {
  render(<App />);
  // At start, all cards should be face down and expose generic accessible name (no emoji leakage).
  const faceDown = screen.getAllByRole("button", { name: /card face down, card \d+ of \d+/i });
  expect(faceDown.length).toBeGreaterThan(0);
});
