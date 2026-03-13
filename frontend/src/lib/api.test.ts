import { describe, it, expect } from "vitest";
import { formatOutput } from "./api";
import type { JobWithScans } from "./api";

const baseJob: JobWithScans = {
  id: "abc",
  title: "Test Job",
  created_at: "2026-01-01T00:00:00Z",
  scans: [],
  patterns: [],
};

describe("formatOutput", () => {
  it("outputs title followed by blank line then barcodes", () => {
    const job: JobWithScans = {
      ...baseJob,
      scans: [
        { id: "1", job_id: "abc", barcode: "TL12345678", valid: true, scanned_at: "" },
        { id: "2", job_id: "abc", barcode: "TL87654321", valid: true, scanned_at: "" },
      ],
    };
    expect(formatOutput(job)).toBe("Test Job\n\nTL12345678\nTL87654321");
  });

  it("outputs title and blank line with no scans", () => {
    expect(formatOutput(baseJob)).toBe("Test Job\n");
  });

  it("includes invalid scans in output", () => {
    const job: JobWithScans = {
      ...baseJob,
      scans: [
        { id: "1", job_id: "abc", barcode: "INVALID", valid: false, scanned_at: "" },
      ],
    };
    expect(formatOutput(job)).toBe("Test Job\n\nINVALID");
  });

  it("preserves scan order", () => {
    const job: JobWithScans = {
      ...baseJob,
      scans: [
        { id: "1", job_id: "abc", barcode: "TL00000001", valid: true, scanned_at: "" },
        { id: "2", job_id: "abc", barcode: "TL00000002", valid: true, scanned_at: "" },
        { id: "3", job_id: "abc", barcode: "TL00000003", valid: true, scanned_at: "" },
      ],
    };
    const lines = formatOutput(job).split("\n");
    expect(lines[2]).toBe("TL00000001");
    expect(lines[3]).toBe("TL00000002");
    expect(lines[4]).toBe("TL00000003");
  });
});
