import { useState } from "react";
import { Printer } from "lucide-react";
import { useFetch } from "../../hooks/useFetch.js";
import { bigMoney, date, money, plural, today } from "../../lib/format.js";
import { Alert, Button, NumberInput, PageHeader, Section, Spinner, Table, td, th } from "../../ui/index.js";

/** Cash counted against cash in drawer: matches, short or extra. */
export function difference(expected, counted) {
  if (counted === "" || Number.isNaN(Number(counted))) return null;
  const gap = Math.round((Number(counted) - Number(expected)) * 100) / 100;
  if (gap === 0) return { tone: "text-green-700", text: "Matches the cash in drawer" };
  return gap < 0 ? { tone: "text-red-700", text: `Short by ${money(-gap)}` } : { tone: "text-amber-800", text: `Extra ${money(gap)}` };
}

function Figure({ label, value, hint, tone = "text-gray-900" }) {
  return (
    <div className="flex-[1_1_180px] px-4 py-3 border-r border-b border-gray-100">
      <p className="text-[15px] text-gray-600">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${tone}`}>{value}</p>
      {hint && <p className="text-sm text-gray-500">{hint}</p>}
    </div>
  );
}

/** The printed day-end sheet: compact A4, black on white, like the other printouts. */
function DayEndPrint({ day, shop, counted, gap }) {
  const cell = "px-1.5 py-1 text-left";
  const num = "px-1.5 py-1 text-right whitespace-nowrap";
  return (
    <article className="hidden print:block text-[11px] leading-snug text-black">
      <p className="text-center text-lg font-bold uppercase">{shop?.name}</p>
      <p className="text-center text-[13px] font-bold mb-2">DAY-END SUMMARY · {date(day.date)}</p>
      <table className="w-full border-collapse border border-black mb-3">
        <tbody>
          {[
            ["Bills", `${day.bills} · ${money(day.sales)}`],
            ["Cash in drawer", money(day.cash_in_drawer)],
            ...(counted !== "" ? [["Cash counted", `${money(counted)} — ${gap?.text ?? ""}`]] : []),
            ["Given on udhaar", money(day.on_khata)],
            ["Udhaar paid back", money(day.khata_collected)],
            ["Goods returned", money(day.returns)],
            ["Bills cancelled", `${day.cancelled.count} · ${money(day.cancelled.total)}`],
            ["Estimates made", String(day.estimates)],
          ].map(([label, value]) => (
            <tr key={label} className="border-b border-gray-400">
              <td className={cell}>{label}</td>
              <td className={num}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="w-full border-collapse border border-black mb-3">
        <thead>
          <tr className="border-b border-black">
            <th className={cell}>Money</th>
            <th className={num}>In</th>
            <th className={num}>Given back</th>
            <th className={num}>Net</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(day.by_mode).map(([mode, row]) => (
            <tr key={mode} className="border-b border-gray-400">
              <td className={cell}>{row.label}</td>
              <td className={num}>{money(row.received)}</td>
              <td className={num}>{money(row.refunded)}</td>
              <td className={num}>{money(row.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {day.staff.length > 0 && (
        <table className="w-full border-collapse border border-black mb-6">
          <thead>
            <tr className="border-b border-black">
              <th className={cell}>Person</th>
              <th className={num}>Bills</th>
              <th className={num}>Sales</th>
              <th className={num}>Cash</th>
              <th className={num}>UPI</th>
              <th className={num}>Udhaar collected</th>
              <th className={num}>Given back</th>
            </tr>
          </thead>
          <tbody>
            {day.staff.map((row) => (
              <tr key={row.name} className="border-b border-gray-400">
                <td className={cell}>{row.name}</td>
                <td className={num}>{row.bills}</td>
                <td className={num}>{money(row.sales)}</td>
                <td className={num}>{money(row.received.cash || 0)}</td>
                <td className={num}>{money(row.received.upi || 0)}</td>
                <td className={num}>{money(row.khata_collected)}</td>
                <td className={num}>{money(row.given_back)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex justify-between pt-6">
        <span>Counted by: ____________________</span>
        <span>Checked by: ____________________</span>
      </div>
    </article>
  );
}

/** Closing the counter (plan §16.1): the day's bills and money, cash in drawer, and each person's share. */
export default function DayEnd() {
  const [day, setDay] = useState(today());
  const [counted, setCounted] = useState("");
  const { data, error, loading } = useFetch(`/sales/day-end?date=${day}`);
  const { data: shop } = useFetch("/shop/settings");
  const gap = data ? difference(data.cash_in_drawer, counted) : null;
  const cash = data?.by_mode.cash;

  return (
    <>
      <div className="print:hidden">
        <PageHeader title="Close the day" back={["/dashboard", "Home"]} subtitle="The day's bills and money, for closing the counter.">
          <input
            type="date"
            value={day}
            max={today()}
            onChange={(event) => {
              if (!event.target.value) return;
              setDay(event.target.value);
              setCounted("");
            }}
            aria-label="Day"
            className="h-11 px-3 rounded-lg border border-gray-300 bg-white"
          />
          <Button onClick={() => window.print()} disabled={!data}>
            <Printer size={18} /> Print
          </Button>
        </PageHeader>
        <Alert>{error}</Alert>
        {loading && !data ? (
          <Spinner />
        ) : (
          data && (
            <div className="space-y-5">
              <Section title="Cash in drawer" bodyClassName="p-4 flex flex-wrap items-end gap-x-8 gap-y-3">
                <div>
                  <p className="text-[34px] font-bold leading-none">{bigMoney(data.cash_in_drawer)}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {cash ? `${money(cash.received)} cash in, ${money(cash.refunded)} given back` : "No cash taken or given back"}
                  </p>
                </div>
                <label className="block">
                  <span className="block text-sm font-semibold text-gray-700 mb-1">Cash counted in the drawer (₹)</span>
                  <NumberInput className="w-40 h-11 text-right" value={counted} onChange={(event) => setCounted(event.target.value)} />
                </label>
                {gap && <p className={`text-lg font-bold ${gap.tone}`}>{gap.text}</p>}
              </Section>

              <Section title={`${date(data.date)} · ${plural(data.bills, "bill")}`} bodyClassName="flex flex-wrap -mb-px -mr-px">
                <Figure label="Sales" value={bigMoney(data.sales)} />
                <Figure label="Given on udhaar" value={bigMoney(data.on_khata)} tone={Number(data.on_khata) ? "text-red-700" : "text-gray-900"} />
                <Figure label="Udhaar paid back" value={bigMoney(data.khata_collected)} tone={Number(data.khata_collected) ? "text-green-700" : "text-gray-900"} />
                <Figure label="Goods returned" value={bigMoney(data.returns)} />
                <Figure label="Bills cancelled" value={bigMoney(data.cancelled.total)} hint={plural(data.cancelled.count, "bill")} />
                <Figure label="Estimates made" value={data.estimates} />
              </Section>

              <Section title="Money by type">
                {Object.keys(data.by_mode).length === 0 ? (
                  <p className="px-4 py-5 text-gray-500">No money taken or given back on this day.</p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th className={th}>Type</th>
                        <th className={`${th} text-right`}>In</th>
                        <th className={`${th} text-right`}>Given back</th>
                        <th className={`${th} text-right`}>Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.by_mode).map(([mode, row]) => (
                        <tr key={mode}>
                          <td className={td}>{row.label}</td>
                          <td className={`${td} text-right`}>{money(row.received)}</td>
                          <td className={`${td} text-right`}>{money(row.refunded)}</td>
                          <td className={`${td} text-right font-bold`}>{money(row.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Section>

              <Section title="By person">
                {data.staff.length === 0 ? (
                  <p className="px-4 py-5 text-gray-500">Nobody made bills or took money on this day.</p>
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <th className={th}>Person</th>
                        <th className={`${th} text-right`}>Bills</th>
                        <th className={`${th} text-right`}>Sales</th>
                        <th className={`${th} text-right`}>Cash</th>
                        <th className={`${th} text-right`}>UPI</th>
                        <th className={`${th} text-right`}>Udhaar collected</th>
                        <th className={`${th} text-right`}>Given back</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.staff.map((row) => (
                        <tr key={row.name}>
                          <td className={`${td} font-semibold`}>{row.name}</td>
                          <td className={`${td} text-right`}>{row.bills}</td>
                          <td className={`${td} text-right`}>{money(row.sales)}</td>
                          <td className={`${td} text-right`}>{money(row.received.cash || 0)}</td>
                          <td className={`${td} text-right`}>{money(row.received.upi || 0)}</td>
                          <td className={`${td} text-right`}>{money(row.khata_collected)}</td>
                          <td className={`${td} text-right`}>{money(row.given_back)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Section>
            </div>
          )
        )}
      </div>
      {data && <DayEndPrint day={data} shop={shop?.data} counted={counted} gap={gap} />}
    </>
  );
}
