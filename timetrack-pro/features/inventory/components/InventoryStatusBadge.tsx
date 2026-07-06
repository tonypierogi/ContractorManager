import React from 'react';
import Badge from '@/components/ui/Badge';

/**
 * Legacy mapping (inventory.js:245): 'OUT' -> red, 'Some' -> amber,
 * anything else (i.e. 'Plenty') -> green.
 */
export default function InventoryStatusBadge({ status }: { status: string }) {
  const variant = status === 'OUT' ? 'danger' : status === 'Some' ? 'warning' : 'success';
  return <Badge label={status} variant={variant} />;
}
