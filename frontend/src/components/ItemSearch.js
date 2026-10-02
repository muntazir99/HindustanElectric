import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import api from "../api.js";
import { money } from "../lib/format.js";
import { errorMessage } from "../lib/errors.js";

/**
 * Search box for picking an item. Works with a USB barcode scanner (which types the
 * code and presses Enter) as well as typing a name.
 * onSelect(item, unitId) — unitId is the scanned pack's unit, or the base unit.
 */
export default function ItemSearch({
  onSelect,
  placeholder = "Scan the barcode, or type the item name",
  autoFocus = true,
  label = "Find item",
  compact = false,
  tone = "light",
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [highlight, setHighlight] = useState(0);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const latest = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults([]);
      return undefined;
    }
    const request = ++latest.current;
    const timer = setTimeout(async () => {
      try {
        const response = await api.get("/catalog/items", { params: { search: text, page_size: 8 } });
        if (request === latest.current) {
          setResults(response.data.results);
          setHighlight(0);
          setOpen(true);
        }
      } catch (err) {
        if (request === latest.current) setMessage(errorMessage(err));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function choose(item, unitId) {
    latest.current += 1; // drop any search still in flight
    setQuery("");
    setResults([]);
    setOpen(false);
    setMessage("");
    onSelect(item, unitId ?? item.units.find((unit) => unit.is_base)?.id);
    inputRef.current?.focus();
  }

  async function onKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((index) => Math.max(index - 1, 0));
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const text = query.trim();
      if (!text) return;
      // A single word may be a barcode or item code: try an exact match first.
      if (!/\s/.test(text)) {
        try {
          const response = await api.get("/catalog/lookup", { params: { code: text } });
          choose(response.data.item, response.data.unit_id);
          return;
        } catch (err) {
          if (err.response?.status !== 404) {
            setMessage(errorMessage(err));
            return;
          }
        }
      }
      if (results[highlight]) {
        choose(results[highlight]);
      } else {
        setMessage(`Nothing found for "${text}".`);
      }
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <ScanLine
          className={`absolute left-3 top-1/2 -translate-y-1/2 ${tone === "dark" ? "text-steel-200" : "text-gray-500"}`}
          size={compact ? 20 : 24}
        />
        <input
          ref={inputRef}
          className={
            tone === "dark"
              ? "w-full h-11 pl-10 pr-3 rounded-lg border border-transparent bg-steel-700 text-white placeholder:text-steel-200 focus:bg-white focus:text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
              : compact
                ? "w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-300 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-steel-700"
                : "w-full pl-12 pr-3 py-4 text-xl rounded-[10px] border-2 border-steel-800 bg-white focus:outline-none focus:ring-2 focus:ring-steel-700"
          }
          value={query}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-label={label}
          onChange={(event) => {
            setQuery(event.target.value);
            setMessage("");
          }}
          onKeyDown={onKeyDown}
          onFocus={() => results.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {message && <p className="text-sm text-red-700 mt-1">{message}</p>}
      {open && results.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white text-gray-900 border border-line rounded-lg shadow-lg max-h-96 overflow-y-auto">
          {results.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={`w-full text-left px-4 py-2.5 flex justify-between gap-4 ${index === highlight ? "bg-steel-50" : "hover:bg-gray-50"}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(item)}
                onMouseEnter={() => setHighlight(index)}
              >
                <span>
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-gray-500 text-sm ml-2">#{item.code}</span>
                  {!item.is_active && <span className="text-red-600 text-sm ml-2">inactive</span>}
                </span>
                <span className="text-sm text-gray-600 whitespace-nowrap">
                  {item.counted_at ? item.stock_display : "stock not checked"} · {money(item.selling_price)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
