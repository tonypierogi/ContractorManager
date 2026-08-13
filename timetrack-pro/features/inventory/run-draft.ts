import AsyncStorage from '@react-native-async-storage/async-storage';
import type { InventoryStatus } from './api';

// An entry exists only once the item is fully checked — the camera-first
// flow guarantees status and photo always arrive together.
export interface DraftCheck {
  status: InventoryStatus;
  photo_url: string;
  notes?: string;
}

export interface RunDraft {
  startedAt: string;
  checks: Record<string, DraftCheck>;
}

const keyFor = (userId: string) => `inventory-run-draft:${userId}`;

export async function loadRunDraft(userId: string): Promise<RunDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunDraft;
    return parsed && typeof parsed.checks === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveRunDraft(userId: string, draft: RunDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(draft));
  } catch {
    // Persistence is best-effort; the in-memory draft still drives the run.
  }
}

export async function clearRunDraft(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    // Ignore — a stale draft resurfaces as "Continue run" and can be discarded.
  }
}
