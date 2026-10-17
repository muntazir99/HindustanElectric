import { ArrowLeft, Printer } from "lucide-react";
import { useParams } from "react-router-dom";
import { useFetch } from "../../hooks/useFetch.js";
import { date, plain } from "../../lib/format.js";
import { Alert, Button, Spinner } from "../../ui/index.js";

/** A purchase order on A4, compact and black on white like the bill; no rates (plan §18). */
export default function OrderPrint() {
  const { id } = useParams();
  const { data: order, error } = useFetch(`/purchases/orders/${id}`);
  const { data: shop } = useFetch("/shop/settings");

  if (error) return <Alert>{error}</Alert>;
  if (!order || !shop) return <Spinner />;
  const s = shop.data;
  const cell = "px-1.5 py-1 text-left";

  return (
    <div className="bg-gray-200 min-h-screen py-6 print:bg-white print:py-0">
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex flex-wrap gap-3 px-2">
        <Button to={`/orders/${order.id}`}>
          <ArrowLeft size={18} /> Back to the order
        </Button>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer size={18} /> Print
        </Button>
      </div>
      <article className="bg-white max-w-[210mm] mx-auto p-[8mm] text-[11px] leading-snug text-black shadow print:shadow-none print:p-0">
        <div className="text-center border-b border-black pb-2 mb-2">
          <p className="text-lg font-bold uppercase">{s.name}</p>
          {s.address && <p className="whitespace-pre-line">{s.address}</p>}
          <p>{[s.phone && `Phone: ${s.phone}`, s.gstin && `GSTIN: ${s.gstin}`].filter(Boolean).join("   ")}</p>
        </div>
        <p className="text-center text-[13px] font-bold mb-2">
          PURCHASE ORDER{order.status === "cancelled" ? " — CANCELLED" : ""}
        </p>
        <div className="flex justify-between gap-6 mb-3">
          <div>
            <p className="font-bold">To</p>
            <p className="font-semibold">{order.supplier_name}</p>
            {order.supplier_address && <p className="whitespace-pre-line">{order.supplier_address}</p>}
            {order.supplier_phone && <p>Phone: {order.supplier_phone}</p>}
            {order.supplier_gstin && <p>GSTIN: {order.supplier_gstin}</p>}
          </div>
          <div className="grid grid-cols-[auto_auto] gap-x-3 content-start">
            <span>Order no.</span>
            <b>{order.number}</b>
            <span>Date</span>
            <b>{date(order.order_date)}</b>
          </div>
        </div>
        <table className="w-full border-collapse border border-black mb-3">
          <thead>
            <tr className="border-b border-black">
              <th className={`${cell} w-8`}>#</th>
              <th className={cell}>Item</th>
              <th className={`${cell} w-20`}>Code</th>
              <th className={`${cell} w-24 text-right`}>Quantity</th>
              <th className={`${cell} w-28`}>Unit</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line, index) => (
              <tr key={line.id} className="border-b border-gray-400">
                <td className={cell}>{index + 1}</td>
                <td className={cell}>{line.item_name}</td>
                <td className={cell}>{line.item_code}</td>
                <td className={`${cell} text-right font-semibold`}>{plain(line.quantity)}</td>
                <td className={cell}>
                  {line.unit_name}
                  {Number(line.unit_factor) !== 1 && ` (${plain(line.unit_factor)} ${line.base_unit})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {order.note && <p className="mb-3">Note: {order.note}</p>}
        <div className="flex justify-between pt-8">
          <span>Please send by: ____________________</span>
          <span>For {s.name}: ____________________</span>
        </div>
      </article>
    </div>
  );
}
