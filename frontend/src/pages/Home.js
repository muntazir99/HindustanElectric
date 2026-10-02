import { Link } from "react-router-dom";
import { ChevronRight, CircleCheck, ClipboardCheck, HandCoins, PackagePlus, Receipt, TriangleAlert, Truck } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";
import { A } from "../lib/access.js";
import { useFetch } from "../hooks/useFetch.js";
import { bigMoney, dateTime, money, plural } from "../lib/format.js";
import { Alert, Card } from "../ui/index.js";

// The jobs done every day, as big tiles: the first four this person may do. Everything else is on More.
const TASKS = [
  { to: "/billing", icon: Receipt, name: "New Bill", text: "Make a bill for a customer", main: true, need: A.BILLING },
  { to: "/purchases/new", icon: Truck, name: "Goods Arrived", text: "Enter the distributor's bill", need: A.PURCHASES },
  { to: "/customers?owing=1", icon: HandCoins, name: "Take Payment", text: "A customer pays their udhaar", tone: "text-green-700", need: A.PAYMENTS },
  { to: "/items/new", icon: PackagePlus, name: "Add New Item", text: "A new product, size or colour", need: A.ADD_ITEMS },
  { to: "/counts", icon: ClipboardCheck, name: "Check Stock", text: "Count a rack and set the real stock", need: A.COUNT_STOCK },
];

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function Task({ task }) {
  const Icon = task.icon;
  return (
    <Link
      to={task.to}
      className={`flex flex-col justify-between gap-6 min-h-[136px] p-5 rounded-2xl border ${
        task.main ? "bg-blue-800 border-blue-800 text-white hover:bg-blue-900" : "bg-white border-gray-200 hover:border-blue-400"
      }`}
    >
      <Icon size={34} strokeWidth={1.8} className={task.main ? "text-white" : task.tone || "text-blue-800"} />
      <span>
        <span className="block text-xl sm:text-2xl font-bold leading-tight">{task.name}</span>
        <span className={`block ${task.main ? "text-blue-100" : "text-gray-600"}`}>{task.text}</span>
      </span>
    </Link>
  );
}

function Figure({ label, value, hint, tone = "text-gray-900" }) {
  return (
    <div>
      <p className="text-gray-600">{label}</p>
      <p className={`text-3xl font-bold leading-tight ${tone}`}>{value}</p>
      {hint && <p className="text-sm text-gray-500">{hint}</p>}
    </div>
  );
}

function SectionTitle({ children, to, link }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="text-xl font-bold">{children}</h2>
      {to && (
        <Link to={to} className="inline-flex items-center font-semibold text-blue-800 hover:underline">
          {link} <ChevronRight size={18} />
        </Link>
      )}
    </div>
  );
}

function TodayCard({ today, canBill }) {
  const cash = today.by_mode.cash;
  const khata = today.on_khata !== undefined;
  const others = Object.entries(today.by_mode).filter(([mode]) => mode !== "cash");
  const backHint = (row) => (Number(row.refunded) > 0 ? `${money(row.received)} came in, ${money(row.refunded)} given back` : null);
  return (
    <Card className="p-5 md:p-6">
      <SectionTitle to="/bills" link="Today's bills">
        Today's business
      </SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
        <Figure label="Total sales" value={bigMoney(today.sales)} hint={plural(today.bills, "bill")} />
        <Figure label="Cash in the drawer" value={bigMoney(cash?.net || 0)} hint={cash ? backHint(cash) : "No cash yet"} />
        {others.map(([mode, row]) => (
          <Figure key={mode} label={row.label} value={bigMoney(row.net)} hint={backHint(row)} />
        ))}
        {khata && (
          <Figure
            label="Given on udhaar"
            value={bigMoney(today.on_khata)}
            tone={Number(today.on_khata) ? "text-red-700" : "text-gray-900"}
          />
        )}
        {khata && (
          <Figure
            label="Udhaar paid back"
            value={bigMoney(today.khata_collected)}
            tone={Number(today.khata_collected) ? "text-green-700" : "text-gray-900"}
          />
        )}
        {Number(today.returns) > 0 && <Figure label="Goods returned" value={bigMoney(today.returns)} tone="text-amber-800" />}
      </div>
      {canBill && today.held_bills > 0 && <HeldNote count={today.held_bills} />}
    </Card>
  );
}

/** Bills kept for later are picked up on New Bill ("Kept for later" at the top). */
function HeldNote({ count, alone = false }) {
  return (
    <p className={alone ? "text-amber-900" : "mt-5 pt-4 border-t border-gray-200 text-amber-900"}>
      {count === 1 ? "1 bill is" : `${count} bills are`} kept for later.{" "}
      <Link to="/billing" className="font-semibold underline">
        Open New Bill to finish {count === 1 ? "it" : "them"}
      </Link>
    </p>
  );
}

