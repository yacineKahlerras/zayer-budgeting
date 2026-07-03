import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";

import { getTransactionsPage, type TransactionListItem } from "@/db/queries";
import { groupByDay, type DaySection } from "@/utils/group-transactions";

const PAGE_SIZE = 20;

type PaginatedTransactions = {
  sections: DaySection[];
  loading: boolean;
  done: boolean;
  loadMore: () => void;
};

/**
 * Loads transactions page-by-page from the database and groups them into day
 * sections. Re-fetches the first page whenever the screen regains focus, so a
 * transaction added in the modal shows up on return.
 */
export function usePaginatedTransactions(): PaginatedTransactions {
  const [items, setItems] = useState<TransactionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const pageRef = useRef(0);

  const sections = useMemo(() => groupByDay(items), [items]);

  // Reload from scratch when the screen focuses.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const first = await getTransactionsPage(0, PAGE_SIZE);
        if (cancelled) return;
        setItems(first);
        pageRef.current = 0;
        setDone(first.length < PAGE_SIZE);
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    const next = pageRef.current + 1;
    const batch = await getTransactionsPage(next, PAGE_SIZE);
    if (batch.length === 0) {
      setDone(true);
    } else {
      setItems((prev) => [...prev, ...batch]);
      pageRef.current = next;
      if (batch.length < PAGE_SIZE) setDone(true);
    }
    setLoading(false);
  }, [loading, done]);

  return { sections, loading, done, loadMore };
}
