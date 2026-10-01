import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api.js";
import { errorMessage } from "../lib/errors.js";

/** GET a URL and re-fetch when it changes. Pass null to skip. */
export function useFetch(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(url));
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const request = ++latest.current;
    setLoading(true);
    setError("");
    try {
      const response = await api.get(url);
      // Ignore answers to older requests (e.g. while typing in a search box).
      if (request === latest.current) setData(response.data);
    } catch (err) {
      if (request === latest.current) setError(errorMessage(err));
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
