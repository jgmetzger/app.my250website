// Minimal RFC-4180-ish CSV parser. Handles quoted fields, escaped quotes
// (""), CRLF / LF line endings, and a BOM at the start. No streaming —
// one-shot parse from a string. Good enough for human-edited spreadsheets.

export type CsvRow = Record<string, string>;

export function parseCsv(input: string): { headers: string[]; rows: CsvRow[] } {
  // Strip UTF-8 BOM.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records = tokenize(text);
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = (records[0] ?? []).map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const cols = records[i] ?? [];
    if (cols.length === 0 || (cols.length === 1 && cols[0] === "")) continue;
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

function tokenize(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // ignore (handled together with \n)
    } else {
      field += ch;
    }
  }
  // Flush last field/row.
  if (field !== "" || row.length > 0) {
    row.push(field);
    records.push(row);
  }
  return records;
}
