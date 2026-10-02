import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScanBarcode } from "lucide-react";
import { hasCamera } from "../lib/barcode.js";
import { errorMessage } from "../lib/errors.js";
import { lookupCode } from "../lib/lookup.js";
import CameraScanner from "./CameraScanner.js";

/**
 * "Scan to see an item": a button that opens the camera and goes straight to the scanned item's page
 * (price, stock, rack, pack sizes). Shown only on devices with a camera.
 */
export default function ScanToFind({ className = "" }) {
  const navigate = useNavigate();
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let current = true;
    hasCamera().then((yes) => current && setAvailable(yes));
    return () => {
      current = false;
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setStatus(null);
  }, []);

  async function onCode(code) {
    try {
      const found = await lookupCode(code);
      if (!found) {
        setStatus({ tone: "warn", text: `No item has the code ${code}.` });
        return;
      }
      close();
      navigate(`/items/${found.item.id}`);
    } catch (err) {
      setStatus({ tone: "error", text: errorMessage(err) });
    }
  }

  if (!available) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Scan an item to see its details"
        title="Scan an item"
        className={`shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg border border-steel-500 text-white hover:bg-steel-700 ${className}`}
      >
        <ScanBarcode size={22} />
      </button>
      {open && <CameraScanner onCode={onCode} onClose={close} status={status} />}
    </>
  );
}
