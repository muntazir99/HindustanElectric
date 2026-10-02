import { useEffect, useId } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Home, X } from "lucide-react";
import { usePage } from "../hooks/usePage.js";
import { useGoBack } from "../hooks/useTrail.js";

const BUTTON = {
  primary: "bg-steel-800 hover:bg-steel-900 text-white border-steel-800",
  secondary: "bg-white hover:bg-gray-50 text-gray-900 border-gray-300",
  danger: "bg-white hover:bg-red-50 text-red-700 border-red-300",
  success: "bg-green-700 hover:bg-green-800 text-white border-green-700",
};

export function Button({ variant = "secondary", className = "", to, children, ...props }) {
  const classes = `inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border font-semibold
    transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON[variant]} ${className}`;
  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}

const BADGE = {
  gray: "bg-gray-100 text-gray-700",
  blue: "bg-blue-100 text-blue-800",
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
};

export function Badge({ color = "gray", children }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-sm font-semibold whitespace-nowrap ${BADGE[color]}`}>
      {children}
    </span>
  );
}

/**
 * "← Back to Purchase Bills": goes to the screen this one was opened from. `to` and `children` are the usual
 * screen above it, used when that isn't known (a bookmark, a refresh in a new tab). Shown in the line
 * under the top bar (see Layout).
 */
export function BackLink({ to = "/more", children = "All options" }) {
  const back = useGoBack(to, children);
  return (
    <Link
      to={back.to}
      onClick={(event) => {
        if (!back.fromHistory) return;
        event.preventDefault();
        back.go();
      }}
      className="no-print inline-flex items-center gap-1.5 min-h-[36px] font-semibold text-blue-800 hover:underline"
    >
      <ArrowLeft size={18} /> Back to {back.label}
    </Link>
  );
}

/** The big blue "Go to Home" button that ends every finished job. */
export function GoHomeButton() {
  return (
    <Link
      to="/dashboard"
      className="flex items-center justify-center gap-2.5 h-[60px] rounded-[10px] bg-steel-800 hover:bg-steel-900 text-white text-xl font-bold"
    >
      <Home size={24} /> Go to Home
    </Link>
  );
}

/** Shown when a job is finished: what was done, and what to do next (children: the buttons). */
export function DonePanel({ title, detail, note, children }) {
  return (
    <div role="status" className="max-w-xl mx-auto md:py-6">
      <Card className="p-6 md:p-9 flex flex-col items-center text-center gap-2">
        <span className="flex items-center justify-center w-[72px] h-[72px] rounded-full bg-green-50 text-green-700">
          <Check size={40} strokeWidth={2.6} />
        </span>
        <h1 className="text-3xl font-bold leading-tight mt-2">{title}</h1>
        {detail && <p className="text-xl">{detail}</p>}
        {note && <p className="text-gray-600">{note}</p>}
        <div className="w-full max-w-sm flex flex-col gap-3 mt-5">{children}</div>
      </Card>
    </div>
  );
}

/**
 * The screen's title, with its buttons on the right. `back` = [address, name] of the usual screen above,
 * for the "Back to …" link in the line under the top bar (it goes where you came from when known).
 */
export function PageHeader({ title, subtitle, back, children }) {
  usePage(title, back);
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
      <div>
        <h1 className="text-[28px] font-bold text-gray-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-gray-600 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Card({ className = "", children }) {
  return <div className={`bg-white rounded-[10px] border border-line ${className}`}>{children}</div>;
}

/**
 * A box with a labelled header strip: the building block of every screen. `right` sits at the right of
 * the strip (a count, a "See all" link). `tone="amber"` for "needs attention".
 */
export function Section({ title, right, tone = "plain", className = "", bodyClassName = "", children }) {
  const id = useId();
  const strip = tone === "amber" ? "bg-amber-100 border-amber-300 text-amber-950" : "bg-steel-50 border-line text-steel-800";
  const frame = tone === "amber" ? "bg-amber-50 border-amber-300" : "bg-white border-line";
  return (
    <section aria-labelledby={title ? id : undefined} className={`rounded-[10px] border overflow-hidden ${frame} ${className}`}>
      {title && (
        <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 border-b ${strip}`}>
          <h2 id={id} className="text-[15px] font-bold uppercase tracking-wide">
            {title}
          </h2>
          {right && <div className="text-[15px] text-gray-700">{right}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** One row of filter choices ("Today · Yesterday · 7 days"): pills, the chosen one dark. */
export function Pills({ label, options, value, onChange }) {
  return (
    <div>
      {label && <p className="text-sm font-bold text-gray-600 mb-1.5">{label}</p>}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={`min-h-[38px] px-3.5 rounded-full border text-[15px] ${
              value === option ? "bg-steel-800 border-steel-800 text-white font-semibold" : "bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Alert({ kind = "error", children, onClose }) {
  if (!children) return null;
  const styles = {
    error: "bg-red-50 border-red-300 text-red-800",
    success: "bg-green-50 border-green-300 text-green-800",
    warning: "bg-amber-50 border-amber-300 text-amber-900",
    info: "bg-blue-50 border-blue-200 text-blue-900",
  };
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex items-start gap-3 border rounded-lg px-4 py-3 mb-4 ${styles[kind]}`}>
      <div className="flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
          <X size={18} />
        </button>
      )}
    </div>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="block font-semibold text-gray-700 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-sm text-gray-500 mt-1">{hint}</span>}
    </label>
  );
}

/** Field look without a width, for boxes sized with a w-* class. */
export const inputBase =
  "px-3 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-steel-700 focus:border-steel-700 disabled:bg-gray-100";
export const inputClass = `w-full ${inputBase}`;

export function Input(props) {
  return <input className={inputClass} {...props} />;
}

/** Text input for decimals: no scroll-wheel surprises, numeric keypad on phones. Pass a w-* class to size it. */
export function NumberInput({ className = "", ...props }) {
  const base = /(^|\s)w-/.test(className) ? inputBase : inputClass;
  return <input type="text" inputMode="decimal" autoComplete="off" className={`${base} ${className}`} {...props} />;
}

export function Select({ children, ...props }) {
  return (
    <select className={inputClass} {...props}>
      {children}
    </select>
  );
}

export function Spinner({ label = "Loading…" }) {
  return <div className="py-10 text-center text-gray-500">{label}</div>;
}

export function Empty({ children }) {
  return <div className="py-10 text-center text-gray-500">{children}</div>;
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-white rounded-[10px] shadow-xl w-full overflow-hidden ${wide ? "max-w-4xl" : "max-w-lg"} mt-12`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-steel-50">
          <h2 className="text-xl font-bold text-steel-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-800">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Pagination({ page, count, pageSize = 50, onPage }) {
  if (!count || count <= pageSize) return null;
  const last = Math.ceil(count / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-gray-600">
      <span>
        {from}–{to} of {count}
      </span>
      <div className="flex gap-2">
        <Button disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button disabled={page >= last} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

/** A list as a striped table: every other row lightly shaded, like a paper register. */
export function Table({ children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left [&_tbody_tr:nth-child(even)]:bg-[#F8FAFB]">{children}</table>
    </div>
  );
}

export const th = "px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border-b border-line";
export const td = "px-4 py-3 border-b border-gray-100 align-top";
