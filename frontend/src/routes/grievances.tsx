import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Clock3, MapPin, RefreshCw, Search } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pb, fileUrl, isAbortError } from "@/lib/pocketbase";

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
  created?: string;
  expand?: {
    citizen?: { id: string; name?: string; email: string };
    department?: { id: string; name: string };
  };
};

type UpdateRecord = {
  id: string;
  grievance: string;
  status?: string;
  note?: string;
  created: string;
  admin?: string; // admin user ID
  user?: string;  // department user ID
  expand?: {
    admin?: { id: string; name?: string; email?: string };
    user?: { id: string; name?: string; email?: string };
  };
};

const CATEGORIES = ["all", "roads", "water", "electricity", "sanitation", "other"];
const STATUSES = ["all", "pending", "in_progress", "resolved", "rejected"];

export const Route = createFileRoute("/grievances")({
  head: () => ({ meta: [{ title: "Browse Grievances — PGMS" }] }),
  component: GrievancesPage,
});

function GrievancesPage() {
  const [items, setItems] = useState<GrievanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedUpdates, setSelectedUpdates] = useState<UpdateRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [posting, setPosting] = useState(false);
  const { role } = useAuth();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const records = await pb.collection("grievances").getFullList<GrievanceRecord>({
        sort: "-created",
        expand: "citizen,department",
      });
      setItems(records);
    } catch (err: any) {
      if (!isAbortError(err)) setError(err?.message ?? "Could not load grievances.");
    } finally {
      setLoading(false);
    }
  }

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  async function loadUpdates(id: string) {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const updates = await pb.collection("grievance_updates").getFullList<UpdateRecord>({
        filter: `grievance = "${id}"`,
        sort: "-created",
        expand: "user,admin",
      });
      setSelectedUpdates(updates.slice(0, 2));
    } catch (err: any) {
      setDetailError(err?.message ?? "Could not load updates.");
      setSelectedUpdates([]);
    } finally {
      setDetailLoading(false);
    }
  }

  function selectItem(item: GrievanceRecord) {
    if (selectedId === item.id) {
      setSelectedId(null);
      setSelectedUpdates([]);
      setNote("");
      return;
    }

    setSelectedId(item.id);
    loadUpdates(item.id);
  }

  async function postUpdate(e: FormEvent) {
    e.preventDefault();
    if (!selectedItem || !note.trim()) return;

    setPosting(true);
    setDetailError(null);
    try {
      const currentUserId = (pb.authStore.model as any)?.id;
      const payload: Record<string, unknown> = {
        grievance: selectedItem.id,
        status: selectedItem.status ?? "pending",
        note: note.trim(),
      };
      
      // Set admin or user field based on role
      if (role === "admin") {
        payload.admin = currentUserId;
      } else if (role === "department") {
        payload.user = currentUserId;
      }

      const created = await pb.collection("grievance_updates").create<UpdateRecord>(payload, {
        expand: "admin,user",
      });
      setSelectedUpdates((prev) => [created, ...prev].slice(0, 2));
      setNote("");
    } catch (err: any) {
      setDetailError(err?.message ?? "Could not post update.");
    } finally {
      setPosting(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (category !== "all" && it.category !== category) return false;
      if (status !== "all" && (it.status ?? "pending") !== status) return false;
      if (q && !`${it.title} ${it.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, category, status]);

  return (
    <Layout>
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl md:text-3xl">Browse Grievances</h1>
            <p className="mt-2 md:mt-3 text-sm md:text-base text-muted-foreground">
              Track community complaints and resolution progress.
            </p>
          </div>
          <div className="flex gap-2 md:gap-3 w-full md:w-auto">
            <Button variant="outline" onClick={load} disabled={loading} className="flex-1 md:flex-none">
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              <span className="hidden sm:inline ml-2">Refresh</span>
            </Button>
            <Button asChild className="flex-1 md:flex-none">
              <Link to="/submit">New Complaint</Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search grievances..."
              className="pl-9 text-sm"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c === "all" ? "All categories" : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : formatStatus(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-3 md:gap-4">
          {loading
            ? [1, 2, 3].map((i) => (
                <Card key={i} className="border-border">
                  <CardContent className="p-4 md:p-6">
                    <div className="h-5 w-40 rounded bg-muted" />
                    <div className="mt-3 h-4 w-full rounded bg-muted" />
                    <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
                  </CardContent>
                </Card>
              ))
            : null}

          {!loading && !filtered.length ? (
            <Card className="border-border">
              <CardContent className="px-4 md:px-6 py-12 text-center text-muted-foreground text-sm md:text-base">
                No grievances match your filters.
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
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectItem(item)}
                    className="block text-left"
                  >
                    <Card
                      className={`border-border shadow-[var(--shadow-soft)] cursor-pointer transition-all ${
                        selectedId === item.id ? "border-primary bg-primary/5" : "hover:border-border hover:bg-muted/5"
                      }`}
                    >
                      <CardContent className="grid gap-5 p-5 md:grid-cols-[220px_minmax(0,1fr)] md:p-6">
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
                            <div className="font-display text-2xl text-foreground group-hover:text-primary transition-colors">
                              {item.title}
                            </div>
                            <Badge variant="secondary">{formatStatus(item.status)}</Badge>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Badge variant="outline">{item.category || "General"}</Badge>
                            {item.expand?.citizen ? (
                              <Badge variant="outline">By: {item.expand.citizen.name || item.expand.citizen.email}</Badge>
                            ) : null}
                            <Badge variant="outline">
                              <Clock3 className="h-3.5 w-3.5" />
                              {formatDate(item.created)}
                            </Badge>
                            <Badge variant="outline">
                              <MapPin className="h-3.5 w-3.5" />
                              {formatCoordinates(item.latitude, item.longitude)}
                            </Badge>
                          </div>
                          <div className="mt-3 text-sm font-medium text-primary hover:underline">
                            {selectedId === item.id ? "Hide details" : "View details →"}
                          </div>
                        </div>
                      </CardContent>

                      {selectedId === item.id ? (
                        <div className="rounded-b-md border-t border-border bg-background px-5 pb-5 pt-4 md:px-6">
                          <div className="grid gap-6 md:grid-cols-[1fr_300px]">
                            <div>
                                  <p className="mt-4 text-sm leading-7 text-foreground">{item.description}</p>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                {imageNames.length ? (
                                  imageNames.map((name) => (
                                    <div key={name} className="overflow-hidden rounded-md border border-border bg-muted/30">
                                      <img
                                        src={fileUrl(item, name)}
                                        alt={item.title}
                                        className="h-48 w-full object-cover"
                                        loading="lazy"
                                      />
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                                    No attached images
                                  </div>
                                )}
                              </div>

                              <div className="mt-6">
                                <h3 className="font-display text-lg">Latest updates</h3>
                                <p className="text-sm text-muted-foreground">Showing the two most recent department/admin updates.</p>

                                {detailLoading ? (
                                  <div className="mt-4 text-sm text-muted-foreground">Loading updates…</div>
                                ) : detailError ? (
                                  <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                    {detailError}
                                  </div>
                                ) : selectedUpdates.length === 0 ? (
                                  <div className="mt-4 text-sm text-muted-foreground">No recent updates yet.</div>
                                ) : (
                                  <div className="mt-4 space-y-4">
                                    {selectedUpdates.map((update) => {
                                      // Determine who posted the update and get their name only
                                      let updateType = "Update";

                                      if (update.admin) {
                                        const adminName = update.expand?.admin?.name || "Admin";
                                        updateType = `Update: ${adminName}`;
                                      } else if (update.user) {
                                        const deptName = update.expand?.user?.name || "Department";
                                        updateType = `Update: ${deptName}`;
                                      }

                                      return (
                                        <div key={update.id} className="rounded-md border border-border bg-muted/20 p-4">
                                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <span>{formatDate(update.created)}</span>
                                            <span>· {updateType}</span>
                                          </div>
                                          <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <Badge variant="secondary">{formatStatus(update.status)}</Badge>
                                          </div>
                                          {update.note ? (
                                            <p className="mt-3 text-sm leading-6 text-foreground">{update.note}</p>
                                          ) : null}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </Card>
                  </button>
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
  return new Date(value).toLocaleDateString();
}

function formatCoordinates(lat?: number, lng?: number) {
  if (typeof lat !== "number" || typeof lng !== "number") return "No location";
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}
