"use client";

import { PrinterIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Prints the current page; navigation and elements marked `no-print` are hidden by globals.css. */
export function PrintButton({ label = "طباعة" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" className="no-print" onClick={() => window.print()}>
      <PrinterIcon />
      {label}
    </Button>
  );
}
