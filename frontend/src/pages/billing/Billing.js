import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PauseCircle, Printer, RotateCcw, Trash2 } from "lucide-react";
import api from "../../api.js";
import CustomerPicker from "../../components/CustomerPicker.js";
import ItemSearch from "../../components/ItemSearch.js";
import { useAuth } from "../../context/AuthContext.js";
import { useFetch } from "../../hooks/useFetch.js";
import { errorMessage } from "../../lib/errors.js";
import { money, plain, round2 } from "../../lib/format.js";
import { HOME_STATE, STATES } from "../../lib/states.js";
import { Alert, Button, Card, NumberInput, inputClass } from "../../ui/index.js";

let nextKey = 1;

const EMPTY_HEADER = {
  customer: null,
  buyer_name: "",
  buyer_phone: "",
  buyer_address: "",
  buyer_gstin: "",
  place_of_supply: HOME_STATE,
  rates_include_tax: true,
  bill_discount: "",
  note: "",
};

const PAY_MODES = [
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["card", "Card"],
  ["khata", "Khata"],
  ["split", "Split"],
];

function lineFromItem(item, unitId) {
  return {
    key: nextKey++,
    item: { id: item.id, name: item.name, code: item.code, base_unit: item.base_unit, units: item.units },
    unit: unitId,
    quantity: "1",
    rate: "",
    rateManual: false,
    discount: "",
    discountManual: false,
  };
}

function lineFromServer(line) {
  return {
    key: nextKey++,
    item: { id: line.item, name: line.description, code: line.item_code, base_unit: line.base_unit, units: line.item_units },
    unit: line.unit,
    quantity: plain(line.quantity),
    rate: plain(line.rate),
    rateManual: true,
    discount: plain(line.discount_percent),
    discountManual: true,
  };
}

function headerFromServer(bill) {
  return {
    customer: bill.customer_detail,
    buyer_name: bill.buyer_name,
    buyer_phone: bill.buyer_phone,
    buyer_address: bill.buyer_address,
    buyer_gstin: bill.buyer_gstin,
    place_of_supply: bill.place_of_supply,
    rates_include_tax: bill.rates_include_tax,
    bill_discount: Number(bill.bill_discount) ? plain(bill.bill_discount) : "",
    note: bill.note,
  };
}

const validQuantity = (line) => Number(line.quantity) > 0;

/** What the server needs. Blank rate/discount means "use the item's / customer's default". */
function payload(lines, header, held) {
  const sent = lines.filter(validQuantity);
  return {
    sent,
    body: {
      customer: header.customer?.id ?? null,
      buyer_name: header.buyer_name,
      buyer_phone: header.buyer_phone,
      buyer_address: header.buyer_address,
      buyer_gstin: header.buyer_gstin,
      place_of_supply: header.place_of_supply,
      rates_include_tax: header.rates_include_tax,
      bill_discount: Number(header.bill_discount) > 0 ? header.bill_discount : "0",
      note: header.note,
      held,
      lines: sent.map((line) => ({
        item: line.item.id,
        unit: line.unit,
        quantity: line.quantity,
        rate: line.rateManual && line.rate !== "" ? line.rate : null,
        discount_percent: line.discountManual && line.discount !== "" ? line.discount : null,
      })),
    },
  };
}

