import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { placeName } from "../lib/places.js";

// "Back" returns to the screen this one was opened from (like a phone's back button), not to a fixed
// parent: Goods Arrived opened from Home goes back to Home. Each browser-history entry remembers where
// it came from, for this tab only, so it also survives a page refresh.

const STORE = "came-from";
const LIMIT = 200;

function loadTrail() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE)) || {};
  } catch {
    return {};
  }
}

function saveTrail(trail) {
  const keys = Object.keys(trail);
  keys.slice(0, Math.max(0, keys.length - LIMIT)).forEach((key) => delete trail[key]);
  try {
    sessionStorage.setItem(STORE, JSON.stringify(trail));
  } catch {
    /* Back links fall back to the usual screen */
  }
}

const TrailContext = createContext({});

/** Wrap the routes with this, inside the router. */
export function TrailProvider({ children }) {
  const location = useLocation();
  const type = useNavigationType();
  const previous = useRef(null);
  const trail = useRef(null);
  if (trail.current === null) trail.current = loadTrail();
  const [, redraw] = useState(0);

  // Before paint, so the first frame of a new screen already shows the right "Back to …".
  useLayoutEffect(() => {
    const prev = previous.current;
    previous.current = location;
    if (!prev || prev.key === location.key || type === "POP") return; // browser back/forward: already known
    // Opening a screen records where from; replacing it (saving a new bill, changing a filter) keeps that.
    const origin = type === "PUSH" ? { path: prev.pathname + prev.search } : trail.current[prev.key];
    if (!origin) return;
    trail.current = { ...trail.current, [location.key]: origin };
    saveTrail(trail.current);
    redraw((n) => n + 1);
  }, [location, type]);

  return <TrailContext.Provider value={trail.current}>{children}</TrailContext.Provider>;
}

/**
 * Where "Back" (or "Cancel") goes from this screen: the screen it was opened from, or, when that's not
 * known (opened from a bookmark, a print page), the usual screen above it.
 */
export function useGoBack(fallbackTo, fallbackLabel) {
  const trail = useContext(TrailContext);
  const location = useLocation();
  const navigate = useNavigate();
  const origin = trail[location.key];
  const label = origin && origin.path.split("?")[0] !== location.pathname ? placeName(origin.path) : null;
  if (label) return { label, to: origin.path, fromHistory: true, go: () => navigate(-1) };
  return { label: fallbackLabel, to: fallbackTo, fromHistory: false, go: () => navigate(fallbackTo) };
}
