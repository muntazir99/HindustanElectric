import { useNavigate, useSearchParams } from "react-router-dom";
import { Paperclip, Plus } from "lucide-react";
import { useFetch } from "../../hooks/useFetch.js";
import { date, money } from "../../lib/format.js";
import { Alert, Badge, Button, Card, Empty, Input, PageHeader, Pagination, Spinner, Table, td, th } from "../../ui/index.js";

const TABS = [
  ["", "All"],
  ["draft", "Not posted"],
  ["posted", "Posted"],
];

export default function PurchaseList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "";
  const search = params.get("search") || "";
  const page = Number(params.get("page") || 1);

  function update(changes) {
    const next = new URLSearchParams(params);
    Object.entries({ page: "", ...changes }).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  }

  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set("status", status);
  if (search) query.set("search", search);
  const { data, error, loading } = useFetch(`/purchases/bills?${query}`);

  return (
    <>
      <PageHeader title="Purchases" subtitle="Bills from distributors. Posting a bill adds its goods to stock.">
        <Button variant="primary" to="/purchases/new">
          <Plus size={18} /> Enter a bill
        </Button>
      </PageHeader>
      <Card className="p-4 mb-4 flex flex-wrap gap-3 items-center">
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
        <div className="flex-1 min-w-[220px]">
          <Input defaultValue={search} placeholder="Search bill number or supplier" onChange={(e) => update({ search: e.target.value.trim() })} />
        </div>
      </Card>
      <Alert>{error}</Alert>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : !data?.results.length ? (
          <Empty>No bills{status || search ? " match" : " yet"}.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Bill date</th>
                <th className={th}>Supplier</th>
                <th className={th}>Bill no.</th>
                <th className={`${th} text-right`}>Lines</th>
                <th className={`${th} text-right`}>Total</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((bill) => (
                <tr key={bill.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => navigate(`/purchases/${bill.id}`)}>
                  <td className={`${td} whitespace-nowrap`}>{date(bill.bill_date)}</td>
                  <td className={`${td} font-semibold`}>{bill.supplier_name}</td>
                  <td className={td}>
                    {bill.bill_number}
                    {bill.has_attachment && <Paperclip size={14} className="inline ml-1 text-gray-500" aria-label="Has photo" />}
                  </td>
                  <td className={`${td} text-right`}>{bill.line_count}</td>
                  <td className={`${td} text-right font-semibold`}>{money(bill.total)}</td>
                  <td className={td}>
                    <Badge color={bill.status === "posted" ? "green" : "amber"}>{bill.status === "posted" ? "Posted" : "Not posted"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {data && <Pagination page={page} count={data.count} onPage={(next) => update({ page: String(next) })} />}
      </Card>
    </>
  );
}
