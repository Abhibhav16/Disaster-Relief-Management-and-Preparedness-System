"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, Boxes, Download, HandHeart, Home, LogOut, Moon, Plus, Search, ShieldAlert, Sun, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { io } from "socket.io-client";
import { API_URL, ApiList, api } from "@/lib/api";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";

const OperationsMap = dynamic(() => import("@/components/OperationsMap").then((m) => m.OperationsMap), { ssr: false });

type Disaster = { id: string; title: string; type: string; location: string; latitude: number; longitude: number; severity: string; status: string };
type Shelter = { id: string; name: string; address: string; latitude: number; longitude: number; capacity: number; occupiedBeds: number };
type Request = { id: string; requestType: string; description: string; latitude: number; longitude: number; priority: string; status: string };
type Resource = { id: string; name: string; category: string; quantity: number; location: string; status: string };
type Volunteer = { id: string; skills: string[]; availability: boolean; user?: { name: string; email: string } };
type CurrentUser = { id: string; name: string; email: string; role: { name: string } };

export default function Dashboard() {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [disasters, setDisasters] = useState<Disaster[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [live, setLive] = useState("connecting");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const token = localStorage.getItem("drrcs_token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    api<CurrentUser>("/api/auth/me")
      .then((currentUser) => {
        setUser(currentUser);
        localStorage.setItem("drrcs_user", JSON.stringify(currentUser));
        setAuthReady(true);
      })
      .catch(() => {
        localStorage.removeItem("drrcs_token");
        localStorage.removeItem("drrcs_user");
        window.location.href = "/login";
      });
  }, []);

  useEffect(() => {
    if (!authReady) return;
    Promise.all([
      api<ApiList<Disaster>>("/api/disasters"),
      api<ApiList<Shelter>>("/api/shelters"),
      api<ApiList<Request>>("/api/requests"),
      api<ApiList<Resource>>("/api/resources"),
      api<ApiList<Volunteer>>("/api/volunteers").catch(() => ({ data: [] })),
      api<any>("/api/analytics").catch(() => null)
    ]).then(([d, s, r, rs, v, a]) => {
      setDisasters(d.data);
      setShelters(s.data);
      setRequests(r.data);
      setResources(rs.data);
      setVolunteers(v.data);
      setAnalytics(a);
    });
  }, [authReady]);

  useEffect(() => {
    const socket = io(API_URL);
    socket.on("connected", () => setLive("online"));
    socket.on("heartbeat", () => setLive("synced"));
    return () => {
      socket.disconnect();
    };
  }, []);

  const resourceChart = useMemo(() => resources.map((r) => ({ name: r.category, quantity: r.quantity })), [resources]);
  const occupancyChart = shelters.map((s) => ({ name: s.name, occupied: s.occupiedBeds, capacity: s.capacity }));
  const filteredDisasters = disasters.filter((d) => `${d.title} ${d.location} ${d.type}`.toLowerCase().includes(search.toLowerCase()));

  async function exportCsv() {
    const token = localStorage.getItem("drrcs_token");
    const res = await fetch(`${API_URL}/api/reports/export.csv`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "drrcs-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    try {
      await api<null>("/api/auth/logout", { method: "POST" });
    } finally {
      localStorage.removeItem("drrcs_token");
      localStorage.removeItem("drrcs_user");
      window.location.href = "/login";
    }
  }

  if (!authReady) {
    return <main className="min-h-screen bg-muted p-6 text-sm">Checking login...</main>;
  }

  return (
    <main className="min-h-screen bg-muted">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-background p-4 md:block">
        <div className="mb-8 flex items-center gap-2 font-semibold"><ShieldAlert /> DRRCS</div>
        <nav className="space-y-1">
          {[
            ["overview", Activity],
            ["disasters", ShieldAlert],
            ["requests", HandHeart],
            ["resources", Boxes],
            ["shelters", Home],
            ["volunteers", Users],
            ["notifications", Bell]
          ].map(([key, Icon]: any) => (
            <button key={key} onClick={() => setTab(key)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm capitalize ${tab === key ? "bg-primary text-white" : "hover:bg-muted"}`}>
              <Icon size={18} /> {key}
            </button>
          ))}
        </nav>
      </aside>

      <section className="md:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold capitalize">{tab === "overview" ? "Operations Dashboard" : tab}</h1>
              <p className="text-sm text-foreground/60">
                {user?.name} · {user?.role.name.replaceAll("_", " ")} · Realtime: {live}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5" size={16} />
                <Input className="w-56 pl-8" placeholder="Search incidents" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Button className="px-3" onClick={() => setDark((v) => !v)} aria-label="Toggle dark mode">{dark ? <Sun size={18} /> : <Moon size={18} />}</Button>
              <Button className="gap-2" onClick={exportCsv}><Download size={16} /> CSV</Button>
              <Button className="gap-2 bg-foreground/20 text-foreground" onClick={logout}><LogOut size={16} /> Logout</Button>
            </div>
          </div>
        </header>

        <div className="space-y-5 p-4">
          {tab === "overview" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Metric label="Active Disasters" value={analytics?.activeDisasters ?? disasters.length} />
                <Metric label="Available Resources" value={analytics?.resourcesAvailable ?? resources.reduce((s, r) => s + r.quantity, 0)} />
                <Metric label="Shelter Occupancy" value={`${analytics?.shelterOccupancy?.occupied ?? 0}/${analytics?.shelterOccupancy?.capacity ?? 0}`} />
                <Metric label="Open Requests" value={requests.filter((r) => r.status !== "RESOLVED").length} />
                <Metric label="Volunteers" value={analytics?.availableVolunteers ?? volunteers.length} />
              </div>
              <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                <Card>
                  <h2 className="mb-3 font-semibold">GIS Operations Map</h2>
                  <OperationsMap disasters={disasters} shelters={shelters} requests={requests.map((r) => ({ ...r, title: r.requestType }))} />
                </Card>
                <Card>
                  <h2 className="mb-3 font-semibold">Resource Usage</h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={resourceChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="quantity" fill="#0f9aa6" /></BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
              <Card>
                <h2 className="mb-3 font-semibold">Shelter Utilization</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart><Pie data={occupancyChart} dataKey="occupied" nameKey="name" outerRadius={95}>{occupancyChart.map((_, i) => <Cell key={i} fill={["#0f9aa6", "#e0564a", "#5a9f68"][i % 3]} />)}</Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}

          {tab === "disasters" && <Table title="Disaster Management" rows={filteredDisasters} columns={["title", "type", "severity", "status", "location"]} />}
          {tab === "requests" && <RequestPanel requests={requests} onCreated={(request) => setRequests((items) => [request, ...items])} />}
          {tab === "resources" && <Table title="Resources" rows={resources} columns={["name", "category", "quantity", "status", "location"]} />}
          {tab === "shelters" && <Table title="Shelters" rows={shelters} columns={["name", "capacity", "occupiedBeds", "address"]} />}
          {tab === "volunteers" && <Table title="Volunteers" rows={volunteers.map((v) => ({ name: v.user?.name ?? "Volunteer", skills: v.skills.join(", "), availability: v.availability ? "Available" : "Busy" }))} columns={["name", "skills", "availability"]} />}
          {tab === "notifications" && <BroadcastForm />}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <Card><p className="text-sm text-foreground/60">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></Card>;
}

function Table({ title, rows, columns }: { title: string; rows: any[]; columns: string[] }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{title}</h2><Button className="gap-2"><Plus size={16} /> Add</Button></div>
      <div className="overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead><tr>{columns.map((c) => <th key={c} className="border-b border-border p-3 text-left capitalize">{c}</th>)}</tr></thead>
          <tbody>{rows.map((row, i) => <tr key={row.id ?? i} className="hover:bg-muted">{columns.map((c) => <td key={c} className="border-b border-border p-3">{String(row[c] ?? "")}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </Card>
  );
}

function RequestPanel({ requests, onCreated }: { requests: Request[]; onCreated: (request: Request) => void }) {
  const [requestType, setRequestType] = useState("Food");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const created = await api<Request>("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          requestType,
          priority,
          description,
          latitude: 31.3959,
          longitude: 75.5350
        })
      });
      onCreated(created);
      setDescription("");
      setMessage("Request submitted successfully.");
    } catch {
      setMessage("Could not submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-4 font-semibold">Request Emergency Resource</h2>
        <form className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]" onSubmit={submit}>
          <Select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
            <option value="Food">Food</option>
            <option value="Water">Water</option>
            <option value="Medicine">Medicine</option>
            <option value="Blankets">Blankets</option>
            <option value="Shelter">Shelter</option>
            <option value="Rescue Equipment">Rescue Equipment</option>
            <option value="Evacuation Support">Evacuation Support</option>
            <option value="Medical Assistance">Medical Assistance</option>
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="LOW">Low Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="HIGH">High Priority</option>
            <option value="URGENT">Urgent</option>
          </Select>
          <Button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit Request"}</Button>
          <Textarea
            className="lg:col-span-3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you need, number of people affected, and nearby landmark"
            required
          />
        </form>
        {message && <p className="mt-3 text-sm text-foreground/70">{message}</p>}
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {requests.length === 0 && (
          <Card>
            <p className="text-sm text-foreground/70">No requests submitted yet.</p>
          </Card>
        )}
        {requests.map((r) => (
          <Card key={r.id}>
            <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{r.requestType}</h3><Badge>{r.priority}</Badge></div>
            <p className="text-sm text-foreground/70">{r.description}</p>
            <Select className="mt-4" defaultValue={r.status}><option>PENDING</option><option>ASSIGNED</option><option>IN_PROGRESS</option><option>RESOLVED</option></Select>
          </Card>
        ))}
      </div>
    </div>
  );
}
function BroadcastForm() {
  return (
    <Card className="max-w-2xl">
      <h2 className="mb-4 font-semibold">Emergency Broadcast</h2>
      <div className="space-y-3">
        <Input placeholder="Alert title" />
        <Textarea placeholder="Broadcast message" />
        <Select><option>Email</option><option>SMS Placeholder</option><option>System</option></Select>
        <Button>Send Broadcast</Button>
      </div>
    </Card>
  );
}
