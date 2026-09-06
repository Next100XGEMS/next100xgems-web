import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function SmokeComponent() {
  return <p>Vitest is configured.</p>;
}

describe("Vitest foundation", () => {
  it("renders a synchronous React component in jsdom", () => {
    render(<SmokeComponent />);

    expect(screen.getByText("Vitest is configured.")).toBeTruthy();
  });
});
