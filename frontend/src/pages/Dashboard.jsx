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
          <div className="bg-base-300/60 px-3 py-2 rounded-lg border border-base-content/5 inline-block w-fit">
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

  return (
    <div className="space-y-6">
      {/* Row 1: System-wide User Profile Metrics (2-column layout) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-primary/10 bg-base-200/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20">
          <div className="text-xs uppercase tracking-wider font-semibold text-base-content/50">
            Users With Profiles
          </div>
          {renderVersionValue(usersWithProfiles)}
          <div className="mt-1 text-xs text-base-content/50">
            {error ? `Error: ${error}` : "Profiles stored in memory"}
          </div>
        </div>
        <div className="rounded-2xl border border-primary/10 bg-base-200/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20">
          <div className="text-xs uppercase tracking-wider font-semibold text-base-content/50">
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
        <div className="rounded-2xl border border-primary/10 bg-base-200/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20">
          <div className="text-xs uppercase tracking-wider font-semibold text-base-content/50">
            Category Model Version
          </div>
          {renderVersionValue(categoryVersion, "cat-knn")}
          <div className="mt-1 text-xs text-base-content/50">
            Latest classification snapshot
          </div>
        </div>
        <div className="rounded-2xl border border-primary/10 bg-base-200/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20">
          <div className="text-xs uppercase tracking-wider font-semibold text-base-content/50">
            Global IForest Version
          </div>
          {renderVersionValue(globalVersion, "iforest")}
          <div className="mt-1 text-xs text-base-content/50">
            Latest global model snapshot
          </div>
        </div>
        <div className="rounded-2xl border border-primary/10 bg-base-200/50 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20">
          <div className="text-xs uppercase tracking-wider font-semibold text-base-content/50">
            User Seq Model Version
          </div>
          {renderVersionValue(userSeqVersion, "gru-ae")}
          <div className="mt-1 text-xs text-base-content/50">
            Latest sequence autoencoder snapshot
          </div>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-primary/10 bg-base-200/50 p-5 transition-all duration-300 hover:scale-[1.01] hover:border-primary/20">
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

        <div className="rounded-2xl border border-primary/10 bg-base-200/50 p-5 transition-all duration-300 hover:scale-[1.01] hover:border-primary/20">
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

        <div className="rounded-2xl border border-primary/10 bg-base-200/50 p-5 transition-all duration-300 hover:scale-[1.01] hover:border-primary/20">
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
