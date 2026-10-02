import { useEffect, useRef, useState } from "react";
import { Flashlight, FlashlightOff, X } from "lucide-react";
import { cameraProblem, getDetector, scanGate } from "../lib/barcode.js";

/**
 * Full-screen camera view that reads barcodes and QR codes with the phone's back camera.
 * Calls onCode(text) once per new code and keeps reading, so items can be scanned one after another;
 * the parent closes it. `status` ({tone, text}) shows what the last scan did.
 */
export default function CameraScanner({ onCode, onClose, status }) {
  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const onCodeRef = useRef(onCode);
  const [problem, setProblem] = useState("");
  const [starting, setStarting] = useState(true);
  const [torch, setTorch] = useState(null); // null: this camera has no light

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let stopped = false;
    let stream = null;
    let timer = null;
    const gate = scanGate();

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no camera API"), { name: "SecurityError" });
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        if (track.getCapabilities?.().torch) setTorch(false);
        const detector = await getDetector();
        if (stopped) return;
        setStarting(false);

        const read = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2) {
              const found = await detector.detect(video);
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
  }, []);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function toggleTorch() {
    try {
      await trackRef.current.applyConstraints({ advanced: [{ torch: !torch }] });
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  }

  const tone = { ok: "bg-green-700", warn: "bg-amber-600", error: "bg-red-700" };

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan with camera" className="fixed inset-0 z-[60] bg-black text-white flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-black/70">
        <p className="font-semibold">Point the camera at a barcode or QR code</p>
        <button type="button" onClick={onClose} aria-label="Close camera" className="shrink-0 w-12 h-12 flex items-center justify-center rounded-lg hover:bg-white/10">
          <X size={28} />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
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
        <div className="flex gap-3">
          {torch !== null && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-pressed={torch}
              className="h-14 px-5 rounded-lg border border-white/40 flex items-center gap-2 font-semibold"
            >
              {torch ? <FlashlightOff size={22} /> : <Flashlight size={22} />} Light
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
