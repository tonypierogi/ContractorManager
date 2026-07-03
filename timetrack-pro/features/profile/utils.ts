import type { Profile } from '@/types/database';

export function isProfileIncomplete(profile: Profile | null): boolean {
  if (!profile) return true;
  return (
    !profile.first_name ||
    !profile.last_name ||
    !profile.address_street ||
    !profile.address_city ||
    !profile.address_state ||
    !profile.address_zip
  );
}