export default function Billing() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [lines, setLines] = useState([]);
  const [header, setHeader] = useState(EMPTY_HEADER);
  const [server, setServer] = useState(null); // last saved bill (totals come from here)
  const [computed, setComputed] = useState({}); // line key -> saved line
  const [pending, setPending] = useState(false);
  const [payMode, setPayMode] = useState("cash");
  const [split, setSplit] = useState({ cash: "", upi: "", card: "" });
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [heldOpen, setHeldOpen] = useState(false);
  const { data: heldData, reload: reloadHeld } = useFetch("/sales/invoices?status=held");

  const state = useRef({ lines, header });
  const billId = useRef(null);
  const chain = useRef(Promise.resolve());
  const version = useRef(0);
  const timer = useRef(null);

  // --- saving -----------------------------------------------------------------

  const apply = useCallback((bill, sent, savedVersion) => {
    setServer(bill);
    if (savedVersion !== version.current) return; // newer edits are on their way
    const byKey = {};
    sent.forEach((line, index) => (byKey[line.key] = bill.lines[index]));
    setComputed(byKey);
    const next = state.current.lines.map((line) => {
      const saved = byKey[line.key];
      if (!saved) return line;
      return {
        ...line,
        rate: line.rateManual ? line.rate : plain(saved.rate),
        discount: line.discountManual ? line.discount : plain(saved.discount_percent),
      };
    });
    state.current.lines = next;
    setLines(next);
    setPending(false);
  }, []);

  const queueSave = useCallback(
    ({ held = false } = {}) => {
      const run = async () => {
        const { lines: currentLines, header: currentHeader } = state.current;
        if (!billId.current && currentLines.length === 0) {
          setPending(false);
          return null;
        }
        const savedVersion = version.current;
        const { sent, body } = payload(currentLines, currentHeader, held);
        try {
          const response = billId.current
            ? await api.put(`/sales/invoices/${billId.current}`, body)
            : await api.post("/sales/invoices", body);
          billId.current = response.data.id;
          apply(response.data, sent, savedVersion);
          setError("");
          return response.data;
        } catch (err) {
          setError(errorMessage(err));
          setPending(false);
          return null;
        }
      };
      chain.current = chain.current.then(run, run);
      return chain.current;
    },
    [apply]
  );

  function changed() {
    version.current += 1;
    setPending(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => queueSave(), 300);
  }

  // Build the new state once, outside React's updater: updaters must be pure (React may run them
  // twice), and adding a line creates a new key.
  function changeLines(update) {
    const next = update(state.current.lines);
    state.current.lines = next;
    setLines(next);
    changed();
  }

  function changeHeader(patch) {
    const next = { ...state.current.header, ...patch };
    state.current.header = next;
    setHeader(next);
    changed();
  }

  function reset() {
    clearTimeout(timer.current);
    version.current += 1;
    billId.current = null;
    state.current = { lines: [], header: EMPTY_HEADER };
    setLines([]);
    setHeader(EMPTY_HEADER);
    setServer(null);
    setComputed({});
    setPending(false);
    setPayMode("cash");
    setSplit({ cash: "", upi: "", card: "" });
    setShowMore(false);
  }

  function load(bill) {
    reset();
    billId.current = bill.id;
    const loadedLines = bill.lines.map(lineFromServer);
    const loadedHeader = headerFromServer(bill);
    state.current = { lines: loadedLines, header: loadedHeader };
    setLines(loadedLines);
    setHeader(loadedHeader);
    apply(bill, loadedLines, version.current);
    setShowMore(Boolean(bill.buyer_address || bill.note || !bill.rates_include_tax || bill.place_of_supply !== HOME_STATE));
  }

  // Resume the bill this user was working on (after a refresh), or a held bill from the Bills page.
  useEffect(() => {
    const resumeId = params.get("resume");
    const request = resumeId ? api.get(`/sales/invoices/${resumeId}`) : api.get("/sales/invoices/current");
    request
      .then((response) => {
        if (response.status === 200 && response.data.status === "draft") {
          load(response.data);
          if (resumeId) {
            setParams({}, { replace: true });
            queueSave().then(reloadHeld); // no longer held
          }
        }
      })
      .catch((err) => setError(errorMessage(err)));
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- actions -------------------------------------------------------------------

  function addItem(item, unitId) {
    setNotice("");
    changeLines((current) => {
      const existing = current.find((line) => line.item.id === item.id && line.unit === unitId);
      if (existing) {
        return current.map((line) => (line === existing ? { ...line, quantity: plain(Number(line.quantity || 0) + 1) } : line));
      }
      return [...current, lineFromItem(item, unitId)];
    });
  }

  function setLine(key, patch) {
    changeLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function hold() {
    if (!lines.length) return;
    clearTimeout(timer.current);
    const saved = await queueSave({ held: true });
    if (!saved) return;
    reset();
    reloadHeld();
    setNotice(`Bill held${header.customer ? ` for ${header.customer.name}` : ""}. Resume it from “Held bills”.`);
    focusSearch();
  }

  async function resume(id) {
    if (lines.length) await hold();
    try {
      setHeldOpen(false);
      const response = await api.get(`/sales/invoices/${id}`);
      load(response.data);
      await queueSave(); // marks it no longer held
      reloadHeld();
      setNotice("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function discard() {
    if (!lines.length && !billId.current) return;
    if (!window.confirm("Clear this bill and start again?")) return;
    clearTimeout(timer.current);
    await chain.current;
    if (billId.current) {
      try {
        await api.delete(`/sales/invoices/${billId.current}`);
      } catch (err) {
        setError(errorMessage(err));
        return;
      }
    }
    reset();
    focusSearch();
  }

  function paymentsFor(total) {
    const amount = Number(total);
    if (payMode === "khata" || amount === 0) return [];
    if (payMode !== "split") return [{ mode: payMode, amount: String(amount) }];
    return Object.entries(split)
      .filter(([, value]) => Number(value) > 0)
      .map(([mode, value]) => ({ mode, amount: value }));
  }

  async function finish(print = true) {
    if (!lines.length || busy) return;
    setBusy(true);
    setError("");
    clearTimeout(timer.current);
    const saved = await queueSave();
    if (!saved) {
      setBusy(false);
      return;
    }
    try {
      const response = await api.post(`/sales/invoices/${saved.id}/finalise`, { payments: paymentsFor(saved.total) });
      const bill = response.data;
      reset();
      reloadHeld();
      if (print) {
        navigate(`/bills/${bill.id}/print?auto=1&next=/billing`, { state: { warnings: bill.warnings } });
      } else {
        setNotice(
          <>
            Bill <b>{bill.number}</b> saved · {money(bill.total)}.{" "}
            <Link to={`/bills/${bill.id}/print`} className="underline font-semibold">
              Print
            </Link>
            {bill.warnings?.length > 0 && <span className="block mt-1">{bill.warnings.join(" ")}</span>}
          </>
        );
        focusSearch();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function focusSearch() {
    setTimeout(() => document.querySelector('[aria-label="Find item"]')?.focus(), 0);
  }

  // Keyboard: F2 item, F4 customer, F8 hold, F9 finish & print.
  const keys = useRef({});
  keys.current = { hold, finish };
  useEffect(() => {
    function onKey(event) {
      const actions = {
        F2: focusSearch,
        F4: () => document.getElementById("customer-search")?.focus(),
        F8: () => keys.current.hold(),
        F9: () => keys.current.finish(true),
      };
      if (actions[event.key]) {
        event.preventDefault();
        actions[event.key]();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- display -------------------------------------------------------------------

  const total = server && lines.length ? Number(server.total) : 0;
  const splitPaid = round2(Object.values(split).reduce((sum, value) => sum + (Number(value) || 0), 0));
  const toKhata = payMode === "khata" ? total : payMode === "split" ? round2(total - splitPaid) : 0;
  const khataProblem = toKhata > 0 && !header.customer ? "Choose a customer to put the unpaid amount on khata." : "";
  const overpaid = payMode === "split" && splitPaid > total ? "Split amounts add up to more than the bill." : "";
  const sameState = header.place_of_supply === HOME_STATE;
  const held = heldData?.results || [];

  return (
    <div className="grid xl:grid-cols-[1fr_340px] gap-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-2xl font-bold">Billing</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span className="hidden lg:inline">F2 item · F4 customer · F8 hold · F9 finish & print</span>
            {held.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={heldOpen}
                  onClick={() => setHeldOpen(!heldOpen)}
                  className="px-3 py-1.5 rounded-lg border bg-amber-50 border-amber-300 text-amber-900 font-semibold"
                >
                  Held bills ({held.length})
                </button>
                {heldOpen && (
                <ul className="absolute right-0 z-30 mt-1 w-72 bg-white border rounded-lg shadow-lg">
                  {held.map((bill) => (
                    <li key={bill.id}>
                      <button type="button" onClick={() => resume(bill.id)} className="w-full text-left px-3 py-2 hover:bg-blue-50">
                        <span className="font-semibold">{bill.buyer_name || "Walk-in"}</span> · {bill.line_count} items · {money(bill.total)}
                      </button>
                    </li>
                  ))}
                </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <Alert kind="success" onClose={() => setNotice("")}>
          {notice}
        </Alert>

        <Card className="p-4 mb-4">
          <ItemSearch onSelect={addItem} />
        </Card>

        <Card>
          {lines.length === 0 ? (
            <p className="py-16 text-center text-gray-500">Scan an item or type its name to start a bill.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs uppercase text-gray-500 border-b">
                    <th className="px-3 py-2 min-w-[200px]">Item</th>
                    <th className="px-1 py-2 w-28">Unit</th>
                    <th className="px-1 py-2 w-16 text-right">Qty</th>
                    <th className="px-1 py-2 w-24 text-right">Rate</th>
                    <th className="px-1 py-2 w-14 text-right">Disc %</th>
                    <th className="px-2 py-2 w-24 text-right">Amount</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const saved = computed[line.key];
                    const unit = line.item.units.find((u) => u.id === line.unit);
                    const wanted = Number(line.quantity || 0) * Number(unit?.factor || 1);
                    const stock = saved?.item_stock;
                    const short = stock?.counted && wanted > Number(stock.qty);
                    return (
                      <tr key={line.key} className={`border-b border-gray-100 ${saved?.below_cost ? "bg-red-50" : ""}`}>
                        <td className="px-3 py-2">
                          <div className="font-semibold leading-tight">{line.item.name}</div>
                          <div className="text-xs text-gray-500">
                            #{line.item.code}
                            {stock && (stock.counted ? ` · in stock ${stock.display}` : " · not counted")}
                          </div>
                          {short && <div className="text-xs text-amber-700 font-semibold">More than the stock shows — check the shelf</div>}
                          {saved?.below_cost && (
                            <div className="text-xs text-red-700 font-semibold">
                              {isOwner ? "Below average cost" : "Price too low — ask the owner"}
                            </div>
                          )}
                        </td>
                        <td className="px-1 py-2">
                          <select
                            className={`${inputClass} px-1 py-1 text-sm`}
                            value={line.unit}
                            aria-label={`Unit line ${index + 1}`}
                            onChange={(e) => setLine(line.key, { unit: Number(e.target.value), ...(line.rateManual ? {} : { rate: "" }) })}
                          >
                            {line.item.units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.is_base ? u.name : `${u.name} ${plain(u.factor)}${line.item.base_unit}`}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-2">
                          <NumberInput
                            className={`px-1.5 py-1 text-right text-sm ${validQuantity(line) ? "" : "border-red-400 bg-red-50"}`}
                            value={line.quantity}
                            aria-label={`Quantity line ${index + 1}`}
                            onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && focusSearch()}
                          />
                        </td>
                        <td className="px-1 py-2">
                          <NumberInput
                            className="px-1.5 py-1 text-right text-sm"
                            value={line.rate}
                            aria-label={`Rate line ${index + 1}`}
                            onChange={(e) => setLine(line.key, { rate: e.target.value, rateManual: e.target.value !== "" })}
                            onKeyDown={(e) => e.key === "Enter" && focusSearch()}
                          />
                        </td>
                        <td className="px-1 py-2">
                          <NumberInput
                            className="px-1.5 py-1 text-right text-sm"
                            value={line.discount}
                            aria-label={`Discount line ${index + 1}`}
                            onChange={(e) => setLine(line.key, { discount: e.target.value, discountManual: e.target.value !== "" })}
                            onKeyDown={(e) => e.key === "Enter" && focusSearch()}
                          />
                        </td>
                        <td className={`px-2 py-2 text-right font-semibold whitespace-nowrap ${pending ? "text-gray-400" : ""}`}>
                          {saved ? money(saved.total) : "…"}
                        </td>
                        <td className="pr-2">
                          <button
                            type="button"
                            aria-label={`Remove line ${index + 1}`}
                            onClick={() => changeLines((current) => current.filter((l) => l.key !== line.key))}
                            className="text-gray-400 hover:text-red-600"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-4">
          <p className="text-sm font-semibold text-gray-600 mb-2">Customer</p>
          <CustomerPicker value={header.customer} onChange={(customer) => changeHeader({ customer })} />
          <button type="button" onClick={() => setShowMore(!showMore)} className="text-sm text-blue-800 mt-2 hover:underline">
            {showMore ? "Fewer options" : "Buyer details, GST options, note"}
          </button>
          {showMore && (
            <div className="grid gap-2 mt-3">
              {!header.customer && (
                <>
                  <input className={inputClass} placeholder="Buyer name" value={header.buyer_name} onChange={(e) => changeHeader({ buyer_name: e.target.value })} />
                  <input className={inputClass} placeholder="Buyer phone" value={header.buyer_phone} onChange={(e) => changeHeader({ buyer_phone: e.target.value })} />
                  <input className={inputClass} placeholder="Buyer address (needed above ₹50,000)" value={header.buyer_address} onChange={(e) => changeHeader({ buyer_address: e.target.value })} />
                  <input className={inputClass} placeholder="Buyer GSTIN" value={header.buyer_gstin} onChange={(e) => changeHeader({ buyer_gstin: e.target.value.toUpperCase() })} />
                </>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={header.rates_include_tax} onChange={(e) => changeHeader({ rates_include_tax: e.target.checked })} />
                Rates include GST
              </label>
              <label className="text-sm">
                Place of supply
                <select className={`${inputClass} mt-1`} value={header.place_of_supply} onChange={(e) => changeHeader({ place_of_supply: e.target.value })}>
                  {STATES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name} ({code})
                    </option>
                  ))}
                </select>
              </label>
              {!sameState && <p className="text-xs text-amber-800">IGST applies — only when the goods go to another state.</p>}
              <input className={inputClass} placeholder="Note on bill" value={header.note} onChange={(e) => changeHeader({ note: e.target.value })} />
            </div>
          )}
        </Card>

        <Card className="p-4">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between items-center">
              <dt>Discount on bill (₹)</dt>
              <dd className="w-28">
                <NumberInput className="py-1 text-right" value={header.bill_discount} aria-label="Discount on bill" onChange={(e) => changeHeader({ bill_discount: e.target.value })} />
              </dd>
            </div>
            {server && lines.length > 0 && (
              <>
                <div className="flex justify-between text-gray-600">
                  <dt>Taxable value</dt>
                  <dd>{money(server.taxable_total)}</dd>
                </div>
                {sameState ? (
                  <div className="flex justify-between text-gray-600">
                    <dt>CGST + SGST</dt>
                    <dd>
                      {money(server.cgst_total)} + {money(server.sgst_total)}
                    </dd>
                  </div>
                ) : (
                  <div className="flex justify-between text-gray-600">
                    <dt>IGST</dt>
                    <dd>{money(server.igst_total)}</dd>
                  </div>
                )}
                {Number(server.discount_total) > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <dt>Discount given</dt>
                    <dd>{money(server.discount_total)}</dd>
                  </div>
                )}
                <div className="flex justify-between text-gray-600">
                  <dt>Round off</dt>
                  <dd>{money(server.round_off)}</dd>
                </div>
              </>
            )}
          </dl>
          <div className={`flex justify-between items-baseline border-t mt-3 pt-3 ${pending ? "opacity-50" : ""}`}>
            <span className="text-lg font-bold">Total</span>
            <span className="text-3xl font-bold">{money(total)}</span>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-semibold text-gray-600 mb-2">Payment</p>
          <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Payment">
            {PAY_MODES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={payMode === value}
                onClick={() => setPayMode(value)}
                className={`py-2 rounded-lg border text-sm font-semibold ${
                  payMode === value ? "bg-blue-700 text-white border-blue-700" : "bg-white border-gray-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {payMode === "split" && (
            <div className="grid gap-2 mt-3">
              {[["cash", "Cash"], ["upi", "UPI"], ["card", "Card"]].map(([mode, label]) => (
                <label key={mode} className="flex items-center justify-between gap-3 text-sm">
                  {label}
                  <NumberInput className="w-32 py-1 text-right" value={split[mode]} onChange={(e) => setSplit({ ...split, [mode]: e.target.value })} />
                </label>
              ))}
            </div>
          )}
          {toKhata > 0 && (
            <p className="mt-3 text-sm">
              On khata: <b className="text-red-700">{money(toKhata)}</b>
            </p>
          )}
          {(khataProblem || overpaid) && <p className="mt-2 text-sm text-red-700">{khataProblem || overpaid}</p>}
          <Alert onClose={() => setError("")}>{error}</Alert>
          <Button
            variant="success"
            className="w-full mt-4 py-3 text-lg"
            onClick={() => finish(true)}
            disabled={!lines.length || busy || Boolean(khataProblem || overpaid) || lines.some((l) => !validQuantity(l))}
          >
            <Printer size={20} /> {busy ? "Saving…" : "Finish & print (F9)"}
          </Button>
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-2 mt-3 text-sm">
            <button type="button" onClick={() => finish(false)} disabled={!lines.length || busy} className="text-blue-800 hover:underline disabled:opacity-40">
              Finish without printing
            </button>
            <span className="flex gap-3">
              <button type="button" onClick={hold} disabled={!lines.length} className="inline-flex items-center gap-1 text-amber-800 hover:underline disabled:opacity-40">
                <PauseCircle size={16} /> Hold (F8)
              </button>
              <button type="button" onClick={discard} disabled={!lines.length && !billId.current} className="inline-flex items-center gap-1 text-red-700 hover:underline disabled:opacity-40">
                <RotateCcw size={16} /> Clear
              </button>
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
