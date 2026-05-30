// Defensive caps for untrusted CSV uploads — bound work so a hostile payload
// can't drive an unbounded loop (DoS). Generous vs. any real society dataset.
const MAX_LINE_LENGTH = 64 * 1024; // 64 KB per line
const MAX_ROWS = 50_000;

/** Parse a single CSV line respecting quoted fields. */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  // Clamp the loop bound to a constant so it can't be driven unbounded by a
  // user-controlled line length.
  const len = Math.min(line.length, MAX_LINE_LENGTH);
  for (let i = 0; i < len; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''));
  // Cap the number of data rows processed — bounds total parsing work.
  const rows = lines.slice(1, MAX_ROWS + 1).map(parseCsvLine);
  return { headers, rows };
}

export function rowToRecord(headers: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    record[header] = (row[index] ?? '').trim();
  });
  return record;
}

export function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(values: string[]): string {
  return values.map((v) => escapeCsvField(v)).join(',');
}
