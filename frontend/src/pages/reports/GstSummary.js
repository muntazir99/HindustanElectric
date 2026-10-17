import { useState } from "react";
import { Download } from "lucide-react";
import { useFetch } from "../../hooks/useFetch.js";
import { downloadFile } from "../../lib/download.js";
import { errorMessage } from "../../lib/errors.js";
import { money, plural, today } from "../../lib/format.js";
import { Alert, Button, PageHeader, Section, Select, Spinner, Table, td, th } from "../../ui/index.js";

const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const iso = (d) => d.toISOString().slice(0, 10);
const span = (year, month, months) => [iso(new Date(Date.UTC(year, month, 1))), iso(new Date(Date.UTC(year, month + months, 0)))];

/** Periods to pick: the last 12 months, newest first, then the last 4 GST quarters (Apr–Jun, Jul–Sep, ...). [label, from, to] */
export function gstPeriods(now = today()) {
  const [year, month] = now.split("-").map(Number);
  const months = Array.from({ length: 12 }, (_, back) => {
    const [from, to] = span(year, month - 1 - back, 1);
    return [MONTH.format(new Date(from)), from, to];
  });
  const quarterStart = month - 1 - ((month - 1) % 3);
  const quarters = Array.from({ length: 4 }, (_, back) => {
    const [from, to] = span(year, quarterStart - 3 * back, 3);
    return [`${MONTH.format(new Date(from)).split(" ")[0]}–${MONTH.format(new Date(to))} (quarter)`, from, to];
  });
  return [...months, ...quarters];
}

/** GST summary for the CA (plan §16.3): tax by rate on screen, the GSTR-1 layout in Excel. Owner only. */
export default function GstSummary() {
  const options = gstPeriods();
  const [picked, setPicked] = useState(1); // last month: the one being filed
  const [, from, to] = options[picked];
  const [downloadError, setDownloadError] = useState("");
  const query = `from=${from}&to=${to}`;
  const { data, error, loading } = useFetch(`/sales/gst?${query}`);

  async function download() {
    setDownloadError("");
    try {
      await downloadFile(`/sales/gst?${query}&download=xlsx`, `gst-${from}-to-${to}.xlsx`);
    } catch (err) {
      setDownloadError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title="GST summary" back={["/more", "All options"]} subtitle="Tax by rate, and the Excel file for your CA.">
        <Button onClick={download} disabled={!data}>
          <Download size={18} /> Excel for CA
        </Button>
      </PageHeader>

      <Section title="Period" className="mb-5" bodyClassName="p-4 max-w-xs">
        <Select value={picked} onChange={(e) => setPicked(Number(e.target.value))} aria-label="Period">
          {options.map(([label], index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </Select>
      </Section>

      <Alert>{error || downloadError}</Alert>
      {loading && !data ? (
        <Spinner />
      ) : (
        data && (
          <div className="space-y-5">
            {!data.shop_gstin && (
              <Alert kind="warning">The shop's GSTIN is not filled in. Add it in More → Shop Details; it goes at the top of the file.</Alert>
            )}
            {data.missing_hsn.length > 0 && (
              <Alert kind="warning">
                No HSN code on {plural(data.missing_hsn.length, "item")} sold: {data.missing_hsn.join(", ")}. Add it on the item's product so
                the CA's HSN summary is complete. Bills already made keep the blank.
              </Alert>
            )}

            <Section title={`Tax by rate · ${plural(data.counts.bills, "bill")}, ${plural(data.counts.returns, "return")}`}>
              {data.by_rate.length === 0 ? (
                <p className="px-4 py-5 text-gray-500">No bills or returns in this period.</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <th className={th}>GST rate</th>
                      <th className={`${th} text-right`}>Before GST</th>
                      <th className={`${th} text-right`}>IGST</th>
                      <th className={`${th} text-right`}>CGST</th>
                      <th className={`${th} text-right`}>SGST</th>
                      <th className={`${th} text-right`}>Total GST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.by_rate, { rate: "Total", ...data.total }].map((row) => (
                      <tr key={row.rate} className={row.rate === "Total" ? "font-bold" : ""}>
                        <td className={td}>{row.rate === "Total" ? "Total" : `${row.rate}%`}</td>
                        <td className={`${td} text-right`}>{money(row.taxable)}</td>
                        <td className={`${td} text-right`}>{money(row.igst)}</td>
                        <td className={`${td} text-right`}>{money(row.cgst)}</td>
                        <td className={`${td} text-right`}>{money(row.sgst)}</td>
                        <td className={`${td} text-right font-semibold`}>{money(row.gst)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Section>

            <Section title="In the Excel file" bodyClassName="p-4 space-y-1.5">
              <p>
                <b>{plural(data.counts.b2b, "bill")}</b> to buyers with a GSTIN (b2b), <b>{data.counts.b2cl}</b> big bill
                {data.counts.b2cl === 1 ? "" : "s"} to other states (b2cl); every other sale totalled by state and rate (b2cs).
              </p>
              <p>
                <b>{plural(data.counts.cdnr, "return")}</b> from buyers with a GSTIN (cdnr); other returns come off b2cs. HSN summary, and
                the bill numbers used (docs):
              </p>
              {data.documents.map((row) => (
                <p key={row["Nature of Document"]} className="pl-4 text-gray-700">
                  {row["Nature of Document"]}: {row["Sr. No. From"]} to {row["Sr. No. To"]} · {row["Total Number"]}
                  {row.Cancelled ? `, ${row.Cancelled} cancelled` : ""}
                </p>
              ))}
              <p className="text-sm text-gray-500 pt-2">
                Give the file to your CA. They check the first month against their own working before you rely on it. Figures are net of
                returns; cancelled bills and estimates are left out.
              </p>
            </Section>
          </div>
        )
      )}
    </>
  );
}
