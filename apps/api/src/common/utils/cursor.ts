/**
 * Opaque cursors.
 *
 * A cursor is base64url of the last row's sort key. It is opaque to the client
 * on purpose: making it readable invites hand-editing, and encoding the sort
 * key means the page boundary survives rows being inserted above it, which an
 * offset does not.
 */
export function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined): string | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Take one row more than asked for; its presence is what tells us another page
 * exists without a second COUNT query.
 */
export function paginate<T>(
  rows: T[],
  limit: number,
  toCursor: (row: T) => string,
): { items: T[]; nextCursor: string | null } {
  if (rows.length <= limit) {
    return { items: rows, nextCursor: null };
  }
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: last ? encodeCursor(toCursor(last)) : null };
}
