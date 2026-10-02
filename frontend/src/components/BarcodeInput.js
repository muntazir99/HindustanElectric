import { useCallback, useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { hasCamera } from "../lib/barcode.js";
import { lookupCode } from "../lib/lookup.js";
import { inputClass } from "../ui/index.js";
import CameraScanner from "./CameraScanner.js";

/**
 * A barcode box with a camera button (on devices with a camera): the scanned code fills the box. If another
 * item already has that code it says which, because a barcode can belong to only one item or pack.
 * Takes the same value / onChange(event) as a normal input; other props go to the input.
 */
export default function BarcodeInput({ value, onChange, className = "", ...props }) {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [usedBy, setUsedBy] = useState("");

  useEffect(() => {
    let current = true;
    hasCamera().then((yes) => current && setAvailable(yes));
    return () => {
      current = false;
    };
  }, []);

  const close = useCallback(() => setOpen(false), []);

  async function onCode(code) {
    onChange({ target: { value: code } });
    close();
    try {
      const found = await lookupCode(code);
      setUsedBy(found ? found.item.name : "");
    } catch {
      setUsedBy("");
    }
  }

  return (
    <div>
      <div className="relative">
        <input
          autoComplete="off"
          {...props}
          className={`${inputClass} ${className} ${available ? "pr-11" : ""}`}
          value={value}
          onChange={(event) => {
            setUsedBy("");
            onChange(event);
          }}
        />
        {available && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Scan barcode with camera"
            title="Scan with camera"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-md text-steel-800 hover:bg-steel-50"
          >
            <Camera size={20} />
          </button>
        )}
      </div>
      {usedBy && <p className="text-sm text-amber-800 mt-1">Already used by {usedBy}</p>}
      {open && <CameraScanner onCode={onCode} onClose={close} />}
    </div>
  );
}
