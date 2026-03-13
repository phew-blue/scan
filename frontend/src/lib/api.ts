export interface Pattern {
  id: string;
  name: string;
  regex: string;
  is_default: boolean;
  created_at: string;
}

export interface Job {
  id: string;
  title: string;
  created_at: string;
  scan_count?: number;
}

export interface Scan {
  id: string;
  job_id: string;
  barcode: string;
  valid: boolean;
  scanned_at: string;
}

export interface JobWithScans extends Job {
  scans: Scan[];
  patterns: Pattern[];
}

const base = typeof window !== "undefined" ? "" : "http://localhost:8080";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listJobs: () => request<Job[]>("/api/jobs"),

  createJob: (title: string) =>
    request<Job>("/api/jobs", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  getJob: (id: string) => request<JobWithScans>(`/api/jobs/${id}`),

  deleteJob: (id: string) =>
    request<void>(`/api/jobs/${id}`, { method: "DELETE" }),

  addScan: (jobId: string, barcode: string) =>
    request<Scan>(`/api/jobs/${jobId}/scans`, {
      method: "POST",
      body: JSON.stringify({ barcode }),
    }),

  deleteScan: (jobId: string, scanId: string) =>
    request<void>(`/api/jobs/${jobId}/scans/${scanId}`, { method: "DELETE" }),

  addJobPattern: (jobId: string, patternId: string) =>
    request<void>(`/api/jobs/${jobId}/patterns`, {
      method: "POST",
      body: JSON.stringify({ pattern_id: patternId }),
    }),

  removeJobPattern: (jobId: string, patternId: string) =>
    request<void>(`/api/jobs/${jobId}/patterns/${patternId}`, { method: "DELETE" }),

  listPatterns: () => request<Pattern[]>("/api/patterns"),

  createPattern: (name: string, regex: string) =>
    request<Pattern>("/api/patterns", {
      method: "POST",
      body: JSON.stringify({ name, regex }),
    }),

  setPatternDefault: (id: string, isDefault: boolean) =>
    request<void>(`/api/patterns/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_default: isDefault }),
    }),

  deletePattern: (id: string) =>
    request<void>(`/api/patterns/${id}`, { method: "DELETE" }),
};

export function formatOutput(job: JobWithScans): string {
  const lines = [job.title, "", ...job.scans.map((s) => s.barcode)];
  return lines.join("\n");
}
