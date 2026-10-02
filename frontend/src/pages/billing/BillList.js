import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.js";
import { useFetch } from "../../hooks/useFetch.js";
import { A } from "../../lib/access.js";
import { date, dateTime, money, today } from "../../lib/format.js";
import { Search } from "lucide-react";
import { Alert, Badge, Empty, PageHeader, Pagination, Pills, Section, Spinner, Table, td, th } from "../../ui/index.js";

const TABS = [
  ["", "Bills"],
  ["held", "Kept for later"],
  ["quotation", "Estimates"],
  ["cancelled", "Cancelled"],
];

export const BILL_STATUS = { final: ["green", "Done"], draft: ["amber", "Kept for later"], cancelled: ["red", "Cancelled"] };

// Opened from "Return Goods" / "Cancel a Bill" on the More page: both start from the bill.
const HELP = {
  return: "To take goods back: find the bill below, open it, then press “Return goods”.",
  cancel: "To cancel a bill: find it below, open it, then press “Cancel bill”.",
};

/** "2026-10-02" -> "2026-10-01" (local dates, not UTC). */
function dayBefore(iso) {
  const day = new Date(`${iso}T12:00:00`);
  day.setDate(day.getDate() - 1);
  return day.toISOString().slice(0, 10);
}

export default function BillList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { can } = useAuth();
  // Someone who only takes returns sees the bills list to find a bill, not the other tabs.
  const allTabs = can(A.VIEW_BILLS);
  const status = allTabs ? params.get("status") || "" : "";
  const day = params.get("day") ?? today();
  const page = Number(params.get("page") || 1);
  const [search, setSearch] = useState(params.get("search") || "");
  const help = HELP[params.get("help")];

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

  const yesterday = dayBefore(today());
  const listTitle =
    status === "held" ? "Kept for later" : status === "quotation" ? "Estimates" : !day ? "All dates" : day === today() ? "Today" : date(day);

  return (
    <>
      <PageHeader
        title={status === "held" ? "Kept for Later" : status === "quotation" ? "Estimates" : "Old Bills"}
        back={["/more", "All options"]}
        subtitle={
          status === "held"
            ? "Bills put on hold at the counter. Open one to finish it."
            : status === "quotation"
              ? "Price quotes given to customers. They are not bills."
              : day
                ? `Bills on ${date(day)}`
                : "All bills"
        }
      >
        <label className="flex items-center gap-2 h-11 px-3 w-[min(380px,100%)] rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-steel-700">
          <Search size={18} className="text-gray-500 shrink-0" />
          <input
            value={search}
            aria-label="Search bills"
            placeholder="Bill number, name or phone — press Enter"
            className="flex-1 min-w-0 bg-transparent focus:outline-none"
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && update({ search: search.trim(), day: "" })}
          />
        </label>
      </PageHeader>
      {help && <Alert kind="info">{help}</Alert>}
      <Alert>{error}</Alert>

      <div className="flex flex-wrap gap-5 items-start">
        <Section
          className="flex-[1_1_620px] min-w-0"
          title={data ? `${listTitle} · ${data.count} ${data.count === 1 ? "bill" : "bills"}` : listTitle}
          right={!undated && day && rows.length > 0 && <>Total <b className="text-gray-900">{money(dayTotal)}</b></>}
        >
          {loading && !data ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <Empty>{status === "held" ? "No bills kept for later." : status === "quotation" ? "No estimates yet." : "No bills here."}</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className={th}>Bill</th>
                  <th className={th}>When</th>
                  <th className={th}>Buyer</th>
                  <th className={`${th} text-right`}>Items</th>
                  <th className={`${th} text-right`}>Total</th>
                  <th className={`${th} text-right`}>Udhaar</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((bill) => (
                  <tr
                    key={bill.id}
                    className="hover:!bg-steel-50 cursor-pointer"
                    onClick={() => navigate(bill.kind === "invoice" && bill.status === "draft" ? `/billing?resume=${bill.id}` : `/bills/${bill.id}`)}
                  >
                    <td className={`${td} whitespace-nowrap font-semibold text-blue-800`}>{bill.number || "—"}</td>
                    <td className={`${td} whitespace-nowrap`}>{bill.kind === "quotation" ? date(bill.invoice_date) : dateTime(bill.finalised_at || bill.updated_at)}</td>
                    <td className={td}>
                      {bill.buyer_name || "Cash sale"}
                      {bill.buyer_phone && <span className="text-sm text-gray-500"> · {bill.buyer_phone}</span>}
                    </td>
                    <td className={`${td} text-right`}>{bill.line_count}</td>
                    <td className={`${td} text-right text-lg font-bold whitespace-nowrap`}>{money(bill.total)}</td>
                    <td className={`${td} text-right whitespace-nowrap ${Number(bill.credit_amount) > 0 ? "text-red-700 font-semibold" : "text-gray-400"}`}>
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
          {data && <Pagination page={page} count={data.count} onPage={(next) => update({ page: String(next) })} />}
        </Section>

        <Section className="flex-[1_1_260px] lg:max-w-[300px]" title="Show" bodyClassName="p-4 space-y-4">
          {!undated && (
            <div className="space-y-2">
              <Pills
                label="Day"
                options={[
                  [today(), "Today"],
                  [yesterday, "Yesterday"],
                  ["", "Any day"],
                ]}
                value={day}
                onChange={(value) => update({ day: value })}
              />
              <label className="flex items-center gap-2 text-[15px] text-gray-700">
                Or pick a date
                <input
                  type="date"
                  className="border border-gray-300 rounded-lg px-2 py-1.5"
                  value={day}
                  max={today()}
                  onChange={(e) => update({ day: e.target.value })}
                />
              </label>
            </div>
          )}
          {allTabs && <Pills label="Kind" options={TABS} value={status} onChange={(value) => update({ status: value })} />}
        </Section>
      </div>
    </>
  );
}
