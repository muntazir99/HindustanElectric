import { Link } from "react-router-dom";
import { ChevronRight, CircleCheck, ClipboardCheck, HandCoins, PackagePlus, Receipt, Truck } from "lucide-react";
import { useAuth } from "../context/AuthContext.js";
import { A } from "../lib/access.js";
import { useFetch } from "../hooks/useFetch.js";
import { usePage } from "../hooks/usePage.js";
import { bigMoney, dateTime, money, plural } from "../lib/format.js";
import { Alert, Section, Table, td } from "../ui/index.js";

// The jobs done every day, as big tiles: the first four this person may do. Everything else is on More.
const TASKS = [
  { to: "/billing", icon: Receipt, name: "New Bill", text: "Make a bill", main: true, need: A.BILLING },
  { to: "/purchases/new", icon: Truck, name: "Goods Arrived", text: "Distributor's bill", need: A.PURCHASES },
  { to: "/customers?owing=1", icon: HandCoins, name: "Take Payment", text: "Udhaar paid back", tone: "text-green-700", need: A.PAYMENTS },
  { to: "/items/new", icon: PackagePlus, name: "Add New Item", text: "Product, size, colour", need: A.ADD_ITEMS },
  { to: "/counts", icon: ClipboardCheck, name: "Check Stock", text: "Count a rack", need: A.COUNT_STOCK },
];

// Less-used screens as plain links: a main link and a second one, each shown only to those allowed.
const OTHER = [
  { main: ["/bills", "Old bills", [A.VIEW_BILLS]], second: ["/bills?status=held", "Kept for later", [A.VIEW_BILLS]] },
  { main: ["/customers", "Khata", [A.VIEW_KHATA, A.PAYMENTS]], second: ["/customers?owing=1", "Who owes", [A.VIEW_KHATA, A.PAYMENTS]] },
  { main: ["/items", "All items", null], second: ["/counts", "Check stock", [A.COUNT_STOCK, A.FIX_STOCK]] },
  { main: ["/purchases", "Purchase bills", [A.PURCHASES]], second: ["/suppliers", "Distributors", [A.PURCHASES]] },
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
      className={`flex-[1_1_220px] flex items-center gap-3 min-h-[76px] px-4 py-3 rounded-[10px] border ${
        task.main ? "bg-steel-800 border-steel-800 text-white hover:bg-steel-900" : "bg-white border-line hover:border-steel-500"
      }`}
    >
      <Icon size={28} strokeWidth={1.9} className={`shrink-0 ${task.main ? "text-white" : task.tone || "text-steel-800"}`} />
      <span>
        <span className="block text-lg sm:text-xl font-bold leading-tight">{task.name}</span>
        <span className={`block text-sm ${task.main ? "text-steel-200" : "text-gray-600"}`}>{task.text}</span>
      </span>
    </Link>
  );
}

const seeAll = (to, text) => (
  <Link to={to} className="inline-flex items-center font-semibold text-blue-800 hover:underline">
    {text} <ChevronRight size={17} />
  </Link>
);

/** One figure in the Today box: label, big amount, optional note. */
function Figure({ label, value, hint, tone = "text-gray-900" }) {
  return (
    <div className="flex-[1_1_160px] px-4 py-3.5 border-r border-b border-gray-100">
      <p className="text-[15px] text-gray-600">{label}</p>
      <p className={`text-[28px] font-bold leading-tight ${tone}`}>{value}</p>
      {hint && <p className="text-sm text-gray-500">{hint}</p>}
    </div>
  );
}

