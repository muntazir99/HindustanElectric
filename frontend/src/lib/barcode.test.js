import { afterEach, describe, expect, it, vi } from "vitest";
import { cameraProblem, hasCamera, pickBackCamera, scanGate, startZoom, zoomSteps } from "./barcode.js";

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

describe("pickBackCamera: the main back camera, which can focus close", () => {
  // How Chrome on a Galaxy S23 names its cameras once the camera is allowed.
  const s23 = [
    { kind: "videoinput", deviceId: "front", label: "camera2 1, facing front" },
    { kind: "videoinput", deviceId: "ultrawide", label: "camera2 2, facing back" },
    { kind: "videoinput", deviceId: "tele", label: "camera2 3, facing back" },
    { kind: "videoinput", deviceId: "main", label: "camera2 0, facing back" },
    { kind: "audioinput", deviceId: "mic", label: "Microphone" },
  ];

  it("chooses camera 0 on a phone with several back cameras", () => {
    expect(pickBackCamera(s23, null)).toBe("main");
  });

  it("keeps the camera the person chose with Switch camera", () => {
    expect(pickBackCamera(s23, "tele")).toBe("tele");
  });

  it("ignores a remembered camera that no longer exists", () => {
    expect(pickBackCamera(s23, "gone")).toBe("main");
  });

  it("leaves the choice to the browser with one back camera, or names it can't read", () => {
    expect(pickBackCamera([{ kind: "videoinput", deviceId: "b", label: "Back Camera" }], null)).toBeNull();
    expect(
      pickBackCamera(
        [
          { kind: "videoinput", deviceId: "a", label: "Back Camera" },
          { kind: "videoinput", deviceId: "b", label: "Back Ultra Wide Camera" },
        ],
        null
      )
    ).toBeNull();
  });
});

describe("zoom: start at 2x so the phone is held where it can focus", () => {
  it("offers 1x to 3x on a phone that zooms far", () => {
    const capabilities = { zoom: { min: 1, max: 10 } };
    expect(zoomSteps(capabilities)).toEqual([1, 1.5, 2, 3]);
    expect(startZoom(capabilities)).toBe(2);
  });

  it("uses the most it has when it can't reach 2x", () => {
    expect(startZoom({ zoom: { min: 1, max: 1.6 } })).toBe(1.5);
  });

  it("no zoom button where the camera can't zoom", () => {
    expect(zoomSteps({})).toEqual([]);
    expect(startZoom({ zoom: { min: 1, max: 1 } })).toBeNull();
  });
});
