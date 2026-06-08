import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock3, Loader2, MapPin, Send } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { pb, fileUrl } from "@/lib/pocketbase";

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
  vote_count?: number;
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
  expand?: {
    admin?: { id: string; name?: string; email?: string };
    user?: { id: string; name?: string; email?: string; expand?: { department?: { id: string; name: string } } };
  };
};

type CommentRecord = {
  id: string;
  text: string;
  created: string;
  expand?: { user?: { id: string; name?: string; email: string } };
};

export const Route = createFileRoute("/grievances/$id")({
  head: () => ({ meta: [{ title: "Grievance Details — PGMS" }] }),
  component: GrievanceDetail,
});

function GrievanceDetail() {
  const { id } = useParams({ from: "/grievances/$id" });
  const [item, setItem] = useState<GrievanceRecord | null>(null);
  const [updates, setUpdates] = useState<UpdateRecord[]>([]);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [departments, setDepartments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const me = pb.authStore.model as any;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const g = await pb.collection("grievances").getOne<GrievanceRecord>(id, {
        expand: "citizen,department",
      });
      setItem(g);

      try {
        const depts = await pb.collection("departments").getFullList<{ id: string; name: string }>();
        const deptMap: Record<string, string> = {};
        depts.forEach((d) => {
          deptMap[d.id] = d.name;
        });
        setDepartments(deptMap);
      } catch {
        // Ignore if departments fail to load
      }

      try {
        const u = await pb.collection("grievance_updates").getFullList<UpdateRecord>({
          filter: `grievance = "${id}"`,
          sort: "-created",
          expand: "admin,user",
        });
        setUpdates(u);
      } catch {
        setUpdates([]);
      }

      try {
        const c = await pb.collection("comments").getFullList<CommentRecord>({
          filter: `grievance = "${id}"`,
          sort: "created",
          expand: "user",
        });
        setComments(c);
      } catch {
        setComments([]);
      }
    } catch (err: any) {
      setError(err?.message ?? "Could not load grievance.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !me?.id) return;
    setPosting(true);
    setError(null);
    try {
      const created = await pb.collection("comments").create<CommentRecord>(
        { grievance: id, user: me.id, text: text.trim() },
        { expand: "user" },
      );
      setComments((arr) => [...arr, created]);
      setText("");
    } catch (err: any) {
      setError(err?.message ?? "Could not post comment. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Layout>
      <section className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/grievances">
            <ArrowLeft className="h-4 w-4" /> Back to all grievances
          </Link>
        </Button>

        {loading ? (
          <Card className="border-border">
            <CardContent className="p-6">Loading…</CardContent>
          </Card>
        ) : error || !item ? (
          <Card className="border-border">
            <CardContent className="p-6 text-destructive">{error ?? "Not found."}</CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-border shadow-[var(--shadow-soft)]">
              <CardContent className="p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h1 className="font-display text-3xl">{item.title}</h1>
                    <p className="mt-1 text-xs text-muted-foreground">ID: {item.id}</p>
                  </div>
                  <Badge variant="secondary">{formatStatus(item.status)}</Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline">{item.category || "general"}</Badge>
                  <Badge variant="outline">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatDate(item.created)}
                  </Badge>
                  <Badge variant="outline">
                    <MapPin className="h-3.5 w-3.5" />
                    {formatCoordinates(item.latitude, item.longitude)}
                  </Badge>
                  {item.expand?.department ? (
                    <Badge variant="outline">Dept: {item.expand.department.name}</Badge>
                  ) : null}
                  {item.expand?.citizen ? (
                    <Badge variant="outline">Uploaded by: {item.expand.citizen.name || item.expand.citizen.email}</Badge>
                  ) : null}
                </div>

                <p className="mt-5 whitespace-pre-wrap text-[15px] leading-7 text-foreground">
                  {item.description}
                </p>

                {(() => {
                  const imageNames = Array.isArray(item.images)
                    ? item.images
                    : item.images
                    ? [item.images]
                    : (item as any).image
                    ? [(item as any).image]
                    : [];
                  return imageNames.length ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {imageNames.map((name) => (
                        <div key={name} className="overflow-hidden rounded-md border border-border bg-muted/30">
                          <img
                            src={fileUrl(item, name)}
                            alt={item.title}
                            className="h-64 w-full object-cover sm:h-72"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}
              </CardContent>
            </Card>

            <h2 className="mt-10 font-display text-2xl">Updates</h2>
            <Card className="mt-3 border-border">
              <CardContent className="p-6">
                {updates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No updates yet.</p>
                ) : (
                  <div className="space-y-3">
                    {updates.map((update) => {
                      const author =
                        update.expand?.user?.name ||
                        update.expand?.user?.email ||
                        update.expand?.admin?.name ||
                        update.expand?.admin?.email ||
                        "Unknown";
                      const userDeptId = (update.expand?.user as any)?.department;
                      const deptName = userDeptId ? departments[userDeptId] : null;
                      const roleLabel = update.expand?.admin
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
                            <span>· {roleLabel}: {author}</span>
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
              </CardContent>
            </Card>

            <h2 className="mt-10 font-display text-2xl">Comments</h2>
            <Card className="mt-3 border-border">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No comments yet. Be the first to share your thoughts.
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="rounded-md border border-border p-3">
                        <div className="text-xs text-muted-foreground">
                          {c.expand?.user?.name || c.expand?.user?.email || "User"} ·{" "}
                          {formatDate(c.created)}
                        </div>
                        <p className="mt-1 text-sm text-foreground">{c.text}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-6">
                  {me?.id ? (
                    <form onSubmit={postComment} className="space-y-3">
                      <Textarea
                        placeholder="Write a comment…"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        required
                      />
                      <Button type="submit" disabled={posting || !text.trim()}>
                        {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Post comment
                      </Button>
                    </form>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      <Link
                        to="/login"
                        search={{ redirect: `/grievances/${id}` }}
                        className="text-primary underline"
                      >
                        Sign in
                      </Link>{" "}
                      to leave a comment.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
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
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
