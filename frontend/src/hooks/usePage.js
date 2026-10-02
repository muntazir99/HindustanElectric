import { createContext, useContext, useLayoutEffect, useState } from "react";
import { useLocation } from "react-router-dom";

// Each screen tells the frame its name and the usual screen above it, for the "Home › this page" line and
// the "Back to …" link beside it (docs/PLAN.md §10). Keyed by the history entry, so a screen that doesn't
// call usePage never shows the previous screen's name.

const SetPage = createContext(() => {});
const CurrentPage = createContext(null);

export function PageProvider({ children }) {
  const [page, setPage] = useState(null);
  return (
    <SetPage.Provider value={setPage}>
      <CurrentPage.Provider value={page}>{children}</CurrentPage.Provider>
    </SetPage.Provider>
  );
}

/** usePage("Old Bills", ["/more", "All options"]): this screen's name and its usual screen above. */
export function usePage(title, back = null) {
  const setPage = useContext(SetPage);
  const { key } = useLocation();
  const [backTo, backLabel] = back || [];
  useLayoutEffect(() => {
    setPage({ key, title, back: backTo ? [backTo, backLabel] : null });
  }, [setPage, key, title, backTo, backLabel]);
}

/** The current screen's name and usual screen above, or null while it hasn't said. */
export function useCurrentPage() {
  const page = useContext(CurrentPage);
  const { key } = useLocation();
  return page?.key === key ? page : null;
}
