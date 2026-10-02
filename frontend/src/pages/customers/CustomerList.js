import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import CustomerForm, { CUSTOMER_KINDS } from "../../components/CustomerForm.js";
import { useFetch } from "../../hooks/useFetch.js";
import { bigMoney, money, plural } from "../../lib/format.js";
import { Alert, Button, Empty, PageHeader, Pagination, Pills, Section, Spinner, Table, td, th } from "../../ui/index.js";

const KIND_LABEL = Object.fromEntries(CUSTOMER_KINDS);

export function BalanceText({ balance }) {
  const value = Number(balance);
  if (value > 0) return <span className="text-red-700 font-semibold">owes {money(value)}</span>;
  if (value < 0) return <span className="text-green-700 font-semibold">advance {money(-value)}</span>;
  return <span className="text-gray-400">nothing due</span>;
}

/** One figure in the udhaar box: label, big amount, note. */
function Figure({ label, value, hint, tone }) {
  return (
    <div className="flex-[1_1_200px] px-4 py-3.5 border-r border-b border-gray-100">
      <p className="text-[15px] text-gray-600">{label}</p>
      <p className={`text-[28px] font-bold leading-tight ${tone}`}>{value}</p>
      {hint && <p className="text-sm text-gray-500">{hint}</p>}
    </div>
  );
}

export default function CustomerList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const owing = params.get("owing") === "1";
  const page = Number(params.get("page") || 1);
  const [search, setSearch] = useState(params.get("search") || "");
  const [adding, setAdding] = useState(false);
  const { data: today } = useFetch("/sales/today");

  function update(changes) {
    const next = new URLSearchParams(params);
    Object.entries({ page: "", ...changes }).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  }

  const query = new URLSearchParams({ page: String(page) });
  if (owing) query.set("owing", "1");
  if (params.get("search")) query.set("search", params.get("search"));
  const { data, error, loading } = useFetch(`/sales/customers?${query}`);

  return (
    <>
      <PageHeader title="Khata (Udhaar)" back={["/dashboard", "Home"]} subtitle="Who owes the shop money, and payments received">
        <Button onClick={() => setAdding(true)} className="text-blue-800">
          <Plus size={20} /> Add customer
        </Button>
      </PageHeader>

      {/* The money figures need "See khata"; someone who only takes payments sees just the list. */}
      {today?.khata_collected !== undefined && (
        <Section title="Udhaar" className="mb-5">
          <div className="flex flex-wrap -mb-px -mr-px">
            {today.udhaar_outstanding !== undefined && (
              <Figure
                label="You will get"
                value={bigMoney(today.udhaar_outstanding)}
                hint={today.customers_owing === 0 ? "Nobody owes money" : `from ${plural(today.customers_owing, "customer")}`}
                tone={Number(today.udhaar_outstanding) ? "text-red-700" : "text-gray-900"}
              />
            )}
            <Figure
              label="Received today"
              value={bigMoney(today.khata_collected)}
              hint="Udhaar paid back"
              tone={Number(today.khata_collected) ? "text-green-700" : "text-gray-900"}
            />
            <Figure label="Given on udhaar today" value={bigMoney(today.on_khata)} hint="On today's bills" tone="text-gray-900" />
          </div>
        </Section>
      )}

      <Alert>{error}</Alert>
      <Section title={data ? `Customers · ${data.count}` : "Customers"}>
        <div className="px-4 py-3 flex flex-wrap gap-3 items-center border-b border-gray-100">
          <Pills options={[["", "Everyone"], ["1", "Owe money"]]} value={owing ? "1" : ""} onChange={(value) => update({ owing: value })} />
          <label className="flex-1 min-w-[240px] flex items-center gap-2 h-11 px-3 rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-steel-700">
            <Search size={18} className="text-gray-500 shrink-0" />
            <input
              value={search}
              aria-label="Search customers"
              placeholder="Name or phone number — press Enter"
              className="flex-1 min-w-0 bg-transparent focus:outline-none"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && update({ search: search.trim() })}
            />
          </label>
        </div>
        {loading && !data ? (
          <Spinner />
        ) : !data?.results.length ? (
          <Empty>{owing ? "Nobody owes money." : "No customers yet. Add one here, or while making a bill."}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={`${th} hidden sm:table-cell`}>Phone</th>
                <th className={`${th} hidden sm:table-cell`}>Type</th>
                <th className={`${th} text-right`}>Udhaar</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((customer) => {
                const balance = Number(customer.balance);
                return (
                  <tr key={customer.id} className="hover:!bg-steel-50 cursor-pointer" onClick={() => navigate(`/customers/${customer.id}`)}>
                    <td className={td}>
                      <Link to={`/customers/${customer.id}`} className="font-semibold text-blue-800 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {customer.name}
                      </Link>
                      {/* On a phone, phone and type sit under the name so the udhaar fits without swiping. */}
                      <span className="sm:hidden block text-sm text-gray-500">
                        {[customer.phone, KIND_LABEL[customer.kind]].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className={`${td} hidden sm:table-cell whitespace-nowrap`}>{customer.phone || "—"}</td>
                    <td className={`${td} hidden sm:table-cell`}>{KIND_LABEL[customer.kind]}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      {balance === 0 ? (
                        <span className="text-gray-400">nothing due</span>
                      ) : (
                        <>
                          <span className={`text-lg font-bold ${balance > 0 ? "text-red-700" : "text-green-700"}`}>{money(Math.abs(balance))}</span>{" "}
                          <span className="text-sm text-gray-500">{balance > 0 ? "owes" : "advance"}</span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {data && <Pagination page={page} count={data.count} onPage={(next) => update({ page: String(next) })} />}
      </Section>
      {adding && <CustomerForm onClose={() => setAdding(false)} onSaved={(customer) => navigate(`/customers/${customer.id}`)} />}
    </>
  );
}