function TodayBox({ today, canBill }) {
  const cash = today.by_mode.cash;
  const khata = today.on_khata !== undefined;
  const others = Object.entries(today.by_mode).filter(([mode]) => mode !== "cash");
  const backHint = (row) => (Number(row.refunded) > 0 ? `${money(row.received)} in, ${money(row.refunded)} given back` : null);
  return (
    <Section title="Today" right={seeAll("/bills", "Today's bills")}>
      <div className="flex flex-wrap -mb-px -mr-px">
        <Figure label={`Sales · ${plural(today.bills, "bill")}`} value={bigMoney(today.sales)} />
        <Figure label="Cash in drawer" value={bigMoney(cash?.net || 0)} hint={cash ? backHint(cash) : null} />
        {others.map(([mode, row]) => (
          <Figure key={mode} label={row.label} value={bigMoney(row.net)} hint={backHint(row)} />
        ))}
        {khata && (
          <Figure label="Given on udhaar" value={bigMoney(today.on_khata)} tone={Number(today.on_khata) ? "text-red-700" : "text-gray-900"} />
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
    </Section>
  );
}

/** Bills kept for later are picked up on New Bill ("Kept for later" at the top). */
function HeldNote({ count }) {
  return (
    <p className="px-4 py-3 border-t border-line bg-amber-50 text-amber-900">
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
    <Section title="Recent bills" right={seeAll("/bills?day=", "All bills")}>
      {bills.length === 0 ? (
        <p className="px-4 py-5 text-gray-500">No bills yet. Press New Bill to make the first one.</p>
      ) : (
        <Table>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td className={`${td} whitespace-nowrap`}>
                  <Link to={`/bills/${bill.id}`} className="font-semibold text-blue-800 hover:underline">
                    {bill.number}
                  </Link>
                  <span className="block text-sm text-gray-500">{dateTime(bill.finalised_at)}</span>
                </td>
                <td className={td}>{bill.buyer_name || "Cash sale"}</td>
                <td className={td}>
                  {Number(bill.credit_amount) > 0 ? (
                    <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-800 text-sm font-semibold">Udhaar</span>
                  ) : (
                    <span className="text-sm text-gray-500">Paid</span>
                  )}
                </td>
                <td className={`${td} text-right text-lg font-bold whitespace-nowrap`}>{bigMoney(bill.total)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Section>
  );
}

function UdhaarBox({ today, canTakePayment }) {
  const { data } = useFetch("/sales/customers?owing=1&page_size=5");
  const customers = data?.results || [];
  return (
    <Section title="Udhaar to collect" right={seeAll("/customers?owing=1", "Khata")}>
      <p className="px-4 pt-3 pb-1">
        <span className={`text-[30px] font-bold leading-none ${Number(today.udhaar_outstanding) ? "text-red-700" : "text-gray-900"}`}>
          {bigMoney(today.udhaar_outstanding)}
        </span>{" "}
        <span className="text-gray-600">
          {today.customers_owing === 0 ? "Nobody owes money." : `from ${plural(today.customers_owing, "customer")}`}
        </span>
      </p>
      {customers.length > 0 && (
        <ul className="divide-y divide-gray-100 mt-2 border-t border-gray-100">
          {customers.map((customer) => (
            <li key={customer.id} className="flex items-center gap-3 px-4 py-2.5">
              <Link to={`/customers/${customer.id}`} className="min-w-0 flex-1 hover:underline">
                <span className="block font-semibold truncate">{customer.name}</span>
                <span className="block text-sm text-red-700">owes {money(customer.balance)}</span>
              </Link>
              {canTakePayment && (
                <Link
                  to={`/customers/${customer.id}?pay=1`}
                  className="shrink-0 inline-flex items-center min-h-[40px] px-3 rounded-lg border border-green-700 text-green-800 font-semibold hover:bg-green-50"
                >
                  Take payment
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function AttentionBox({ stock, can }) {
  // Only what this person can act on.
  const rows = [
    [stock.low_stock, "/items?status=low", (n) => `${plural(n, "item")} running low`, true],
    [stock.needs_recount, "/items?status=needs_recount", (n) => `${plural(n, "item")} to check again`, true],
    [stock.draft_bills, "/purchases?status=draft", (n) => `${plural(n, "purchase bill")} not added to stock`, can(A.PURCHASES)],
    [stock.open_counts, "/counts", (n) => `${plural(n, "stock check")} not finished`, can(A.COUNT_STOCK, A.FIX_STOCK)],
    [stock.not_counted, "/items?status=not_counted", (n) => `${plural(n, "item")} not checked yet`, true],
  ].filter(([count, , , allowed]) => count > 0 && allowed);

  if (rows.length === 0) {
    return (
      <Section>
        <p className="px-4 py-4 flex items-center gap-2.5 text-green-800 font-semibold">
          <CircleCheck size={22} /> Nothing needs your attention.
        </p>
      </Section>
    );
  }
  return (
    <Section title="Needs attention" tone="amber">
      <ul className="divide-y divide-amber-200">
        {rows.map(([count, to, text]) => (
          <li key={to}>
            <Link to={to} className="flex items-center gap-2 px-4 py-2.5 font-semibold text-amber-950 hover:underline">
              <span className="flex-1">{text(count)}</span>
              <ChevronRight size={18} />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function OtherThings({ can, stock }) {
  const allowed = ([, , need]) => !need || can(...need);
  const rows = OTHER.filter((row) => allowed(row.main));
  return (
    <Section title="Other things">
      <Table>
        <tbody>
          {rows.map((row) => (
            <tr key={row.main[0]}>
              <th scope="row" className="px-4 py-2.5 border-b border-gray-100 font-semibold">
                <Link to={row.main[0]} className="text-blue-800 hover:underline">
                  {row.main[1]}
                </Link>
              </th>
              <td className="px-4 py-2.5 border-b border-gray-100 text-right">
                {allowed(row.second) && (
                  <Link to={row.second[0]} className="text-blue-800 hover:underline">
                    {row.second[1]}
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="px-4 py-2.5 flex flex-wrap justify-between gap-2 text-[15px]">
        <Link to="/more" className="font-semibold text-blue-800 hover:underline">
          Everything else is in More ›
        </Link>
        {stock && (
          <span className="text-gray-600">
            {plural(stock.active_items, "item")}
            {stock.stock_value !== undefined && <> · worth {bigMoney(stock.stock_value)} at cost</>}
          </span>
        )}
      </p>
    </Section>
  );
}

export default function Home() {
  const { can } = useAuth();
  usePage("Home");
  const { data: stock, error } = useFetch("/stock/summary");
  const tasks = TASKS.filter((task) => can(task.need)).slice(0, 4);
  const { data: today, error: todayError } = useFetch("/sales/today");
  const dateLine = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <>
      <h1 className="text-[24px] font-bold leading-tight mb-4">
        {greeting()} <span className="text-base font-normal text-gray-600">· {dateLine}</span>
      </h1>
      <Alert>{error || todayError}</Alert>

      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5">
          {tasks.map((task) => (
            <Task key={task.name} task={task} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {today?.sales !== undefined && <TodayBox today={today} canBill={can(A.BILLING)} />}
          {today?.sales === undefined && today?.held_bills > 0 && (
            <Section>
              <HeldNote count={today.held_bills} />
            </Section>
          )}
          {can(A.VIEW_BILLS) && <RecentBills />}
        </div>
        <div className="space-y-5">
          {today?.udhaar_outstanding !== undefined && <UdhaarBox today={today} canTakePayment={can(A.PAYMENTS)} />}
          {stock && <AttentionBox stock={stock} can={can} />}
          <OtherThings can={can} stock={stock} />
        </div>
      </div>
    </>
  );
}
