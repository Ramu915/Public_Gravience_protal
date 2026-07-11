import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Mail, Lock, User, Phone, AlertCircle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { getRoleHomePath, useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Create Account — PGMS" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);

  function update(k: keyof typeof form, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    try {
      await register(form);
      navigate({ to: getRoleHomePath("citizen") });
    } catch (err: any) {
      setError(err?.message ?? "Could not create account. Please try again.");
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md px-4 py-16 bg-blue-500 rounded-xl">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4 shadow-[var(--shadow-soft)]">
            <UserPlus className="h-6 w-6" />
          </div>
          <h1 className="font-display">Create your account</h1>
          <p className="mt-2 text-muted-foreground">Join PGMS and make your voice count.</p>
        </div>

        <Card className="border-border shadow-[var(--shadow-soft)] !bg-blue-50">
          <CardContent className="p-7">
            <form onSubmit={onSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Field id="name" label="Full name" icon={User}>
                <Input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Your full name" className="pl-9 h-11 text-[15px]" />
              </Field>

              <Field id="email" label="Email address" icon={Mail}>
                <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" className="pl-9 h-11 text-[15px]" />
              </Field>

              <Field id="phone" label="Phone (optional)" icon={Phone}>
                <Input id="phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder=" XXXXX XXXXX" className="pl-9 h-11 text-[15px]" />
              </Field>

              <Field id="password" label="Password" icon={Lock}>
                <Input id="password" type="password" required autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => update("password", e.target.value)} placeholder="At least 8 characters" className="pl-9 h-11 text-[15px]" />
              </Field>

              <Button type="submit" disabled={loading} className="w-full h-11 text-[15px] font-semibold bg-accent text-accent-foreground hover:bg-accent/90">
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" search={{ redirect: "/" }} className="font-semibold text-primary hover:underline">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function Field({
  id, label, icon: Icon, children,
}: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[14px] font-medium">{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {children}
      </div>
    </div>
  );
}
