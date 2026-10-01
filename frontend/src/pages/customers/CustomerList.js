import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronRight, Plus } from "lucide-react";
import CustomerForm, { CUSTOMER_KINDS } from "../../components/CustomerForm.js";
import { useAuth } from "../../context/AuthContext.js";
import { useFetch } from "../../hooks/useFetch.js";
import { bigMoney, money, plural } from "../../lib/format.js";
import { Alert, Button, Card, Empty, Input, PageHeader, Pagination, Spinner } from "../../ui/index.js";

const KIND_LABEL = Object.fromEntries(CUSTOMER_KINDS);

export function BalanceText({ balance }) {
  const value = Number(balance);
  if (value > 0) return <span className="text-red-700 font-semibold">owes {money(value)}</span>;
  if (value < 0) return <span className="text-green-700 font-semibold">advance {money(-value)}</span>;
  return <span className="text-gray-400">nothing due</span>;
}

function Summary({ label, value, hint, tone }) {
  return (
    <Card className="p-5">
      <p className="text-gray-600">{label}</p>
      <p className={`text-3xl font-bold leading-tight ${tone}`}>{value}</p>
      {hint && <p className="text-sm text-gray-500">{hint}</p>}
    </Card>
  );
}

function CustomerRow({ customer }) {
  const balance = Number(customer.balance);
  const avatar = balance > 0 ? "bg-red-50 text-red-700" : balance < 0 ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600";
  return (
    <li>
      <Link to={`/customers/${customer.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-blue-50/50">
        <span className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold ${avatar}`}>
          {customer.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold truncate">{customer.name}</span>
          <span className="block text-sm text-gray-500">{[customer.phone, KIND_LABEL[customer.kind]].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="text-right">
          {balance === 0 ? (
            <span className="text-gray-400">nothing due</span>
          ) : (
            <>
              <span className={`block text-lg font-bold ${balance > 0 ? "text-red-700" : "text-green-700"}`}>{money(Math.abs(balance))}</span>
              <span className="block text-sm text-gray-500">{balance > 0 ? "owes" : "advance"}</span>
            </>
          )}
        </span>
        <ChevronRight size={20} className="text-gray-400 shrink-0" />
      </Link>
    </li>
  );
}

export default function CustomerList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
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

      {today && (
        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          {isOwner && today.udhaar_outstanding !== undefined && (
            <Summary
              label="You will get"
              value={bigMoney(today.udhaar_outstanding)}
              hint={today.customers_owing === 0 ? "Nobody owes money" : `from ${plural(today.customers_owing, "customer")}`}
              tone={Number(today.udhaar_outstanding) ? "text-red-700" : "text-gray-900"}
            />
          )}
          <Summary
            label="Received today"
            value={bigMoney(today.khata_collected)}
            hint="Udhaar paid back"
            tone={Number(today.khata_collected) ? "text-green-700" : "text-gray-900"}
          />
          <Summary label="Given on udhaar today" value={bigMoney(today.on_khata)} hint="On today's bills" tone="text-gray-900" />
        </div>
      )}

      <Card>
        <div className="p-4 md:p-5 flex flex-wrap gap-3 items-center border-b border-gray-200">
          <div className="flex gap-2" role="tablist" aria-label="Show">
            {[["", "Everyone"], ["1", "Owe money"]].map(([value, label]) => {
              const chosen = (owing ? "1" : "") === value;
              return (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={chosen}
                  onClick={() => update({ owing: value })}
                  className={`px-4 py-1.5 rounded-full font-semibold border ${
                    chosen ? "bg-blue-800 text-white border-blue-800" : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex-1 min-w-[240px]">
            <Input
              value={search}
              aria-label="Search customers"
              placeholder="Name or phone number — press Enter"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && update({ search: search.trim() })}
            />
          </div>
        </div>
        <Alert>{error}</Alert>
        {loading && !data ? (
          <Spinner />
        ) : !data?.results.length ? (
          <Empty>{owing ? "Nobody owes money." : "No customers yet. Add one here, or while making a bill."}</Empty>
        ) : (
          <ul className="divide-y divide-gray-100">
            {data.results.map((customer) => (
              <CustomerRow key={customer.id} customer={customer} />
            ))}
          </ul>
        )}
        {data && <Pagination page={page} count={data.count} onPage={(next) => update({ page: String(next) })} />}
      </Card>
      {adding && <CustomerForm onClose={() => setAdding(false)} onSaved={(customer) => navigate(`/customers/${customer.id}`)} />}
    </>
  );
}
