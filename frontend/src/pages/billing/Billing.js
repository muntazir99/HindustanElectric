import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Clock, FileText, Minus, Plus, Printer, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import api from "../../api.js";
import CustomerPicker from "../../components/CustomerPicker.js";
import ItemSearch from "../../components/ItemSearch.js";
import { useAuth } from "../../context/AuthContext.js";
import { useFetch } from "../../hooks/useFetch.js";
import { errorMessage } from "../../lib/errors.js";
import { bigMoney, money, plain, plural, round2 } from "../../lib/format.js";
import { HOME_STATE, STATES } from "../../lib/states.js";
import { Alert, BackLink, Button, Card, NumberInput, inputBase, inputClass } from "../../ui/index.js";

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

// Cash, UPI and Udhaar are the big buttons; Card and part payment sit below them.
const PAY_MODES = [
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["khata", "Udhaar"],
  ["card", "Card"],
  ["split", "Part payment"],
];
const MAIN_MODES = ["cash", "upi", "khata"];

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
    setNotice(`Bill kept for later${header.customer ? ` for ${header.customer.name}` : ""}. Open it again from “Kept for later” at the top.`);
    focusSearch();
  }

  async function quote() {
    if (!lines.length || busy) return;
    setBusy(true);
    clearTimeout(timer.current);
    const saved = await queueSave();
    if (!saved) {
      setBusy(false);
      return;
    }
    try {
      const response = await api.post(`/sales/invoices/${saved.id}/quotation`);
      reset();
      navigate(`/bills/${response.data.id}/print?next=/billing`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
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
    if (!window.confirm("Start over? Everything on this bill will be cleared.")) return;
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
  const khataProblem = toKhata > 0 && !header.customer ? "To give udhaar, choose who is buying (above)." : "";
  const overpaid = payMode === "split" && splitPaid > total ? "The amounts add up to more than the bill." : "";
  const sameState = header.place_of_supply === HOME_STATE;
  const held = heldData?.results || [];
  const gst = server ? round2(Number(server.cgst_total) + Number(server.sgst_total) + Number(server.igst_total)) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px] gap-5 items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <BackLink to="/dashboard">Home</BackLink>
            <h1 className="text-3xl font-bold leading-tight mt-1">New Bill</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="hidden xl:inline text-sm text-gray-500">Keys: F2 item · F4 customer · F8 keep for later · F9 save &amp; print</span>
            {held.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={heldOpen}
                  onClick={() => setHeldOpen(!heldOpen)}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border bg-amber-50 border-amber-300 text-amber-900 font-semibold"
                >
                  <Clock size={18} /> Kept for later ({held.length})
                </button>
                {heldOpen && (
                  <ul className="absolute right-0 z-30 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-1">
                    {held.map((bill) => (
                      <li key={bill.id}>
                        <button type="button" onClick={() => resume(bill.id)} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50">
                          <span className="font-semibold">{bill.buyer_name || "Cash customer"}</span>
                          <span className="block text-sm text-gray-600">
                            {plural(bill.line_count, "item")} · {money(bill.total)}
                          </span>
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

        <ItemSearch onSelect={addItem} />
        <p className="text-sm text-gray-500 mt-1.5 mb-4 px-1">Scanning the same item again adds one more.</p>

        <Card>
          <h2 className="px-5 py-4 border-b border-gray-200 text-lg font-bold">
            Items in this bill{lines.length > 0 && ` (${lines.length})`}
          </h2>
          {lines.length === 0 ? (
            <p className="py-16 px-5 text-center text-gray-500">Scan an item or type its name above to start the bill.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {lines.map((line, index) => {
                const saved = computed[line.key];
                const unit = line.item.units.find((u) => u.id === line.unit);
                const wanted = Number(line.quantity || 0) * Number(unit?.factor || 1);
                const stock = saved?.item_stock;
                const short = stock?.counted && wanted > Number(stock.qty);
                const quantity = Number(line.quantity || 0);
                return (
                  <li key={line.key} className={`px-5 py-4 ${saved?.below_cost ? "bg-red-50" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-semibold leading-snug">{line.item.name}</p>
                        <p className="text-sm text-gray-500">
                          #{line.item.code}
                          {stock && (stock.counted ? ` · in stock ${stock.display}` : " · shelf stock not checked yet")}
                        </p>
                        {short && (
                          <p className="flex items-center gap-1.5 text-sm text-amber-800 font-semibold">
                            <TriangleAlert size={15} /> More than the stock shows — check the shelf
                          </p>
                        )}
                        {saved?.below_cost && (
                          <p className="text-sm text-red-700 font-semibold">{isOwner ? "Below average cost" : "Price too low — ask the owner"}</p>
                        )}
                      </div>
                      <p className={`pt-0.5 text-right text-xl font-bold whitespace-nowrap ${pending ? "text-gray-400" : ""}`}>
                        {saved ? money(saved.total) : "…"}
                      </p>
                      <button
                        type="button"
                        aria-label={`Remove line ${index + 1}`}
                        onClick={() => changeLines((current) => current.filter((l) => l.key !== line.key))}
                        className="-mt-1.5 w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white">
                        <button
                          type="button"
                          aria-label={`One less, line ${index + 1}`}
                          disabled={quantity <= 1}
                          onClick={() => setLine(line.key, { quantity: plain(Math.max(1, quantity - 1)) })}
                          className="w-11 h-11 flex items-center justify-center bg-gray-50 hover:bg-gray-100 disabled:opacity-40"
                        >
                          <Minus size={18} />
                        </button>
                        <input
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          className={`w-14 h-11 text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600 ${
                            validQuantity(line) ? "" : "bg-red-50 text-red-700"
                          }`}
                          value={line.quantity}
                          aria-label={`Quantity line ${index + 1}`}
                          onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => e.key === "Enter" && focusSearch()}
                        />
                        <button
                          type="button"
                          aria-label={`One more, line ${index + 1}`}
                          onClick={() => setLine(line.key, { quantity: plain(quantity + 1) })}
                          className="w-11 h-11 flex items-center justify-center bg-gray-50 hover:bg-gray-100"
                        >
                          <Plus size={18} />
                        </button>
                      </div>

                      {line.item.units.length > 1 ? (
                        <select
                          className={`${inputBase} h-11 py-1`}
                          value={line.unit}
                          aria-label={`Unit line ${index + 1}`}
                          onChange={(e) => setLine(line.key, { unit: Number(e.target.value), ...(line.rateManual ? {} : { rate: "" }) })}
                        >
                          {line.item.units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.is_base ? u.name : `${u.name} (${plain(u.factor)} ${line.item.base_unit})`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-600">{unit?.name}</span>
                      )}

                      <label className="flex items-center gap-2 text-gray-600">
                        Price ₹
                        <NumberInput
                          className="w-24 py-1.5 text-right text-base"
                          value={line.rate}
                          aria-label={`Rate line ${index + 1}`}
                          onChange={(e) => setLine(line.key, { rate: e.target.value, rateManual: e.target.value !== "" })}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => e.key === "Enter" && focusSearch()}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-gray-600">
                        Disc %
                        <NumberInput
                          className="w-16 py-1.5 text-right text-base"
                          value={line.discount}
                          aria-label={`Discount line ${index + 1}`}
                          onChange={(e) => setLine(line.key, { discount: e.target.value, discountManual: e.target.value !== "" })}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => e.key === "Enter" && focusSearch()}
                        />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-24">
        <Card className="p-5">
          <h2 className="font-semibold text-gray-600 mb-2">Who is buying?</h2>
          <CustomerPicker value={header.customer} onChange={(customer) => changeHeader({ customer })} />
          {!header.customer && <p className="text-sm text-gray-500 mt-1.5">Leave empty for a cash customer. Choose a customer to give udhaar.</p>}
          <button type="button" onClick={() => setShowMore(!showMore)} className="text-blue-800 mt-2 hover:underline">
            {showMore ? "Hide buyer details" : "Buyer's name, address, GSTIN, other state…"}
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
              <label className="flex items-center gap-2">
                <input type="checkbox" className="w-5 h-5" checked={header.rates_include_tax} onChange={(e) => changeHeader({ rates_include_tax: e.target.checked })} />
                Prices include GST
              </label>
              <label>
                Goods going to (state)
                <select className={`${inputClass} mt-1`} value={header.place_of_supply} onChange={(e) => changeHeader({ place_of_supply: e.target.value })}>
                  {STATES.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name} ({code})
                    </option>
                  ))}
                </select>
              </label>
              {!sameState && <p className="text-sm text-amber-800">IGST applies — only when the goods go to another state.</p>}
              <input className={inputClass} placeholder="Note on bill" value={header.note} onChange={(e) => changeHeader({ note: e.target.value })} />
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-gray-600">To pay</p>
          <p className={`text-5xl font-bold leading-tight ${pending ? "opacity-50" : ""}`}>{bigMoney(total)}</p>
          {server && lines.length > 0 && (
            <p className="text-sm text-gray-500">
              GST {header.rates_include_tax ? "included" : "added"}: {money(gst)}
            </p>
          )}
          <label className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-200 text-gray-700">
            Discount on whole bill (₹)
            <NumberInput className="w-28 py-1.5 text-right" value={header.bill_discount} aria-label="Discount on bill" onChange={(e) => changeHeader({ bill_discount: e.target.value })} />
          </label>
          {server && lines.length > 0 && (
            <details className="mt-3 text-sm text-gray-600">
              <summary className="cursor-pointer text-blue-800">Tax details</summary>
              <dl className="space-y-1 mt-2">
                <div className="flex justify-between">
                  <dt>Taxable value</dt>
                  <dd>{money(server.taxable_total)}</dd>
                </div>
                {sameState ? (
                  <div className="flex justify-between">
                    <dt>CGST + SGST</dt>
                    <dd>
                      {money(server.cgst_total)} + {money(server.sgst_total)}
                    </dd>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <dt>IGST</dt>
                    <dd>{money(server.igst_total)}</dd>
                  </div>
                )}
                {Number(server.discount_total) > 0 && (
                  <div className="flex justify-between">
                    <dt>Discount given</dt>
                    <dd>{money(server.discount_total)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt>Round off</dt>
                  <dd>{money(server.round_off)}</dd>
                </div>
              </dl>
            </details>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-gray-600 mb-2">How are they paying?</h2>
          <div role="radiogroup" aria-label="Payment" className="grid grid-cols-6 gap-2">
            {PAY_MODES.map(([value, label]) => {
              const big = MAIN_MODES.includes(value);
              const chosen = payMode === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  onClick={() => setPayMode(value)}
                  className={`rounded-xl border-2 font-semibold ${big ? "col-span-2 h-14 text-lg" : "col-span-3 h-11"} ${
                    chosen ? "bg-blue-800 text-white border-blue-800" : "bg-white border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {payMode === "split" && (
            <div className="grid gap-2 mt-3">
              <p className="text-sm text-gray-600">Enter how much came in each way. Anything left goes on udhaar.</p>
              {[["cash", "Cash"], ["upi", "UPI"], ["card", "Card"]].map(([mode, label]) => (
                <label key={mode} className="flex items-center justify-between gap-3">
                  {label}
                  <NumberInput className="w-32 py-1.5 text-right" value={split[mode]} onChange={(e) => setSplit({ ...split, [mode]: e.target.value })} />
                </label>
              ))}
            </div>
          )}
          {toKhata > 0 && (
            <p className="mt-3">
              Goes on udhaar: <b className="text-red-700">{money(toKhata)}</b>
            </p>
          )}
          {(khataProblem || overpaid) && <p className="mt-2 text-red-700">{khataProblem || overpaid}</p>}
          <div className="mt-4">
            <Alert onClose={() => setError("")}>{error}</Alert>
          </div>
          <Button
            variant="success"
            className="w-full h-16 text-xl"
            onClick={() => finish(true)}
            disabled={!lines.length || busy || Boolean(khataProblem || overpaid) || lines.some((l) => !validQuantity(l))}
          >
            <Printer size={24} /> {busy ? "Saving…" : "Save & Print Bill"}
          </Button>
          <div className="flex justify-between mt-2 text-sm">
            <button type="button" onClick={() => finish(false)} disabled={!lines.length || busy} className="text-blue-800 hover:underline disabled:opacity-40">
              Save without printing
            </button>
            <span className="text-gray-500">Shortcut: F9</span>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          <Button onClick={hold} disabled={!lines.length} className="px-2 text-sm leading-tight">
            <Clock size={18} className="shrink-0" /> Keep for later
          </Button>
          <Button onClick={quote} disabled={!lines.length || busy} className="px-2 text-sm leading-tight">
            <FileText size={18} className="shrink-0" /> Make estimate
          </Button>
          <Button variant="danger" onClick={discard} disabled={!lines.length && !billId.current} className="px-2 text-sm leading-tight">
            <RotateCcw size={18} className="shrink-0" /> Start over
          </Button>
        </div>
      </div>
    </div>
  );
}
