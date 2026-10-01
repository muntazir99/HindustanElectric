import { Link } from "react-router-dom";
import {
  Ban,
  Building2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  HandCoins,
  Lock,
  LogOut,
  Package,
  PackagePlus,
  ReceiptText,
  SlidersHorizontal,
  Store,
  Tag,
  TriangleAlert,
  Truck,
  Undo2,
  UserPlus,
  Users,
} from "lucide-react";
import { BACK_OFFICE_URL } from "../api.js";
import { useAuth } from "../context/AuthContext.js";
import { PageHeader } from "../ui/index.js";

// Everything that isn't needed every hour. Names say what the person wants to do, in shop words.
const SECTIONS = [
  {
    title: "Bills",
    tiles: [
      { to: "/bills", icon: ReceiptText, name: "Old Bills", text: "See or reprint any bill" },
      { to: "/bills?status=held", icon: Clock, name: "Kept for Later", text: "Bills put on hold at the counter" },
      { to: "/bills?status=quotation", icon: FileText, name: "Estimates", text: "Price quotes given to customers" },
      { to: "/bills?help=return", icon: Undo2, name: "Return Goods", text: "A customer brings items back", owner: true },
      { to: "/bills?help=cancel", icon: Ban, name: "Cancel a Bill", text: "Undo a bill made by mistake", owner: true },
    ],
  },
  {
    title: "Items & stock",
    tiles: [
      { to: "/items", icon: Package, name: "All Items", text: "Prices and what's on the shelf" },
      { to: "/items/new", icon: PackagePlus, name: "Add New Item", text: "A new product, size or colour" },
      { to: "/counts", icon: ClipboardCheck, name: "Check Stock", text: "Count a rack and set the real stock" },
      { to: "/items?status=low", icon: TriangleAlert, name: "Running Low", text: "Items to order again", tone: "amber" },
      { to: "/adjustments", icon: SlidersHorizontal, name: "Fix Stock", text: "Broken, lost or used in the shop", owner: true },
    ],
  },
  {
    title: "Buying from distributors",
    tiles: [
      { to: "/purchases/new", icon: Truck, name: "Goods Arrived", text: "Enter a distributor's bill" },
      { to: "/purchases", icon: FileText, name: "Purchase Bills", text: "All bills from distributors" },
      { to: "/suppliers", icon: Building2, name: "Distributors", text: "Names, phone numbers, GSTIN" },
    ],
  },
  {
    title: "Khata",
    tiles: [
      { to: "/customers", icon: Users, name: "Customers", text: "Who owes what" },
      { to: "/customers?owing=1", icon: HandCoins, name: "Take Payment", text: "A customer pays their udhaar", tone: "green" },
    ],
  },
  {
    title: "Setup",
    owner: true,
    tiles: [
      { to: "/import", icon: FileSpreadsheet, name: "Upload from Excel", text: "Add many items at once", owner: true },
      { to: "/import?kind=prices", icon: Tag, name: "Update Prices", text: "New price list from a distributor", owner: true },
      { to: "/create-user", icon: UserPlus, name: "Staff Logins", text: "Give each helper their own login", owner: true },
      {
        href: `${BACK_OFFICE_URL}shop/shopsettings/`,
        icon: Store,
        name: "Shop Details",
        text: "Name, GSTIN, bank — printed on bills",
        owner: true,
      },
    ],
  },
];

const ICON_TONE = {
  blue: "bg-blue-50 text-blue-800",
  amber: "bg-amber-50 text-amber-800",
  green: "bg-green-50 text-green-800",
  owner: "bg-stone-100 text-stone-700",
};

function OwnerTag() {
  return (
    <span className="inline-flex items-center gap-1 px-2 rounded-full bg-stone-100 text-stone-700 text-sm font-semibold">
      <Lock size={13} strokeWidth={2.4} /> Owner
    </span>
  );
}

function Tile({ tile, isOwner }) {
  const Icon = tile.icon;
  const locked = tile.owner && !isOwner;
  const body = (
    <>
      <span className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-xl ${ICON_TONE[tile.owner ? "owner" : tile.tone || "blue"]}`}>
        <Icon size={24} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-lg font-bold leading-snug">
          {tile.name}
          {tile.owner && <Lock size={15} strokeWidth={2.4} className="text-stone-600" aria-label="Owner only" />}
        </span>
        <span className="block text-gray-600 leading-snug">{locked ? "Only the owner can do this" : tile.text}</span>
      </span>
    </>
  );
  const classes = "flex gap-3.5 items-start min-h-[92px] p-4 rounded-2xl bg-white border border-gray-200";
  if (locked) return <div className={`${classes} opacity-60`}>{body}</div>;
  if (tile.href) {
    return (
      <a href={tile.href} target="_blank" rel="noreferrer" className={`${classes} hover:border-blue-400 hover:bg-blue-50/30`}>
        {body}
      </a>
    );
  }
  return (
    <Link to={tile.to} className={`${classes} hover:border-blue-400 hover:bg-blue-50/30`}>
      {body}
    </Link>
  );
}

export default function More() {
  const { user, logout } = useAuth();
  const isOwner = user?.role === "owner";

  return (
    <>
      <PageHeader
        title="All options"
        back={["/dashboard", "Home"]}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            Everything that isn't needed every hour. Things only the owner can do show <OwnerTag />
          </span>
        }
      />
      <div className="space-y-7">
        {SECTIONS.map((section) => (
          <section key={section.title} aria-labelledby={`more-${section.title}`}>
            <h2 id={`more-${section.title}`} className="flex items-center gap-2 text-xl font-bold mb-3">
              {section.title} {section.owner && <OwnerTag />}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {section.tiles.map((tile) => (
                <Tile key={tile.name} tile={tile} isOwner={isOwner} />
              ))}
            </div>
          </section>
        ))}

        <section className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-5 border-t border-gray-200">
          <p className="text-gray-600 mr-auto">Signed in as {isOwner ? "the owner" : "staff"}.</p>
          {isOwner && (
            <a href={BACK_OFFICE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-gray-700 hover:underline">
              <ExternalLink size={16} /> Back office (advanced)
            </a>
          )}
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-red-200 bg-white text-red-700 font-semibold hover:bg-red-50"
          >
            <LogOut size={18} /> Log out
          </button>
        </section>
      </div>
    </>
  );
}
