import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LogIn, Mail, Lock, AlertCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { getRoleHomePath, getUserRole, useAuth } from "@/hooks/useAuth";
import { pb } from "@/lib/pocketbase";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign In — PGMS" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      const nextUserRole = getUserRole(pb.authStore.model?.role);
      const redirectTarget = search.redirect || getRoleHomePath(nextUserRole);
      if (redirectTarget === "/") {
        navigate({ to: "/" });
        return;
      }

      if (redirectTarget === "/submit") {
        navigate({ to: "/submit" });
        return;
      }

      if (redirectTarget === "/dashboard") {
        navigate({ to: "/dashboard" });
        return;
      }

      if (redirectTarget === "/admin") {
        navigate({ to: "/admin" });
        return;
      }

      navigate({ to: "/grievances" });
    } catch (err: any) {
      setError(err?.message ?? "Invalid email or password.");
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md w-full px-4 py-12 md:py-16 lg:py-20">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 md:h-14 w-12 md:w-14 items-center justify-center rounded-lg md:rounded-xl bg-primary text-primary-foreground mb-4 shadow-[var(--shadow-soft)]">
            <LogIn className="h-5 md:h-6 w-5 md:w-6" />
          </div>
          <h1 className="font-display text-2xl md:text-3xl">Welcome back</h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">Sign in to file and track your grievances.</p>
        </div>

        <Card className="border-border shadow-[var(--shadow-soft)]">
          <CardContent className="p-5 md:p-7">
            <form onSubmit={onSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm md:text-[14px] font-medium">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-9 h-10 md:h-11 text-sm md:text-[15px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm md:text-[14px] font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 h-10 md:h-11 text-sm md:text-[15px]"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full h-10 md:h-11 text-sm md:text-[15px] font-semibold bg-accent text-accent-foreground hover:bg-accent/90">
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/register" className="font-semibold text-primary hover:underline">Register</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
