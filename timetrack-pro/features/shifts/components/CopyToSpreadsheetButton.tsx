import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Button from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Colors } from '@/constants/theme';

export interface SpreadsheetColumn<T> {
  header: string;
  value: (row: T) => string;
}

interface CopyToSpreadsheetButtonProps<T> {
  /** Already-loaded rows currently shown in the table (filtered). */
  rows: T[];
  /** Column config: header label + cell text extractor, in export order. */
  columns: SpreadsheetColumn<T>[];
}

/**
 * "Copy to Spreadsheet" button (legacy spreadsheet.js parity).
 * Builds TSV (header row + one line per row, tab-separated, newline-terminated)
 * and writes it to the OS clipboard for pasting into Excel/Google Sheets.
 */
export default function CopyToSpreadsheetButton<T>({
  rows,
  columns,
}: CopyToSpreadsheetButtonProps<T>) {
  const { showToast } = useToast();

  const handleCopy = async () => {
    // Clipboard writes are not mutations, so the global MutationCache error
    // toast never fires here — handle failures inline.
    if (rows.length === 0) {
      showToast('No shifts to copy.', 'error');
      return;
    }
    const header = columns.map((c) => c.header).join('\t');
    const lines = rows.map((row) => columns.map((c) => c.value(row)).join('\t'));
    // Legacy output terminated every line (including the last) with \n.
    const tsv = `${header}\n${lines.join('\n')}\n`;
    try {
      await Clipboard.setStringAsync(tsv);
      showToast(`Copied ${rows.length} shift${rows.length === 1 ? '' : 's'} to clipboard`);
    } catch {
      showToast('Failed to copy.', 'error');
    }
  };

  return (
    <Button
      title="Copy to Spreadsheet"
      variant="secondary"
      size="sm"
      onPress={handleCopy}
      icon={<Ionicons name="copy-outline" size={14} color={Colors.text} />}
    />
  );
}
