import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useFetch } from "../../hooks/useFetch.js";
import { date, dateTime, money, today } from "../../lib/format.js";
import { Alert, Badge, Button, Card, Empty, Input, PageHeader, Pagination, Spinner, Table, td, th } from "../../ui/index.js";

const TABS = [
  ["", "Bills"],
  ["held", "Held"],
  ["quotation", "Quotations"],
  ["cancelled", "Cancelled"],
];

export const BILL_STATUS = { final: ["green", "Paid / final"], draft: ["amber", "Held"], cancelled: ["red", "Cancelled"] };

export default function BillList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const day = params.get("day") ?? today();
  const page = Number(params.get("page") || 1);
  const [search, setSearch] = useState(params.get("search") || "");

  function update(changes) {
    const next = new URLSearchParams(params);
    Object.entries({ page: "", ...changes }).forEach(([key, value]) => (value !== "" && value !== null ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  }

  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set("status", status);
  if (params.get("search")) query.set("search", params.get("search"));
  const undated = status === "held" || status === "quotation";
  if (day && !undated) {
    query.set("date_from", day);
    query.set("date_to", day);
  }
  const { data, error, loading } = useFetch(`/sales/invoices?${query}`);
  const rows = data?.results || [];
  const dayTotal = rows.filter((bill) => bill.status === "final").reduce((sum, bill) => sum + Number(bill.total), 0);

  return (
    <>
      <PageHeader
        title="Bills"
        subtitle={status === "held" ? "Bills parked at the counter" : status === "quotation" ? "Quotations (estimates) — not bills" : day ? `Bills on ${date(day)}` : "All bills"}
      >
        <Button variant="primary" to="/billing">
          <Plus size={18} /> New bill
        </Button>
      </PageHeader>
      <Card className="p-4 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {TABS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => update({ status: value })}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${
                status === value ? "bg-blue-700 text-white border-blue-700" : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {!undated && (
          <label className="flex items-center gap-2 text-sm">
            Date
            <input type="date" className="border rounded-lg px-2 py-1.5" value={day} max={today()} onChange={(e) => update({ day: e.target.value })} />
            <button type="button" className="text-blue-800 underline" onClick={() => update({ day: "" })}>
              all dates
            </button>
          </label>
        )}
        <div className="flex-1 min-w-[220px]">
          <Input
            value={search}
            placeholder="Bill number, buyer name or phone"
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && update({ search: search.trim(), day: "" })}
          />
        </div>
      </Card>
      <Alert>{error}</Alert>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>No bills here.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Bill</th>
                <th className={th}>When</th>
                <th className={th}>Buyer</th>
                <th className={`${th} text-right`}>Items</th>
                <th className={`${th} text-right`}>Total</th>
                <th className={`${th} text-right`}>On khata</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((bill) => (
                <tr
                  key={bill.id}
                  className="hover:bg-blue-50/50 cursor-pointer"
                  onClick={() => navigate(bill.kind === "invoice" && bill.status === "draft" ? `/billing?resume=${bill.id}` : `/bills/${bill.id}`)}
                >
                  <td className={`${td} font-mono text-sm font-semibold`}>{bill.number || "—"}</td>
                  <td className={`${td} whitespace-nowrap`}>{bill.kind === "quotation" ? date(bill.invoice_date) : dateTime(bill.finalised_at || bill.updated_at)}</td>
                  <td className={td}>
                    {bill.buyer_name || "Cash sale"}
                    {bill.buyer_phone && <span className="text-sm text-gray-500"> · {bill.buyer_phone}</span>}
                  </td>
                  <td className={`${td} text-right`}>{bill.line_count}</td>
                  <td className={`${td} text-right font-semibold`}>{money(bill.total)}</td>
                  <td className={`${td} text-right ${Number(bill.credit_amount) > 0 ? "text-red-700" : "text-gray-400"}`}>
                    {Number(bill.credit_amount) > 0 ? money(bill.credit_amount) : "—"}
                  </td>
                  <td className={td}>
                    {bill.kind === "quotation" ? (
                      <Badge color="blue">{bill.converted_to ? "Converted" : `Valid till ${date(bill.valid_until)}`}</Badge>
                    ) : (
                      <Badge color={BILL_STATUS[bill.status][0]}>{BILL_STATUS[bill.status][1]}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {data && !undated && day && rows.length > 0 && (
          <p className="px-4 py-3 border-t text-sm text-gray-700">
            Total of final bills on this page: <b>{money(dayTotal)}</b>
          </p>
        )}
        {data && <Pagination page={page} count={data.count} onPage={(next) => update({ page: String(next) })} />}
      </Card>
    </>
  );
}
