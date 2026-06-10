"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bell, BookOpen, Boxes, Cpu, Download, HandHeart, Home, LogOut, MessageSquare, Moon, Plus, Search, ShieldAlert, Sparkles, Sun, Users, X, Check, Send, Inbox, Mail } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { io } from "socket.io-client";
import { API_URL, ApiList, api } from "@/lib/api";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";

const OperationsMap = dynamic(() => import("@/components/OperationsMap").then((m) => m.OperationsMap), { ssr: false });

type Disaster = { id: string; title: string; type: string; description: string; location: string; latitude: number; longitude: number; severity: string; status: string; imageUrl?: string };
type Shelter = { id: string; name: string; address: string; latitude: number; longitude: number; capacity: number; occupiedBeds: number; contactPerson?: string; phone?: string };
type Request = { id: string; requestType: string; description: string; latitude: number; longitude: number; priority: string; status: string; imageUrl?: string; user?: { name: string; email: string } };
type Resource = { id: string; name: string; category: string; quantity: number; location: string; status: string; latitude?: number; longitude?: number; provider?: string; expiryDate?: string };
type Volunteer = { id: string; skills: string[]; availability: boolean; user?: { name: string; email: string } };
type CurrentUser = { id: string; name: string; email: string; role: { name: string } };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-background/90 p-3 shadow-md backdrop-blur-md text-sm">
        <p className="font-semibold">{label}</p>
        <div className="mt-1 space-y-1">
          {payload.map((pld: any) => (
            <p key={pld.name} className="text-xs flex items-center gap-1.5" style={{ color: pld.color || pld.fill }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pld.color || pld.fill }} />
              <span className="text-foreground/80 capitalize">{pld.name}</span>: <span className="font-bold">{pld.value}</span>
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

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

  const resourceChart = useMemo(() => {
    const groups: Record<string, number> = {};
    resources.forEach((r) => {
      const cat = r.category || "Other";
      groups[cat] = (groups[cat] || 0) + r.quantity;
    });
    return Object.entries(groups).map(([name, quantity]) => ({
      name: name.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
      quantity
    }));
  }, [resources]);

  const shelterBarChartData = useMemo(() => {
    return shelters.map((s) => ({
      name: s.name.length > 18 ? s.name.slice(0, 15) + "..." : s.name,
      Occupied: s.occupiedBeds,
      Available: Math.max(0, s.capacity - s.occupiedBeds)
    }));
  }, [shelters]);

  const systemShelterDonutData = useMemo(() => {
    let totalOccupied = 0;
    let totalCapacity = 0;
    shelters.forEach((s) => {
      totalOccupied += s.occupiedBeds;
      totalCapacity += s.capacity;
    });
    const totalAvailable = Math.max(0, totalCapacity - totalOccupied);
    return {
      data: [
        { name: "Occupied Beds", value: totalOccupied },
        { name: "Available Beds", value: totalAvailable }
      ],
      totalOccupied,
      totalCapacity,
      percentage: totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0
    };
  }, [shelters]);

  const filteredDisasters = useMemo(() => {
    return disasters.filter((d) =>
      `${d.title} ${d.location} ${d.type} ${d.severity} ${d.status}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [disasters, search]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) =>
      `${r.requestType} ${r.description} ${r.priority} ${r.status} ${r.user?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [requests, search]);

  const filteredResources = useMemo(() => {
    return resources.filter((r) =>
      `${r.name} ${r.category} ${r.location} ${r.status}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [resources, search]);

  const filteredShelters = useMemo(() => {
    return shelters.filter((s) =>
      `${s.name} ${s.address}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [shelters, search]);

  const filteredVolunteers = useMemo(() => {
    return volunteers.filter((v) =>
      `${v.user?.name ?? ""} ${v.skills.join(" ")} ${v.availability ? "available" : "busy"}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [volunteers, search]);

  const recentDisasters = useMemo(() => {
    return filteredDisasters.slice(0, 4);
  }, [filteredDisasters]);

  const recentRequests = useMemo(() => {
    return filteredRequests
      .filter((r) => r.status === "PENDING" || r.status === "IN_PROGRESS")
      .slice(0, 4);
  }, [filteredRequests]);

  const refreshAnalytics = () => {
    api<any>("/api/analytics")
      .then((a) => setAnalytics(a))
      .catch((err) => console.error("Failed to refresh analytics:", err));
  };

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
            ["learning center", BookOpen],
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
              {/* Metrics Grid */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Metric 
                  label="Active Disasters" 
                  value={filteredDisasters.length} 
                  icon={ShieldAlert}
                  color="bg-red-500/10 text-red-600 dark:text-red-400"
                  trend="Priority-tracked"
                  indicatorColor="bg-red-500"
                />
                <Metric 
                  label="Available Resources" 
                  value={filteredResources.reduce((s, r) => s + r.quantity, 0)} 
                  icon={Boxes}
                  color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  trend="In supply"
                  indicatorColor="bg-blue-500"
                />
                <Metric 
                  label="Shelter Occupancy" 
                  value={search ? `${filteredShelters.reduce((s, sh) => s + sh.occupiedBeds, 0)}/${filteredShelters.reduce((s, sh) => s + sh.capacity, 0)}` : (analytics?.shelterOccupancy ? `${analytics.shelterOccupancy.occupied}/${analytics.shelterOccupancy.capacity}` : `${shelters.reduce((s, sh) => s + sh.occupiedBeds, 0)}/${shelters.reduce((s, sh) => s + sh.capacity, 0)}`)} 
                  icon={Home}
                  color="bg-green-500/10 text-green-600 dark:text-green-400"
                  trend="Live occupancy"
                  indicatorColor="bg-green-500"
                />
                <Metric 
                  label="Open Requests" 
                  value={filteredRequests.filter((r) => r.status === "PENDING" || r.status === "IN_PROGRESS").length} 
                  icon={HandHeart}
                  color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  trend="Critical priority"
                  indicatorColor="bg-amber-500"
                />
                <Metric 
                  label="Volunteers" 
                  value={filteredVolunteers.length} 
                  icon={Users}
                  color="bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  trend="Ready deployment"
                  indicatorColor="bg-purple-500"
                />
              </div>

              {/* Row 2: Map & Resource Inventory */}
              <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                <Card className="flex flex-col">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-lg">GIS Operations Map</h2>
                      <p className="text-xs text-foreground/50">Real-time incident and resource locations</p>
                    </div>
                    <Badge className="bg-primary/10 text-primary">Live GIS</Badge>
                  </div>
                  <div className="flex-1 min-h-[420px] rounded-lg overflow-hidden border border-border">
                    <OperationsMap disasters={filteredDisasters} shelters={filteredShelters} requests={filteredRequests.filter((r) => r.status === "PENDING" || r.status === "IN_PROGRESS").map((r) => ({ ...r, title: r.requestType }))} />
                  </div>
                </Card>

                <Card className="flex flex-col">
                  <div className="mb-3">
                    <h2 className="font-semibold text-lg">Resource Inventory</h2>
                    <p className="text-xs text-foreground/50">Quantity distribution across active categories</p>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={380}>
                      <BarChart data={resourceChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="resourceColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0f9aa6" stopOpacity={0.9}/>
                            <stop offset="95%" stopColor="#0f9aa6" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="rgba(128,128,128,0.5)" />
                        <YAxis tick={{ fontSize: 11 }} stroke="rgba(128,128,128,0.5)" />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="quantity" fill="url(#resourceColor)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {/* Row 3: Shelter Breakdown and System Occupancy */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="flex flex-col">
                  <div className="mb-3">
                    <h2 className="font-semibold text-lg">Shelter Capacities</h2>
                    <p className="text-xs text-foreground/50">Occupied vs Available beds per shelter</p>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={shelterBarChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="occupiedColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.4}/>
                          </linearGradient>
                          <linearGradient id="availableColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.4}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,128,0.15)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="rgba(128,128,128,0.5)" />
                        <YAxis tick={{ fontSize: 11 }} stroke="rgba(128,128,128,0.5)" />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="Occupied" stackId="a" fill="url(#occupiedColor)" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Available" stackId="a" fill="url(#availableColor)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="flex flex-col">
                  <div className="mb-3">
                    <h2 className="font-semibold text-lg">System Bed Occupancy</h2>
                    <p className="text-xs text-foreground/50">Overall bed capacity utilization across all shelters</p>
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1.2fr_0.8fr] items-center gap-4">
                    <div className="relative h-[220px] flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie 
                            data={systemShelterDonutData.data} 
                            cx="50%" 
                            cy="50%" 
                            innerRadius={70} 
                            outerRadius={90} 
                            paddingAngle={2} 
                            dataKey="value"
                          >
                            {systemShelterDonutData.data.map((entry, idx) => (
                              <Cell key={idx} fill={idx === 0 ? "#0f9aa6" : "rgba(128,128,128,0.15)"} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-extrabold text-foreground">{systemShelterDonutData.percentage}%</span>
                        <span className="text-xs text-foreground/50 font-medium">Beds Filled</span>
                      </div>
                    </div>
                    <div className="space-y-3 px-2">
                      <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-xs text-foreground/50 font-medium">Total Capacity</p>
                        <p className="text-2xl font-bold mt-0.5">{systemShelterDonutData.totalCapacity} Beds</p>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-foreground/75 text-xs">
                            <span className="h-3 w-3 rounded bg-primary" />
                            Occupied Beds
                          </span>
                          <span className="font-semibold text-xs">{systemShelterDonutData.totalOccupied}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-foreground/75 text-xs">
                            <span className="h-3 w-3 rounded bg-border" />
                            Available Beds
                          </span>
                          <span className="font-semibold text-xs">{systemShelterDonutData.totalCapacity - systemShelterDonutData.totalOccupied}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Row 4: Recent Activity Command Logs */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="flex flex-col">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-lg">Recent Disasters</h2>
                      <p className="text-xs text-foreground/50">Latest reported incident areas</p>
                    </div>
                    <Button onClick={() => setTab("disasters")} className="h-8 text-xs font-semibold px-3 bg-muted text-foreground hover:bg-muted/80">View All</Button>
                  </div>
                  <div className="flex-1 space-y-3">
                    {recentDisasters.length === 0 ? (
                      <div className="py-8 text-center text-foreground/40 text-sm">No recent incidents reported</div>
                    ) : (
                      recentDisasters.map((d) => (
                        <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/10 p-3 hover:bg-muted/20 transition-all duration-200">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-10 w-10 rounded-lg flex items-center justify-center font-bold text-xs border",
                              d.severity === "CRITICAL" ? "bg-red-500/10 text-red-600 border-red-500/20" :
                              d.severity === "HIGH" ? "bg-orange-500/10 text-orange-600 border-orange-500/20" :
                              "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                            )}>
                              {d.severity.slice(0, 3)}
                            </div>
                            <div>
                              <p className="font-semibold text-sm line-clamp-1">{d.title}</p>
                              <p className="text-xs text-foreground/50 flex items-center gap-1.5 mt-0.5">
                                <span>{d.type}</span>
                                <span>•</span>
                                <span className="line-clamp-1">{d.location}</span>
                              </p>
                            </div>
                          </div>
                          <Badge className={
                            d.status === "ACTIVE" ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                            d.status === "MONITORING" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" :
                            "bg-green-500/10 text-green-600 dark:text-green-400"
                          }>
                            {d.status.toLowerCase()}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </Card>

                <Card className="flex flex-col">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-lg">Active Help Requests</h2>
                      <p className="text-xs text-foreground/50">Latest pending assistance calls</p>
                    </div>
                    <Button onClick={() => setTab("requests")} className="h-8 text-xs font-semibold px-3 bg-muted text-foreground hover:bg-muted/80">View All</Button>
                  </div>
                  <div className="flex-1 space-y-3">
                    {recentRequests.length === 0 ? (
                      <div className="py-8 text-center text-foreground/40 text-sm">No pending help requests</div>
                    ) : (
                      recentRequests.map((r) => (
                        <div key={r.id} className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/10 p-3 hover:bg-muted/20 transition-all duration-200">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{r.requestType}</p>
                              <Badge className={
                                r.priority === "CRITICAL" ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                                r.priority === "HIGH" ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" :
                                "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              }>
                                {r.priority.toLowerCase()}
                              </Badge>
                            </div>
                            <p className="text-xs text-foreground/60 line-clamp-1 mt-1">{r.description}</p>
                          </div>
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            {r.status.replace("_", " ").toLowerCase()}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}

          {tab === "disasters" && <DisasterPanel disasters={filteredDisasters} user={user} onCreated={(newDisaster) => { setDisasters((prev) => [newDisaster, ...prev]); refreshAnalytics(); }} />}
          {tab === "requests" && (
            <RequestPanel
              requests={filteredRequests}
              user={user}
              onCreated={(request) => { setRequests((items) => [request, ...items]); refreshAnalytics(); }}
              onStatusChanged={(id, newStatus) => { setRequests((items) => items.map((item) => item.id === id ? { ...item, status: newStatus } : item)); refreshAnalytics(); }}
            />
          )}
          {tab === "resources" && <ResourcePanel resources={filteredResources} user={user} onCreated={(newRes) => { setResources((prev) => [newRes, ...prev]); refreshAnalytics(); }} />}
          {tab === "shelters" && <ShelterPanel shelters={filteredShelters} user={user} onCreated={(newShelter) => { setShelters((prev) => [newShelter, ...prev]); refreshAnalytics(); }} />}
          {tab === "volunteers" && (
            <div className="space-y-6">
              {user?.role.name === "AFFECTED_INDIVIDUAL" && (
                <Card className="relative overflow-hidden border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-2 max-w-2xl">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">
                        <HandHeart size={14} className="stroke-[2.5]" /> Community Support
                      </div>
                      <h3 className="text-xl font-bold text-foreground">Make a Difference in Your Community</h3>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        Every helper counts when coordinating relief operations. If you are safe and able, joining our volunteer network allows you to help distribute food, update shelter beds, coordinate logistics, or provide direct support to those in need. Even small acts of coordination save lives when minutes matter.
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      <div className="rounded-full bg-primary/10 p-3 text-primary">
                        <HandHeart size={32} className="animate-pulse stroke-[1.5]" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-3 text-xs text-foreground/60">
                    <span>Interested? Speak with any active Administrator or NGO Coordinator to enroll your skills.</span>
                    <span className="font-semibold text-primary">Together, we coordinate relief.</span>
                  </div>
                </Card>
              )}
              <Table 
                title="Volunteers" 
                rows={filteredVolunteers.map((v) => ({ 
                  name: v.user?.name ?? "Volunteer", 
                  skills: v.skills.join(", "), 
                  availability: v.availability ? "Available" : "Busy" 
                }))} 
                columns={["name", "skills", "availability"]} 
              />
            </div>
          )}
          {tab === "learning center" && <LearningCenter />}
          {tab === "notifications" && <NotificationCenter user={user} />}
        </div>
        <ChatWidget />
      </section>
    </main>
  );
}

function Metric({ label, value, icon: Icon, color, trend, indicatorColor }: { label: string; value: string | number; icon?: any; color?: string; trend?: string; indicatorColor?: string }) {
  return (
    <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground/50">{label}</p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight">{value}</h3>
          {trend && (
            <p className="mt-1.5 text-[11px] text-foreground/45 flex items-center gap-1">
              <span className="text-green-600 dark:text-green-400 font-semibold">✓</span> {trend}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("rounded-lg p-2.5 flex items-center justify-center", color || "bg-primary/10 text-primary")}>
            <Icon size={20} className="stroke-[2.5]" />
          </div>
        )}
      </div>
      <div className={cn("absolute bottom-0 left-0 h-1 w-full opacity-60", indicatorColor || "bg-primary")} />
    </Card>
  );
}

function Table({ title, rows, columns, onAdd, onRowClick }: { title: string; rows: any[]; columns: string[]; onAdd?: () => void; onRowClick?: (row: any) => void }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {onAdd && <Button className="gap-2" onClick={onAdd}><Plus size={16} /> Add</Button>}
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead><tr>{columns.map((c) => <th key={c} className="border-b border-border p-3 text-left capitalize">{c === "imageUrl" ? "Photo" : c}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr 
                key={row.id ?? i} 
                className={cn("hover:bg-muted/80 transition-colors duration-150", onRowClick && "cursor-pointer")}
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((c) => {
                  const val = row[c];
                  return (
                    <td key={c} className="border-b border-border p-3">
                      {c === "imageUrl" ? (
                        val ? (
                          <img src={`${API_URL}${val}`} alt="Incident" className="h-10 w-10 rounded object-cover border border-border" />
                        ) : (
                          <span className="text-xs text-foreground/45 font-medium">No Photo</span>
                        )
                      ) : c === "status" ? (
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider",
                          val === "AVAILABLE" || val === "ACTIVE" || val === "RESOLVED" || val === "CONTAINED" ? "bg-green-500/10 text-green-700 dark:text-green-400" :
                          val === "LOW_STOCK" || val === "MONITORING" || val === "IN_PROGRESS" || val === "ASSIGNED" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                          "bg-red-500/10 text-red-700 dark:text-red-400"
                        )}>
                          {String(val ?? "").replace(/_/g, " ").toLowerCase()}
                        </span>
                      ) : c === "severity" || c === "priority" ? (
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider",
                          val === "CRITICAL" ? "bg-red-500/10 text-red-700 dark:text-red-400" :
                          val === "HIGH" ? "bg-orange-500/10 text-orange-700 dark:text-orange-400" :
                          val === "MEDIUM" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                          "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                        )}>
                          {String(val ?? "").toLowerCase()}
                        </span>
                      ) : c === "capacity" || c === "quantity" || c === "occupiedBeds" ? (
                        <span className="font-semibold text-foreground/90">{val}</span>
                      ) : (
                        <span className="text-foreground/80">{String(val ?? "")}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ResourcePanel({ resources, user, onCreated }: { resources: Resource[]; user: CurrentUser | null; onCreated: (resource: Resource) => void }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Water");
  const [customCategory, setCustomCategory] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [location, setLocation] = useState("");
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState("AVAILABLE");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const canAdd = user && ["ADMIN", "AUTHORITY", "NGO_COORDINATOR", "VOLUNTEER"].includes(user.role.name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const finalCategory = category === "Other" ? customCategory : category;
      if (!finalCategory.trim()) {
        throw new Error("Category is required");
      }

      const created = await api<Resource>("/api/resources", {
        method: "POST",
        body: JSON.stringify({
          name,
          category: finalCategory,
          quantity: Number(quantity),
          location,
          provider,
          status,
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined,
        }),
      });

      onCreated(created);
      setName("");
      setCategory("Water");
      setCustomCategory("");
      setQuantity(0);
      setLocation("");
      setProvider("");
      setStatus("AVAILABLE");
      setLatitude("");
      setLongitude("");
      setShowAddForm(false);
      setMessage("");
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || "Could not add resource. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {showAddForm && (
        <Card className="border-primary/20 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-primary">Add New Relief Resource</h2>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Resource Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Drinking Water Cans, First Aid Kits"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Provider / Organization *</label>
                <Input
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="e.g., Red Cross, Rapid Relief Foundation"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Category *</label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="Water">Water</option>
                  <option value="Medicine">Medicine</option>
                  <option value="Food">Food</option>
                  <option value="Shelter">Shelter</option>
                  <option value="Blankets">Blankets</option>
                  <option value="Rescue Equipment">Rescue Equipment</option>
                  <option value="Evacuation Support">Evacuation Support</option>
                  <option value="Medical Assistance">Medical Assistance</option>
                  <option value="Other">Other (Custom)</option>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Quantity *</label>
                <Input
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Status</label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="RESERVED">RESERVED</option>
                  <option value="ALLOCATED">ALLOCATED</option>
                  <option value="EXPIRED">EXPIRED</option>
                </Select>
              </div>
            </div>

            {category === "Other" && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-xs font-semibold text-foreground/70">Custom Category Name *</label>
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Enter custom category"
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/70">Storage / Drop-off Location *</label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Jalandhar Relief Warehouse"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Latitude (Optional)</label>
                <Input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="e.g., 31.3959"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Longitude (Optional)</label>
                <Input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="e.g., 75.5350"
                />
              </div>
            </div>

            {message && (
              <p className="text-sm font-medium text-red-500 bg-red-500/10 p-2.5 rounded border border-red-500/20">
                {message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                className="bg-muted text-foreground hover:bg-muted/80"
                onClick={() => {
                  setShowAddForm(false);
                  setMessage("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding..." : "Add Resource"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Table
        title="Resources"
        rows={resources}
        columns={["name", "category", "quantity", "status", "location"]}
        onAdd={canAdd ? () => setShowAddForm(true) : undefined}
        onRowClick={(row) => setSelectedResource(row)}
      />

      {selectedResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg border-primary/20 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <button 
              type="button" 
              onClick={() => setSelectedResource(null)} 
              className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-muted text-foreground/75 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="space-y-4">
              <div>
                <Badge className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-full",
                  selectedResource.status === "AVAILABLE" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                  selectedResource.status === "LOW_STOCK" ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" :
                  "bg-red-500/10 text-red-600 dark:text-red-400"
                )}>
                  {selectedResource.status}
                </Badge>
                <h3 className="mt-2 text-xl font-bold leading-tight">{selectedResource.name}</h3>
                <p className="text-xs text-foreground/50 mt-1">
                  Category: <span className="font-semibold capitalize">{selectedResource.category.toLowerCase().replace(/_/g, " ")}</span>
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/10 p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-foreground/50 font-medium">Quantity Available</p>
                  <p className="text-2xl font-bold mt-0.5">{selectedResource.quantity} Units</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-foreground/50 font-medium">Provider / Donor</p>
                  <p className="font-semibold mt-0.5">{selectedResource.provider || "Not specified"}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Distribution Location</h4>
                <p className="text-sm text-foreground/85 leading-relaxed bg-muted/30 p-3 rounded-md border border-border/50">
                  {selectedResource.location}
                </p>
              </div>

              {selectedResource.latitude && selectedResource.longitude && (
                <div className="rounded-lg border border-border bg-muted/10 p-2.5 text-xs">
                  <p className="text-foreground/50 font-medium">Coordinates</p>
                  <p className="font-semibold text-sm mt-0.5">{selectedResource.latitude.toFixed(4)}, {selectedResource.longitude.toFixed(4)}</p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={() => setSelectedResource(null)} className="px-5">
                  Close Details
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function ShelterPanel({ shelters, user, onCreated }: { shelters: Shelter[]; user: CurrentUser | null; onCreated: (shelter: Shelter) => void }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState<number>(0);
  const [occupiedBeds, setOccupiedBeds] = useState<number>(0);
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);

  const canAdd = user && ["ADMIN", "AUTHORITY", "NGO_COORDINATOR"].includes(user.role.name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      if (!name.trim() || !address.trim() || !contactPerson.trim() || !latitude || !longitude) {
        throw new Error("Please fill in all required fields.");
      }

      const created = await api<Shelter>("/api/shelters", {
        method: "POST",
        body: JSON.stringify({
          name,
          address,
          capacity: Number(capacity),
          occupiedBeds: Number(occupiedBeds),
          contactPerson,
          phone: phone || undefined,
          latitude: Number(latitude),
          longitude: Number(longitude)
        })
      });

      onCreated(created);
      setName("");
      setAddress("");
      setCapacity(0);
      setOccupiedBeds(0);
      setContactPerson("");
      setPhone("");
      setLatitude("");
      setLongitude("");
      setShowAddForm(false);
      setMessage("");
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || "Could not add shelter. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {showAddForm && (
        <Card className="border-primary/20 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-primary">Add New Relief Shelter</h2>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Shelter Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., NIT Jalandhar Campus Shelter"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Address *</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g., Campus GT Road, Jalandhar"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Contact Person *</label>
                <Input
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g., Asha Mehta"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Phone Number (Optional)</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., +911812345678"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Total Capacity (Beds) *</label>
                <Input
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Occupied Beds</label>
                <Input
                  type="number"
                  min="0"
                  value={occupiedBeds}
                  onChange={(e) => setOccupiedBeds(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Latitude *</label>
                <Input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="e.g., 31.3959"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Longitude *</label>
                <Input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="e.g., 75.5350"
                  required
                />
              </div>
            </div>

            {message && (
              <p className="text-sm font-medium text-red-500 bg-red-500/10 p-2.5 rounded border border-red-500/20">
                {message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                className="bg-muted text-foreground hover:bg-muted/80"
                onClick={() => {
                  setShowAddForm(false);
                  setMessage("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Adding..." : "Add Shelter"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Table
        title="Shelters"
        rows={shelters}
        columns={["name", "capacity", "occupiedBeds", "address"]}
        onAdd={canAdd ? () => setShowAddForm(true) : undefined}
        onRowClick={(row) => setSelectedShelter(row)}
      />

      {selectedShelter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg border-primary/20 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <button 
              type="button" 
              onClick={() => setSelectedShelter(null)} 
              className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-muted text-foreground/75 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="space-y-4">
              <div>
                <Badge className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-full",
                  (selectedShelter.occupiedBeds / selectedShelter.capacity) >= 0.9 ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                  (selectedShelter.occupiedBeds / selectedShelter.capacity) >= 0.7 ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" :
                  "bg-green-500/10 text-green-600 dark:text-green-400"
                )}>
                  {Math.round((selectedShelter.occupiedBeds / selectedShelter.capacity) * 100)}% Beds Filled
                </Badge>
                <h3 className="mt-2 text-xl font-bold leading-tight">{selectedShelter.name}</h3>
                <p className="text-xs text-foreground/50 mt-1">
                  Address: <span className="font-semibold">{selectedShelter.address}</span>
                </p>
              </div>

              {/* Occupancy Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-foreground/60">Occupancy Detail</span>
                  <span>{selectedShelter.occupiedBeds} / {selectedShelter.capacity} Beds occupied</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      (selectedShelter.occupiedBeds / selectedShelter.capacity) >= 0.9 ? "bg-red-500" :
                      (selectedShelter.occupiedBeds / selectedShelter.capacity) >= 0.7 ? "bg-amber-500" :
                      "bg-emerald-500"
                    )}
                    style={{ width: `${Math.min(100, (selectedShelter.occupiedBeds / selectedShelter.capacity) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/10 p-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-foreground/50 font-medium">Contact Person</p>
                  <p className="font-semibold mt-0.5">{selectedShelter.contactPerson || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-xs text-foreground/50 font-medium">Phone Number</p>
                  <p className="font-semibold mt-0.5">{selectedShelter.phone || "Not specified"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="rounded-lg border border-border bg-muted/10 p-2.5">
                  <p className="text-foreground/50 font-medium">Available Beds</p>
                  <p className="font-semibold text-sm mt-0.5">{Math.max(0, selectedShelter.capacity - selectedShelter.occupiedBeds)} Beds</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/10 p-2.5">
                  <p className="text-foreground/50 font-medium">GPS Location</p>
                  <p className="font-semibold text-sm mt-0.5">{selectedShelter.latitude.toFixed(4)}, {selectedShelter.longitude.toFixed(4)}</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => setSelectedShelter(null)} className="px-5">
                  Close Details
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function DisasterPanel({ disasters, user, onCreated }: { disasters: Disaster[]; user: CurrentUser | null; onCreated: (disaster: Disaster) => void }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("FLOOD");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [status, setStatus] = useState("ACTIVE");
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedDisaster, setSelectedDisaster] = useState<Disaster | null>(null);

  const canAdd = user && ["ADMIN", "AUTHORITY", "NGO_COORDINATOR"].includes(user.role.name);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      if (!title.trim() || !description.trim() || !location.trim() || !latitude || !longitude || !startDate) {
        throw new Error("Please fill in all required fields.");
      }

      const created = await api<Disaster>("/api/disasters", {
        method: "POST",
        body: JSON.stringify({
          title,
          type,
          description,
          location,
          latitude: Number(latitude),
          longitude: Number(longitude),
          severity,
          startDate: new Date(startDate).toISOString(),
          status,
          imageUrl: photo || undefined
        })
      });

      onCreated(created);
      setTitle("");
      setType("FLOOD");
      setDescription("");
      setLocation("");
      setLatitude("");
      setLongitude("");
      setSeverity("MEDIUM");
      setStartDate(new Date().toISOString().split("T")[0]);
      setStatus("ACTIVE");
      setPhoto(null);
      setShowAddForm(false);
      setMessage("");
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || "Could not report disaster. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {showAddForm && (
        <Card className="border-primary/20 shadow-md">
          <h2 className="mb-4 text-lg font-semibold text-primary">Report New Disaster Event</h2>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Disaster Title *</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Heavy Rainfall Urban Flood Alert"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Incident Location *</label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Jalandhar, Punjab"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Disaster Type *</label>
                <Select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="FLOOD">FLOOD</option>
                  <option value="EARTHQUAKE">EARTHQUAKE</option>
                  <option value="FIRE">FIRE</option>
                  <option value="PANDEMIC">PANDEMIC</option>
                  <option value="CYCLONE">CYCLONE</option>
                  <option value="LANDSLIDE">LANDSLIDE</option>
                  <option value="OTHER">OTHER</option>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Severity Level *</label>
                <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Initial Status</label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="MONITORING">MONITORING</option>
                  <option value="CONTAINED">CONTAINED</option>
                  <option value="RESOLVED">RESOLVED</option>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Start Date *</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Latitude *</label>
                <Input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="e.g., 31.3260"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Longitude *</label>
                <Input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="e.g., 75.5762"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr] items-end">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Disaster Description & Details *</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide details about the coordination needs..."
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Attach Banner Photo (Optional)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-foreground/60 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                  {photo && (
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-border">
                      <img src={photo} alt="Preview" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setPhoto(null)} className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-bold text-xs opacity-0 hover:opacity-100 transition-opacity">X</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {message && (
              <p className="text-sm font-medium text-red-500 bg-red-500/10 p-2.5 rounded border border-red-500/20">
                {message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                className="bg-muted text-foreground hover:bg-muted/80"
                onClick={() => {
                  setShowAddForm(false);
                  setPhoto(null);
                  setMessage("");
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Reporting..." : "Report Disaster"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Table
        title="Disaster Management"
        rows={disasters}
        columns={["title", "type", "severity", "status", "location", "imageUrl"]}
        onAdd={canAdd ? () => setShowAddForm(true) : undefined}
        onRowClick={(row) => setSelectedDisaster(row)}
      />

      {selectedDisaster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-lg border-primary/20 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            <button 
              type="button" 
              onClick={() => setSelectedDisaster(null)} 
              className="absolute right-4 top-4 rounded-full p-1.5 hover:bg-muted text-foreground/75 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <div className="space-y-4">
              <div>
                <Badge className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-full",
                  selectedDisaster.severity === "CRITICAL" ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                  selectedDisaster.severity === "HIGH" ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" :
                  "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                )}>
                  {selectedDisaster.severity} Severity
                </Badge>
                <h3 className="mt-2 text-xl font-bold leading-tight">{selectedDisaster.title}</h3>
                <p className="text-xs text-foreground/50 mt-1 flex items-center gap-1.5">
                  <span className="capitalize">{selectedDisaster.type.toLowerCase()}</span>
                  <span>•</span>
                  <span>{selectedDisaster.location}</span>
                </p>
              </div>

              {selectedDisaster.imageUrl && (
                <div className="h-48 w-full overflow-hidden rounded-lg border border-border">
                  <img src={`${API_URL}${selectedDisaster.imageUrl}`} alt={selectedDisaster.title} className="h-full w-full object-cover" />
                </div>
              )}

              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/60">Description & Details</h4>
                <p className="text-sm text-foreground/85 leading-relaxed bg-muted/30 p-3 rounded-md border border-border/50 whitespace-pre-wrap">
                  {selectedDisaster.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                <div className="rounded-lg border border-border bg-muted/10 p-2.5">
                  <p className="text-foreground/50 font-medium">Status</p>
                  <p className="font-semibold text-sm mt-0.5 capitalize">{selectedDisaster.status.toLowerCase()}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/10 p-2.5">
                  <p className="text-foreground/50 font-medium">Coordinates</p>
                  <p className="font-semibold text-sm mt-0.5">{selectedDisaster.latitude.toFixed(4)}, {selectedDisaster.longitude.toFixed(4)}</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => setSelectedDisaster(null)} className="px-5">
                  Close Details
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function RequestPanel({
  requests,
  user,
  onCreated,
  onStatusChanged
}: {
  requests: Request[];
  user: CurrentUser | null;
  onCreated: (request: Request) => void;
  onStatusChanged: (id: string, status: string) => void;
}) {
  const [requestType, setRequestType] = useState("Food");
  const [priority, setPriority] = useState("MEDIUM");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const visibleRequests = requests.filter((r) => r.status === "PENDING" || r.status === "IN_PROGRESS");

  const canUpdateStatus = user && ["ADMIN", "AUTHORITY", "NGO_COORDINATOR", "VOLUNTEER"].includes(user.role.name);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

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
          longitude: 75.5350,
          imageUrl: photo || undefined
        })
      });
      onCreated(created);
      setDescription("");
      setPhoto(null);
      setMessage("Request submitted successfully.");
    } catch {
      setMessage("Could not submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      await api(`/api/requests/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });
      onStatusChanged(id, newStatus);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to update request status.");
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
          
          <div className="lg:col-span-3 space-y-1">
            <label className="text-xs font-semibold text-foreground/70">Attach Incident Photo (Optional)</label>
            <div className="flex items-center gap-3">
              <input
                 type="file"
                 accept="image/*"
                 onChange={handleFileChange}
                 className="block w-full text-xs text-foreground/60 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
              {photo && (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-border">
                  <img src={photo} alt="Preview" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setPhoto(null)} className="absolute inset-0 flex items-center justify-center bg-black/50 text-white font-bold text-xs opacity-0 hover:opacity-100 transition-opacity">X</button>
                </div>
              )}
            </div>
          </div>

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
        {visibleRequests.length === 0 && (
          <Card>
            <p className="text-sm text-foreground/70">No requests submitted yet.</p>
          </Card>
        )}
        {visibleRequests.map((r) => (
          <Card key={r.id} className="flex flex-col justify-between">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">{r.requestType}</h3>
                <Badge>{r.priority}</Badge>
              </div>
              {r.imageUrl && (
                <div className="mb-3 overflow-hidden rounded-md border border-border bg-muted">
                  <img src={`${API_URL}${r.imageUrl}`} alt="Incident Photo" className="h-40 w-full object-cover" />
                </div>
              )}
              <p className="text-sm text-foreground/70 mb-2">{r.description}</p>
              <p className="text-xs text-foreground/50 mb-4">Requested by: {r.user?.name || "Citizen"}</p>
            </div>
            <Select 
              value={r.status} 
              disabled={!canUpdateStatus} 
              onChange={(e) => handleStatusChange(r.id, e.target.value)}
            >
              <option value="PENDING">PENDING</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CANCELLED">CANCELLED</option>
            </Select>
          </Card>
        ))}
      </div>
    </div>
  );
}
interface Notification {
  id: string;
  userId: string | null;
  title: string;
  message: string;
  channel: string;
  createdAt: string;
  readAt: string | null;
}

function NotificationCenter({ user }: { user: CurrentUser | null }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetType, setTargetType] = useState<"ROLE" | "USER">("ROLE");
  const [targetRole, setTargetRole] = useState<"AFFECTED_INDIVIDUAL" | "VOLUNTEER">("AFFECTED_INDIVIDUAL");
  const [targetUserId, setTargetUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });

  const isSender = user && ["ADMIN", "NGO_COORDINATOR", "AUTHORITY"].includes(user.role.name);

  useEffect(() => {
    if (isSender) {
      api<ApiList<any>>("/api/users/recipients")
        .then((res) => {
          setRecipients(res.data);
          if (res.data.length > 0) {
            setTargetUserId(res.data[0].id);
          }
        })
        .catch((err) => console.error("Failed to fetch recipients:", err));
    } else {
      fetchNotifications();
    }
  }, [user, isSender]);

  const fetchNotifications = () => {
    setLoading(true);
    api<ApiList<Notification>>("/api/notifications")
      .then((res) => setNotifications(res.data))
      .catch((err) => console.error("Failed to load notifications:", err))
      .finally(() => setLoading(false));
  };

  const showToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSubmitting(true);

    try {
      await api("/api/notifications/send", {
        method: "POST",
        body: JSON.stringify({
          title,
          message,
          targetType,
          targetRole: targetType === "ROLE" ? targetRole : undefined,
          targetUserId: targetType === "USER" ? targetUserId : undefined
        })
      });

      setTitle("");
      setMessage("");
      showToast("Message sent");
    } catch (err: any) {
      console.error(err);
      alert("Failed to send message: " + (err.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkAsSeen(id: string) {
    try {
      await api(`/api/notifications/${id}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      showToast("Notification cleared");
    } catch (err: any) {
      console.error(err);
      alert("Failed to clear notification.");
    }
  }

  const filteredRecipients = recipients.filter((r) => r.role.name === targetRole);

  useEffect(() => {
    if (targetType === "USER" && filteredRecipients.length > 0) {
      const match = filteredRecipients.find((r) => r.id === targetUserId);
      if (!match) {
        setTargetUserId(filteredRecipients[0].id);
      }
    }
  }, [targetRole, targetType]);

  if (isSender) {
    return (
      <div className="relative space-y-6 max-w-2xl mx-auto">
        {toast.show && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-2xl transition-all duration-300 animate-in slide-in-from-top-4 fade-in">
            <Check size={18} className="shrink-0" />
            <span>{toast.message}</span>
          </div>
        )}

        <Card className="p-6 border border-border/80 bg-background/50 backdrop-blur-md shadow-xl rounded-2xl">
          <div className="flex items-center gap-3 border-b border-border/60 pb-4 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Send size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wide text-foreground">Relief Dispatch Center</h2>
              <p className="text-xs text-foreground/60">Send alerts and system notifications to responders or affected individuals.</p>
            </div>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Recipient Target Type</label>
                <Select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as any)}
                  className="w-full bg-background"
                >
                  <option value="ROLE">Broadcast by Role Group</option>
                  <option value="USER">Direct Message to User</option>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/70">Target Role</label>
                <Select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as any)}
                  className="w-full bg-background"
                >
                  <option value="AFFECTED_INDIVIDUAL">Affected Individuals</option>
                  <option value="VOLUNTEER">Volunteers</option>
                </Select>
              </div>
            </div>

            {targetType === "USER" && (
              <div className="space-y-1 animate-in fade-in duration-200">
                <label className="text-xs font-semibold text-foreground/70">Select Recipient User</label>
                <Select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full bg-background"
                >
                  {filteredRecipients.length === 0 ? (
                    <option value="" disabled>No users registered under this role</option>
                  ) : (
                    filteredRecipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.email})
                      </option>
                    ))
                  )}
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/70">Message Subject / Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Evacuation Advisory or Volunteer Check-in"
                required
                className="w-full bg-background"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/70">Message Description & Instructions</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your emergency instructions or dispatch description..."
                required
                rows={5}
                className="w-full bg-background"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={submitting || (targetType === "USER" && !targetUserId)} className="w-full sm:w-auto gap-2 shadow-lg hover:shadow-primary/20">
                <Send size={16} />
                {submitting ? "Sending message..." : "Send Message"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative space-y-6 max-w-4xl mx-auto">
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-2xl transition-all duration-300 animate-in slide-in-from-top-4 fade-in">
          <Check size={18} className="shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
        <div>
          <h2 className="text-xl font-bold tracking-wide text-foreground">Relief Notifications</h2>
          <p className="text-sm text-foreground/60">Important alert logs, evacuation plans, and messages from relief coordinators.</p>
        </div>
        <Button onClick={fetchNotifications} className="bg-muted text-foreground hover:bg-muted/80 gap-1.5 text-xs py-1.5 px-3">
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-foreground/60 font-medium">Fetching notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2 border-border/80 bg-background/30 rounded-2xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-foreground/40 mb-4 animate-bounce duration-1000">
            <Inbox size={32} />
          </div>
          <h3 className="text-lg font-bold tracking-wide text-foreground">All Caught Up!</h3>
          <p className="text-sm text-foreground/60 mt-1 max-w-xs">You have no active emergency notifications or coordinator messages in your section.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {notifications.map((n) => (
            <Card key={n.id} className="flex flex-col justify-between p-5 border border-border/70 bg-card shadow-md rounded-2xl hover:shadow-lg hover:border-primary/20 transition-all duration-300 group">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping"></span>
                    <h3 className="font-bold text-foreground text-sm tracking-wide leading-snug">{n.title}</h3>
                  </div>
                  <span className="text-[10px] text-foreground/40 font-semibold shrink-0">
                    {new Date(n.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-foreground/75 whitespace-pre-wrap">{n.message}</p>
              </div>
              <div className="mt-5 pt-3 border-t border-border/40 flex justify-end">
                <Button
                  onClick={() => handleMarkAsSeen(n.id)}
                  className="bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all duration-300 py-1.5 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Check size={14} />
                  Mark as Seen
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { sender: "bot", text: "Hello! I am your DRRCS Relief Assistant. Ask me anything about active disasters, available resources, shelter occupancy, or volunteer status. Please type 'help' first to see what I can do and start our conversation!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { sender: "user", text: userMessage }]);
    setLoading(true);

    try {
      const data = await api<{ response: string }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message: userMessage })
      });
      setMessages((prev) => [...prev, { sender: "bot", text: data.response }]);
    } catch {
      setMessages((prev) => [...prev, { sender: "bot", text: "Sorry, I could not reach the chat service. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Action Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:scale-105 hover:bg-primary/90 focus:outline-none"
        aria-label="Chat with Assistant"
      >
        <MessageSquare size={24} className={open ? "hidden" : "block"} />
        <X size={24} className={open ? "block" : "hidden"} />
      </button>

      {/* Chat Box */}
      {open && (
        <Card className="absolute bottom-16 right-0 w-[360px] sm:w-[400px] h-[500px] flex flex-col border border-border bg-background/95 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300 rounded-xl overflow-hidden p-0">
          {/* Header */}
          <div className="flex items-center justify-between bg-primary p-4 text-white">
            <div className="flex items-center gap-2">
              <MessageSquare size={20} />
              <div>
                <h3 className="font-semibold text-sm">DRRCS Relief Assistant</h3>
                <div className="flex items-center gap-1.5 text-[11px] text-white/80 font-normal">
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                  AI Operator Online
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3.5 py-2 text-sm whitespace-pre-line shadow-sm leading-relaxed ${
                    m.sender === "user"
                      ? "bg-primary text-white rounded-br-none"
                      : "bg-background text-foreground border border-border rounded-bl-none"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-background border border-border text-foreground max-w-[85%] rounded-lg rounded-bl-none px-3.5 py-2.5 text-sm shadow-sm flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className="p-3 border-t border-border bg-background flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about disasters, shelters, resources..."
              className="flex-1"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()} className="h-10 px-4">
              Send
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}

function LearningCenter() {
  const [activeSubTab, setActiveSubTab] = useState<"all" | "flood" | "earthquake" | "fire" | "firstaid">("all");

  const topics = [
    {
      id: "flood",
      title: "Flood Safety & Evacuation Guide",
      category: "Flood Safety",
      color: "border-blue-500/30 text-blue-500 bg-blue-50/10",
      description: "Learn how to prepare, stay safe during a flood, and recover safely afterwards.",
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-teal-500 mb-2 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-400">1</span>
              Before a Flood (Preparation)
            </h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
              <li>Identify local evacuation routes and emergency shelter locations.</li>
              <li>Assemble a 72-hour emergency kit (water, non-perishable food, flashlight, first aid, batteries).</li>
              <li>Move valuables and critical electrical items to higher floors.</li>
              <li>Keep documents and papers in watertight containers.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-amber-500 mb-2 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-50/20 text-xs font-bold text-amber-400">2</span>
              During a Flood (Immediate Action)
            </h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
              <li><strong>Turn around, don't drown!</strong> Never walk, swim, or drive through floodwaters. Just 6 inches of moving water can knock you down, and 12 inches can sweep a vehicle away.</li>
              <li>If told to evacuate, do so immediately. Lock your home and turn off main power switches and gas valves.</li>
              <li>Move to higher ground or the highest floor of your building. Do not climb into a closed attic; go to the roof only if necessary.</li>
              <li>Monitor local radio, TV, or emergency alerts for instructions.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-green-500 mb-2 flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-50/20 text-xs font-bold text-green-400">3</span>
              After a Flood (Recovery & Safety)
            </h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
              <li>Return home only when local authorities declare it safe.</li>
              <li>Avoid standing water, as it may be contaminated with sewage or carry active electrical currents from downed lines.</li>
              <li>Do not use water that might be contaminated. Boil or filter water before drinking, cooking, or brushing teeth.</li>
              <li>Inspect your home for structural damage, mold, and gas leaks before entering.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "earthquake",
      title: "Earthquake Survival Guidelines",
      category: "Earthquake Safety",
      color: "border-orange-500/30 text-orange-500 bg-orange-50/10",
      description: "Critical safety measures to follow when the ground starts shaking.",
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-red-500 mb-2 flex items-center gap-1.5">Drop, Cover, and Hold On</h4>
            <div className="grid gap-3 sm:grid-cols-3 text-center mb-3">
              <div className="p-3 rounded-lg border border-border bg-muted/40">
                <p className="font-bold text-lg text-primary">1. DROP</p>
                <p className="text-xs text-foreground/70 mt-1">Drop onto your hands and knees. This position protects you from being knocked down.</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-muted/40">
                <p className="font-bold text-lg text-primary">2. COVER</p>
                <p className="text-xs text-foreground/70 mt-1">Cover your head and neck under a sturdy table or desk. If none is nearby, crawl to an interior wall.</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-muted/40">
                <p className="font-bold text-lg text-primary">3. HOLD ON</p>
                <p className="text-xs text-foreground/70 mt-1">Hold on to your shelter until the shaking stops. Be prepared to move with it if it shifts.</p>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-teal-500 mb-2 flex items-center gap-1.5">Where You Are Matters</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
              <li><strong>Indoors:</strong> Stay inside. Do not run outside or stand in doorways. Avoid windows, mirrors, hanging objects, and tall furniture.</li>
              <li><strong>Outdoors:</strong> Move to a clear, open area away from buildings, streetlights, utility wires, and bridges. Drop and cover your head.</li>
              <li><strong>In a Vehicle:</strong> Pull over safely to a clear area. Avoid stopping under bridges, overpasses, utility wires, or next to buildings. Stay inside the car.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-green-500 mb-2 flex items-center gap-1.5">After the Shaking Stops</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
              <li>Expect aftershocks. Each time you feel one, Drop, Cover, and Hold On.</li>
              <li>Check yourself and others for injuries. Administer basic first aid if necessary.</li>
              <li>Check your home for gas leaks or fire hazards. If you smell gas, turn off the main valve.</li>
              <li>Avoid elevators. Use stairs if you need to evacuate a building.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "fire",
      title: "Fire Safety & Evacuation Plan",
      category: "Fire Safety",
      color: "border-red-500/30 text-red-500 bg-red-50/10",
      description: "Prevent home fires and know how to escape quickly if a fire breaks out.",
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-red-500 mb-2 flex items-center gap-1.5">In Case of Fire: Escape Immediately</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
              <li><strong>Get low and crawl:</strong> Smoke rises, carrying heat and toxic gases. Crawl on your hands and knees where the air is cleaner.</li>
              <li><strong>Test doors before opening:</strong> Feel the door and handle with the back of your hand. If they are hot, do not open. Use an alternate escape route.</li>
              <li><strong>Never use elevators:</strong> Power outages can trap you inside. Always use the stairs.</li>
              <li><strong>Once out, stay out:</strong> Never go back inside a burning building for any reason. Call emergency services from outside.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-amber-500 mb-2 flex items-center gap-1.5">If Your Clothes Catch Fire: Stop, Drop, and Roll</h4>
            <div className="grid gap-3 sm:grid-cols-3 text-center mb-1">
              <div className="p-2.5 rounded-lg border border-border bg-muted/40 text-xs">
                <p className="font-bold text-sm text-amber-500">1. STOP</p>
                <p className="mt-1">Stop moving immediately. Running fans the flames and makes the fire burn faster.</p>
              </div>
              <div className="p-2.5 rounded-lg border border-border bg-muted/40 text-xs">
                <p className="font-bold text-sm text-amber-500">2. DROP</p>
                <p className="mt-1">Drop to the ground and cover your face with your hands to protect your eyes and mouth.</p>
              </div>
              <div className="p-2.5 rounded-lg border border-border bg-muted/40 text-xs">
                <p className="font-bold text-sm text-amber-500">3. ROLL</p>
                <p className="mt-1">Roll back and forth repeatedly until the flames are completely smothered.</p>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-teal-500 mb-2 flex items-center gap-1.5">How to Use a Fire Extinguisher (P.A.S.S.)</h4>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-foreground/80">
              <li><strong>P - Pull:</strong> Pull the safety pin to break the seal.</li>
              <li><strong>A - Aim:</strong> Aim the nozzle at the base of the fire, not the flames.</li>
              <li><strong>S - Squeeze:</strong> Squeeze the lever slowly to discharge the extinguishing agent.</li>
              <li><strong>S - Sweep:</strong> Sweep the nozzle side-to-side across the base of the fire until it goes out.</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      id: "firstaid",
      title: "Essential First Aid Tutorials",
      category: "First Aid",
      color: "border-green-500/30 text-green-500 bg-green-50/10",
      description: "Quick reference step-by-step guides for basic life-saving medical response.",
      content: (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-red-500 mb-2 flex items-center gap-1.5">Cardiopulmonary Resuscitation (CPR) Guide</h4>
            <p className="text-xs text-foreground/60 mb-2">Use CPR when an adult is unresponsive and not breathing normally.</p>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-foreground/80">
              <li><strong>Check Responsiveness:</strong> Shake the shoulders and ask loudly, "Are you okay?" Check for chest rise.</li>
              <li><strong>Call for Help:</strong> Dial emergency services immediately. Get an AED (Defibrillator) if available.</li>
              <li><strong>Perform Chest Compressions:</strong> Place the heel of one hand in the center of the chest. Interlock your other hand on top. Push hard and fast (100–120 compressions per minute, 2 inches deep) to the beat of "Staying Alive".</li>
              <li><strong>Rescue Breaths:</strong> If trained, tilt the head back, pinch the nose, and give 2 rescue breaths after every 30 compressions. Repeat cycle until help arrives.</li>
            </ol>
          </div>
          <div>
            <h4 className="font-semibold text-amber-500 mb-2 flex items-center gap-1.5">Controlling Heavy Bleeding</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-foreground/80">
              <li><strong>Apply Direct Pressure:</strong> Cover the wound with a clean sterile dressing and press firmly with both hands.</li>
              <li><strong>Maintain Pressure:</strong> Do not release pressure to check the wound. Keep pressing until bleeding stops. Wrap firmly with a bandage.</li>
              <li><strong>Elevate:</strong> If possible, raise the injured limb above heart level to reduce blood flow to the wound.</li>
              <li><strong>Tourniquet:</strong> For severe arterial bleeding that won't stop, apply a commercial tourniquet 2 inches above the wound (never on a joint).</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-teal-500 mb-2 flex items-center gap-1.5">Treating Burns & Fractures</h4>
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="p-3 rounded-lg border border-border bg-muted/40">
                <p className="font-bold text-teal-500">Burns Care</p>
                <p className="mt-1">Cool the burn under cool, clean running water for 10–20 minutes. Cover loosely with a sterile, non-stick dressing. Do not apply ice, butter, or oils. Do not pop blisters.</p>
              </div>
              <div className="p-3 rounded-lg border border-border bg-muted/40">
                <p className="font-bold text-teal-500">Fracture Care</p>
                <p className="mt-1">Do not attempt to realign the bone. Immobilize the limb using a splint or sling. Apply a cold pack wrapped in a cloth to reduce swelling. Seek medical help immediately.</p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const filteredTopics = activeSubTab === "all" ? topics : topics.filter((t) => t.id === activeSubTab);

  return (
    <Card className="p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-wide text-primary flex items-center gap-2">
            <BookOpen className="text-primary" /> Disaster Preparedness Learning Center
          </h2>
          <p className="text-sm text-foreground/60 mt-1">Get certified, live-saving tips and safety checklists for emergency events.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "all", label: "All Content" },
            { id: "flood", label: "Floods" },
            { id: "earthquake", label: "Earthquakes" },
            { id: "fire", label: "Fires" },
            { id: "firstaid", label: "First Aid" }
          ].map((tabInfo) => (
            <button
              key={tabInfo.id}
              onClick={() => setActiveSubTab(tabInfo.id as any)}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold tracking-wide border transition-all ${
                activeSubTab === tabInfo.id
                  ? "bg-primary text-white border-primary shadow-[0_2px_8px_rgba(15,154,166,0.3)]"
                  : "bg-background text-foreground/70 border-border hover:bg-muted"
              }`}
            >
              {tabInfo.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {filteredTopics.map((topic) => (
          <div key={topic.id} className="flex flex-col rounded-xl border border-border bg-background shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-primary/20">
            <div className="p-4 border-b border-border bg-muted/20">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold border ${topic.color}`}>
                {topic.category}
              </span>
              <h3 className="font-bold text-base mt-2 tracking-wide text-foreground">{topic.title}</h3>
              <p className="text-xs text-foreground/60 mt-1">{topic.description}</p>
            </div>
            <div className="p-5 flex-1 bg-card">
              {topic.content}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
