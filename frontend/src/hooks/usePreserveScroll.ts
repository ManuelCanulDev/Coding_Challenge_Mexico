import { useLayoutEffect, useRef } from 'react';

export function usePreserveScroll<T extends { id: string }>(items: T[]) {
  const ref = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const scrollHeightRef = useRef(0);
  const firstIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const firstId = items[0]?.id ?? null;
    const prepended =
      firstId !== null &&
      firstIdRef.current !== null &&
      firstId !== firstIdRef.current &&
      scrollTopRef.current > 0;

    if (prepended) {
      const delta = el.scrollHeight - scrollHeightRef.current;
      el.scrollTop = scrollTopRef.current + delta;
    } else if (scrollTopRef.current > 0) {
      el.scrollTop = scrollTopRef.current;
    }

    scrollHeightRef.current = el.scrollHeight;
    firstIdRef.current = firstId;
    scrollTopRef.current = el.scrollTop;
  }, [items]);

  function onScroll(): void {
    const el = ref.current;
    if (!el) return;
    scrollTopRef.current = el.scrollTop;
    scrollHeightRef.current = el.scrollHeight;
  }

  return { ref, onScroll };
}
