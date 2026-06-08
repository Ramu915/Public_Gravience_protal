import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { pb } from "@/lib/pocketbase";
import { getUserRole, type AppRole } from "@/hooks/useAuth";

type Department = { id: string; name: string; description?: string };
type UserRecord = {
  id: string;
  email: string;
  name?: string;
  role?: AppRole;
  department?: string;
};
type GrievanceLite = {
  id: string;
  title: string;
  status?: string;
  department?: string;
  category?: string;
};
type GrievanceUpdateRecord = {
  id: string;
  grievance: string;
  status?: string;
  note?: string;
  created: string;
  expand?: {
    grievance?: { id: string; title: string };
    admin?: { id: string; name?: string; email?: string };
    user?: { id: string; name?: string; email?: string; expand?: { department?: { id: string; name: string } } };
  };
};

const ROLES: AppRole[] = ["citizen", "department", "admin"];

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ location }) => {
    if (!pb.authStore.isValid) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    const role = getUserRole((pb.authStore.model as any)?.role);
    if (role !== "admin") {
      throw redirect({ to: "/", search: { redirect: location.href } as never });
    }
  },
  head: () => ({ meta: [{ title: "Admin Panel — PGMS" }] }),
  component: AdminPanel,
});

function AdminPanel() {
  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display">Admin Panel</h1>
            <p className="mt-3 text-muted-foreground">
              Manage departments, users, grievance assignments and department updates.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/dashboard">Open Dashboard</Link>
          </Button>
        </div>

        <Tabs defaultValue="departments" className="mt-8">
          <TabsList>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="assign">Assign Grievances</TabsTrigger>
            <TabsTrigger value="updates">Updates</TabsTrigger>
          </TabsList>
          <TabsContent value="departments" className="mt-6">
            <DepartmentsTab />
          </TabsContent>
          <TabsContent value="users" className="mt-6">
            <UsersTab />
          </TabsContent>
          <TabsContent value="assign" className="mt-6">
            <AssignTab />
          </TabsContent>
          <TabsContent value="updates" className="mt-6">
            <UpdatesTab />
          </TabsContent>
        </Tabs>
      </section>
    </Layout>
  );
}

