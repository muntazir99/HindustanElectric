import { useNavigate, useSearchParams } from "react-router-dom";
import { Paperclip, Plus } from "lucide-react";
import { useFetch } from "../../hooks/useFetch.js";
import { date, money } from "../../lib/format.js";
import { Alert, Badge, Button, Empty, Input, PageHeader, Pagination, Pills, Section, Spinner, Table, td, th } from "../../ui/index.js";

const TABS = [
  ["", "All"],
  ["draft", "Not added to stock"],
  ["posted", "Added to stock"],
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
      <PageHeader
        title="Purchase Bills"
        back={["/more", "All options"]}
        subtitle="Bills from distributors. The goods go into stock when you press “Add to stock”."
      >
        <Button variant="primary" to="/purchases/new">
          <Plus size={18} /> Goods Arrived
        </Button>
      </PageHeader>
      <Alert>{error}</Alert>
      <Section title={data ? `Purchase bills · ${data.count}` : "Purchase bills"}>
        <div className="px-4 py-3 flex flex-wrap gap-3 items-center border-b border-gray-100">
          <Pills options={TABS} value={status} onChange={(value) => update({ status: value })} />
          <div className="flex-1 min-w-[220px]">
            <Input defaultValue={search} placeholder="Bill number or distributor" onChange={(e) => update({ search: e.target.value.trim() })} />
          </div>
        </div>
        {loading && !data ? (
          <Spinner />
        ) : !data?.results.length ? (
          <Empty>No bills{status || search ? " match" : " yet"}.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Bill date</th>
                <th className={th}>Distributor</th>
                <th className={th}>Bill no.</th>
                <th className={`${th} text-right`}>Lines</th>
                <th className={`${th} text-right`}>Total</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((bill) => (
                <tr key={bill.id} className="hover:!bg-steel-50 cursor-pointer" onClick={() => navigate(`/purchases/${bill.id}`)}>
                  <td className={`${td} whitespace-nowrap`}>{date(bill.bill_date)}</td>
                  <td className={`${td} font-semibold`}>{bill.supplier_name}</td>
                  <td className={td}>
                    {bill.bill_number}
                    {bill.has_attachment && <Paperclip size={14} className="inline ml-1 text-gray-500" aria-label="Has photo" />}
                  </td>
                  <td className={`${td} text-right`}>{bill.line_count}</td>
                  <td className={`${td} text-right font-semibold`}>{money(bill.total)}</td>
                  <td className={td}>
                    <Badge color={bill.status === "posted" ? "green" : "amber"}>{bill.status === "posted" ? "Added to stock" : "Not added yet"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {data && <Pagination page={page} count={data.count} onPage={(next) => update({ page: String(next) })} />}
      </Section>
    </>
  );
}
