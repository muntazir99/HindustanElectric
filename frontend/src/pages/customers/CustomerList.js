import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import CustomerForm, { CUSTOMER_KINDS } from "../../components/CustomerForm.js";
import { useFetch } from "../../hooks/useFetch.js";
import { money } from "../../lib/format.js";
import { Alert, Button, Card, Empty, Input, PageHeader, Pagination, Spinner, Table, td, th } from "../../ui/index.js";

const KIND_LABEL = Object.fromEntries(CUSTOMER_KINDS);

export function BalanceText({ balance }) {
  const value = Number(balance);
  if (value > 0) return <span className="text-red-700 font-semibold">owes {money(value)}</span>;
  if (value < 0) return <span className="text-green-700 font-semibold">advance {money(-value)}</span>;
  return <span className="text-gray-400">nothing due</span>;
}

export default function CustomerList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const owing = params.get("owing") === "1";
  const page = Number(params.get("page") || 1);
  const [search, setSearch] = useState(params.get("search") || "");
  const [adding, setAdding] = useState(false);

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
      <PageHeader title="Customers" subtitle="Khata (udhaar) and regular buyers">
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus size={18} /> New customer
        </Button>
      </PageHeader>
      <Card className="p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-2">
          {[["", "All"], ["1", "Owe money"]].map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => update({ owing: value })}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${
                (owing ? "1" : "") === value ? "bg-blue-700 text-white border-blue-700" : "bg-white text-gray-700 border-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[240px]">
          <Input
            value={search}
            placeholder="Name, phone or GSTIN — press Enter"
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && update({ search: search.trim() })}
          />
        </div>
      </Card>
      <Alert>{error}</Alert>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : !data?.results.length ? (
          <Empty>{owing ? "Nobody owes money." : "No customers yet. They're added from here or while billing."}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Phone</th>
                <th className={th}>Type</th>
                <th className={`${th} text-right`}>Khata</th>
                <th className={`${th} text-right`}>Credit limit</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((customer) => (
                <tr key={customer.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => navigate(`/customers/${customer.id}`)}>
                  <td className={`${td} font-semibold`}>{customer.name}</td>
                  <td className={td}>{customer.phone || "—"}</td>
                  <td className={td}>{KIND_LABEL[customer.kind]}</td>
                  <td className={`${td} text-right`}>
                    <BalanceText balance={customer.balance} />
                  </td>
                  <td className={`${td} text-right text-gray-600`}>
                    {customer.credit_limit === null ? "no limit" : money(customer.credit_limit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {data && <Pagination page={page} count={data.count} onPage={(next) => update({ page: String(next) })} />}
      </Card>
      {adding && (
        <CustomerForm
          onClose={() => setAdding(false)}
          onSaved={(customer) => navigate(`/customers/${customer.id}`)}
        />
      )}
    </>
  );
}