/* ----------------------------- Departments ----------------------------- */
function DepartmentsTab() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const records = await pb.collection("departments").getFullList<Department>({ sort: "name" });
      setItems(records);
    } catch (err: any) {
      setError(err?.message ?? "Could not load departments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const rec = await pb
        .collection("departments")
        .create<Department>({ name: name.trim(), description: desc.trim() });
      setItems((arr) => [...arr, rec].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setDesc("");
    } catch (err: any) {
      setError(err?.message ?? "Could not create department.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this department?")) return;
    setError(null);
    try {
      await pb.collection("departments").delete(id);
      setItems((arr) => arr.filter((d) => d.id !== id));
    } catch (err: any) {
      setError(err?.message ?? "Could not delete.");
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="border-border">
        <CardContent className="p-5">
          <h3 className="font-semibold">Add department</h3>
          <form onSubmit={create} className="mt-4 space-y-3">
            <div>
              <Label htmlFor="dept-name">Name</Label>
              <Input
                id="dept-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Public Works"
                required
              />
            </div>
            <div>
              <Label htmlFor="dept-desc">Description</Label>
              <Input
                id="dept-desc"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Descript"
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Departments ({items.length})</h3>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
          </div>
          {error ? (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="mt-4 divide-y divide-border">
            {loading ? (
              <div className="py-6 text-sm text-muted-foreground">Loading…</div>
            ) : items.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">No departments yet.</div>
            ) : (
              items.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{d.name}</div>
                    {d.description ? (
                      <div className="text-xs text-muted-foreground">{d.description}</div>
                    ) : null}
                    <div className="text-[11px] text-muted-foreground">id: {d.id}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => remove(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------- Users -------------------------------- */
function UsersTab() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "department" as AppRole,
    department: "",
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [u, d] = await Promise.all([
        pb.collection("users").getFullList<UserRecord>({ sort: "name" }),
        pb.collection("departments").getFullList<Department>({ sort: "name" }),
      ]);
      setUsers(u);
      setDepts(d);
    } catch (err: any) {
      setError(err?.message ?? "Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.email || !createForm.password) {
      setError("Email and password are required.");
      return;
    }
    setCreatingUser(true);
    setError(null);
    try {
      const newUser = await pb.collection("users").create<UserRecord>({
        email: createForm.email,
        password: createForm.password,
        passwordConfirm: createForm.password,
        name: createForm.name || createForm.email,
        role: createForm.role,
        department: createForm.department || undefined,
      });
      setUsers((arr) => [...arr, newUser].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)));
      setCreateForm({ email: "", password: "", name: "", role: "department", department: "" });
      alert(
        `✅ User created!\n\nEmail: ${createForm.email}\nPassword: ${createForm.password}\n\nShare these credentials with the user.`,
      );
    } catch (err: any) {
      setError(err?.message ?? "Could not create user.");
    } finally {
      setCreatingUser(false);
    }
  }

  async function patch(id: string, data: Partial<UserRecord>) {
    setBusy(id);
    setError(null);
    try {
      const rec = await pb.collection("users").update<UserRecord>(id, data);
      setUsers((arr) => arr.map((u) => (u.id === id ? { ...u, ...rec } : u)));
    } catch (err: any) {
      setError(err?.message ?? "Could not update user.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="border-border">
        <CardContent className="p-5">
          <h3 className="mb-4 font-semibold">Create New User</h3>
          <form onSubmit={createUser} className="space-y-3">
            <div>
              <Label htmlFor="user-email">Email (for login)</Label>
              <Input
                id="user-email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                placeholder="user@example.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="user-password">Password</Label>
              <Input
                id="user-password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Min 8 characters"
                minLength={8}
                required
              />
            </div>
            <div>
              <Label htmlFor="user-name">Name (optional)</Label>
              <Input
                id="user-name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="user-role">Role</Label>
              <Select
                value={createForm.role}
                onValueChange={(v) => setCreateForm({ ...createForm, role: v as AppRole })}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="citizen">Citizen</SelectItem>
                  <SelectItem value="department">Department Staff</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {createForm.role === "department" && (
              <div>
                <Label htmlFor="user-dept">Assign Department</Label>
                <Select
                  value={createForm.department}
                  onValueChange={(v) => setCreateForm({ ...createForm, department: v })}
                >
                  <SelectTrigger id="user-dept">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {depts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" disabled={creatingUser} className="w-full">
              {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create User
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Users ({users.length})</h3>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
          </div>
          {error ? (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="mt-4 divide-y divide-border">
            {loading ? (
              <div className="py-6 text-sm text-muted-foreground">Loading…</div>
            ) : users.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">No users.</div>
            ) : (
              users.map((u) => (
                <div
                  key={u.id}
                  className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_180px_220px_auto] md:items-center"
                >
                  <div>
                    <div className="font-medium">{u.name || u.email}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <Select value={u.role ?? "citizen"} onValueChange={(v) => patch(u.id, { role: v as AppRole })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={u.department ?? "none"}
                    onValueChange={(v) => patch(u.id, { department: v === "none" ? "" : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {depts.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-right">
                    {busy === u.id ? (
                      <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Badge variant="outline">{u.role ?? "citizen"}</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* --------------------------- Assign Grievances ------------------------- */
function AssignTab() {
  const [items, setItems] = useState<GrievanceLite[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [g, d] = await Promise.all([
        pb.collection("grievances").getFullList<GrievanceLite>({ sort: "-created" }),
        pb.collection("departments").getFullList<Department>({ sort: "name" }),
      ]);
      setItems(g);
      setDepts(d);
    } catch (err: any) {
      setError(err?.message ?? "Could not load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function assign(id: string, deptId: string) {
    setBusy(id);
    setError(null);
    try {
      await pb.collection("grievances").update(id, { department: deptId === "none" ? "" : deptId });
      setItems((arr) =>
        arr.map((x) =>
          x.id === id ? { ...x, department: deptId === "none" ? undefined : deptId } : x,
        ),
      );
    } catch (err: any) {
      setError(err?.message ?? "Could not assign.");
    } finally {
      setBusy(null);
    }
  }

  const visible = onlyUnassigned ? items.filter((g) => !g.department) : items;

  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Grievances ({visible.length})</h3>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={onlyUnassigned}
                onChange={(e) => setOnlyUnassigned(e.target.checked)}
              />
              Only unassigned
            </label>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
          </div>
        </div>
        {error ? (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <div className="mt-4 divide-y divide-border">
          {loading ? (
            <div className="py-6 text-sm text-muted-foreground">Loading…</div>
          ) : visible.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">Nothing to show.</div>
          ) : (
            visible.map((g) => (
              <div
                key={g.id}
                className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_260px_auto] md:items-center"
              >
                <Link to="/grievances/$id" params={{ id: g.id }} className="group">
                  <div className="font-medium group-hover:underline">{g.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {g.category || "general"} · {g.status || "pending"}
                  </div>
                </Link>
                <Select value={g.department ?? "none"} onValueChange={(v) => assign(g.id, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assign department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Unassigned —</SelectItem>
                    {depts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-right">
                  {busy === g.id ? (
                    <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
                  ) : g.department ? (
                    <Badge variant="secondary">Assigned</Badge>
                  ) : (
                    <Badge variant="outline">Unassigned</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------- Updates -------------------------------- */
function UpdatesTab() {
  const [items, setItems] = useState<GrievanceUpdateRecord[]>([]);
  const [departments, setDepartments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [records, depts] = await Promise.all([
        pb.collection("grievance_updates").getFullList<GrievanceUpdateRecord>({
          sort: "-created",
          expand: "grievance,admin,user",
        }),
        pb.collection("departments").getFullList<{ id: string; name: string }>(),
      ]);
      setItems(records);
      const deptMap: Record<string, string> = {};
      depts.forEach((d) => {
        deptMap[d.id] = d.name;
      });
      setDepartments(deptMap);
    } catch (err: any) {
      setError(
        err?.message ??
          "Could not load grievance updates. Make sure the grievance_updates collection exists.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Card className="border-border">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Department Updates ({items.length})</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest notes posted by departments and admins.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>

        {error ? (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4">
          {loading ? (
            <div className="py-6 text-sm text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">No updates yet.</div>
          ) : (
            items.map((update) => {
              const author =
                update.expand?.admin?.name ||
                update.expand?.admin?.email ||
                update.expand?.user?.name ||
                update.expand?.user?.email ||
                "Unknown";
              const userDeptId = (update.expand?.user as any)?.department;
              const deptName = userDeptId ? departments[userDeptId] : null;
              const sourceLabel = update.expand?.admin
                ? "Admin"
                : deptName
                ? deptName
                : update.expand?.user
                ? "Department"
                : "Update";
              return (
                <div key={update.id} className="rounded-md border border-border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(update.created)}</span>
                    <span>
                      · {sourceLabel}: {author}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="secondary">{formatStatus(update.status)}</Badge>
                    <Badge variant="outline">
                      {update.expand?.grievance?.title || `Grievance ${update.grievance}`}
                    </Badge>
                  </div>

                  {update.note ? (
                    <p className="mt-3 text-sm leading-6 text-foreground">{update.note}</p>
                  ) : null}

                  <div className="mt-3">
                    <Link
                      to="/grievances/$id"
                      params={{ id: update.grievance }}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      View grievance →
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function formatStatus(value?: string) {
  if (!value) return "Pending";
  return value.replaceAll("_", " ").replace(/^./, (l) => l.toUpperCase());
}

function formatDate(value?: string) {
  if (!value) return "Recently";
  return new Date(value).toLocaleString();
}
