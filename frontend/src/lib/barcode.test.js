import { afterEach, describe, expect, it, vi } from "vitest";
import { cameraProblem, hasCamera, scanGate } from "./barcode.js";

describe("scanGate: one code counts once while the camera stays on it", () => {
  it("lets a new code through, then ignores it while it stays in view", () => {
    const gate = scanGate(1500);
    expect(gate("8901234567890", 0)).toBe(true);
    // Read again and again while held in front of the camera: never counted twice.
    expect(gate("8901234567890", 100)).toBe(false);
    expect(gate("8901234567890", 1400)).toBe(false);
    expect(gate("8901234567890", 2800)).toBe(false);
  });

  it("counts the same code again after it was out of view for the gap", () => {
    const gate = scanGate(1500);
    expect(gate("8901234567890", 0)).toBe(true);
    expect(gate("8901234567890", 1600)).toBe(true);
  });

  it("counts a different code straight away", () => {
    const gate = scanGate(1500);
    expect(gate("8901234567890", 0)).toBe(true);
    expect(gate("8906543210987", 50)).toBe(true);
    expect(gate("8901234567890", 100)).toBe(true);
  });
});

describe("hasCamera", () => {
  const original = { mediaDevices: navigator.mediaDevices, secure: globalThis.isSecureContext };
  const devices = (list) => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { enumerateDevices: vi.fn().mockResolvedValue(list) },
    });
  };
  const secure = (value) => Object.defineProperty(globalThis, "isSecureContext", { configurable: true, value });

  afterEach(() => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: original.mediaDevices });
    secure(original.secure);
  });

  it("is true on a phone with a camera, over https", async () => {
    secure(true);
    devices([{ kind: "audioinput" }, { kind: "videoinput" }]);
    expect(await hasCamera()).toBe(true);
  });

  it("is false on a counter PC without a camera", async () => {
    secure(true);
    devices([{ kind: "audioinput" }, { kind: "audiooutput" }]);
    expect(await hasCamera()).toBe(false);
  });

  it("is false without https, where browsers block the camera", async () => {
    secure(false);
    devices([{ kind: "videoinput" }]);
    expect(await hasCamera()).toBe(false);
  });
});

describe("cameraProblem explains why the camera didn't start", () => {
  it.each([
    ["NotAllowedError", "isn't allowed"],
    ["NotFoundError", "No camera"],
    ["NotReadableError", "another app"],
    ["SomethingElse", "couldn't start"],
  ])("%s", (name, words) => {
    expect(cameraProblem({ name })).toContain(words);
  });
});
