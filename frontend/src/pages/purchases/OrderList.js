import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, ShoppingCart } from "lucide-react";
import { useFetch } from "../../hooks/useFetch.js";
import { date } from "../../lib/format.js";
import { Alert, Badge, Button, Empty, PageHeader, Pagination, Pills, Section, Spinner, Table, td, th } from "../../ui/index.js";

export const ORDER_STATUS = { draft: "amber", sent: "blue", received: "green", cancelled: "gray" };

const TABS = [
  ["open", "Open"],
  ["received", "Received"],
  ["", "All"],
];

/** Orders for distributors (plan §18), newest first. */
export default function OrderList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "open";
  const page = Number(params.get("page") || 1);
  const query = new URLSearchParams({ page: String(page) });
  if (status) query.set("status", status);
  const { data, error, loading } = useFetch(`/purchases/orders?${query}`);

  return (
    <>
      <PageHeader title="Orders" back={["/more", "All options"]} subtitle="Orders for distributors: made, sent, received.">
        <Button to="/reorder">
          <ShoppingCart size={18} /> Reorder list
        </Button>
        <Button variant="primary" to="/orders/new">
          <Plus size={18} /> New order
        </Button>
      </PageHeader>
      <Alert>{error}</Alert>
      <Section title={data ? `Orders · ${data.count}` : "Orders"}>
        <div className="px-4 py-3 border-b border-gray-100">
          <Pills options={TABS} value={status} onChange={(value) => setParams({ status: value }, { replace: true })} />
        </div>
        {loading && !data ? (
          <Spinner />
        ) : !data?.results.length ? (
          <Empty>{status === "open" ? "No open orders. Make one from the reorder list." : "No orders."}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Order</th>
                <th className={th}>Distributor</th>
                <th className={`${th} text-right`}>Items</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((order) => (
                <tr key={order.id} className="hover:!bg-steel-50 cursor-pointer" onClick={() => navigate(`/orders/${order.id}`)}>
                  <td className={`${td} whitespace-nowrap`}>{date(order.order_date)}</td>
                  <td className={`${td} font-mono text-sm`}>{order.number}</td>
                  <td className={`${td} font-semibold`}>{order.supplier_name}</td>
                  <td className={`${td} text-right`}>{order.line_count}</td>
                  <td className={td}>
                    <Badge color={ORDER_STATUS[order.status]}>{order.status_display}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {data && <Pagination page={page} count={data.count} onPage={(next) => setParams({ status, page: String(next) }, { replace: true })} />}
      </Section>
    </>
  );
}