function RecentBills() {
  const { data } = useFetch("/sales/invoices?page_size=5");
  const bills = data?.results || [];
  return (
    <Card className="p-5 md:p-6">
      <SectionTitle to="/bills?day=" link="All bills">
        Recent bills
      </SectionTitle>
      {bills.length === 0 ? (
        <p className="text-gray-500">No bills yet. Press New Bill to make the first one.</p>
      ) : (
        <ul className="divide-y divide-gray-100 -my-2">
          {bills.map((bill) => (
            <li key={bill.id}>
              <Link to={`/bills/${bill.id}`} className="flex items-center gap-4 py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold truncate">{bill.buyer_name || "Cash sale"}</span>
                  <span className="block text-sm text-gray-500">
                    {bill.number} · {dateTime(bill.finalised_at)}
                  </span>
                </span>
                {Number(bill.credit_amount) > 0 ? (
                  <span className="text-sm font-semibold text-red-700 bg-red-50 rounded-md px-2">Udhaar</span>
                ) : (
                  <span className="text-sm text-gray-500">Paid</span>
                )}
                <span className="w-28 text-right text-lg font-bold">{bigMoney(bill.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function UdhaarCard({ today, canTakePayment }) {
  const { data } = useFetch("/sales/customers?owing=1&page_size=5");
  const customers = data?.results || [];
  return (
    <Card className="p-5 md:p-6">
      <SectionTitle to="/customers?owing=1" link="Khata">
        Udhaar to collect
      </SectionTitle>
      <p className={`text-4xl font-bold leading-none ${Number(today.udhaar_outstanding) ? "text-red-700" : "text-gray-900"}`}>
        {bigMoney(today.udhaar_outstanding)}
      </p>
      <p className="text-gray-600 mt-1">
        {today.customers_owing === 0 ? "Nobody owes money." : `from ${plural(today.customers_owing, "customer")}`}
      </p>
      {customers.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
          {customers.map((customer) => (
            <li key={customer.id} className="flex items-center gap-3 py-2.5">
              <Link to={`/customers/${customer.id}`} className="min-w-0 flex-1 hover:underline">
                <span className="block font-semibold truncate">{customer.name}</span>
                <span className="block text-sm text-red-700">owes {money(customer.balance)}</span>
              </Link>
              {canTakePayment && (
                <Link
                  to={`/customers/${customer.id}?pay=1`}
                  className="shrink-0 inline-flex items-center min-h-[40px] px-3 rounded-xl border border-green-700 text-green-800 font-semibold hover:bg-green-50"
                >
                  Take payment
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AttentionCard({ stock, can }) {
  // Only what this person can act on.
  const rows = [
    [stock.low_stock, "/items?status=low", (n) => `${plural(n, "item")} running low`, "Order again", true],
    [stock.needs_recount, "/items?status=needs_recount", (n) => `${plural(n, "item")} to check again`, "Stock went below zero", true],
    [stock.draft_bills, "/purchases?status=draft", (n) => `${plural(n, "purchase bill")} not added to stock`, "Finish entering them", can(A.PURCHASES)],
    [stock.open_counts, "/counts", (n) => `${plural(n, "stock check")} not finished`, null, can(A.COUNT_STOCK, A.FIX_STOCK)],
    [stock.not_counted, "/items?status=not_counted", (n) => `${plural(n, "item")} not checked yet`, "Stock shows after a count", true],
  ].filter(([count, , , , allowed]) => count > 0 && allowed);

  return (
    <>
      {rows.length === 0 ? (
        <Card className="p-5 flex items-center gap-3 text-green-800">
          <CircleCheck size={24} /> <span className="font-semibold">Nothing needs your attention.</span>
        </Card>
      ) : (
        <section aria-labelledby="attention-heading" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 md:p-6">
          <h2 id="attention-heading" className="flex items-center gap-2 text-xl font-bold text-amber-950 mb-3">
            <TriangleAlert size={22} /> Needs your attention
          </h2>
          <ul className="divide-y divide-amber-200">
            {rows.map(([count, to, text, hint]) => (
              <li key={to}>
                <Link to={to} className="flex items-center gap-3 py-2.5 text-amber-950 hover:underline">
                  <span className="flex-1">
                    <span className="block font-semibold">{text(count)}</span>
                    {hint && <span className="block text-sm text-amber-900">{hint}</span>}
                  </span>
                  <ChevronRight size={20} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-gray-600 px-1">
        <Link to="/items" className="hover:underline">
          {plural(stock.active_items, "item")} in the shop
        </Link>
        {stock.stock_value !== undefined && <> · stock worth {bigMoney(stock.stock_value)} at cost</>}
      </p>
    </>
  );
}

export default function Home() {
  const { can } = useAuth();
  const { data: stock, error } = useFetch("/stock/summary");
  const tasks = TASKS.filter((task) => can(task.need)).slice(0, 4);
  const { data: today, error: todayError } = useFetch("/sales/today");
  const dateLine = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <div className="mb-5">
        <h1 className="text-3xl font-bold leading-tight">{greeting()}</h1>
        <p className="text-gray-600">{dateLine}</p>
      </div>
      <Alert>{error || todayError}</Alert>

      {tasks.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          {tasks.map((task) => (
            <Task key={task.name} task={task} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {today?.sales !== undefined && <TodayCard today={today} canBill={can(A.BILLING)} />}
          {today?.sales === undefined && today?.held_bills > 0 && (
            <Card className="p-5">
              <HeldNote count={today.held_bills} alone />
            </Card>
          )}
          {can(A.VIEW_BILLS) && <RecentBills />}
        </div>
        <div className="space-y-5">
          {today?.udhaar_outstanding !== undefined && <UdhaarCard today={today} canTakePayment={can(A.PAYMENTS)} />}
          {stock && <AttentionCard stock={stock} can={can} />}
        </div>
      </div>
    </>
  );
}
