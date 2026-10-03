import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());
vi.mock("../api.js", () => ({ default: { post } }));

import Help, { HelpProvider, screenOf, splitSteps, unwrap } from "./Help.js";

describe("reading an answer", () => {
  it("splits it into intro, numbered steps and what follows", () => {
    const { intro, steps, outro } = splitSteps("Estimate ke liye:\n1. **New Bill** kholiye.\n2. **Make estimate**\n   dabaiye.\n\nStock nahi badalta.");
    expect(intro).toBe("Estimate ke liye:");
    expect(steps).toEqual(["**New Bill** kholiye.", "**Make estimate** dabaiye."]);
    expect(outro).toBe("Stock nahi badalta.");
  });

  it("knows which screen a step names", () => {
    expect(screenOf("Press the green **New Bill**.")).toEqual({ name: "New Bill", to: "/billing" });
    expect(screenOf("Press **Make estimate**.")).toBeNull();
  });

  it("unwrap joins the handbook's wrapped lines, keeping steps, points and labels apart", () => {
    const text = "**Who:** owner.\n1. Press **Take Payment**, or open the customer and press\n   **Take Payment**.\n2. Enter the amount.\n- A point that wraps\n  onto two lines.\n\nGood to know: a long sentence\nthat wraps.";
    expect(unwrap(text)).toBe(
      "**Who:** owner.\n1. Press **Take Payment**, or open the customer and press **Take Payment**.\n2. Enter the amount.\n- A point that wraps onto two lines.\n\nGood to know: a long sentence that wraps."
    );
  });
});

function shop({ wide }) {
  // The test browser says 1024 px; say plainly whether this is a phone or a counter PC.
  window.matchMedia = vi.fn(() => ({ matches: wide, addEventListener() {}, removeEventListener() {} }));
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <HelpProvider>
        <main>
          <Routes>
            <Route path="/dashboard" element={<h1>Home page</h1>} />
            <Route
              path="/billing"
              element={
                <>
                  <h1>New Bill page</h1>
                  <button type="button">Make estimate</button>
                </>
              }
            />
          </Routes>
        </main>
        <Help />
      </HelpProvider>
    </MemoryRouter>
  );
}

describe("Help follows you around the app (phone)", () => {
  it("keeps the conversation, tracks the step and points at the button", async () => {
    post.mockResolvedValue({
      data: {
        source: "ai",
        answer: "Estimate ke liye:\n1. **New Bill** kholiye.\n2. **Make estimate** dabaiye.\n3. Print ke liye khulega.",
        topics: [],
      },
    });
    shop({ wide: false });
    fireEvent.click(screen.getByRole("button", { name: /Help/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your question" }), { target: { value: "estimate kaise banaye" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ask" })));
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();

    // "Open New Bill" changes the page; the conversation stays and knows where you are.
    await act(async () => fireEvent.click(screen.getByRole("link", { name: /Open New Bill/ })));
    expect(screen.getByText("New Bill page")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Help" }));
    // The question is still there: in the conversation, and as the title of the steps being followed.
    expect(screen.getAllByText("estimate kaise banaye")).toHaveLength(2);
    expect(screen.getByText("You're here")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done, next step" }));
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show me" }));
    expect(screen.getByRole("button", { name: "Make estimate" })).toHaveAttribute("data-help-spot", "Step 2");

    // Phones drop to a one-line step bar while you follow along.
    fireEvent.click(screen.getByRole("button", { name: "Follow these steps" }));
    expect(screen.getByRole("region", { name: "Help steps" })).toHaveTextContent("Step 2 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("region", { name: "Help steps" })).toHaveTextContent("Step 3 of 3");
  });

  it("without the assistant, follows the closest handbook topic's steps", async () => {
    post.mockResolvedValue({
      data: { source: "handbook", answer: null, topics: [{ id: "B14", title: "B14. Cancel a bill", text: "### B14. Cancel a bill\n1. Open the bill.\n2. Press **Cancel bill**." }] },
    });
    shop({ wide: false });
    fireEvent.click(screen.getByRole("button", { name: /Help/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your question" }), { target: { value: "bill cancel" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ask" })));
    expect(screen.getByText("From the handbook:")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(screen.getByText("Cancel bill").tagName).toBe("B");
  });
});

describe("On the counter PC, Help stays docked while you work", () => {
  it("opening a step's screen keeps the panel open beside it", async () => {
    post.mockResolvedValue({ data: { source: "ai", answer: "1. **New Bill** kholiye.\n2. **Make estimate** dabaiye.", topics: [] } });
    shop({ wide: true });
    fireEvent.click(screen.getByRole("button", { name: /Help/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your question" }), { target: { value: "estimate" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ask" })));
    await act(async () => fireEvent.click(screen.getByRole("link", { name: /Open New Bill/ })));
    expect(screen.getByText("New Bill page")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Help" })).toBeInTheDocument();
    expect(screen.getByText("You're here")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Follow these steps" })).not.toBeInTheDocument();
  });
});

describe("works in today's Chrome", () => {
  it("doesn't break when scrollIntoView returns a promise (as Chrome's does)", async () => {
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = () => Promise.resolve();
    try {
      post.mockResolvedValue({ data: { source: "ai", answer: "1. **New Bill** kholiye.", topics: [] } });
      const { unmount } = shop({ wide: true });
      fireEvent.click(screen.getByRole("button", { name: /Help/ }));
      fireEvent.change(screen.getByRole("textbox", { name: "Your question" }), { target: { value: "bill" } });
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ask" })));
      fireEvent.click(screen.getByRole("button", { name: "Close Help" }));
      expect(() => unmount()).not.toThrow();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});
