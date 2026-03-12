"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { api, type Job, type JobWithScans, type Scan, formatOutput } from "@/lib/api";

const Scanner = dynamic(() => import("@/components/Scanner"), { ssr: false });

function JobDetail({ id }: { id: string }) {
  const [job, setJob] = useState<JobWithScans | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    api.getJob(id).then(setJob).catch(() => setError("Job not found"));
  }, [id]);

  const handleScan = useCallback(
    async (barcode: string) => {
      try {
        const scan = await api.addScan(id, barcode);
        setJob((prev) =>
          prev ? { ...prev, scans: [...prev.scans, scan] } : prev
        );
      } catch (err) {
        console.error("add scan failed", err);
      }
    },
    [id]
  );

  async function removeScan(scan: Scan) {
    await api.deleteScan(id, scan.id);
    setJob((prev) =>
      prev ? { ...prev, scans: prev.scans.filter((s) => s.id !== scan.id) } : prev
    );
  }

  async function copyOutput() {
    if (!job) return;
    await navigator.clipboard.writeText(formatOutput(job));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) return <p className="text-red-400">{error}</p>;
  if (!job) return <p className="text-gray-500">Loading…</p>;

  const validScans = job.scans.filter((s) => s.valid);
  const invalidScans = job.scans.filter((s) => !s.valid);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <a href="/" className="mb-1 inline-block text-xs text-gray-500 hover:text-gray-300">
            ← All jobs
          </a>
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <p className="text-sm text-gray-500">
            {new Date(job.created_at).toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={copyOutput}
          disabled={job.scans.length === 0}
          className="flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-40"
        >
          {copied ? (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy output
            </>
          )}
        </button>
      </div>

      {job.scans.length > 0 && (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">Output preview</p>
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-200">
            {formatOutput(job)}
          </pre>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">Scanner</h2>
        <button onClick={() => setScanning(!scanning)} className="text-xs text-gray-500 hover:text-gray-300">
          {scanning ? "Hide scanner" : "Show scanner"}
        </button>
      </div>

      {scanning && <Scanner onScan={handleScan} />}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">
            Scanned codes
            <span className="ml-2 rounded bg-gray-800 px-1.5 py-0.5 text-xs">{job.scans.length}</span>
          </h2>
          {invalidScans.length > 0 && (
            <span className="text-xs text-amber-400">{invalidScans.length} invalid</span>
          )}
        </div>

        {job.scans.length === 0 ? (
          <p className="text-sm text-gray-600">No codes scanned yet.</p>
        ) : (
          <ul className="space-y-1">
            {[...job.scans].reverse().map((scan) => (
              <li
                key={scan.id}
                className={`flex items-center justify-between rounded px-3 py-2 font-mono text-sm ${
                  scan.valid ? "bg-gray-900 text-gray-100" : "bg-red-950/40 text-red-300"
                }`}
              >
                <span>{scan.barcode}</span>
                <div className="flex items-center gap-3">
                  {!scan.valid && <span className="text-xs text-red-400">invalid</span>}
                  <button onClick={() => removeScan(scan)} className="text-gray-600 hover:text-red-400" title="Remove">
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {job.scans.length > 0 && (
        <div className="flex gap-4 text-xs text-gray-600">
          <span>{validScans.length} valid</span>
          {invalidScans.length > 0 && <span className="text-red-500">{invalidScans.length} invalid</span>}
          <span>{job.scans.length} total</span>
        </div>
      )}
    </div>
  );
}

function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listJobs().then(setJobs).catch(console.error);
  }, []);

  async function createJob(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    try {
      const job = await api.createJob(title.trim());
      window.location.href = `/?id=${job.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
      setCreating(false);
    }
  }

  async function deleteJob(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this job and all its scans?")) return;
    await api.deleteJob(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Jobs</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus:outline-none"
        >
          New Job
        </button>
      </div>

      {showForm && (
        <form onSubmit={createJob} className="flex gap-3">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Job title e.g. S4C Mens"
            className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={creating || !title.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {jobs.length === 0 ? (
        <p className="text-gray-500">No jobs yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <a
                href={`/?id=${job.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 hover:border-gray-700 hover:bg-gray-800"
              >
                <div>
                  <p className="font-medium">{job.title}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(job.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    · {job.scan_count ?? 0} scan{job.scan_count !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteJob(e, job.id)}
                  className="ml-4 text-xs text-gray-600 hover:text-red-400"
                >
                  Delete
                </button>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function App() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  return id ? <JobDetail id={id} /> : <JobList />;
}

export default function Home() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
      <App />
    </Suspense>
  );
}
