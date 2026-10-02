import { useEffect, useRef, useState } from "react";
import { Flashlight, FlashlightOff, SwitchCamera, X, ZoomIn } from "lucide-react";
import { backCameras, cameraProblem, getDetector, pickBackCamera, scanGate, startZoom, zoomSteps } from "../lib/barcode.js";

const REMEMBER = "scanCamera"; // this phone's barcode camera, chosen once

function remembered() {
  try {
    return localStorage.getItem(REMEMBER);
  } catch {
    return null;
  }
}

function remember(deviceId) {
  try {
    if (deviceId) localStorage.setItem(REMEMBER, deviceId);
    else localStorage.removeItem(REMEMBER);
  } catch {
    // private window: choose again next time
  }
}

/** Ask for one camera setting; cameras that don't have it just ignore the request. */
async function setting(track, value) {
  try {
    await track.applyConstraints({ advanced: [value] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Full-screen camera view that reads barcodes and QR codes with the phone's main back camera.
 * Calls onCode(text) once per new code and keeps reading, so items can be scanned one after another;
 * the parent closes it. `status` ({tone, text}) shows what the last scan did.
 */
export default function CameraScanner({ onCode, onClose, status }) {
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const onCodeRef = useRef(onCode);
  const [cameraId, setCameraId] = useState(remembered);
  const [cameras, setCameras] = useState([]);
  const [problem, setProblem] = useState("");
  const [starting, setStarting] = useState(true);
  const [torch, setTorch] = useState(null); // null: this camera has no light
  const [zoom, setZoom] = useState(null); // { value, steps } when the camera can zoom
  const [canFocus, setCanFocus] = useState(false);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stopped = false;
    let stream = null;
    let timer = null;
    const gate = scanGate();
    setStarting(true);
    setProblem("");

    async function open() {
      const video = { width: { ideal: 1920 }, height: { ideal: 1080 } };
      if (cameraId) video.deviceId = { exact: cameraId };
      else video.facingMode = { ideal: "environment" };
      return navigator.mediaDevices.getUserMedia({ video, audio: false });
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no camera API"), { name: "SecurityError" });
        try {
          stream = await open();
        } catch (error) {
          // The remembered camera is gone (new phone, browser reset): let the browser choose again.
          if (cameraId && ["OverconstrainedError", "NotFoundError"].includes(error.name)) {
            remember(null);
            if (!stopped) setCameraId(null);
            return;
          }
          throw error;
        }
        if (stopped) return;
        const track = stream.getVideoTracks()[0];

        // Camera names are only visible once the camera is allowed, so choose the main one now.
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (stopped) return;
        setCameras(backCameras(devices));
        if (!cameraId) {
          const main = pickBackCamera(devices, null);
          if (main && main !== track.getSettings?.().deviceId) {
            remember(main);
            setCameraId(main); // this effect runs again on the main camera
            return;
          }
        }

        const videoEl = videoRef.current;
        videoEl.srcObject = stream;
        await videoEl.play();
        trackRef.current = track;

        const capabilities = track.getCapabilities?.() || {};
        const focusModes = capabilities.focusMode || [];
        if (focusModes.includes("continuous")) await setting(track, { focusMode: "continuous" });
        setCanFocus(focusModes.includes("single-shot") || focusModes.includes("continuous"));
        const firstZoom = startZoom(capabilities);
        if (firstZoom && (await setting(track, { zoom: firstZoom }))) {
          setZoom({ value: firstZoom, steps: zoomSteps(capabilities) });
        } else {
          setZoom(null);
        }
        setTorch(capabilities.torch ? false : null);

        const detector = await getDetector();
        if (stopped) return;
        setStarting(false);

        const read = async () => {
          if (stopped) return;
          try {
            if (videoEl.readyState >= 2) {
              const found = await detector.detect(videoEl);
              const code = found[0]?.rawValue?.trim();
              if (code && gate(code, Date.now()) && !stopped) {
                navigator.vibrate?.(60);
                await onCodeRef.current(code);
              }
            }
          } catch {
            // one frame that couldn't be read; try the next
          }
          if (!stopped) timer = setTimeout(read, 120);
        };
        read();
      } catch (error) {
        if (!stopped) {
          setStarting(false);
          setProblem(cameraProblem(error));
        }
      }
    }

    start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraId]);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function toggleTorch() {
    if (await setting(trackRef.current, { torch: !torch })) setTorch(!torch);
    else setTorch(null);
  }

  async function nextZoom() {
    const index = zoom.steps.indexOf(zoom.value);
    const value = zoom.steps[(index + 1) % zoom.steps.length];
    if (await setting(trackRef.current, { zoom: value })) setZoom({ ...zoom, value });
  }

  /** Tap the picture to focus there. */
  async function focusAt(event) {
    const track = trackRef.current;
    if (!canFocus || !track) return;
    const box = event.currentTarget.getBoundingClientRect();
    const point = { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
    await setting(track, { pointsOfInterest: [point] });
    if (await setting(track, { focusMode: "single-shot" })) {
      setTimeout(() => setting(track, { focusMode: "continuous" }), 1500);
    }
  }

  function switchCamera() {
    const index = cameras.findIndex((camera) => camera.deviceId === (trackRef.current?.getSettings?.().deviceId ?? cameraId));
    const next = cameras[(index + 1) % cameras.length]?.deviceId;
    if (!next) return;
    remember(next);
    setCameraId(next);
  }

  const tone = { ok: "bg-green-700", warn: "bg-amber-600", error: "bg-red-700" };
  const roundButton = "h-14 px-4 rounded-lg border border-white/40 flex items-center gap-2 font-semibold";

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan with camera" className="fixed inset-0 z-[60] bg-black text-white flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-black/70">
        <div>
          <p className="font-semibold">Point the camera at a barcode or QR code</p>
          <p className="text-sm text-white/75">Hold it 15–20 cm away{canFocus ? " · tap the picture to focus" : ""}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close camera" className="shrink-0 w-12 h-12 flex items-center justify-center rounded-lg hover:bg-white/10">
          <X size={28} />
        </button>
      </div>

      {/* Tapping the picture focuses the camera there. */}
      <div className="relative flex-1 overflow-hidden" onClick={focusAt}>
        <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        {!problem && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 max-w-[80%] h-40 rounded-xl border-4 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
        {starting && !problem && <p className="absolute inset-x-0 top-1/2 text-center text-lg">Starting the camera…</p>}
        {problem && <p className="absolute inset-x-4 top-1/3 text-center text-lg bg-black/80 rounded-xl p-4">{problem}</p>}
      </div>

      <div className="px-4 py-3 bg-black/70 space-y-3">
        {status && (
          <p role="status" className={`rounded-lg px-4 py-3 text-lg font-semibold ${tone[status.tone] || tone.ok}`}>
            {status.text}
          </p>
        )}
        <div className="flex gap-2">
          {zoom && (
            <button type="button" onClick={nextZoom} aria-label={`Zoom ${zoom.value}x, tap to change`} className={roundButton}>
              <ZoomIn size={22} /> {zoom.value}×
            </button>
          )}
          {torch !== null && (
            <button type="button" onClick={toggleTorch} aria-pressed={torch} aria-label="Light" className={roundButton}>
              {torch ? <FlashlightOff size={22} /> : <Flashlight size={22} />}
            </button>
          )}
          {cameras.length > 1 && (
            <button type="button" onClick={switchCamera} aria-label="Switch camera" className={roundButton}>
              <SwitchCamera size={22} />
            </button>
          )}
          <button type="button" onClick={onClose} className="flex-1 h-14 rounded-lg bg-white text-gray-900 text-lg font-bold">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
