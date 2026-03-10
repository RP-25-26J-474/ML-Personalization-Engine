import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getExternalUsers } from "../services/api-services";

function AdminUsers() {
  const [usersResponse, setUsersResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  useEffect(() => {
    let mounted = true;

    async function loadUsers() {
      setLoading(true);
      try {
        const data = await getExternalUsers({ page, limit: pageSize });
        if (!mounted) {
          return;
        }
        setUsersResponse(data);
        setError("");
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err.message || "Failed to load users.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      mounted = false;
    };
  }, [page]);

  const users = usersResponse?.users ?? [];
  const pagination = usersResponse?.pagination;
  const currentPage = pagination?.page ?? page;
  const totalPages = pagination?.totalPages ?? 1;
  const totalUsers = pagination?.total ?? users.length;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary/10 bg-base-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Users</div>
            <div className="mt-1 text-sm text-base-content/60">
              Browse current users and open an MLPE-centered profile view.
            </div>
          </div>
          <div className="rounded-xl border border-primary/10 bg-base-100 px-4 py-3 text-right">
            <div className="text-xs uppercase tracking-wide text-base-content/50">
              Loaded Users
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {loading ? "--" : users.length}
            </div>
            <div className="text-xs text-base-content/60">
              Total: {loading ? "--" : totalUsers}
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-primary/10 bg-base-200">
        <div className="border-b border-primary/10 px-5 py-4">
          <div className="text-sm font-semibold">Users</div>
          <div className="text-xs text-base-content/60">
            Selecting a user opens their profile page with MLPE data and stored profile history.
          </div>
        </div>

        {error ? (
          <div className="p-5 text-sm text-error">{error}</div>
        ) : loading ? (
          <div className="p-5 text-sm text-base-content/60">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-5 text-sm text-base-content/60">No users returned.</div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Demographics</th>
                    <th>Privacy</th>
                    <th>Created</th>
                    <th>Last Login</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id}>
                      <td>
                        <div className="font-medium">{user.name || "Unnamed user"}</div>
                        <div className="text-xs text-base-content/60">{user.email || "--"}</div>
                        <div className="text-xs text-base-content/40">{user._id}</div>
                      </td>
                      <td className="text-sm text-base-content/70">
                        {user.age ?? "--"} years, {user.gender ?? "--"}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge
                            active={Boolean(user.consentGiven)}
                            activeLabel="Consent On"
                            inactiveLabel="Consent Off"
                          />
                          <StatusBadge
                            active={Boolean(user.trackingEnabled)}
                            activeLabel="Tracking On"
                            inactiveLabel="Tracking Off"
                          />
                        </div>
                      </td>
                      <td className="text-sm text-base-content/70">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="text-sm text-base-content/70">
                        {formatDateTime(user.lastLogin)}
                      </td>
                      <td className="text-right">
                        <Link
                          to={`/admin/users/${encodeURIComponent(user._id)}`}
                          state={{ user }}
                          className="btn btn-sm btn-primary"
                        >
                          Open Profile
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-primary/10 px-5 py-4">
              <div className="text-sm text-base-content/60">
                Showing page {currentPage} of {totalPages}
              </div>
              <div className="join">
                <button
                  type="button"
                  className="btn btn-sm join-item"
                  disabled={loading || currentPage <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <button type="button" className="btn btn-sm join-item btn-ghost" disabled>
                  {currentPage}
                </button>
                <button
                  type="button"
                  className="btn btn-sm join-item"
                  disabled={loading || currentPage >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ active, activeLabel, inactiveLabel }) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2 py-1 text-xs font-medium",
        active
          ? "border-success/40 bg-success/10 text-success"
          : "border-base-content/20 bg-base-100 text-base-content/60",
      ].join(" ")}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
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

export default AdminUsers;
