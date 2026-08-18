import type { Equipment, EquipmentTag } from '@/types/database';

/**
 * Tag helpers shared by everything that shows or filters equipment tags: the
 * Locations & Equipment list (admins and contractors), the task editors'
 * equipment picker, and the tag manager.
 */

/** tag id -> tag, for turning the ids stored on an item into chips. */
export function tagsById(
  tags: readonly EquipmentTag[] | undefined,
): Map<string, EquipmentTag> {
  return new Map((tags ?? []).map((tag) => [tag.id, tag]));
}

/** The tags on one item, in the same order the chips elsewhere are shown. */
export function tagsForEquipment(
  item: Pick<Equipment, 'tag_ids'>,
  byId: ReadonlyMap<string, EquipmentTag>,
): EquipmentTag[] {
  return (item.tag_ids ?? [])
    .map((id) => byId.get(id))
    .filter((tag): tag is EquipmentTag => tag != null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Whether an item survives the tag filter. Selecting more tags widens the
 * list rather than narrowing it — picking "Ladders" and "Cleaning" means
 * "show me both", which is how people read a row of category chips. Nothing
 * selected means no tag filter at all.
 */
export function matchesTagFilter(
  item: Pick<Equipment, 'tag_ids'>,
  selectedTagIds: readonly string[],
): boolean {
  if (selectedTagIds.length === 0) return true;
  const tags = item.tag_ids ?? [];
  return selectedTagIds.some((id) => tags.includes(id));
}

/**
 * Drop selected ids whose tag has since been deleted. Without this, deleting
 * the last tag someone was filtering by would leave the filter on with no chip
 * left to switch it off, and the list stuck empty.
 */
export function pruneTagFilter(
  selected: readonly string[],
  byId: ReadonlyMap<string, EquipmentTag>,
): string[] {
  return selected.filter((id) => byId.has(id));
}

/** Tick a tag on or off in a selection (filter chips, and the item's tags). */
export function toggleTagId(
  selected: readonly string[],
  tagId: string,
): string[] {
  return selected.includes(tagId)
    ? selected.filter((id) => id !== tagId)
    : [...selected, tagId];
}

/** How many items carry each tag, for the manager's "used on N items" line. */
export function tagUsageCounts(
  equipment: readonly Equipment[] | undefined,
): Map<string, number> {
  const counts = new Map<string, number>();
  (equipment ?? []).forEach((item) => {
    (item.tag_ids ?? []).forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
  });
  return counts;
}

/** Case-insensitive name match, so nobody creates "Ladders" twice. */
export function findTagByName(
  tags: readonly EquipmentTag[] | undefined,
  name: string,
): EquipmentTag | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  return (tags ?? []).find((tag) => tag.name.trim().toLowerCase() === needle);
}
