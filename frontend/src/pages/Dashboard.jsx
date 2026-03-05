import { useEffect, useState } from "react";
import { getJson } from "../api/MLPEClient";

function Dashboard() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    getJson("/dashboard/status")
      .then((data) => {
        if (mounted) {
          setStatus(data);
          setError("");
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Failed to load status.");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const usersWithProfiles = status?.data?.users_with_profiles ?? "--";
  const profileVersions = status?.data?.profile_versions_total ?? "--";
  const globalVersion = status?.models?.global_iforest_version ?? "--";
  const userSeqVersion = status?.models?.user_seq_model_version ?? "--";
  const categoryVersion = status?.models?.category_model_version ?? "--";
  const engineStatus = status?.engine_status || {};
  const healthChecks = status?.health_checks || {};
  const categoryStatus = engineStatus.category_engine || {};
  const tempStatus = engineStatus.temp_detector || {};
  const userStatus = engineStatus.user_engine || {};
  const categoryHealth = healthChecks.category_engine_model || {};
  const tempHealth = healthChecks.temp_detector_model || {};
  const userHealth = healthChecks.user_seq_model || {};

  const formatTime = (value) => {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  return (
    <div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-primary/10 bg-base-200 p-4">
          <div className="text-xs uppercase tracking-wide text-base-content/60">
            Users With Profiles
          </div>
          <div className="mt-2 text-2xl font-semibold">{usersWithProfiles}</div>
          <div className="text-xs text-base-content/60">
            {error ? `Error: ${error}` : "Profiles stored in memory"}
          </div>
        </div>
        <div className="rounded-xl border border-primary/10 bg-base-200 p-4">
          <div className="text-xs uppercase tracking-wide text-base-content/60">
            Profile Versions
          </div>
          <div className="mt-2 text-2xl font-semibold">{profileVersions}</div>
          <div className="text-xs text-base-content/60">
            Total versions across all users
          </div>
        </div>
        <div className="rounded-xl border border-primary/10 bg-base-200 p-4">
          <div className="text-xs uppercase tracking-wide text-base-content/60">
            Global IForest Version
          </div>
          <div className="mt-2 text-2xl font-semibold">{globalVersion}</div>
          <div className="text-xs text-base-content/60">
            Latest global model snapshot
          </div>
        </div>
        <div className="rounded-xl border border-primary/10 bg-base-200 p-4">
          <div className="text-xs uppercase tracking-wide text-base-content/60">
            User Seq Model Version
          </div>
          <div className="mt-2 text-2xl font-semibold">{userSeqVersion}</div>
          <div className="text-xs text-base-content/60">
            Latest sequence autoencoder snapshot
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-primary/10 bg-base-200 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Category Engine</div>
            <HealthChip active={Boolean(categoryHealth.available)} />
          </div>
          <div className="mt-2 text-xs text-base-content/60">
            Trained:{" "}
            <span className="font-medium text-base-content">
              {categoryStatus.trained ? "Yes" : "No"}
            </span>
          </div>
          <div className="text-xs text-base-content/60">
            Samples (last train):{" "}
            <span className="font-medium text-base-content">
              {categoryStatus.last_n_samples ?? 0}
            </span>
          </div>
          <div className="text-xs text-base-content/60">
            Version:{" "}
            <span className="font-medium text-base-content">
              {categoryVersion}
            </span>
          </div>
          <div className="text-xs text-base-content/60">
            Last trained:{" "}
            <span className="font-medium text-base-content">
              {formatTime(categoryStatus.last_training_time)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-primary/10 bg-base-200 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Temporary User Detector</div>
            <HealthChip active={Boolean(tempHealth.available)} />
          </div>
          <div className="mt-2 text-xs text-base-content/60">
            Trained:{" "}
            <span className="font-medium text-base-content">
              {tempStatus.trained ? "Yes" : "No"}
            </span>
          </div>
          <div className="text-xs text-base-content/60">
            Quarantine threshold:{" "}
            <span className="font-medium text-base-content">
              {tempStatus.quarantine_threshold ?? "--"}
            </span>
          </div>
          <div className="text-xs text-base-content/60">
            Reject threshold:{" "}
            <span className="font-medium text-base-content">
              {tempStatus.reject_threshold ?? "--"}
            </span>
          </div>
          <div className="text-xs text-base-content/60">
            Baseline users:{" "}
            <span className="font-medium text-base-content">
              {tempStatus.baseline_user_count ?? 0}
            </span>
          </div>
          <div className="text-xs text-base-content/60">
            Last trained:{" "}
            <span className="font-medium text-base-content">
              {formatTime(tempStatus.last_training_time)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-primary/10 bg-base-200 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">User Engine</div>
            <HealthChip active={Boolean(userHealth.available)} />
          </div>
          <div className="mt-2 text-xs text-base-content/60">
            Seq model trained:{" "}
            <span className="font-medium text-base-content">
              {userStatus.trained ? "Yes" : "No"}
            </span>
          </div>
          <div className="text-xs text-base-content/60">
            Clusters:{" "}
            <span className="font-medium text-base-content">
              {userStatus.n_clusters ?? "--"}
            </span>
          </div>
          <div className="text-xs text-base-content/60">
            Embedding dim:{" "}
            <span className="font-medium text-base-content">
              {userStatus.embedding_dim ?? "--"}
            </span>
          </div>
          <div className="text-xs text-base-content/60">
            Last trained:{" "}
            <span className="font-medium text-base-content">
              {formatTime(userStatus.last_training_time)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthChip({ active }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        active
          ? "border-success/40 bg-success/10 text-success"
          : "border-base-content/20 bg-base-100 text-base-content/60",
      ].join(" ")}
    >
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-success animate-pulse" : "bg-base-content/40",
        ].join(" ")}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default Dashboard;
