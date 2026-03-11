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
};

export function formatOutput(job: JobWithScans): string {
  const lines = [job.title, "", ...job.scans.map((s) => s.barcode)];
  return lines.join("\n");
}
