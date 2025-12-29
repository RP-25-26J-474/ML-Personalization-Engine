import React from "react";

function Dashboard() {
  return (
    <div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-primary/10 bg-base-200 p-4">
          <div className="text-xs uppercase tracking-wide text-base-content/60">
            Active Experiments
          </div>
          <div className="mt-2 text-2xl font-semibold">8</div>
          <div className="text-xs text-base-content/60">
            2 running, 6 queued
          </div>
        </div>
        <div className="rounded-xl border border-primary/10 bg-base-200 p-4">
          <div className="text-xs uppercase tracking-wide text-base-content/60">
            Model Health
          </div>
          <div className="mt-2 text-2xl font-semibold">98.4%</div>
          <div className="text-xs text-base-content/60">Stable over 7 days</div>
        </div>
        <div className="rounded-xl border border-primary/10 bg-base-200 p-4">
          <div className="text-xs uppercase tracking-wide text-base-content/60">
            Data Freshness
          </div>
          <div className="mt-2 text-2xl font-semibold">14 min</div>
          <div className="text-xs text-base-content/60">
            Last ingest: 12:41 PM
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
