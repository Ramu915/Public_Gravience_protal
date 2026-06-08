import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock3, Loader2, MapPin, RefreshCw, Send } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pb, fileUrl } from "@/lib/pocketbase";
import { getUserRole } from "@/hooks/useAuth";

type GrievanceRecord = {
  id: string;
  collectionId: string;
  collectionName: string;
  title: string;
  description: string;
  category?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  images?: string[];
  department?: string;
  citizen?: string;
  vote_count?: number;
  created?: string;
};

type GrievanceUpdateRecord = {
  id: string;
  grievance: string;
  status?: string;
  note?: string;
  created: string;
  expand?: {
    admin?: { id: string; name?: string; email?: string };
    user?: { id: string; name?: string; email?: string };
  };
};

const STATUSES = ["pending", "in_progress", "resolved", "rejected"] as const;

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ location }) => {
    if (!pb.authStore.isValid) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    const role = getUserRole((pb.authStore.model as any)?.role);
    if (role !== "department" && role !== "admin") {
      throw redirect({ to: "/", search: { redirect: location.href } as never });
    }
  },
  head: () => ({ meta: [{ title: "Department Dashboard — PGMS" }] }),
  component: DepartmentDashboard,
});

function DepartmentDashboard() {
  const [items, setItems] = useState<GrievanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const me = pb.authStore.model as any;
  const role = getUserRole(me?.role);
  const myDept = me?.department as string | undefined;

  function buildUpdatePayload(grievanceId: string, status: string, note?: string) {
    const payload: Record<string, unknown> = {
      grievance: grievanceId,
      status,
      note: note?.trim() || `Status changed to ${status}`,
    };

    if (role === "admin") {
      payload.admin = me?.id;
    } else if (role === "department") {
      payload.user = me?.id;
    }

    return payload;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Admin sees all; department sees only their assigned grievances
      const filterStr = role === "admin" || !myDept ? "" : `department = "${myDept}"`;
      const records = await pb.collection("grievances").getFullList<GrievanceRecord>({
        filter: filterStr,
        sort: "-created",
      });

      setItems(records);
    } catch (err: any) {
      setError(err?.message ?? "Could not load grievances.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((it) => (it.status ?? "pending") === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const base: Record<string, number> = { all: items.length };
    STATUSES.forEach((s) => (base[s] = 0));
    items.forEach((it) => {
      const s = it.status ?? "pending";
      base[s] = (base[s] ?? 0) + 1;
    });
    return base;
  }, [items]);

  async function updateStatus(g: GrievanceRecord, newStatus: string) {
    setBusy(g.id);
    setError(null);
    try {
      await pb.collection("grievances").update(g.id, { status: newStatus });

      const updateData = buildUpdatePayload(g.id, newStatus, notes[g.id]);
      await pb.collection("grievance_updates").create<GrievanceUpdateRecord>(updateData);

      setItems((arr) => arr.map((x) => (x.id === g.id ? { ...x, status: newStatus } : x)));
      setNotes((n) => ({ ...n, [g.id]: "" }));
    } catch (err: any) {
      setError(err?.message ?? "Could not update status.");
    } finally {
      setBusy(null);
    }
  }

  async function postNote(g: GrievanceRecord) {
    const note = notes[g.id]?.trim();
    if (!note) return;
    setBusy(g.id);
    setError(null);
    try {
      const updateData: Record<string, unknown> = {
        grievance: g.id,
        note,
      };

      if (role === "admin") {
        updateData.status = g.status ?? "pending";
        updateData.admin = me?.id;
      } else if (role === "department") {
        // Department staff only post notes, don't change status
        updateData.user = me?.id;
      }

      console.log("Creating update with payload:", JSON.stringify(updateData, null, 2));
      console.log("User ID being sent:", me?.id);
      console.log("Role:", role);
      
      await pb.collection("grievance_updates").create<GrievanceUpdateRecord>(updateData);

      setNotes((n) => ({ ...n, [g.id]: "" }));
    } catch (err: any) {
      console.error("Full error details:", err);
      console.error("Error data:", err?.data);
      setError(
        err?.message ??
          "Could not post note. Check collection schema and permissions.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display">Department Dashboard</h1>
            <p className="mt-3 text-muted-foreground">
              {role === "admin"
                ? "Admin view — showing every grievance across all departments."
                : "Showing grievances assigned to your department."}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              Refresh
            </Button>
            <Button asChild variant="outline">
              <Link to="/grievances">Public View</Link>
            </Button>
          </div>
        </div>

        {/* Status summary tiles */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {(["all", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-md border px-4 py-3 text-left transition-colors ${
                filter === s ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
              }`}
            >
              <div className="text-2xl font-semibold">{counts[s] ?? 0}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {s === "all" ? "Total" : formatStatus(s)}
              </div>
            </button>
          ))}
        </div>

        {error ? (
          <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4">
          {loading
            ? [1, 2].map((i) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-6">
                    <div className="h-5 w-40 rounded bg-muted" />
                    <div className="mt-3 h-4 w-full rounded bg-muted" />
                  </CardContent>
                </Card>
              ))
            : null}

          {!loading && !filtered.length ? (
            <Card className="border-border">
              <CardContent className="px-6 py-12 text-center text-muted-foreground">
                No grievances in this category yet.
              </CardContent>
            </Card>
          ) : null}

          {!loading
            ? filtered.map((item) => {
                const imageNames = Array.isArray(item.images)
                  ? item.images
                  : item.images
                  ? [item.images]
                  : (item as any).image
                  ? [(item as any).image]
                  : [];
                const imageName = imageNames[0];

                return (
                  <Card key={item.id} className="border-border shadow-[var(--shadow-soft)]">
                    <CardContent className="grid gap-5 p-5 md:grid-cols-[200px_minmax(0,1fr)] md:p-6">
                      <div className="overflow-hidden rounded-md border border-border bg-muted/30">
                        {imageName ? (
                          <img
                            src={fileUrl(item, imageName)}
                            alt={item.title}
                            className="h-44 w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
                            No image
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h2 className="font-display text-2xl">{item.title}</h2>
                            <p className="mt-1 text-xs text-muted-foreground">ID: {item.id}</p>
                          </div>
                          <Badge variant="secondary">{formatStatus(item.status)}</Badge>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">{item.category || "General"}</Badge>
                          <Badge variant="outline">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDate(item.created)}
                          </Badge>
                          <Badge variant="outline">
                            <MapPin className="h-3.5 w-3.5" />
                            {formatCoordinates(item.latitude, item.longitude)}
                          </Badge>
                        </div>

                        {/* Action row - Only admin can change status */}
                        {role === "admin" ? (
                          <div className="mt-5 grid gap-3 md:grid-cols-[200px_minmax(0,1fr)_auto] md:items-start">
                            <Select
                              value={item.status ?? "pending"}
                              onValueChange={(v) => updateStatus(item, v)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {formatStatus(s)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Textarea
                              placeholder="Add a public update note (optional)…"
                              value={notes[item.id] ?? ""}
                              onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                              className="min-h-[42px]"
                            />

                            <Button
                              onClick={() => postNote(item)}
                              disabled={busy === item.id || !notes[item.id]?.trim()}
                            >
                              {busy === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                              Post
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-5">
                            <div className="rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                              Department staff can only add notes. Status changes are restricted to administrators.
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                              <Textarea
                                placeholder="Add a note about this grievance (optional)…"
                                value={notes[item.id] ?? ""}
                                onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))}
                                className="min-h-[42px]"
                              />

                              <Button
                                onClick={() => postNote(item)}
                                disabled={busy === item.id || !notes[item.id]?.trim()}
                              >
                                {busy === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                                Post
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            : null}
        </div>
      </section>
    </Layout>
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

function formatCoordinates(lat?: number, lng?: number) {
  if (typeof lat !== "number" || typeof lng !== "number") return "No location";
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}
