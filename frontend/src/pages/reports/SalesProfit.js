import { useState } from "react";
import { Download } from "lucide-react";
import { useFetch } from "../../hooks/useFetch.js";
import { downloadFile } from "../../lib/download.js";
import { errorMessage } from "../../lib/errors.js";
import { bigMoney, date, money, plural, today } from "../../lib/format.js";
import { Alert, Button, PageHeader, Pills, Section, Spinner, Table, td, th } from "../../ui/index.js";

/** Quick periods: [label, from, to] as yyyy-mm-dd. */
export function periods(now = today()) {
  const [year, month] = now.split("-").map(Number);
  const iso = (d) => d.toISOString().slice(0, 10);
  const lastStart = new Date(Date.UTC(month === 1 ? year - 1 : year, month === 1 ? 11 : month - 2, 1));
  const lastEnd = new Date(Date.UTC(year, month - 1, 0));
  return [
    ["Today", now, now],
    ["This month", `${now.slice(0, 7)}-01`, now],
    ["Last month", iso(lastStart), iso(lastEnd)],
  ];
}

function periodLabel(value) {
  return value.length === 7 ? new Date(`${value}-01T12:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : date(value);
}

function Figure({ label, value, hint, tone = "text-gray-900" }) {
  return (
    <div className="flex-[1_1_170px] px-4 py-3 border-r border-b border-gray-100">
      <p className="text-[15px] text-gray-600">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${tone}`}>{value}</p>
      {hint && <p className="text-sm text-gray-500">{hint}</p>}
    </div>
  );
}

const profitTone = (value) => (Number(value) < 0 ? "text-red-700" : "text-green-700");

/** Profit and margin cells, for people who may see costs. */
function ProfitCells({ row }) {
  return (
    <>
      <td className={`${td} text-right font-semibold ${profitTone(row.profit)}`}>{row.profit === null ? "—" : money(row.profit)}</td>
      <td className={`${td} text-right`}>{row.margin === null ? "—" : `${row.margin}%`}</td>
    </>
  );
}

