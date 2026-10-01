import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowLeft, Printer } from "lucide-react";
import { useFetch } from "../../hooks/useFetch.js";
import { money, plain } from "../../lib/format.js";
import { Alert, Button, Spinner } from "../../ui/index.js";

function UpiQr({ upiId, shopName, amount, billNumber }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    const link = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${Number(amount).toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Bill ${billNumber}`)}`;
    QRCode.toDataURL(link, { margin: 1, width: 220 }).then(setSrc).catch(() => setSrc(""));
  }, [upiId, shopName, amount, billNumber]);
  if (!src) return null;
  return (
    <div className="text-center">
      <img src={src} alt={`UPI QR to pay ${money(amount)}`} className="w-28 h-28 mx-auto" />
      <p className="text-[10px]">Scan to pay {money(amount)} by UPI</p>
    </div>
  );
}

/** A4 tax invoice. Every figure is the saved bill's own value — nothing is recalculated here. */
export default function BillPrint() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: bill, error } = useFetch(`/sales/invoices/${id}`);
  const { data: shop } = useFetch("/shop/settings");
  const next = params.get("next");
  const warnings = location.state?.warnings || [];

  useEffect(() => {
    if (!bill || !shop || params.get("auto") !== "1") return undefined;
    const back = () => next && navigate(next);
    window.addEventListener("afterprint", back);
    const timer = setTimeout(() => window.print(), 300);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", back);
    };
  }, [bill, shop, params, next, navigate]);

  if (error) return <Alert>{error}</Alert>;
  if (!bill || !shop) return <Spinner />;
  const s = shop.data;
  const sameState = Number(bill.igst_total) === 0;
  const cancelled = bill.status === "cancelled";
  const terms = (s.invoice_terms || "").split("\n").filter(Boolean);
  const paidModes = bill.payments.filter((p) => p.kind === "sale");

  return (
    <div className="bg-gray-200 min-h-screen py-6 print:bg-white print:py-0">
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex flex-wrap items-center gap-3 px-2">
        <Button to={next || `/bills/${bill.id}`}>
          <ArrowLeft size={18} /> {next ? "Back to billing" : "Back to bill"}
        </Button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer size={18} /> Print
        </Button>
        {!s.gstin && <span className="text-sm text-amber-800">Shop GSTIN is not set — fill in Shop settings in the back office.</span>}
      </div>
      {warnings.length > 0 && (
        <div className="no-print max-w-[210mm] mx-auto px-2">
          <Alert kind="warning">{warnings.join(" ")}</Alert>
        </div>
      )}

      <article className="invoice relative bg-white max-w-[210mm] mx-auto p-[8mm] text-[11px] leading-snug text-black shadow print:shadow-none print:p-0">
        {cancelled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-7xl font-bold text-red-600/25 -rotate-12 border-8 border-red-600/25 px-6">CANCELLED</span>
          </div>
        )}
        <div className="border border-black">
          <div className="flex justify-between px-2 py-1 border-b border-black">
            <span>GSTIN: <b>{s.gstin || "—"}</b></span>
            <span className="font-bold">TAX INVOICE</span>
            <span>Original for Recipient</span>
          </div>
          <div className="text-center py-2 border-b border-black">
            <p className="text-xl font-bold uppercase tracking-wide">{s.name}</p>
            {s.address && <p className="whitespace-pre-line">{s.address}</p>}
            <p>{[s.phone && `Phone: ${s.phone}`, s.email && `Email: ${s.email}`].filter(Boolean).join("   ")}</p>
          </div>
          <div className="grid grid-cols-2 border-b border-black">
            <div className="p-2 border-r border-black">
              <p className="font-bold mb-1">Billed to</p>
              <p className="font-semibold">{bill.buyer_name || "Cash sale"}</p>
              {bill.buyer_address && <p className="whitespace-pre-line">{bill.buyer_address}</p>}
              {bill.buyer_phone && <p>Phone: {bill.buyer_phone}</p>}
              {bill.buyer_gstin && <p>GSTIN: <b>{bill.buyer_gstin}</b></p>}
            </div>
            <div className="p-2 grid grid-cols-[auto_1fr] gap-x-3 content-start">
              <span>Invoice no.</span><b>{bill.number || "DRAFT"}</b>
              <span>Date</span><b>{bill.invoice_date ? new Date(bill.invoice_date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</b>
              <span>Place of supply</span><b>{bill.place_of_supply_label}</b>
            </div>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-black">
                <th className="px-1 py-1 text-left w-6">#</th>
                <th className="px-1 py-1 text-left">Description</th>
                <th className="px-1 py-1 text-left">HSN</th>
                <th className="px-1 py-1 text-right">Qty</th>
                <th className="px-1 py-1 text-right">Rate{bill.rates_include_tax ? " (incl. GST)" : ""}</th>
                <th className="px-1 py-1 text-right">Disc.</th>
                <th className="px-1 py-1 text-right">Taxable</th>
                <th className="px-1 py-1 text-right">GST</th>
                <th className="px-1 py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.lines.map((line, index) => (
                <tr key={line.id} className="border-b border-gray-300 align-top">
                  <td className="px-1 py-0.5">{index + 1}</td>
                  <td className="px-1 py-0.5">{line.description}</td>
                  <td className="px-1 py-0.5">{line.hsn_code}</td>
                  <td className="px-1 py-0.5 text-right whitespace-nowrap">{plain(line.quantity)} {line.unit_name}</td>
                  <td className="px-1 py-0.5 text-right">{Number(line.rate).toFixed(2)}</td>
                  <td className="px-1 py-0.5 text-right">{Number(line.discount) ? Number(line.discount).toFixed(2) : ""}</td>
                  <td className="px-1 py-0.5 text-right">{Number(line.taxable_value).toFixed(2)}</td>
                  <td className="px-1 py-0.5 text-right">{plain(line.gst_rate)}%</td>
                  <td className="px-1 py-0.5 text-right">{Number(line.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-[1fr_auto] border-t border-black">
            <div className="p-2 border-r border-black">
              <table className="w-full border-collapse mb-2">
                <thead>
                  <tr className="border-b border-gray-400">
                    <th className="text-left font-semibold">GST rate</th>
                    <th className="text-right font-semibold">Taxable</th>
                    {sameState ? (
                      <>
                        <th className="text-right font-semibold">CGST</th>
                        <th className="text-right font-semibold">SGST</th>
                      </>
                    ) : (
                      <th className="text-right font-semibold">IGST</th>
                    )}
                    <th className="text-right font-semibold">Total tax</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.tax_summary.map((row) => (
                    <tr key={row.rate}>
                      <td>{plain(row.rate)}%</td>
                      <td className="text-right">{Number(row.taxable).toFixed(2)}</td>
                      {sameState ? (
                        <>
                          <td className="text-right">{Number(row.cgst).toFixed(2)}</td>
                          <td className="text-right">{Number(row.sgst).toFixed(2)}</td>
                        </>
                      ) : (
                        <td className="text-right">{Number(row.igst).toFixed(2)}</td>
                      )}
                      <td className="text-right">{Number(row.tax).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="font-semibold">{bill.amount_in_words}</p>
              {bill.note && <p className="mt-1">Note: {bill.note}</p>}
            </div>
            <dl className="p-2 min-w-[200px] space-y-0.5">
              <div className="flex justify-between gap-6"><dt>Taxable value</dt><dd>{Number(bill.taxable_total).toFixed(2)}</dd></div>
              {sameState ? (
                <>
                  <div className="flex justify-between gap-6"><dt>CGST</dt><dd>{Number(bill.cgst_total).toFixed(2)}</dd></div>
                  <div className="flex justify-between gap-6"><dt>SGST</dt><dd>{Number(bill.sgst_total).toFixed(2)}</dd></div>
                </>
              ) : (
                <div className="flex justify-between gap-6"><dt>IGST</dt><dd>{Number(bill.igst_total).toFixed(2)}</dd></div>
              )}
              <div className="flex justify-between gap-6"><dt>Round off</dt><dd>{Number(bill.round_off).toFixed(2)}</dd></div>
              <div className="flex justify-between gap-6 border-t border-black pt-1 text-sm font-bold"><dt>Total</dt><dd>{money(bill.total)}</dd></div>
              {paidModes.map((p) => (
                <div key={p.id} className="flex justify-between gap-6"><dt>Paid ({p.mode_display})</dt><dd>{Number(p.amount).toFixed(2)}</dd></div>
              ))}
              {Number(bill.credit_amount) > 0 && (
                <div className="flex justify-between gap-6 font-bold"><dt>Due (on khata)</dt><dd>{Number(bill.credit_amount).toFixed(2)}</dd></div>
              )}
            </dl>
          </div>

          <div className="grid grid-cols-3 border-t border-black">
            <div className="p-2 border-r border-black">
              <p className="font-bold">Bank details</p>
              {s.bank_name ? (
                <p className="whitespace-pre-line">
                  {s.bank_name}
                  {s.bank_branch && `, ${s.bank_branch}`}
                  {"\n"}A/c {s.bank_account_number}
                  {"\n"}IFSC {s.bank_ifsc}
                </p>
              ) : (
                <p>—</p>
              )}
              {s.upi_id && Number(bill.credit_amount) > 0 && !cancelled && (
                <UpiQr upiId={s.upi_id} shopName={s.name} amount={bill.credit_amount} billNumber={bill.number} />
              )}
            </div>
            <div className="p-2 border-r border-black">
              <p className="font-bold">Terms & conditions</p>
              <ol className="list-decimal ml-4">
                {terms.map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ol>
            </div>
            <div className="p-2 flex flex-col justify-between">
              <p className="text-right font-semibold">For {s.name}</p>
              <p className="text-right mt-10">Authorised signatory</p>
            </div>
          </div>
          <div className="flex justify-between px-2 py-1 border-t border-black">
            <span>Receiver's signature</span>
            <span>Thank you for your business</span>
          </div>
        </div>
        {cancelled && <p className="mt-2 text-red-700 font-semibold">Cancelled on {new Date(bill.cancelled_at).toLocaleDateString("en-IN")}: {bill.cancel_reason}</p>}
      </article>
      <p className="no-print text-center text-sm text-gray-500 mt-3">
        <Link to="/billing" className="underline">
          New bill
        </Link>
      </p>
    </div>
  );
}
