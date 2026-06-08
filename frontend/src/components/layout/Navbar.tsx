import { Link, useNavigate } from "@tanstack/react-router";
import { Shield, Menu, X, LogOut, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

function formatRole(role?: string) {
  if (!role) return "Citizen";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/grievances", label: "Browse Grievances" },
  { to: "/submit", label: "Submit Complaint" },
  { to: "/my-complaints", label: "My Complaints" },
  { to: "/about", label: "About" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout, role, mounted } = useAuth();
  const navigate = useNavigate();
  const isStaff = mounted && (role === "department" || role === "admin");
  const isAdmin = mounted && role === "admin";

  const handleLogout = async () => {
    logout();
    // Redirect to login page after logout
    await navigate({ to: "/login", search: { redirect: "/" } });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      {/* Top gov strip */}
      <div className="gov-strip">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-xs sm:text-[13px]">
          <span className="font-medium tracking-wide">Government of India · Public Grievance Portal</span>
          <span className="hidden sm:inline opacity-90">Helpline: 1800-XXX-XXXX</span>
        </div>
      </div>

      {/* Main nav */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <Shield className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[17px] font-bold text-foreground">PGMS</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Grievance Portal</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="px-3.5 py-2 text-[15px] font-medium text-foreground/80 rounded-md hover:bg-muted hover:text-foreground transition-colors"
              activeProps={{ className: "px-3.5 py-2 text-[15px] font-semibold rounded-md bg-muted text-primary" }}
            >
              {l.label}
            </Link>
          ))}
          {isStaff ? (
            <Link
              to="/dashboard"
              className="px-3.5 py-2 text-[15px] font-medium text-foreground/80 rounded-md hover:bg-muted hover:text-foreground transition-colors"
              activeProps={{ className: "px-3.5 py-2 text-[15px] font-semibold rounded-md bg-muted text-primary" }}
            >
              Dashboard
            </Link>
          ) : null}
          {isAdmin ? (
            <Link
              to="/admin"
              className="px-3.5 py-2 text-[15px] font-medium text-foreground/80 rounded-md hover:bg-muted hover:text-foreground transition-colors"
              activeProps={{ className: "px-3.5 py-2 text-[15px] font-semibold rounded-md bg-muted text-primary" }}
            >
              Admin
            </Link>
          ) : null}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {!mounted ? (
            <div className="flex items-center gap-2">
              <div className="h-9 w-48 bg-muted rounded-md animate-pulse" aria-hidden />
              <div className="h-9 w-20 bg-muted rounded-md animate-pulse" aria-hidden />
            </div>
          ) : user ? (
            <>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-[14px] font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-xs">
                <UserIcon className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{user.name || user.email} · {formatRole(role)}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="shrink-0">
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login" search={{ redirect: "/" }}>Sign In</Link>
              </Button>
              <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                <Link to="/register">Register</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && mounted && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="mx-auto max-w-7xl px-4 py-3 flex flex-col gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-md text-[15px] font-medium hover:bg-muted"
              >
                {l.label}
              </Link>
            ))}
            {isStaff ? (
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-md text-[15px] font-medium hover:bg-muted text-primary font-semibold"
              >
                Dashboard
              </Link>
            ) : null}
            {isAdmin ? (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-md text-[15px] font-medium hover:bg-muted text-primary font-semibold"
              >
                Admin
              </Link>
            ) : null}
            {user ? (
              <div className="space-y-2 pt-2">
                <div className="rounded-md bg-muted px-3 py-2 text-[14px] font-medium text-foreground break-words">
                  {user.name || user.email} · {formatRole(role)}
                </div>
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => { setOpen(false); handleLogout(); }}>
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/login" search={{ redirect: "/" }} onClick={() => setOpen(false)}>Sign In</Link>
                </Button>
                <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                  <Link to="/register" onClick={() => setOpen(false)}>Register</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
