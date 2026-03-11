"use client";

import { useEffect, useState } from "react";
import { api, type Job } from "@/lib/api";

export default function Home() {
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
      window.location.href = `/jobs/${job.id}/`;
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
                href={`/jobs/${job.id}/`}
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
