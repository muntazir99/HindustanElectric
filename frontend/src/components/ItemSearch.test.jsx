import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), hasCamera: vi.fn() }));
vi.mock("../api.js", () => ({ default: { get: mocks.get } }));
vi.mock("../lib/barcode.js", () => ({ hasCamera: mocks.hasCamera }));
// The real camera view needs a camera; this stand-in "reads" a code when its button is pressed.
vi.mock("./CameraScanner.js", () => ({
  default: ({ onCode, onClose, status }) => (
    <div role="dialog" aria-label="Scan with camera">
      <button type="button" onClick={() => onCode("8901234567890")}>
        read code
      </button>
      <button type="button" onClick={onClose}>
        Done
      </button>
      {status && <p role="status">{status.text}</p>}
    </div>
  ),
}));

import ItemSearch from "./ItemSearch.js";

const switchItem = { id: 7, name: "Anchor Roma 6A switch", code: "S12", units: [{ id: 70, is_base: true }] };

async function show(props = {}) {
  const onSelect = vi.fn();
  await act(async () => {
    render(<ItemSearch onSelect={onSelect} autoFocus={false} {...props} />);
  });
  return onSelect;
}

beforeEach(() => {
  mocks.get.mockReset();
  mocks.hasCamera.mockReset();
});

describe("Scanning with the phone camera", () => {
  it("shows no camera button where there is no camera (counter PC)", async () => {
    mocks.hasCamera.mockResolvedValue(false);
    await show();
    expect(screen.queryByRole("button", { name: "Scan with camera" })).not.toBeInTheDocument();
  });

  it("a scanned barcode picks the item, and the camera stays on for the next one", async () => {
    mocks.hasCamera.mockResolvedValue(true);
    mocks.get.mockResolvedValue({ data: { item: switchItem, unit_id: 71 } });
    const onSelect = await show();

    fireEvent.click(screen.getByRole("button", { name: "Scan with camera" }));
    await act(async () => fireEvent.click(screen.getByText("read code")));

    expect(mocks.get).toHaveBeenCalledWith("/catalog/lookup", { params: { code: "8901234567890" } });
    expect(onSelect).toHaveBeenCalledWith(switchItem, 71); // 71: the scanned pack (e.g. a box), not the base unit
    expect(screen.getByRole("status")).toHaveTextContent("Anchor Roma 6A switch");
    expect(screen.getByRole("dialog", { name: "Scan with camera" })).toBeInTheDocument();
  });

  it("closes after one item where only one is picked (e.g. Fix Stock)", async () => {
    mocks.hasCamera.mockResolvedValue(true);
    mocks.get.mockResolvedValue({ data: { item: switchItem, unit_id: 70 } });
    const onSelect = await show({ cameraKeepsOpen: false });

    fireEvent.click(screen.getByRole("button", { name: "Scan with camera" }));
    await act(async () => fireEvent.click(screen.getByText("read code")));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Scan with camera" })).not.toBeInTheDocument();
  });

  it("an unknown barcode says so and picks nothing", async () => {
    mocks.hasCamera.mockResolvedValue(true);
    mocks.get.mockRejectedValue({ response: { status: 404 } });
    const onSelect = await show();

    fireEvent.click(screen.getByRole("button", { name: "Scan with camera" }));
    await act(async () => fireEvent.click(screen.getByText("read code")));

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("No item has the code 8901234567890");
  });
});

describe("A USB scanner still works as before", () => {
  it("typing a code and pressing Enter picks the exact match", async () => {
    mocks.hasCamera.mockResolvedValue(false);
    mocks.get.mockResolvedValue({ data: { item: switchItem, unit_id: 70 } });
    const onSelect = await show();
    const box = screen.getByRole("textbox", { name: "Find item" });

    fireEvent.change(box, { target: { value: "S12" } });
    await act(async () => fireEvent.keyDown(box, { key: "Enter" }));

    expect(mocks.get).toHaveBeenCalledWith("/catalog/lookup", { params: { code: "S12" } });
    expect(onSelect).toHaveBeenCalledWith(switchItem, 70);
  });
});
