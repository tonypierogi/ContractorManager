import type { ImageSourcePropType } from 'react-native';

export type Floor = 'upstairs' | 'downstairs';

export interface LocationZone {
  id: string;
  label: string;
}

/** Clickable rectangle as percentages of the floor-plan image. */
export interface ZoneOverlay {
  id: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

// Zone ids are stored verbatim in task_lists.location and
// inventory_items.location in production — never rename an id without a
// data migration. Values mirror the legacy app (old/js/locations.js:3-38,
// git tag legacy-html).
export const LOCATION_ZONES: Record<Floor, LocationZone[]> = {
  upstairs: [
    { id: 'back-closet', label: 'Back Closet' },
    // The curtained back area, split in two so crews can be sent to one side.
    // Neither side is outlined on the bundled floor-plan PNG, so they have no
    // ZONE_OVERLAYS entry and no highlight image — they show up as room chips
    // and in every location picker, and an admin can add a photo from the
    // room editor (location_zone_overrides.photo_url).
    { id: 'backroom-right', label: 'Backroom Right' },
    { id: 'backroom-left', label: 'Backroom Left' },
    { id: 'big-room', label: 'Big Room' },
    { id: 'loft', label: 'Loft' },
  ],
  downstairs: [
    { id: 'office', label: 'Office' },
    { id: 'av-closet', label: 'AV Closet' },
    { id: 'sauna', label: 'Sauna' },
    { id: 'basement', label: 'Basement' },
    { id: 'lounge', label: 'Lounge' },
    { id: 'lobby', label: 'Lobby' },
    { id: 'bar-closet', label: 'Bar Closet' },
  ],
};

// Percentages are tuned to the bundled floor-plan images — keep in sync
// with the assets, not with screen dimensions.
export const ZONE_OVERLAYS: Record<Floor, ZoneOverlay[]> = {
  upstairs: [
    { id: 'back-closet', top: 0, left: 0, width: 100, height: 24 },
    { id: 'big-room', top: 24, left: 0, width: 100, height: 45 },
    { id: 'loft', top: 74, left: 0, width: 100, height: 26 },
  ],
  downstairs: [
    { id: 'office', top: 1, left: 55, width: 45, height: 16 },
    { id: 'av-closet', top: 20, left: 62, width: 30, height: 4 },
    { id: 'sauna', top: 40, left: 55, width: 38, height: 8 },
    { id: 'basement', top: 0, left: 0, width: 65, height: 45 },
    { id: 'lounge', top: 52, left: 0, width: 100, height: 28 },
    { id: 'lobby', top: 80, left: 0, width: 100, height: 18 },
    { id: 'bar-closet', top: 94, left: 62, width: 38, height: 10 },
  ],
};

/**
 * Intrinsic aspect ratio (width/height) of the bundled floor-plan PNGs —
 * both floors are 311x1024. Hardcoded at build time because
 * Image.resolveAssetSource does not exist on react-native-web.
 */
export const FLOOR_PLAN_ASPECT: Record<Floor, number> = {
  upstairs: 311 / 1024,
  downstairs: 311 / 1024,
};

export const FLOOR_PLAN_DEFAULT: Record<Floor, ImageSourcePropType> = {
  upstairs: require('../../assets/locations/fp-up-default.png'),
  downstairs: require('../../assets/locations/fp-down-default.png'),
};

export const FLOOR_PLAN_HIGHLIGHT: Record<string, ImageSourcePropType> = {
  'back-closet': require('../../assets/locations/fp-up-back-closet.png'),
  'big-room': require('../../assets/locations/fp-up-big-room.png'),
  loft: require('../../assets/locations/fp-up-loft.png'),
  office: require('../../assets/locations/fp-down-office.png'),
  'av-closet': require('../../assets/locations/fp-down-av-closet.png'),
  sauna: require('../../assets/locations/fp-down-sauna.png'),
  basement: require('../../assets/locations/fp-down-basement.png'),
  lounge: require('../../assets/locations/fp-down-lounge.png'),
  lobby: require('../../assets/locations/fp-down-lobby.png'),
  'bar-closet': require('../../assets/locations/fp-down-bar-closet.png'),
};

export const ZONE_PHOTOS: Record<string, ImageSourcePropType> = {
  'back-closet': require('../../assets/locations/photo-back-closet.png'),
  'big-room': require('../../assets/locations/photo-big-room.png'),
  loft: require('../../assets/locations/photo-loft.png'),
  office: require('../../assets/locations/photo-office.png'),
  'av-closet': require('../../assets/locations/photo-av-closet.png'),
  sauna: require('../../assets/locations/photo-sauna.png'),
  basement: require('../../assets/locations/photo-basement.png'),
  lounge: require('../../assets/locations/photo-lounge.png'),
  lobby: require('../../assets/locations/photo-lobby.png'),
  'bar-closet': require('../../assets/locations/photo-bar-closet.png'),
};

export const ALL_ZONES: LocationZone[] = [
  ...LOCATION_ZONES.upstairs,
  ...LOCATION_ZONES.downstairs,
];

/** An admin's edits to one room: a renamed label, a replaced photo, or both. */
export interface ZoneOverride {
  label: string | null;
  photo_url: string | null;
}

/**
 * Admin overrides, mirrored here from the location_zone_overrides table by
 * features/locations/hooks.ts. Held in a module cache rather than passed down
 * because getLocationLabel() is called from plain functions all over the app
 * (checklist rows, share summaries, placement text) that have no hook access.
 * Unset rooms keep the bundled name and photo, so the app renders correctly
 * before the fetch lands — and if it never does.
 */
let zoneOverrides: Record<string, ZoneOverride> = {};

export function setZoneOverrides(next: Record<string, ZoneOverride>): void {
  zoneOverrides = next;
}

export function getZoneOverride(zoneId: string): ZoneOverride | undefined {
  return zoneOverrides[zoneId];
}

export function getLocationLabel(zoneId: string | null | undefined): string {
  if (!zoneId) return '';
  const renamed = zoneOverrides[zoneId]?.label;
  if (renamed) return renamed;
  return ALL_ZONES.find((z) => z.id === zoneId)?.label ?? zoneId;
}

/** The room's photo: an admin's upload if there is one, else the bundled shot. */
export function getZonePhoto(
  zoneId: string | null | undefined,
): ImageSourcePropType | undefined {
  if (!zoneId) return undefined;
  const uploaded = zoneOverrides[zoneId]?.photo_url;
  return uploaded ? { uri: uploaded } : ZONE_PHOTOS[zoneId];
}

/** One floor's rooms with any renames applied. */
export function zonesForFloor(floor: Floor): LocationZone[] {
  return LOCATION_ZONES[floor].map((zone) => ({
    ...zone,
    label: getLocationLabel(zone.id),
  }));
}

/** "Big Room → Loft", a single zone's label, or null when neither is set. */
export function formatZoneSpan(
  from?: string | null,
  to?: string | null,
): string | null {
  if (from && to) return `${getLocationLabel(from)} → ${getLocationLabel(to)}`;
  if (from || to) return getLocationLabel(from ?? to);
  return null;
}

export function floorPrefix(floor: Floor): 'up' | 'down' {
  return floor === 'upstairs' ? 'up' : 'down';
}

export function zoneFloor(zoneId: string): Floor | null {
  if (LOCATION_ZONES.upstairs.some((z) => z.id === zoneId)) return 'upstairs';
  if (LOCATION_ZONES.downstairs.some((z) => z.id === zoneId)) return 'downstairs';
  return null;
}
