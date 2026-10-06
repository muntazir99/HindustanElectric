import { useState } from "react";
import { Link } from "react-router-dom";
import ItemSearch from "../../components/ItemSearch.js";
import { useAuth } from "../../context/AuthContext.js";
import { A } from "../../lib/access.js";
import { useFetch } from "../../hooks/useFetch.js";
import { bigMoney, dateTime, money, plural, signed, today } from "../../lib/format.js";
import { Alert, Empty, PageHeader, Pagination, Section, Spinner, Table, td, th } from "../../ui/index.js";
import AdjustModal from "./AdjustModal.js";

/** What written-off stock cost the shop in a month, by reason (needs "See costs and profit"). */
function Losses({ month, onMonth, losses }) {
  const monthName = new Date(`${month}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return (
    <Section
      title="Losses"
      className="mb-5"
      bodyClassName="p-4"
      right={
        <input
          type="month"
          value={month}
          max={today().slice(0, 7)}
          onChange={(event) => event.target.value && onMonth(event.target.value)}
          aria-label="Month"
          className="h-9 px-2 rounded-lg border border-gray-300 bg-white text-sm"
        />
      }
    >
      {!losses ? (
        <Spinner />
      ) : (
        <>
          <p>
            <span className={`text-[30px] font-bold leading-none ${Number(losses.total) ? "text-red-700" : "text-gray-900"}`}>
              {bigMoney(losses.total)}
            </span>{" "}
            <span className="text-gray-600">written off in {monthName}</span>
          </p>
          {losses.by_reason.length > 0 ? (
            <ul className="mt-3 divide-y divide-gray-100 border-y border-gray-100">
              {losses.by_reason.map((row) => (
                <li key={row.reason} className="flex justify-between gap-4 py-2">
                  <span>
                    {row.label} <span className="text-sm text-gray-500">· {plural(row.entries, "write-off")}</span>
                  </span>
                  <b>{money(row.value)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 mt-2">Nothing written off this month.</p>
          )}
          {losses.uncosted > 0 && (
            <p className="text-sm text-amber-800 mt-2">
              {plural(losses.uncosted, "write-off")} had no cost yet (stock from before the app, with no purchase entered), so
              {losses.uncosted === 1 ? " it isn't" : " they aren't"} in the total.
            </p>
          )}
          <p className="text-sm text-gray-500 mt-2">Valued at each item's average buying cost on the day. Corrections of typing mistakes aren't counted.</p>
        </>
      )}
    </Section>
  );
}

export default function Adjustments() {
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const [item, setItem] = useState(null);
  const [message, setMessage] = useState("");
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const { data, error, loading, reload } = useFetch(`/stock/adjustments?page=${page}`);
  const seeCosts = can(A.SEE_COSTS);
  const losses = useFetch(seeCosts ? `/stock/losses?month=${month}` : null);

  return (
    <>
      <PageHeader
        title="Fix Stock"
        back={["/more", "All options"]}
        subtitle="Broken, lost, used in the shop, or a mistake. Every change is recorded with a reason."
      />
      <Section title="Fix an item's stock" className="mb-5" bodyClassName="p-4">
        <p className="font-semibold mb-2">Which item?</p>
        <ItemSearch onSelect={(selected) => setItem(selected)} cameraKeepsOpen={false} />
      </Section>
      <Alert kind="success" onClose={() => setMessage("")}>
        {message}
      </Alert>
      {seeCosts && <Losses month={month} onMonth={setMonth} losses={losses.data} />}
      <Alert>{error}</Alert>
      <Section title="Stock fixed so far">
        {loading && !data ? (
          <Spinner />
        ) : !data?.results.length ? (
          <Empty>No stock fixed yet.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>When</th>
                <th className={th}>Item</th>
                <th className={`${th} text-right`}>Change</th>
                <th className={th}>Reason</th>
                <th className={th}>Note</th>
                <th className={th}>By</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((row) => (
                <tr key={row.id}>
                  <td className={`${td} whitespace-nowrap`}>{dateTime(row.created_at)}</td>
                  <td className={td}>
                    <Link to={`/items/${row.item}`} className="text-blue-800 hover:underline">
                      {row.item_name}
                    </Link>
                  </td>
                  <td className={`${td} text-right font-semibold ${Number(row.quantity) < 0 ? "text-red-700" : "text-green-700"}`}>
                    {signed(row.quantity)} {row.base_unit}
                  </td>
                  <td className={td}>{row.reason_display}</td>
                  <td className={`${td} text-sm text-gray-600`}>{row.note}</td>
                  <td className={td}>{row.created_by}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {data && <Pagination page={page} count={data.count} onPage={setPage} />}
      </Section>
      {item && (
        <AdjustModal
          item={item}
          onClose={() => setItem(null)}
          onDone={() => {
            setMessage(`Adjusted ${item.name}.`);
            setItem(null);
            setPage(1);
            reload();
            if (seeCosts) losses.reload();
          }}
        />
      )}
    </>
  );
}
