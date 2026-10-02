import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), hasCamera: vi.fn() }));
vi.mock("../api.js", () => ({ default: { get: mocks.get } }));
vi.mock("../lib/barcode.js", () => ({ hasCamera: mocks.hasCamera }));
// Stand-in for the camera: "reads" a code when its button is pressed.
vi.mock("./CameraScanner.js", () => ({
  default: ({ onCode }) => (
    <div role="dialog" aria-label="Scan with camera">
      <button type="button" onClick={() => onCode("8901000000118")}>
        read code
      </button>
    </div>
  ),
}));

import BarcodeInput from "./BarcodeInput.js";

function Form() {
  const [barcode, setBarcode] = useState("");
  return <BarcodeInput aria-label="Unit barcode" value={barcode} onChange={(event) => setBarcode(event.target.value)} />;
}

async function show() {
  await act(async () => {
    render(<Form />);
  });
}

async function scan() {
  fireEvent.click(screen.getByRole("button", { name: "Scan barcode with camera" }));
  await act(async () => fireEvent.click(screen.getByText("read code")));
}

beforeEach(() => {
  mocks.get.mockReset();
  mocks.hasCamera.mockReset();
});

describe("Barcode box with the camera (Add New Item, Add pack, quick add)", () => {
  it("is a plain box where there is no camera", async () => {
    mocks.hasCamera.mockResolvedValue(false);
    await show();
    expect(screen.getByRole("textbox", { name: "Unit barcode" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Scan barcode with camera" })).not.toBeInTheDocument();
  });

  it("a scan fills the box and closes the camera", async () => {
    mocks.hasCamera.mockResolvedValue(true);
    mocks.get.mockRejectedValue({ response: { status: 404 } }); // a new barcode, not used yet
    await show();
    await scan();
    expect(screen.getByRole("textbox", { name: "Unit barcode" })).toHaveValue("8901000000118");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/Already used by/)).not.toBeInTheDocument();
  });

  it("warns when another item already has the scanned barcode", async () => {
    mocks.hasCamera.mockResolvedValue(true);
    mocks.get.mockResolvedValue({ data: { item: { id: 38, name: "Havells SP MCB C-curve 6A" }, unit_id: 1 } });
    await show();
    await scan();
    expect(screen.getByText("Already used by Havells SP MCB C-curve 6A")).toBeInTheDocument();
    // Changing the box clears the warning.
    fireEvent.change(screen.getByRole("textbox", { name: "Unit barcode" }), { target: { value: "123" } });
    expect(screen.queryByText(/Already used by/)).not.toBeInTheDocument();
  });
});
