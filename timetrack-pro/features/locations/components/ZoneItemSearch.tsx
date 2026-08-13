import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInventoryItems } from '@/features/inventory/hooks';
import { useEquipment } from '@/features/equipment/hooks';
import { getLocationLabel } from '@/features/locations/zones';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import type { Equipment } from '@/types/database';
import type { InventoryItem } from '@/features/inventory/api';

/** A searchable thing that lives somewhere in the building. */
export interface FoundItem {
  kind: 'inventory' | 'equipment';
  id: string;
  name: string;
  description: string | null;
  /** Zone id from LOCATION_ZONES, null = no location recorded. */
  location: string | null;
  imageUrl: string | null;
}

const MAX_RESULTS = 8;

/**
 * "Where's the vacuum?" search across inventory items and equipment.
 * Renders the input + results dropdown only; the host screen decides what
 * selecting a result does (highlight the zone, show the item card).
 */
export default function ZoneItemSearch({
  onSelect,
}: {
  onSelect: (item: FoundItem) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const { data: inventory } = useInventoryItems(true);
  const { data: equipment } = useEquipment();

  const allItems: FoundItem[] = useMemo(
    () => [
      ...(inventory ?? []).map((i: InventoryItem) => ({
        kind: 'inventory' as const,
        id: i.id,
        name: i.name,
        description: i.description,
        location: i.location,
        imageUrl: i.image_url,
      })),
      ...(equipment ?? []).map((e: Equipment) => ({
        kind: 'equipment' as const,
        id: e.id,
        name: e.name,
        description: null,
        location: e.location,
        imageUrl: e.image_url,
      })),
    ],
    [inventory, equipment],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allItems
      .filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, MAX_RESULTS);
  }, [allItems, query]);

  const handleSelect = (item: FoundItem) => {
    setOpen(false);
    setQuery(item.name);
    onSelect(item);
  };

  return (
    <View style={s.container}>
      <View style={s.inputWrap}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={s.input}
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setOpen(true);
          }}
          placeholder="Find something... (vacuum, pitchers, ladder)"
          placeholderTextColor={Colors.textMuted}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setOpen(false);
            }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {open && query.trim().length > 0 && (
        <View style={s.dropdown}>
          {results.length === 0 ? (
            <Text style={s.empty}>No items match “{query.trim()}”</Text>
          ) : (
            results.map((item) => (
              <TouchableOpacity
                key={`${item.kind}-${item.id}`}
                style={s.row}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={s.thumb} />
                ) : (
                  <View style={[s.thumb, s.thumbPlaceholder]}>
                    <Ionicons
                      name={item.kind === 'equipment' ? 'construct-outline' : 'cube-outline'}
                      size={16}
                      color={Colors.textMuted}
                    />
                  </View>
                )}
                <View style={s.rowBody}>
                  <Text style={s.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={s.rowMeta} numberOfLines={1}>
                    {item.location
                      ? getLocationLabel(item.location)
                      : 'No location recorded'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  dropdown: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.bgPanel,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  empty: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  thumb: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
  },
  rowMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
