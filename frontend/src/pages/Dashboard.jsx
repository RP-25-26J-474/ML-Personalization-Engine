import { useEffect, useState } from "react";
import { getDashboardStatus } from "../services/api-services";

function Dashboard() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    getDashboardStatus()
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

  const formatVersionInline = (value, prefix = "") => {
    const valStr = String(value);
    const cleanStr = valStr.startsWith("v") ? valStr.substring(1) : valStr;
    const isIso = cleanStr.includes("T") && cleanStr.includes("-") && cleanStr.includes(":");

    let formattedBuild = valStr;
    if (isIso) {
      const date = new Date(cleanStr);
      if (!Number.isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");

        formattedBuild = `v${year}.${month}.${day}-b${hours}${minutes}`;
      }
    }

    if (prefix && value !== "--") {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-primary font-black uppercase tracking-widest text-[10px] md:text-[11px]">
            {prefix}
          </span>
          <span className="text-base-content/25 text-[11px] md:text-[12px] font-bold">·</span>
          <span className="font-mono text-base-content/90 font-semibold text-[11px] md:text-[12px]">{formattedBuild}</span>
        </span>
      );
    }
    return formattedBuild;
  };

  const renderVersionValue = (value, prefix = "") => {
    const valStr = String(value);
    const cleanStr = valStr.startsWith("v") ? valStr.substring(1) : valStr;
    const isIso = cleanStr.includes("T") && cleanStr.includes("-") && cleanStr.includes(":");

    if (prefix) {
      let formattedBuild = valStr;
      if (isIso) {
        const date = new Date(cleanStr);
        if (!Number.isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          const hours = String(date.getHours()).padStart(2, "0");
          const minutes = String(date.getMinutes()).padStart(2, "0");

          formattedBuild = `v${year}.${month}.${day}-b${hours}${minutes}`;
        }
      }

      return (
        <div className="mt-3 flex items-center min-h-[44px]" title={valStr}>
          <div className="bg-base-300/60 px-3 py-2 rounded-lg border border-base-content/30 inline-block w-fit">
            <span className="flex items-center gap-2">
              <span className="text-primary font-black uppercase tracking-widest text-[11px] md:text-[12px]">
                {prefix}
              </span>
              <span className="text-base-content/30 text-[12px] md:text-[13px] font-bold">·</span>
              <span className="text-base-content/90 font-mono text-[13px] md:text-[14px] font-extrabold break-all">
                {formattedBuild}
              </span>
            </span>
          </div>
        </div>
      );
    }

    if (valStr.length > 15) {
      return (
        <div className="mt-3 flex items-center min-h-[44px]" title={valStr}>
          <div className="bg-base-300/60 px-3 py-2 rounded-lg border border-base-content/5 inline-block w-fit">
            <span className="text-base-content/90 font-mono text-xs font-bold break-all">
              {valStr}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div 
        className="mt-3 text-3xl font-extrabold tracking-tight min-h-[44px] flex items-center" 
        title={valStr}
      >
        {valStr}
      </div>
    );
  };

  const userModelVersions = status?.models?.user_model_versions || {};
  const userVersionEntries = Object.entries(userModelVersions)
    .map(([userId, version]) => {
      const num = parseInt(String(version).replace(/^v/, ""), 10);
      return { userId, version: String(version), count: Number.isNaN(num) ? 0 : num };
    })
    .sort((a, b) => b.count - a.count);
  const maxVersionCount = userVersionEntries.length > 0
    ? Math.max(...userVersionEntries.map((entry) => entry.count), 1)
    : 1;
  const totalUpdates = userVersionEntries.reduce((sum, entry) => sum + entry.count, 0);
  const avgUpdates = userVersionEntries.length > 0
    ? (totalUpdates / userVersionEntries.length).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      {/* Row 1: System-wide User Profile Metrics (2-column layout) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-primary bg-base-200/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20">
          <div className="text-xs uppercase tracking-wider font-semibold">
            Users With Profiles
          </div>
          {renderVersionValue(usersWithProfiles)}
          <div className="mt-1 text-xs text-base-content/50">
            {error ? `Error: ${error}` : "Profiles stored in memory"}
          </div>
        </div>
        <div className="rounded-2xl border border-primary bg-base-200/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20">
          <div className="text-xs uppercase tracking-wider font-semibold">
            Profile Versions
          </div>
          {renderVersionValue(profileVersions)}
          <div className="mt-1 text-xs text-base-content/50">
            Total versions across all users
          </div>
        </div>
      </div>

      {/* Row 2: Machine Learning Model Snapshot Versions (3-column layout) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <div className="rounded-2xl border border-primary bg-base-200/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20">
          <div className="text-xs uppercase tracking-wider font-semibold">
            Category Model Version
          </div>
          {renderVersionValue(categoryVersion, "cat-knn")}
          <div className="mt-1 text-xs text-base-content/50">
            Latest classification snapshot
          </div>
        </div>
        <div className="rounded-2xl border border-primary bg-base-200/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20">
          <div className="text-xs uppercase tracking-wider font-semibold">
            Global IForest Version
          </div>
          {renderVersionValue(globalVersion, "iforest")}
          <div className="mt-1 text-xs text-base-content/50">
            Latest global model snapshot
          </div>
        </div>
        <div className="rounded-2xl border border-primary bg-base-200/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20">
          <div className="text-xs uppercase tracking-wider font-semibold">
            User Seq Model Version
          </div>
          {renderVersionValue(userSeqVersion, "gru-ae")}
          <div className="mt-1 text-xs text-base-content/50">
            Latest sequence autoencoder snapshot
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-primary bg-base-200/50 p-5 transition-all duration-300 hover:scale-[1.01] hover:border-primary/20">
          <div className="flex items-center justify-between border-b border-primary/5 pb-2.5 mb-4">
            <div className="text-sm font-bold text-base-content">Category Engine</div>
            <HealthChip active={Boolean(categoryHealth.available)} />
          </div>
          <div className="space-y-1.5 text-xs text-base-content/70">
            <div>
              Trained:{" "}
              <span className="font-semibold text-base-content">
                {categoryStatus.trained ? "Yes" : "No"}
              </span>
            </div>
            <div>
              Samples (last train):{" "}
              <span className="font-semibold text-base-content">
                {categoryStatus.last_n_samples ?? 0}
              </span>
            </div>
            <div>
              Last trained:{" "}
              <span className="font-semibold text-base-content">
                {formatTime(categoryStatus.last_training_time)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-primary bg-base-200/50 p-5 transition-all duration-300 hover:scale-[1.01] hover:border-primary/20">
          <div className="flex items-center justify-between border-b border-primary/5 pb-2.5 mb-4">
            <div className="text-sm font-bold text-base-content">Temporary User Detector</div>
            <HealthChip active={Boolean(tempHealth.available)} />
          </div>
          <div className="space-y-1.5 text-xs text-base-content/70">
            <div>
              Trained:{" "}
              <span className="font-semibold text-base-content">
                {tempStatus.trained ? "Yes" : "No"}
              </span>
            </div>
            <div>
              Quarantine threshold:{" "}
              <span className="font-semibold text-base-content">
                {tempStatus.quarantine_threshold ?? "--"}
              </span>
            </div>
            <div>
              Reject threshold:{" "}
              <span className="font-semibold text-base-content">
                {tempStatus.reject_threshold ?? "--"}
              </span>
            </div>
            <div>
              Baseline users:{" "}
              <span className="font-semibold text-base-content">
                {tempStatus.baseline_user_count ?? 0}
              </span>
            </div>
            <div>
              Last trained:{" "}
              <span className="font-semibold text-base-content">
                {formatTime(tempStatus.last_training_time)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-primary bg-base-200/50 p-5 transition-all duration-300 hover:scale-[1.01] hover:border-primary/20">
          <div className="flex items-center justify-between border-b border-primary/5 pb-2.5 mb-4">
            <div className="text-sm font-bold text-base-content">User Engine</div>
            <HealthChip active={Boolean(userHealth.available)} />
          </div>
          <div className="space-y-1.5 text-xs text-base-content/70">
            <div>
              Seq model trained:{" "}
              <span className="font-semibold text-base-content">
                {userStatus.trained ? "Yes" : "No"}
              </span>
            </div>
            <div>
              Clusters:{" "}
              <span className="font-semibold text-base-content">
                {userStatus.n_clusters ?? "--"}
              </span>
            </div>
            <div>
              Embedding dim:{" "}
              <span className="font-semibold text-base-content">
                {userStatus.embedding_dim ?? "--"}
              </span>
            </div>
            <div>
              Last trained:{" "}
              <span className="font-semibold text-base-content">
                {formatTime(userStatus.last_training_time)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Profile Update Activity Leaderboard */}
      <div className="rounded-2xl border border-primary bg-base-200/50 p-5 transition-all duration-300">
        <div className="flex items-center justify-between border-b border-primary/5 pb-2.5 mb-4">
          <div>
            <div className="text-sm font-bold text-base-content">Profile Update Activity</div>
            <div className="text-xs text-base-content/50 mt-0.5">
              Users ranked by number of personalization profile updates
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-base-content/60">
            <div className="text-right">
              <div className="text-base-content/40 uppercase tracking-wider text-[10px]">Users</div>
              <div className="font-bold text-base-content text-sm">{userVersionEntries.length}</div>
            </div>
            <div className="text-right">
              <div className="text-base-content/40 uppercase tracking-wider text-[10px]">Total Updates</div>
              <div className="font-bold text-base-content text-sm">{totalUpdates}</div>
            </div>
            <div className="text-right">
              <div className="text-base-content/40 uppercase tracking-wider text-[10px]">Avg / User</div>
              <div className="font-bold text-base-content text-sm">{avgUpdates}</div>
            </div>
          </div>
        </div>

        {userVersionEntries.length === 0 ? (
          <div className="text-sm text-base-content/50 py-6 text-center">
            No user profile updates recorded yet. Use the User Engine to update profiles.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {userVersionEntries.map((entry, index) => {
              const barWidth = Math.max(4, (entry.count / maxVersionCount) * 100);
              return (
                <div
                  key={entry.userId}
                  className="flex items-center gap-3 group"
                >
                  <div className="w-5 text-[10px] font-bold text-base-content/30 text-right shrink-0">
                    {index + 1}
                  </div>
                  <div className="min-w-[80px] max-w-[120px] truncate text-xs font-mono font-semibold text-base-content/80" title={entry.userId}>
                    {entry.userId}
                  </div>
                  <div className="flex-1 h-6 bg-base-300/40 rounded-md overflow-hidden relative">
                    <div
                      className="h-full rounded-md transition-all duration-500 ease-out"
                      style={{
                        width: `${barWidth}%`,
                        background: `linear-gradient(90deg, oklch(var(--p) / 0.6), oklch(var(--p) / 0.25))`,
                      }}
                    />
                  </div>
                  <div className="w-10 text-right text-xs font-bold text-primary shrink-0">
                    v{entry.count}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function HealthChip({ active }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
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
