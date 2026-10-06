import { Link } from "react-router-dom";
import {
  Ban,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  HandCoins,
  LogOut,
  Package,
  PackagePlus,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Tag,
  TriangleAlert,
  Truck,
  Undo2,
  Users,
} from "lucide-react";
import { BACK_OFFICE_URL } from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { A, OWNER } from "../lib/access.js";
import { PageHeader, Section } from "../ui/index.js";

// Everything that isn't needed every hour. Each tile shows only to someone allowed to use it
// (`need`: any of these switches, or OWNER); a tile without `need` is for everyone.
const SECTIONS = [
  {
    title: "Bills",
    tiles: [
      { to: "/bills", icon: ReceiptText, name: "Old Bills", text: "See or reprint any bill", need: [A.VIEW_BILLS] },
      { to: "/bills?status=held", icon: Clock, name: "Kept for Later", text: "Bills put on hold at the counter", need: [A.VIEW_BILLS] },
      { to: "/bills?status=quotation", icon: FileText, name: "Estimates", text: "Price quotes given to customers", need: [A.VIEW_BILLS] },
      { to: "/bills?help=return", icon: Undo2, name: "Return Goods", text: "A customer brings items back", need: [A.RETURNS], tone: "owner" },
      { to: "/bills?help=cancel", icon: Ban, name: "Cancel a Bill", text: "Undo a bill made by mistake", need: [A.RETURNS], tone: "owner" },
    ],
  },
  {
    title: "Items & stock",
    tiles: [
      { to: "/items", icon: Package, name: "All Items", text: "Prices and what's on the shelf" },
      { to: "/items/new", icon: PackagePlus, name: "Add New Item", text: "A new product, size or colour", need: [A.ADD_ITEMS] },
      { to: "/counts", icon: ClipboardCheck, name: "Check Stock", text: "Count a rack and set the real stock", need: [A.COUNT_STOCK, A.FIX_STOCK] },
      { to: "/items?status=low", icon: TriangleAlert, name: "Running Low", text: "Items to order again", tone: "amber" },
      { to: "/adjustments", icon: SlidersHorizontal, name: "Fix Stock", text: "Broken, lost or used in the shop", need: [A.FIX_STOCK], tone: "owner" },
    ],
  },
  {
    title: "Buying from distributors",
    tiles: [
      { to: "/purchases/new", icon: Truck, name: "Goods Arrived", text: "Enter a distributor's bill", need: [A.PURCHASES] },
      { to: "/purchases", icon: FileText, name: "Purchase Bills", text: "All bills from distributors", need: [A.PURCHASES] },
      { to: "/suppliers", icon: Building2, name: "Distributors", text: "Names, phone numbers, GSTIN", need: [A.PURCHASES] },
    ],
  },
  {
    title: "Khata",
    tiles: [
      { to: "/customers", icon: Users, name: "Customers", text: "Who owes what", need: [A.VIEW_KHATA, A.PAYMENTS] },
      { to: "/customers?owing=1", icon: HandCoins, name: "Take Payment", text: "A customer pays their udhaar", tone: "green", need: [A.PAYMENTS] },
    ],
  },
  {
    title: "Reports",
    tiles: [
      { to: "/reports/day-end", icon: CalendarCheck, name: "Close the day", text: "Cash in drawer, money by type, each person", need: [A.VIEW_SALES] },
    ],
  },
  {
    title: "Setup",
    tiles: [
      { to: "/import", icon: FileSpreadsheet, name: "Upload from Excel", text: "Add many items at once", need: [A.IMPORT], tone: "owner" },
      { to: "/import?kind=prices", icon: Tag, name: "Update Prices", text: "New price list from a distributor", need: [A.EDIT_ITEMS], tone: "owner" },
      { to: "/staff", icon: ShieldCheck, name: "Staff & Access", text: "Logins, and what each person can do", need: OWNER, tone: "owner" },
      {
        href: `${BACK_OFFICE_URL}shop/shopsettings/`,
        icon: Store,
        name: "Shop Details",
        text: "Name, GSTIN, bank — printed on bills",
        need: OWNER,
        tone: "owner",
      },
    ],
  },
];

const ICON_TONE = {
  blue: "bg-steel-50 text-steel-800",
  amber: "bg-amber-50 text-amber-800",
  green: "bg-green-50 text-green-800",
  owner: "bg-stone-100 text-stone-700",
};

function Tile({ tile }) {
  const Icon = tile.icon;
  const body = (
    <>
      <span className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-lg ${ICON_TONE[tile.tone || "blue"]}`}>
        <Icon size={22} />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-bold leading-snug text-blue-900">{tile.name}</span>
        <span className="block text-gray-600 leading-snug">{tile.text}</span>
      </span>
    </>
  );
  // A row inside the group's box, not a separate card.
  const classes = "flex gap-3 items-start min-h-[72px] px-4 py-3 border-b border-gray-100 sm:border-r hover:bg-steel-50";
  if (tile.href) {
    return (
      <a href={tile.href} target="_blank" rel="noreferrer" className={classes}>
        {body}
      </a>
    );
  }
  return (
    <Link to={tile.to} className={classes}>
      {body}
    </Link>
  );
}

export default function More() {
  const { user, logout, can, isOwner } = useAuth();
  const allowed = (tile) => !tile.need || (tile.need === OWNER ? isOwner : can(...tile.need));
  const sections = SECTIONS.map((section) => ({ ...section, tiles: section.tiles.filter(allowed) })).filter(
    (section) => section.tiles.length > 0
  );

  return (
    <>
      <PageHeader title="All options" back={["/dashboard", "Home"]} subtitle="Everything that isn't needed every hour." />
      <div className="space-y-5">
        {sections.map((section) => (
          <Section key={section.title} title={section.title} bodyClassName="grid sm:grid-cols-2 lg:grid-cols-3 -mb-px sm:-mr-px">
            {section.tiles.map((tile) => (
              <Tile key={tile.name} tile={tile} />
            ))}
          </Section>
        ))}

        <section className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-5 border-t border-gray-200">
          <p className="text-gray-600 mr-auto">
            Signed in as {user?.name || (isOwner ? "the owner" : "staff")}.
            {!isOwner && " Need something that isn't here? Ask the owner."}
          </p>
          {isOwner && (
            <a href={BACK_OFFICE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-gray-700 hover:underline">
              <ExternalLink size={16} /> Back office (advanced)
            </a>
          )}
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg border border-red-200 bg-white text-red-700 font-semibold hover:bg-red-50"
          >
            <LogOut size={18} /> Log out
          </button>
        </section>
      </div>
    </>
  );
}
