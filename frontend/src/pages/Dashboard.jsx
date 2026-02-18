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
    </div>
  );
}

export default Dashboard;
