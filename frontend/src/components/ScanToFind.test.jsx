import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), hasCamera: vi.fn() }));
vi.mock("../api.js", () => ({ default: { get: mocks.get } }));
vi.mock("../lib/barcode.js", () => ({ hasCamera: mocks.hasCamera }));
// Stand-in for the camera: "reads" a code when its button is pressed.
vi.mock("./CameraScanner.js", () => ({
  default: ({ onCode, status }) => (
    <div role="dialog" aria-label="Scan with camera">
      <button type="button" onClick={() => onCode("8901000000118")}>
        read code
      </button>
      {status && <p role="status">{status.text}</p>}
    </div>
  ),
}));

import ScanToFind from "./ScanToFind.js";

async function show() {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<ScanToFind />} />
          <Route path="/items/:id" element={<p>Item page</p>} />
        </Routes>
      </MemoryRouter>
    );
  });
}

beforeEach(() => {
  mocks.get.mockReset();
  mocks.hasCamera.mockReset();
});

describe("Scan an item to see its details", () => {
  it("isn't shown without a camera", async () => {
    mocks.hasCamera.mockResolvedValue(false);
    await show();
    expect(screen.queryByRole("button", { name: /Scan an item/ })).not.toBeInTheDocument();
  });

  it("opens the scanned item's page", async () => {
    mocks.hasCamera.mockResolvedValue(true);
    mocks.get.mockResolvedValue({ data: { item: { id: 38, name: "Havells SP MCB" }, unit_id: 1 } });
    await show();

    fireEvent.click(screen.getByRole("button", { name: /Scan an item/ }));
    await act(async () => fireEvent.click(screen.getByText("read code")));

    expect(mocks.get).toHaveBeenCalledWith("/catalog/lookup", { params: { code: "8901000000118" } });
    expect(screen.getByText("Item page")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says so when no item has the code, and keeps the camera on", async () => {
    mocks.hasCamera.mockResolvedValue(true);
    mocks.get.mockRejectedValue({ response: { status: 404 } });
    await show();

    fireEvent.click(screen.getByRole("button", { name: /Scan an item/ }));
    await act(async () => fireEvent.click(screen.getByText("read code")));

    expect(screen.getByRole("status")).toHaveTextContent("No item has the code 8901000000118");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
