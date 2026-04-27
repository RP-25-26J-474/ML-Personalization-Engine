import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getExternalUsers } from "../services/api-services";

function AdminUsers() {
  const navigate = useNavigate();
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
        const data = await getExternalUsers();
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
  }, []);

  const allUsers = usersResponse?.users ?? [];
  const totalUsers = usersResponse?.pagination?.total ?? allUsers.length;
  const totalPages = Math.max(1, Math.ceil(allUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const users = allUsers.slice(pageStart, pageStart + pageSize);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary/10 bg-base-200 p-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-base-content/50">
            Total Users
          </div>
          <div className="mt-2 text-3xl font-semibold">
            {loading ? "--" : totalUsers}
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
                    <th>Created</th>
                    <th>Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user._id}
                      className="cursor-pointer transition-colors hover:bg-primary/8"
                      onClick={() =>
                        navigate(`/admin/users/${encodeURIComponent(user._id)}`, {
                          state: { user },
                        })
                      }
                    >
                      <td>
                        <div className="font-medium">{user.name || "Unnamed user"}</div>
                        <div className="text-xs text-base-content/60">{user.email || "--"}</div>
                      </td>
                      <td className="text-sm text-base-content/70">
                        {user.age ?? "--"} years, {user.gender ?? "--"}
                      </td>
                      <td className="text-sm text-base-content/70">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="text-sm text-base-content/70">
                        {formatDateTime(user.lastLogin)}
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
