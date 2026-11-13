/**
 * Dependency-free .xlsx reader for the browser. An .xlsx file is a zip of XML
 * parts; entries are inflated with the built-in DecompressionStream and read
 * with DOMParser, so this module must only be imported by client components.
 */
import type { Table } from "./csv";

interface ZipEntry {
  method: number;
  size: number;
  offset: number;
}

type ZipReader = (name: string) => Promise<string | null>;

const END_OF_CENTRAL_DIR = 0x06054b50;
const CENTRAL_FILE_HEADER = 0x02014b50;

/** Reads the zip central directory and returns a function that extracts one entry as text. */
async function unzip(buffer: ArrayBuffer): Promise<ZipReader> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder();

  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === END_OF_CENTRAL_DIR) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("zip");

  const count = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  const entries = new Map<string, ZipEntry>();
  for (let k = 0; k < count; k++) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== CENTRAL_FILE_HEADER) break;
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    entries.set(decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength)), {
      method: view.getUint16(p + 10, true),
      size: view.getUint32(p + 20, true),
      offset: view.getUint32(p + 42, true),
    });
    p += 46 + nameLength + extraLength + commentLength;
  }

  return async (name) => {
    const entry = entries.get(name);
    if (!entry) return null;
    const start = entry.offset + 30 + view.getUint16(entry.offset + 26, true) + view.getUint16(entry.offset + 28, true);
    const data = bytes.slice(start, start + entry.size);
    if (entry.method === 0) return decoder.decode(data);
    const inflated = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return decoder.decode(await new Response(inflated).arrayBuffer());
  };
}

const parseXml = (source: string) => new DOMParser().parseFromString(source, "application/xml");

const textOf = (el: Element) =>
  Array.from(el.getElementsByTagName("t"))
    .map((t) => t.textContent ?? "")
    .join("");

/** "BC12" → zero-based column index. */
function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

/** Path of the first worksheet, following the workbook relationships; falls back to the usual location. */
async function firstSheetPath(read: ZipReader, workbookXml: string): Promise<string> {
  const fallback = "xl/worksheets/sheet1.xml";
  try {
    const relId = parseXml(workbookXml).getElementsByTagName("sheet")[0]?.getAttribute("r:id");
    const rels = await read("xl/_rels/workbook.xml.rels");
    if (!relId || !rels) return fallback;
    for (const rel of Array.from(parseXml(rels).getElementsByTagName("Relationship"))) {
      const target = rel.getAttribute("Target");
      if (rel.getAttribute("Id") === relId && target) return target.startsWith("/") ? target.slice(1) : `xl/${target}`;
    }
  } catch {
    // Keep the default path.
  }
  return fallback;
}

/** Reads the first sheet of an .xlsx workbook as a table of strings. */
export async function parseXLSX(buffer: ArrayBuffer): Promise<Table> {
  const read = await unzip(buffer);
  const workbook = await read("xl/workbook.xml");
  if (!workbook) throw new Error("xlsx");

  const shared: string[] = [];
  const sharedXml = await read("xl/sharedStrings.xml");
  if (sharedXml) for (const si of Array.from(parseXml(sharedXml).getElementsByTagName("si"))) shared.push(textOf(si));

  const sheetXml = await read(await firstSheetPath(read, workbook));
  if (!sheetXml) throw new Error("xlsx");

  const rows: Table = [];
  for (const row of Array.from(parseXml(sheetXml).getElementsByTagName("row"))) {
    const cells: string[] = [];
    for (const c of Array.from(row.getElementsByTagName("c"))) {
      const ref = c.getAttribute("r");
      const col = ref ? columnIndex(ref) : cells.length;
      const type = c.getAttribute("t");
      let value: string;
      if (type === "inlineStr") value = textOf(c);
      else {
        value = c.getElementsByTagName("v")[0]?.textContent ?? "";
        if (type === "s") value = shared[Number(value)] ?? "";
      }
      cells[col] = value;
    }
    // Sparse rows leave holes; fill them so every cell is a string.
    rows.push(Array.from(cells, (v) => v ?? ""));
  }
  return rows;
}

/** True when the file starts with the zip signature "PK". */
export function looksLikeZip(buffer: ArrayBuffer): boolean {
  const head = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  return head[0] === 0x50 && head[1] === 0x4b;
}
