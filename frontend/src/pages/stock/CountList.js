import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api.js";
import { useFetch } from "../../hooks/useFetch.js";
import { errorMessage } from "../../lib/errors.js";
import { dateTime } from "../../lib/format.js";
import { Alert, Badge, Button, Card, Empty, Field, Input, PageHeader, Pagination, Spinner, Table, td, th } from "../../ui/index.js";

export const COUNT_STATUS_COLOR = { open: "blue", posted: "green", cancelled: "gray" };

export default function CountList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const { data, error: loadError, loading } = useFetch(`/stock/counts?page=${page}`);

  async function start() {
    setError("");
    try {
      const response = await api.post("/stock/counts", { title: title.trim() });
      navigate(`/counts/${response.data.id}`);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Stock counts" subtitle="Count one rack or category at a time. What's on the shelf becomes the stock." />
      <Card className="p-5 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="What are you counting?" className="flex-1 min-w-[240px]">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && title.trim() && start()}
              placeholder='e.g. "Rack A3" or "Wires"'
            />
          </Field>
          <Button variant="primary" onClick={start} disabled={!title.trim()}>
            Start count
          </Button>
        </div>
        <Alert>{error}</Alert>
      </Card>
      <Alert>{loadError}</Alert>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : !data?.results.length ? (
          <Empty>No counts yet.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>Count</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Items</th>
                <th className={th}>Started</th>
                <th className={th}>Posted</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((count) => (
                <tr key={count.id} className="hover:bg-blue-50/50 cursor-pointer" onClick={() => navigate(`/counts/${count.id}`)}>
                  <td className={`${td} font-semibold`}>{count.title}</td>
                  <td className={td}>
                    <Badge color={COUNT_STATUS_COLOR[count.status]}>{count.status_display}</Badge>
                  </td>
                  <td className={`${td} text-right`}>{count.line_count}</td>
                  <td className={td}>
                    {dateTime(count.created_at)} <span className="text-gray-500">· {count.created_by}</span>
                  </td>
                  <td className={td}>
                    {count.posted_at ? (
                      <>
                        {dateTime(count.posted_at)} <span className="text-gray-500">· {count.posted_by}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {data && <Pagination page={page} count={data.count} onPage={setPage} />}
      </Card>
    </>
  );
}
