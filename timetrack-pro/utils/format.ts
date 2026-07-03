export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function formatDuration(minutes: number): string {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

export function formatAddress(
  profile: {
    address_street?: string | null;
    address_street2?: string | null;
    address_city?: string | null;
    address_state?: string | null;
    address_zip?: string | null;
  },
  separator = '\n',
): string {
  const parts: string[] = [];

  if (profile.address_street) {
    parts.push(profile.address_street);
  }
  if (profile.address_street2) {
    parts.push(profile.address_street2);
  }

  if (profile.address_city || profile.address_state || profile.address_zip) {
    const cityStateZip: string[] = [];
    if (profile.address_city) cityStateZip.push(profile.address_city);
    if (profile.address_state) {
      if (profile.address_city) {
        cityStateZip[cityStateZip.length - 1] += ',';
      }
      cityStateZip.push(profile.address_state);
    }
    if (profile.address_zip) cityStateZip.push(profile.address_zip);
    parts.push(cityStateZip.join(' '));
  }

  return parts.length > 0 ? parts.join(separator) : 'Not provided';
}

export function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}
