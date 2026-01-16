import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

test("renders home screen title", () => {
  render(<App />);
  const title = screen.getByRole("heading", { name: /memory card match/i });
  expect(title).toBeInTheDocument();
});

test("renders Play button on home screen", () => {
  render(<App />);
  const play = screen.getByRole("button", { name: /start game/i });
  expect(play).toBeInTheDocument();
});

test("renders theme toggle button with accessible label on home screen", () => {
  render(<App />);
  const toggle = screen.getByRole("button", { name: /switch to (dark|light) mode/i });
  expect(toggle).toBeInTheDocument();
});

test("starts game when Play is activated and shows face-down cards", async () => {
  const user = userEvent.setup();
  render(<App />);

  const play = screen.getByRole("button", { name: /start game/i });
  await user.click(play);

  // After starting, cards should be present and expose generic accessible name (no emoji leakage).
  const faceDown = await screen.findAllByRole("button", { name: /card face down, card \d+ of \d+/i });
  expect(faceDown.length).toBeGreaterThan(0);
});

test("renders timer stat element in game screen after starting", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /start game/i }));

  // Time appears as a stat label in the header; ensure it's present.
  const timeLabel = await screen.findByText(/^time$/i);
  expect(timeLabel).toBeInTheDocument();
});
