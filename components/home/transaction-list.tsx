import { ReactElement } from "react";
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { usePaginatedTransactions } from "@/hooks/use-paginated-transactions";

import { TransactionRow } from "./transaction-row";

type Props = {
  /** Rendered above the list (e.g. the account card + section title). */
  header?: ReactElement;
  /** Restrict the list to one wallet, or undefined for all wallets. */
  walletId?: string;
  /** Bump to force a first-page refetch (e.g. after an inline balance edit). */
  refreshKey?: unknown;
};

/** Infinite-scrolling list of transactions grouped by day, bannered by month. */
export function TransactionList({ header, walletId, refreshKey }: Props) {
  const { sections, loading, done, loadMore } = usePaginatedTransactions(
    walletId,
    refreshKey
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <TransactionRow item={item} />}
      renderSectionHeader={({ section }) => (
        <View>
          {section.monthBanner && (
            <Text style={styles.monthBanner}>{section.monthBanner}</Text>
          )}
          <Text style={styles.dayHeader}>{section.dayLabel}</Text>
        </View>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Text style={styles.emptyText}>
            Tap the + button to add your first one.
          </Text>
        </View>
      }
      contentContainerStyle={styles.listContent}
      stickySectionHeadersEnabled={false}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        loading ? (
          <ActivityIndicator color={Colors.textMuted} style={styles.footer} />
        ) : done && sections.length > 0 ? (
          <Text style={styles.endText}>No more transactions</Text>
        ) : null
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  monthBanner: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 4,
  },
  dayHeader: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
  },
  footer: {
    marginVertical: 20,
  },
  endText: {
    color: Colors.textMuted,
    textAlign: "center",
    marginVertical: 20,
    fontSize: 13,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 6,
  },
});
