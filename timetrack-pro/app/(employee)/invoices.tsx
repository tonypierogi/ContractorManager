import { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InvoiceCard from '@/components/invoices/InvoiceCard';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/lib/auth-provider';
import { useInvoices } from '@/hooks/useInvoices';
import { Colors, Spacing, FontSize, FontWeight } from '@/constants/theme';
import type { Invoice } from '@/types/database';

const CARD_GAP = Spacing.md;

export default function InvoicesScreen() {
  const { user } = useAuth();
  const { data: invoices, isLoading, refetch } = useInvoices(user?.id ?? '');
  const { width } = useWindowDimensions();

  const numColumns = width >= 600 ? 2 : 1;

  const renderItem = useCallback(
    ({ item, index }: { item: Invoice; index: number }) => (
      <View
        style={[
          styles.cardWrapper,
          numColumns === 2 && index % 2 === 0 && { marginRight: CARD_GAP / 2 },
          numColumns === 2 && index % 2 === 1 && { marginLeft: CARD_GAP / 2 },
        ]}
      >
        <InvoiceCard invoice={item} />
      </View>
    ),
    [numColumns],
  );

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <Text style={styles.heading}>My Invoices</Text>

      <FlatList
        key={numColumns}
        data={invoices ?? []}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        contentContainerStyle={[
          styles.list,
          !invoices?.length && styles.emptyContainer,
        ]}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No invoices yet"
              message="Invoices will appear here once generated"
            />
          ) : null
        }
        refreshing={isLoading}
        onRefresh={refetch}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
    padding: Spacing.lg,
    paddingBottom: 0,
  },
  list: {
    padding: Spacing.lg,
  },
  emptyContainer: {
    flex: 1,
  },
  cardWrapper: {
    flex: 1,
  },
  separator: {
    height: CARD_GAP,
  },
});
