import { useState } from "react";
import { Link } from "react-router-dom";
import ItemSearch from "../../components/ItemSearch.js";
import { useFetch } from "../../hooks/useFetch.js";
import { dateTime, signed } from "../../lib/format.js";
import { Alert, Card, Empty, PageHeader, Pagination, Spinner, Table, td, th } from "../../ui/index.js";
import AdjustModal from "./AdjustModal.js";

export default function Adjustments() {
  const [page, setPage] = useState(1);
  const [item, setItem] = useState(null);
  const [message, setMessage] = useState("");
  const { data, error, loading, reload } = useFetch(`/stock/adjustments?page=${page}`);

  return (
    <>
      <PageHeader title="Adjustments" subtitle="Breakage, loss, samples and corrections. Every one is recorded with a reason." />
      <Card className="p-5 mb-6">
        <p className="font-semibold mb-2">Adjust an item</p>
        <ItemSearch onSelect={(selected) => setItem(selected)} />
      </Card>
      <Alert kind="success" onClose={() => setMessage("")}>
        {message}
      </Alert>
      <Alert>{error}</Alert>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : !data?.results.length ? (
          <Empty>No adjustments yet.</Empty>
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
      </Card>
      {item && (
        <AdjustModal
          item={item}
          onClose={() => setItem(null)}
          onDone={() => {
            setMessage(`Adjusted ${item.name}.`);
            setItem(null);
            setPage(1);
            reload();
          }}
        />
      )}
    </>
  );
}
