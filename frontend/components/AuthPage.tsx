"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, Input, Select } from "@/components/ui";

type AuthMode = "login" | "register";
type AuthResponse = {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: { name: string };
  };
};

export function AuthPage({ initialMode = "login" }: { initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialMode === "login" ? "admin@drrcs.local" : "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState(initialMode === "login" ? "Password123!" : "");
  const [role, setRole] = useState("AFFECTED_INDIVIDUAL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload =
        mode === "login"
          ? { email, password }
          : { name, email, phone: phone || undefined, password, role };

      const data = await api<AuthResponse>(path, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      localStorage.setItem("drrcs_token", data.token);
      localStorage.setItem("drrcs_user", JSON.stringify(data.user));
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? readableError(err.message) : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    if (nextMode === "login") {
      setEmail("admin@drrcs.local");
      setPassword("Password123!");
    } else {
      setEmail("");
      setPassword("");
    }
  }

  return (
    <main className="min-h-screen bg-muted">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-md bg-background px-3 py-2 text-sm font-medium">
            <ShieldAlert size={18} /> Disaster Relief & Resource Coordination System
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            Coordinate relief operations when every minute matters.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-foreground/70">
            Log in as an admin, authority, NGO coordinator, volunteer, or affected individual to manage disaster response workflows.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["JWT login", "Role access", "Secure registration"].map((item) => (
              <div key={item} className="rounded-lg border border-border bg-background p-4 text-sm font-medium">
                {item}
              </div>
            ))}
          </div>
        </div>

        <Card className="p-6">
          <div className="mb-5 grid grid-cols-2 gap-2">
            <Button type="button" className={mode === "login" ? "" : "bg-foreground/20 text-foreground"} onClick={() => switchMode("login")}>
              Login
            </Button>
            <Button type="button" className={mode === "register" ? "" : "bg-foreground/20 text-foreground"} onClick={() => switchMode("register")}>
              Register
            </Button>
          </div>

          <form className="space-y-4" onSubmit={submit}>
            {mode === "register" && (
              <>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
              </>
            )}
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" minLength={8} required />
            {mode === "register" && (
              <Select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="AFFECTED_INDIVIDUAL">Affected Individual</option>
                <option value="VOLUNTEER">Volunteer</option>
                <option value="NGO_COORDINATOR">NGO Coordinator</option>
                <option value="AUTHORITY">Authority</option>
              </Select>
            )}
            {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}

function readableError(message: string) {
  if (message.includes("Invalid credentials")) return "Invalid email or password.";
  if (message.includes("already exists") || message.includes("Unique constraint")) return "An account with this email already exists. Try logging in or use another email.";
  if (message.includes("Validation failed")) return "Please check the form fields and try again.";
  return "Could not complete authentication. Make sure the backend is running.";
}
