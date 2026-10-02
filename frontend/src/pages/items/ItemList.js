import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileSpreadsheet, Plus, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext.js";
import { A } from "../../lib/access.js";
import { useFetch } from "../../hooks/useFetch.js";
import { money } from "../../lib/format.js";
import { Alert, Badge, Button, Empty, PageHeader, Pagination, Pills, Section, Select, Spinner, Table, inputClass, td, th } from "../../ui/index.js";

const FILTERS = [
  ["", "All"],
  ["low", "Running low"],
  ["not_counted", "Not checked yet"],
  ["needs_recount", "Check again"],
  ["inactive", "Not sold any more"],
];

export function StatusBadges({ item }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {!item.is_active && <Badge color="gray">Not sold any more</Badge>}
      {!item.counted_at && <Badge color="amber">Not checked yet</Badge>}
      {item.needs_recount && <Badge color="red">Check again</Badge>}
      {item.is_low && <Badge color="red">Running low</Badge>}
    </span>
  );
}

export default function ItemList() {
  const { can } = useAuth();
  const canCost = can(A.SEE_COSTS);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const status = params.get("status") || "";
  const category = params.get("category") || "";
  const page = Number(params.get("page") || 1);

  // Update the URL (and so the list) shortly after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => update({ search: search.trim() }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function update(changes) {
    const next = new URLSearchParams(params);
    Object.entries({ page: "", ...changes }).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }

  const query = new URLSearchParams({ page: String(page) });
  ["search", "status", "category", "ordering"].forEach((key) => params.get(key) && query.set(key, params.get(key)));
  const { data, error, loading } = useFetch(`/catalog/items?${query}`);
  const { data: categories } = useFetch("/catalog/categories");

  return (
    <>
      <PageHeader
        title={status === "low" ? "Running Low" : "All Items"}
        back={["/more", "All options"]}
        subtitle={data ? `${data.count} item${data.count === 1 ? "" : "s"}` : ""}
      >
        {can(A.IMPORT) && (
          <Button to="/import">
            <FileSpreadsheet size={18} /> Upload from Excel
          </Button>
        )}
        {can(A.ADD_ITEMS) && (
          <Button variant="primary" to="/items/new">
            <Plus size={18} /> Add New Item
          </Button>
        )}
      </PageHeader>

      <Alert>{error}</Alert>
      <Section title={data ? `${status === "low" ? "Running low" : "Items"} · ${data.count}` : "Items"}>
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                className={`${inputClass} pl-10`}
                placeholder="Search name, brand, size, code or scan a barcode"
                value={search}
                autoFocus
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search items"
              />
            </div>
            <div className="w-56">
              <Select value={category} onChange={(event) => update({ category: event.target.value })} aria-label="Category">
                <option value="">All categories</option>
                {(categories || []).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="mt-3">
            <Pills options={FILTERS} value={status} onChange={(value) => update({ status: value })} />
          </div>
        </div>
        {loading && !data ? (
          <Spinner />
        ) : data?.results.length === 0 ? (
          <Empty>
            {params.toString() ? "No items match." : "No items yet. Add one, or import your list from Excel."}
          </Empty>
        ) : (
          data && (
            <Table>
              <thead>
                <tr>
                  <th className={th}>Code</th>
                  <th className={th}>Item</th>
                  <th className={th}>Rack</th>
                  <th className={`${th} text-right`}>Stock</th>
                  <th className={`${th} text-right`}>Price</th>
                  <th className={`${th} text-right`}>MRP</th>
                  {canCost && <th className={`${th} text-right`}>Avg cost</th>}
                </tr>
              </thead>
              <tbody>
                {data.results.map((item) => (
                  <tr key={item.id} className="hover:!bg-steel-50 cursor-pointer" onClick={() => navigate(`/items/${item.id}`)}>
                    <td className={`${td} text-gray-500 font-mono text-sm`}>{item.code}</td>
                    <td className={td}>
                      <div className="font-semibold text-blue-800">{item.name}</div>
                      <div className="text-sm text-gray-500 flex flex-wrap gap-2 items-center">
                        {item.category && <span>{item.category}</span>}
                        <StatusBadges item={item} />
                      </div>
                    </td>
                    <td className={td}>{item.rack || "—"}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      {item.counted_at ? (
                        <span className={Number(item.stock_qty) < 0 || item.is_low ? "text-red-700 font-bold" : "font-semibold"}>
                          {item.stock_display}
                        </span>
                      ) : (
                        <span className="text-gray-400" title={`System: ${item.stock_display}`}>
                          —
                        </span>
                      )}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      {money(item.selling_price)}
                      <span className="text-gray-500 text-sm">/{item.base_unit}</span>
                    </td>
                    <td className={`${td} text-right whitespace-nowrap text-gray-600`}>{money(item.mrp)}</td>
                    {canCost && <td className={`${td} text-right whitespace-nowrap text-gray-600`}>{money(item.cost_price)}</td>}
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        )}
        {data && <Pagination page={page} count={data.count} onPage={(next) => update({ page: String(next) })} />}
      </Section>
    </>
  );
}
