import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());
vi.mock("../api.js", () => ({ default: { post } }));

import HelpButton, { unwrap } from "./HelpButton.js";

async function askHelp(question) {
  render(<HelpButton />);
  fireEvent.click(screen.getByRole("button", { name: /Help/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "Your question" }), { target: { value: question } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ask" })));
}

describe("Help panel", () => {
  it("shows the assistant's answer with button names in bold", async () => {
    post.mockResolvedValue({
      data: { source: "ai", answer: "1. **New Bill** kholo\n2. **Make estimate** dabao", topics: [{ id: "B10", title: "B10. Make an estimate", text: "…" }] },
    });
    await askHelp("estimate kaise banate hai");
    expect(post).toHaveBeenCalledWith("/help/ask", { question: "estimate kaise banate hai" });
    expect(screen.getByText("Make estimate").tagName).toBe("B");
    expect(screen.getByText("From the handbook: B10. Make an estimate")).toBeInTheDocument();
  });

  it("without the assistant, shows the closest handbook topic", async () => {
    post.mockResolvedValue({
      data: { source: "handbook", answer: null, topics: [{ id: "B14", title: "B14. Cancel a bill", text: "### B14. Cancel a bill\nPress **Cancel bill**." }] },
    });
    await askHelp("bill cancel");
    expect(screen.getByText("These parts of the handbook match your question:")).toBeInTheDocument();
    expect(screen.getByText("Cancel bill").tagName).toBe("B");
  });
});

describe("unwrap: handbook lines wrapped in the file read as whole sentences", () => {
  it("joins continuations, keeps steps, points and labels on their own lines", () => {
    const text = "**Who:** owner.\n1. Press **Take Payment**, or open the customer and press\n   **Take Payment**.\n2. Enter the amount.\n- A point that wraps\n  onto two lines.\n\nGood to know: a long sentence\nthat wraps.";
    expect(unwrap(text)).toBe(
      "**Who:** owner.\n1. Press **Take Payment**, or open the customer and press **Take Payment**.\n2. Enter the amount.\n- A point that wraps onto two lines.\n\nGood to know: a long sentence that wraps."
    );
  });
});
