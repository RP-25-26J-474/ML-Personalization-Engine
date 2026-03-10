import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import {
  getCurrentProfile,
  getExternalUsers,
  getTempTemplate,
} from "../services/api-services";
import ProfileKnobChangeChart from "../components/charts/user-engine/ProfileKnobChangeChart";
import { formatJson } from "../utils/json";

function AdminUserProfile() {
  const { userId } = useParams();
  const location = useLocation();
  const seededUser = location.state?.user ?? null;

  const [user, setUser] = useState(seededUser);
  const [data, setData] = useState({
    currentProfile: null,
    tempTemplate: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const decodedUserId = decodeURIComponent(userId || "");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setLoading(true);
      try {
        const [usersResponse, currentProfileResult, tempTemplateResult] =
          await Promise.all([
            seededUser ? Promise.resolve(null) : getExternalUsers(),
            getCurrentProfile(decodedUserId).catch((err) =>
              mapNotFoundToNull(err),
            ),
            getTempTemplate(decodedUserId).catch((err) =>
              mapNotFoundToNull(err),
            ),
          ]);

        if (!mounted) {
          return;
        }

        if (!seededUser && usersResponse?.users) {
          const matchedUser =
            usersResponse.users.find(
              (candidate) => candidate._id === decodedUserId,
            ) ?? null;
          setUser(matchedUser);
        }

        setData({
          currentProfile: currentProfileResult,
          tempTemplate: tempTemplateResult,
        });
        setError("");
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err.message || "Failed to load user profile data.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [decodedUserId, refreshTick, seededUser]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary/10 bg-base-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-base-content/50">
              User Profile
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {user?.name || "User Profile"}
            </div>
            <div className="mt-1 text-sm text-base-content/60">
              {user?.email ||
                "External user record not available in the loaded page."}
            </div>
            <div className="mt-3">
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary gap-2">
                <span className="text-sm">Current Profile Version: </span>
                <span className="text-lg">
                  v{data.currentProfile?.metadata?.version ?? "--"} (
                  {data.currentProfile?.metadata?.origin ?? "--"})
                </span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setRefreshTick((value) => value + 1)}
              disabled={loading}
            >
              Refresh
            </button>
            <Link to="/admin/users" className="btn btn-sm btn-outline">
              Back to Users
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <InfoCard title="User Data" loading={loading}>
          <div className="space-y-5">
            <div className="space-y-1">
              <KeyValue label="User ID" value={decodedUserId} />
              <KeyValue label="Age" value={user?.age} />
              <KeyValue label="Gender" value={user?.gender} />
              <KeyValue
                label="Consent Given"
                value={formatBoolean(user?.consentGiven)}
              />
              <KeyValue
                label="Tracking Enabled"
                value={formatBoolean(user?.trackingEnabled)}
              />
              <KeyValue
                label="Created At"
                value={formatDateTime(user?.createdAt)}
              />
              <KeyValue
                label="Last Login"
                value={formatDateTime(user?.lastLogin)}
              />
            </div>
          </div>
        </InfoCard>

        <div className="space-y-6">
          <div className="grid grid-cols-2">
            <InfoCard title="Current MLPE Profile" loading={loading}>
              <JsonPanel
                value={data.currentProfile}
                emptyLabel="No current MLPE profile stored yet."
              />
            </InfoCard>

            <InfoCard title="Temp Detector Template" loading={loading}>
              <JsonPanel
                value={data.tempTemplate}
                emptyLabel="No temp-detector template stored yet."
              />
            </InfoCard>
          </div>

          <InfoCard title="Profile Knob Change Chart" loading={loading}>
            <ProfileKnobChangeChart profile={data.currentProfile?.profile} />
          </InfoCard>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, children, loading }) {
  return (
    <section className="rounded-2xl border border-primary/10 bg-base-200 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        {loading ? (
          <span className="text-xs text-base-content/50">Loading...</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function KeyValue({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-primary/10 py-2 text-sm last:border-b-0">
      <span className="text-base-content/60">{label}</span>
      <span className="text-right font-medium">{value ?? "--"}</span>
    </div>
  );
}

function JsonPanel({ value, emptyLabel }) {
  const isEmptyArray = Array.isArray(value) && value.length === 0;
  if (value == null || isEmptyArray) {
    return <div className="text-sm text-base-content/60">{emptyLabel}</div>;
  }

  return (
    <pre className="max-h-96 overflow-auto rounded-xl bg-base-100 p-4 text-xs leading-6 text-base-content/80">
      {formatJson(value)}
    </pre>
  );
}

function formatDateTime(value) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatBoolean(value) {
  if (typeof value !== "boolean") {
    return "--";
  }
  return value ? "Yes" : "No";
}

function mapNotFoundToNull(error) {
  if (error?.status === 404) {
    return null;
  }
  throw error;
}

export default AdminUserProfile;