/** Sales and profit (plan §16.2): totals, by day or month, by item, by category; Excel download. */
export default function SalesProfit() {
  const quick = periods();
  const [range, setRange] = useState({ from: quick[1][1], to: quick[1][2] });
  const [allItems, setAllItems] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const query = `from=${range.from}&to=${range.to}`;
  const { data, error, loading } = useFetch(`/sales/report?${query}`);
  const costs = data && "profit" in data.summary;
  const s = data?.summary;
  const picked = quick.find(([, from, to]) => from === range.from && to === range.to)?.[0] ?? "";
  const items = data ? (allItems ? data.by_item : data.by_item.slice(0, 20)) : [];

  async function download() {
    setDownloadError("");
    try {
      await downloadFile(`/sales/report?${query}&download=xlsx`, `sales-${range.from}-to-${range.to}.xlsx`);
    } catch (err) {
      setDownloadError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="Sales and profit" back={["/more", "All options"]} subtitle="What sold, what came back, and what it earned.">
        <Button onClick={download} disabled={!data}>
          <Download size={18} /> Excel
        </Button>
      </PageHeader>

      <Section title="Period" className="mb-5" bodyClassName="p-4 flex flex-wrap items-end gap-4">
        <Pills
          options={quick.map(([label]) => [label, label])}
          value={picked}
          onChange={(label) => {
            const [, from, to] = quick.find(([name]) => name === label);
            setRange({ from, to });
          }}
        />
        <label className="flex items-center gap-2">
          From
          <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} className="h-11 px-3 rounded-lg border border-gray-300 bg-white" />
        </label>
        <label className="flex items-center gap-2">
          To
          <input type="date" value={range.to} min={range.from} max={today()} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} className="h-11 px-3 rounded-lg border border-gray-300 bg-white" />
        </label>
      </Section>

      <Alert>{error || downloadError}</Alert>
      {loading && !data ? (
        <Spinner />
      ) : (
        data && (
          <div className="space-y-5">
            <Section title={`${date(data.from)} to ${date(data.to)} · ${plural(s.bills, "bill")}`} bodyClassName="flex flex-wrap -mb-px -mr-px">
              <Figure label="Sales" value={bigMoney(s.sales)} hint="with GST" />
              <Figure label="Returns" value={bigMoney(s.returns)} />
              <Figure label="Net sales" value={bigMoney(s.net_sales)} hint={`${money(s.taxable)} before GST · GST ${money(s.gst)}`} />
              {costs && (
                <Figure
                  label="Profit"
                  value={s.profit === null ? "—" : bigMoney(s.profit)}
                  tone={profitTone(s.profit)}
                  hint={s.margin === null ? "No sales with a known cost" : `${s.margin}% of sales before GST`}
                />
              )}
            </Section>
            {costs && Number(s.unknown_cost_sales) > 0 && (
              <Alert kind="info">
                Profit unknown on {money(s.unknown_cost_sales)} of sales (before GST): those items had no cost yet, as stock from before the app
                with no purchase entered. It isn't counted in the profit.
              </Alert>
            )}

            <Section title={data.by === "month" ? "By month" : "By day"}>
              {data.by_period.length === 0 ? (
                <p className="px-4 py-5 text-gray-500">No sales in this period.</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th className={th}>{data.by === "month" ? "Month" : "Day"}</th>
                      <th className={`${th} text-right`}>Bills</th>
                      <th className={`${th} text-right`}>Sales</th>
                      <th className={`${th} text-right`}>Returns</th>
                      <th className={`${th} text-right`}>Net sales</th>
                      {costs && <th className={`${th} text-right`}>Profit</th>}
                      {costs && <th className={`${th} text-right`}>Margin</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_period.map((row) => (
                      <tr key={row.period}>
                        <td className={`${td} whitespace-nowrap`}>{periodLabel(row.period)}</td>
                        <td className={`${td} text-right`}>{row.bills}</td>
                        <td className={`${td} text-right`}>{money(row.sales)}</td>
                        <td className={`${td} text-right`}>{money(row.returns)}</td>
                        <td className={`${td} text-right font-semibold`}>{money(row.net_sales)}</td>
                        {costs && <ProfitCells row={row} />}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Section>

            <Section
              title={allItems ? `Items · ${data.by_item.length}` : "Top items"}
              right={
                data.by_item.length > 20 && (
                  <button type="button" onClick={() => setAllItems(!allItems)} className="font-semibold text-blue-800 hover:underline">
                    {allItems ? "Top 20 only" : `Show all ${data.by_item.length}`}
                  </button>
                )
              }
            >
              {items.length === 0 ? (
                <p className="px-4 py-5 text-gray-500">Nothing sold in this period.</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th className={th}>Item</th>
                      <th className={`${th} text-right`}>Sold</th>
                      <th className={`${th} text-right`}>Net sales</th>
                      {costs && <th className={`${th} text-right`}>Profit</th>}
                      {costs && <th className={`${th} text-right`}>Margin</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.item}>
                        <td className={td}>{row.name}</td>
                        <td className={`${td} text-right whitespace-nowrap`}>
                          {row.quantity ?? 0} {row.unit}
                        </td>
                        <td className={`${td} text-right font-semibold`}>{money(row.net_sales)}</td>
                        {costs && <ProfitCells row={row} />}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Section>

            <Section title="By category">
              {data.by_category.length === 0 ? (
                <p className="px-4 py-5 text-gray-500">Nothing sold in this period.</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th className={th}>Category</th>
                      <th className={`${th} text-right`}>Net sales</th>
                      {costs && <th className={`${th} text-right`}>Profit</th>}
                      {costs && <th className={`${th} text-right`}>Margin</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_category.map((row) => (
                      <tr key={row.category}>
                        <td className={td}>{row.category}</td>
                        <td className={`${td} text-right font-semibold`}>{money(row.net_sales)}</td>
                        {costs && <ProfitCells row={row} />}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Section>
          </div>
        )
      )}
    </>
  );
}
