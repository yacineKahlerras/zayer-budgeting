import { useCallback, useMemo, useState } from "react";

import { getTransactions, type Transaction } from "@/constants/mock-data";
import { groupByDay, type DaySection } from "@/utils/group-transactions";

const PAGE_SIZE = 20;

type PaginatedTransactions = {
  sections: DaySection[];
  loading: boolean;
  done: boolean;
  loadMore: () => void;
};

/**
 * Loads transactions page-by-page and groups them into day sections.
 * Encapsulates the infinite-scroll state machine so screens stay declarative.
 */
export function usePaginatedTransactions(): PaginatedTransactions {
  const [items, setItems] = useState<Transaction[]>(() =>
    getTransactions(0, PAGE_SIZE)
  );
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const sections = useMemo(() => groupByDay(items), [items]);

  const loadMore = useCallback(() => {
    if (loading || done) return;
    setLoading(true);
    const next = page + 1;
    const batch = getTransactions(next, PAGE_SIZE);
    if (batch.length === 0) {
      setDone(true);
    } else {
      setItems((prev) => [...prev, ...batch]);
      setPage(next);
    }
    setLoading(false);
  }, [loading, done, page]);

  return { sections, loading, done, loadMore };
}
