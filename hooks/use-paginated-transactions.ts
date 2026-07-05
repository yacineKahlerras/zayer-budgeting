import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
 * sections. Re-fetches the first page whenever the screen regains focus (so a
 * transaction added in the modal shows up), when the wallet filter changes, or
 * when `refreshKey` changes (e.g. after an inline balance edit on the screen).
 *
 * @param walletId Restrict to one wallet, or undefined for all wallets.
 * @param refreshKey Bump to force a first-page refetch without a focus change.
 */
export function usePaginatedTransactions(
  walletId?: string,
  refreshKey?: unknown
): PaginatedTransactions {
  const [items, setItems] = useState<TransactionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const pageRef = useRef(0);

  const sections = useMemo(() => groupByDay(items), [items]);

  // Read the current wallet inside effects without making them re-run on a
  // wallet switch (the focus effect below already owns that case).
  const walletIdRef = useRef(walletId);
  walletIdRef.current = walletId;

  // Reload from scratch when the screen focuses or the wallet filter changes.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const first = await getTransactionsPage(0, PAGE_SIZE, walletId);
        if (cancelled) return;
        setItems(first);
        pageRef.current = 0;
        setDone(first.length < PAGE_SIZE);
      })();
      return () => {
        cancelled = true;
      };
    }, [walletId])
  );

  // Refetch the first page when the caller bumps refreshKey (in-screen edits
  // don't blur/refocus the tab, so the focus effect above never re-runs).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return; // The focus effect already loaded the first page on mount.
    }
    let cancelled = false;
    (async () => {
      const first = await getTransactionsPage(0, PAGE_SIZE, walletIdRef.current);
      if (cancelled) return;
      setItems(first);
      pageRef.current = 0;
      setDone(first.length < PAGE_SIZE);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    setLoading(true);
    const next = pageRef.current + 1;
    const batch = await getTransactionsPage(next, PAGE_SIZE, walletId);
    if (batch.length === 0) {
      setDone(true);
    } else {
      setItems((prev) => [...prev, ...batch]);
      pageRef.current = next;
      if (batch.length < PAGE_SIZE) setDone(true);
    }
    setLoading(false);
  }, [loading, done, walletId]);

  return { sections, loading, done, loadMore };
}
