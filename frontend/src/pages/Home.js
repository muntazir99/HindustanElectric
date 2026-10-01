import { Link } from "react-router-dom";
import { ClipboardCheck, FileSpreadsheet, PackagePlus, Truck } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";
import { useFetch } from "../hooks/useFetch.js";
import { money } from "../lib/format.js";
import { Alert, Card, PageHeader, Spinner } from "../ui/index.js";

function Stat({ label, value, to, tone = "text-gray-900", hint }) {
  const body = (
    <Card className="p-5 h-full hover:border-blue-300 transition-colors">
      <p className="text-sm font-semibold text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

function Action({ to, icon: Icon, title, text }) {
  return (
    <Link to={to} className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/40">
      <Icon className="text-blue-700 mt-0.5 shrink-0" size={26} />
      <span>
        <span className="block font-bold">{title}</span>
        <span className="block text-sm text-gray-600">{text}</span>
      </span>
    </Link>
  );
}

export default function Home() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const { data, error, loading } = useFetch("/stock/summary");

  return (
    <>
      <PageHeader title="Home" subtitle="Stock at a glance" />
      <Alert>{error}</Alert>
      {loading && !data ? (
        <Spinner />
      ) : (
        data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Stat label="Items in catalogue" value={data.active_items} to="/items" />
            <Stat
              label="Not counted yet"
              value={data.not_counted}
              to="/items?status=not_counted"
              tone={data.not_counted ? "text-amber-700" : "text-gray-900"}
              hint="Stock shows once an item is counted"
            />
            <Stat
              label="Need recount"
              value={data.needs_recount}
              to="/items?status=needs_recount"
              tone={data.needs_recount ? "text-red-700" : "text-gray-900"}
              hint="Went below zero — something was missed"
            />
            <Stat
              label="Low stock"
              value={data.low_stock}
              to="/items?status=low"
              tone={data.low_stock ? "text-red-700" : "text-gray-900"}
              hint="At or below minimum"
            />
            <Stat label="Counts in progress" value={data.open_counts} to="/counts" />
            <Stat label="Purchase bills not posted" value={data.draft_bills} to="/purchases?status=draft" />
            {isOwner && <Stat label="Stock value (at cost)" value={money(data.stock_value)} hint="Counted stock × average cost" />}
          </div>
        )
      )}

      <h2 className="text-lg font-bold mb-3">Quick actions</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <Action to="/purchases/new" icon={Truck} title="Enter a purchase bill" text="Goods arrived from a distributor? Add them to stock." />
        <Action to="/counts" icon={ClipboardCheck} title="Count a rack" text="Scan what's on the shelf to set the true stock." />
        <Action to="/items/new" icon={PackagePlus} title="Add an item" text="A product and its sizes/colours, with barcodes." />
        {isOwner && (
          <Action to="/import" icon={FileSpreadsheet} title="Import from Excel" text="Load a distributor price list or your item sheet." />
        )}
      </div>
    </>
  );
}
