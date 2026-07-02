// Parse "CyberHoot APIs.xlsx" into config/hotels.json — dependency-free.
//
// An .xlsx is a ZIP archive of XML parts. We read the two parts we need
// (sharedStrings.xml + the worksheet) using a minimal ZIP reader built on
// Node's zlib, then map the sheet's 3 columns (code, name, apiKey) to JSON.
//
// Usage: node scripts/build-hotels-config.mjs [path/to/workbook.xlsx]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const xlsxPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(ROOT, 'CyberHoot APIs.xlsx');
const outPath = resolve(ROOT, 'config', 'hotels.json');

// --- Minimal ZIP reader: returns { entryName: Buffer } for every file. ---
function readZip(buf) {
  // Locate the End Of Central Directory record (scan back from the tail).
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Not a valid ZIP/xlsx file (no EOCD record).');

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16); // start of central directory
  const entries = {};

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) {
      throw new Error('Corrupt central directory in xlsx.');
    }
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);

    // The local header's extra-field length can differ from the central one,
    // so read it to find where the file data actually starts.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = buf.subarray(dataStart, dataStart + compSize);

    entries[name] = method === 0 ? Buffer.from(comp) : inflateRawSync(comp);
    off += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, '&'); // must run last
}

// Shared strings: one <si> per string; concatenate its <t> runs.
function parseSharedStrings(xml) {
  const out = [];
  for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let text = '';
    for (const t of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) text += t[1];
    out.push(decodeXml(text));
  }
  return out;
}

// Worksheet rows -> [{ A, B, C }] using shared-string lookups.
function parseSheet(xml, shared) {
  const rows = [];
  for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const cm of rm[1].matchAll(
      /<c r="([A-Z]+)\d+"([^>]*)>(?:<v>([\s\S]*?)<\/v>)?<\/c>/g
    )) {
      const [, col, attrs, raw] = cm;
      if (raw == null) continue;
      const isShared = /\bt="s"/.test(attrs);
      cells[col] = isShared ? shared[Number(raw)] : decodeXml(raw);
    }
    rows.push(cells);
  }
  return rows;
}

function main() {
  let buf;
  try {
    buf = readFileSync(xlsxPath);
  } catch {
    console.error(`Could not read spreadsheet at: ${xlsxPath}`);
    console.error('Pass the path explicitly: node scripts/build-hotels-config.mjs "<file>.xlsx"');
    process.exit(1);
  }

  const zip = readZip(buf);
  const sharedXml = zip['xl/sharedStrings.xml']?.toString('utf8') ?? '';
  const sheetName =
    Object.keys(zip).find((n) => /^xl\/worksheets\/sheet1\.xml$/.test(n)) ||
    Object.keys(zip).find((n) => /^xl\/worksheets\/.*\.xml$/.test(n));
  const sheetXml = zip[sheetName]?.toString('utf8') ?? '';

  const shared = parseSharedStrings(sharedXml);
  const rows = parseSheet(sheetXml, shared);

  const hotels = [];
  const seen = new Set();
  for (const r of rows) {
    const code = (r.A || '').trim();
    const name = (r.B || '').trim();
    const apiKey = (r.C || '').trim();
    // Skip header row and anything that isn't a 64-char hex API key.
    if (!/^[a-f0-9]{64}$/i.test(apiKey)) continue;
    if (seen.has(apiKey)) continue;
    seen.add(apiKey);
    hotels.push({ code, name, apiKey });
  }

  if (hotels.length === 0) {
    console.error('No hotel rows with valid API keys were found. Check the spreadsheet layout.');
    process.exit(1);
  }

  // Merge any hand-maintained environments not present in the spreadsheet
  // (e.g. Corporate, whose key isn't in hex format). config/extra-hotels.json
  // is a gitignored secret; entries are kept verbatim (code, name, apiKey, ...).
  const extraPath = resolve(ROOT, 'config', 'extra-hotels.json');
  let extras = [];
  try {
    extras = JSON.parse(readFileSync(extraPath, 'utf8'));
  } catch {
    /* no extras file — fine */
  }
  for (const e of extras) {
    if (!e?.apiKey || seen.has(e.apiKey)) continue;
    seen.add(e.apiKey);
    hotels.push(e);
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(hotels, null, 2) + '\n');
  console.log(`Wrote ${hotels.length} hotels to ${outPath}`);
  for (const h of hotels) console.log(`  ${h.code.padEnd(8)} ${h.name}`);
}

main();
