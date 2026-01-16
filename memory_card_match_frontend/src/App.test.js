import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders game title", () => {
  render(<App />);
  const title = screen.getByRole("heading", { name: /memory card match/i });
  expect(title).toBeInTheDocument();
});
