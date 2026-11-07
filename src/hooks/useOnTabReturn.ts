import { useEffect, useRef } from "react";

export function useOnTabReturn(callback: () => void) {
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    const onFocus = () => latest.current();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}
