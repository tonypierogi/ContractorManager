/**
 * Turning pasted notes into draft tasks. The shapes people actually paste —
 * bullets, numbered steps, checkboxes, headings — all mean the same thing, so
 * the parser strips the decoration and keeps the words.
 */

export interface ParsedImportItem {
  title: string;
  description: string;
  item_type: 'task' | 'section';
}

/** '- ', '* ', '1. ', '2) ', '[ ] ', '[x] ' and friends. */
const BULLET = /^(?:[-*•·–—+>]+|\[[ xX]?\]|\(?\d+[.)])\s+/;
/** '# Heading', '## Heading' */
const HEADING = /^#{1,6}\s+/;

const isIndented = (line: string) => /^(?:\t| {2,})/.test(line);

/** 'KITCHEN', 'PREP AREA' — a short shouted line reads as a heading. */
function isShoutedHeading(text: string): boolean {
  return (
    text.length <= 40 && /[A-Z]/.test(text) && text === text.toUpperCase()
  );
}

/**
 * Parses pasted plain text into draft items, one per line.
 *
 * - '# Heading', 'Heading:' and SHORT SHOUTED LINES become sections.
 * - Bullets, numbers and checkboxes are stripped from the title.
 * - 'Mop floors: use the blue bucket' splits into title and description.
 * - An indented line with no bullet is folded into the previous item's
 *   description, so notes with sub-lines survive the trip.
 */
export function parseImportedTasks(text: string): ParsedImportItem[] {
  const items: ParsedImportItem[] = [];

  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;

    const trimmed = raw.trim();
    const heading = HEADING.test(trimmed);
    const bulleted = BULLET.test(trimmed);
    const body = trimmed.replace(HEADING, '').replace(BULLET, '').trim();
    if (!body) continue;

    // A continuation line: indented, unadorned, and something to attach to.
    const previous = items[items.length - 1];
    if (previous && !heading && !bulleted && isIndented(raw)) {
      previous.description = previous.description
        ? `${previous.description}\n${body}`
        : body;
      continue;
    }

    if (heading || (!bulleted && isShoutedHeading(body))) {
      items.push({
        title: body.replace(/:$/, '').trim(),
        description: '',
        item_type: 'section',
      });
      continue;
    }

    if (body.endsWith(':')) {
      items.push({
        title: body.slice(0, -1).trim(),
        description: '',
        item_type: 'section',
      });
      continue;
    }

    // 'Title: the rest' — everything after the first colon is the description.
    const colon = body.indexOf(': ');
    if (colon > 0) {
      items.push({
        title: body.slice(0, colon).trim(),
        description: body.slice(colon + 1).trim(),
        item_type: 'task',
      });
      continue;
    }

    items.push({ title: body, description: '', item_type: 'task' });
  }

  return items.filter((it) => it.title.length > 0);
}
