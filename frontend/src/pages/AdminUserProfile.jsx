import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import {
  getCurrentProfile,
  getExternalUsers,
  getProfiles,
  getProfileDiffs,
  getQuarantine,
  getTempTemplate,
  getTraces,
} from "../services/api-services";
import { formatJson } from "../utils/json";

function AdminUserProfile() {
  const { userId } = useParams();
  const location = useLocation();
  const seededUser = location.state?.user ?? null;

  const [user, setUser] = useState(seededUser);
  const [data, setData] = useState({
    currentProfile: null,
    profiles: [],
    traces: [],
    quarantine: [],
    profileDiffs: [],
    tempTemplate: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const decodedUserId = decodeURIComponent(userId || "");
        const [
          usersResponse,
          currentProfileResult,
          profilesResult,
          tracesResult,
          quarantineResult,
          profileDiffsResult,
          tempTemplateResult,
        ] = await Promise.all([
          seededUser ? Promise.resolve(null) : getExternalUsers({ page: 1, limit: 1000 }),
          getCurrentProfile(decodedUserId).catch((err) => mapNotFoundToNull(err)),
          getProfiles(decodedUserId).catch((err) => mapNotFoundToArray(err)),
          getTraces(decodedUserId).catch((err) => mapNotFoundToArray(err)),
          getQuarantine(decodedUserId).catch((err) => mapNotFoundToArray(err)),
          getProfileDiffs(decodedUserId).catch((err) => mapNotFoundToArray(err)),
          getTempTemplate(decodedUserId).catch((err) => mapNotFoundToNull(err)),
        ]);

        if (!mounted) {
          return;
        }

        if (!seededUser && usersResponse?.users) {
          const matchedUser =
            usersResponse.users.find((candidate) => candidate._id === decodedUserId) ?? null;
          setUser(matchedUser);
        }

        setData({
          currentProfile: currentProfileResult,
          profiles: profilesResult,
          traces: tracesResult,
          quarantine: quarantineResult,
          profileDiffs: profileDiffsResult,
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
  }, [seededUser, userId]);

  const decodedUserId = decodeURIComponent(userId || "");

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
              {user?.email || "External user record not available in the loaded page."}
            </div>
          </div>
          <Link to="/admin/users" className="btn btn-sm btn-outline">
            Back to Users
          </Link>
        </div>
      </section>

      {error ? <div className="rounded-2xl bg-error/10 p-4 text-sm text-error">{error}</div> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard label="Profile Versions" value={loading ? "--" : data.profiles.length} />
        <MetricCard label="Decision Traces" value={loading ? "--" : data.traces.length} />
        <MetricCard label="Quarantine Records" value={loading ? "--" : data.quarantine.length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <InfoCard title="User Data" loading={loading}>
          <KeyValue label="Name" value={user?.name} />
          <KeyValue label="Email" value={user?.email} />
          <KeyValue label="User ID" value={decodedUserId} />
          <KeyValue label="Age" value={user?.age} />
          <KeyValue label="Gender" value={user?.gender} />
          <KeyValue label="Consent Given" value={formatBoolean(user?.consentGiven)} />
          <KeyValue label="Tracking Enabled" value={formatBoolean(user?.trackingEnabled)} />
          <KeyValue label="Created At" value={formatDateTime(user?.createdAt)} />
          <KeyValue label="Last Login" value={formatDateTime(user?.lastLogin)} />
        </InfoCard>

        <InfoCard title="Current MLPE Profile" loading={loading}>
          <JsonPanel value={data.currentProfile} emptyLabel="No current MLPE profile stored yet." />
        </InfoCard>

        <InfoCard title="Temp Detector Template" loading={loading}>
          <JsonPanel value={data.tempTemplate} emptyLabel="No temp-detector template stored yet." />
        </InfoCard>

        <InfoCard title="Profile Diffs" loading={loading}>
          <JsonPanel value={data.profileDiffs} emptyLabel="No profile change history available." />
        </InfoCard>

        <InfoCard title="All Profile Versions" loading={loading}>
          <JsonPanel value={data.profiles} emptyLabel="No profile versions available." />
        </InfoCard>

        <InfoCard title="Decision Traces" loading={loading}>
          <JsonPanel value={data.traces} emptyLabel="No decision traces available." />
        </InfoCard>
      </div>

      <InfoCard title="Quarantine Records" loading={loading}>
        <JsonPanel value={data.quarantine} emptyLabel="No quarantine records available." />
      </InfoCard>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-primary/10 bg-base-200 p-4">
      <div className="text-xs uppercase tracking-wide text-base-content/50">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function InfoCard({ title, children, loading }) {
  return (
    <section className="rounded-2xl border border-primary/10 bg-base-200 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        {loading ? <span className="text-xs text-base-content/50">Loading...</span> : null}
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

function mapNotFoundToArray(error) {
  if (error?.status === 404) {
    return [];
  }
  throw error;
}

export default AdminUserProfile;
