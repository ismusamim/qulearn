import { describe, expect, it } from "vitest";

import { decodeText, detectDelimiter, parseCSV } from "./csv";
import { parseSheetUrl, sheetCsvUrl } from "./sheets";

describe("parseCSV", () => {
  it("parses comma-separated rows and strips the BOM", () => {
    expect(parseCSV("﻿الاسم,الجوال\nمحمد,0100\n")).toEqual([["الاسم", "الجوال"], ["محمد", "0100"]]);
  });

  it("detects tabs (pasted cells) and semicolons", () => {
    expect(detectDelimiter("a\tb,c\td")).toBe("\t");
    expect(parseCSV("الاسم\tالحلقة\r\nعلي\tحلقة أحمد")).toEqual([["الاسم", "الحلقة"], ["علي", "حلقة أحمد"]]);
    expect(parseCSV("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("handles quotes, embedded delimiters, doubled quotes and line breaks", () => {
    expect(parseCSV('name,note\n"علي, محمد","قال ""نعم""\nسطر ثان"')).toEqual([
      ["name", "note"],
      ["علي, محمد", 'قال "نعم"\nسطر ثان'],
    ]);
  });

  it("keeps empty cells and a last line without newline", () => {
    expect(parseCSV("a,b,c\n1,,3")).toEqual([["a", "b", "c"], ["1", "", "3"]]);
    expect(parseCSV("")).toEqual([]);
  });
});

describe("decodeText", () => {
  it("falls back to windows-1256 when the bytes are not UTF-8", () => {
    expect(decodeText(new TextEncoder().encode("الاسم").buffer as ArrayBuffer)).toBe("الاسم");
    // «اسم» in windows-1256
    expect(decodeText(new Uint8Array([0xc7, 0xd3, 0xe3]).buffer)).toBe("اسم");
  });
});

describe("parseSheetUrl", () => {
  it("accepts Google Sheets links and rebuilds the export URL", () => {
    const ref = parseSheetUrl("https://docs.google.com/spreadsheets/d/1AbC_def-456789012/edit?usp=sharing#gid=42");
    expect(ref).toEqual({ id: "1AbC_def-456789012", gid: "42" });
    expect(sheetCsvUrl(ref!)).toBe("https://docs.google.com/spreadsheets/d/1AbC_def-456789012/gviz/tq?tqx=out:csv&gid=42");
    expect(parseSheetUrl("https://docs.google.com/spreadsheets/d/1AbC_def-456789012")?.gid).toBeNull();
  });

  it("rejects anything that is not https://docs.google.com", () => {
    for (const bad of [
      "http://docs.google.com/spreadsheets/d/1AbC_def-456789012/edit",
      "https://docs.google.com.evil.test/spreadsheets/d/1AbC_def-456789012/edit",
      "https://evil.test/spreadsheets/d/1AbC_def-456789012/edit",
      "https://user@docs.google.com/spreadsheets/d/1AbC_def-456789012/edit",
      "https://docs.google.com:8443/spreadsheets/d/1AbC_def-456789012/edit",
      "https://docs.google.com/document/d/1AbC_def-456789012/edit",
      "https://docs.google.com/spreadsheets/d/../../etc/edit",
      "http://169.254.169.254/latest/meta-data",
      "not a url",
    ]) {
      expect(parseSheetUrl(bad), bad).toBeNull();
    }
  });
});
