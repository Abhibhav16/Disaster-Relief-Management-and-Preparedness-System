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
const LocationPickerMap = dynamic(() => import("@/components/LocationPickerMap").then((m) => m.LocationPickerMap), { ssr: false });

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

const translations: Record<string, Record<string, string>> = {
  en: {
    dashboard: "Operations Dashboard",
    overview: "Overview",
    disasters: "Disasters",
    requests: "Emergency Requests",
    resources: "Resource Inventory",
    shelters: "Shelters",
    volunteers: "Volunteers",
    learning: "Learning Center",
    notifications: "Notification Center",
    auditLogs: "System Audit Logs",
    searchPlaceholder: "Search incidents...",
    logout: "Logout",
    offlineBanner: "Operational Alert: Network connection lost. Displaying cached dashboard data. Operations are read-only until online.",
    activeDisasters: "Active Disasters",
    availableResources: "Available Resources",
    shelterOccupancy: "Shelter Occupancy",
    openRequests: "Open Requests",
    liveVolunteers: "Volunteers Available"
  },
  hi: {
    dashboard: "संचालन डैशबोर्ड",
    overview: "अवलोकन",
    disasters: "आपदाएं",
    requests: "आपातकालीन अनुरोध",
    resources: "संसाधन सूची",
    shelters: "आश्रय स्थल",
    volunteers: "स्वयंसेवक",
    learning: "शिक्षण केंद्र",
    notifications: "सूचना केंद्र",
    auditLogs: "सिस्टम ऑडिट लॉग",
    searchPlaceholder: "घटनाओं की खोज करें...",
    logout: "लॉगआउट",
    offlineBanner: "संचालन चेतावनी: नेटवर्क कनेक्शन टूट गया है। कैश्ड डैशबोर्ड डेटा प्रदर्शित हो रहा है। ऑनलाइन होने तक संचालन केवल पढ़ने योग्य है।",
    activeDisasters: "सक्रिय आपदाएं",
    availableResources: "उपलब्ध संसाधन",
    shelterOccupancy: "आश्रय अधिभोग",
    openRequests: "खुले अनुरोध",
    liveVolunteers: "उपलब्ध स्वयंसेवक"
  },
  pa: {
    dashboard: "ਕਾਰਜਸ਼ੀਲ ਡੈਸ਼ਬੋਰਡ",
    overview: "ਸੰਖੇਪ",
    disasters: "ਆਫ਼ਤਾਂ",
    requests: "ਐਮਰਜੈਂਸੀ ਬੇਨਤੀਆਂ",
    resources: "ਸੰਸਾਧਨ ਸੂਚੀ",
    shelters: "ਆਸਰਾ ਘਰ",
    volunteers: "ਵਲੰਟੀਅਰ",
    learning: "ਸਿੱਖਣ ਕੇਂਦਰ",
    notifications: "ਸੂਚਨਾ ਕੇਂਦਰ",
    auditLogs: "ਸਿਸਟਮ ਆਡਿਟ ਲੌਗਸ",
    searchPlaceholder: "ਘਟਨਾਵਾਂ ਦੀ ਖੋਜ ਕਰੋ...",
    logout: "ਲੌਗਆਊਟ",
    offlineBanner: "ਕਾਰਜਸ਼ੀਲ ਚੇਤਾਵਨੀ: ਨੈੱਟਵਰਕ ਕਨੈਕਸ਼ਨ ਟੁੱਟ ਗਿਆ ਹੈ। ਕੈਸ਼ ਕੀਤਾ ਡੈਸ਼ਬੋਰਡ ਡੇਟਾ ਦਿਖਾਇਆ ਜਾ ਰਿਹਾ ਹੈ। ਆਨਲਾਈਨ ਹੋਣ ਤੱਕ ਕਾਰਵਾਈਆਂ ਸਿਰਫ਼ ਪੜ੍ਹਨਯੋਗ ਹਨ।",
    activeDisasters: "ਸਰਗਰਮ ਆਫ਼ਤਾਂ",
    availableResources: "ਉਪਲਬਧ ਸੰਸਾਧਨ",
    shelterOccupancy: "ਆਸਰਾ ਕਬਜ਼ਾ",
    openRequests: "ਖੁੱਲ੍ਹੀਆਂ ਬੇਨਤੀਆਂ",
    liveVolunteers: "ਉਪਲਬਧ ਵਲੰਟੀਅਰ"
  }
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
  const [isOnline, setIsOnline] = useState(true);
  const [lang, setLang] = useState<"en" | "hi" | "pa">("en");
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);

  const t = (key: string) => translations[lang][key] || key;

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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

  const refreshAllData = () => {
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
  };

  useEffect(() => {
    if (!authReady) return;
    refreshAllData();
    (window as any).refreshAllData = refreshAllData;
  }, [authReady]);

  // Load offline queue on mount
  useEffect(() => {
    const saved = localStorage.getItem("drrcs_offline_queue");
    if (saved) {
      setOfflineQueue(JSON.parse(saved));
    }
  }, []);

  async function queueOfflineAction(path: string, options: any, description: string) {
    const newQueue = [...offlineQueue, { id: Math.random().toString(36).substring(2, 9), path, options, description, createdAt: new Date().toISOString() }];
    setOfflineQueue(newQueue);
    localStorage.setItem("drrcs_offline_queue", JSON.stringify(newQueue));
  }

  // Update window helper when queue changes
  useEffect(() => {
    (window as any).queueOfflineAction = queueOfflineAction;
  }, [offlineQueue]);

  async function syncOfflineQueue() {
    const queueToProcess = [...offlineQueue];
    setOfflineQueue([]);
    localStorage.removeItem("drrcs_offline_queue");

    let successCount = 0;
    for (const item of queueToProcess) {
      try {
        await api(item.path, item.options);
        successCount++;
      } catch (err) {
        console.error("Failed to sync offline item:", item, err);
        if (err instanceof TypeError || (err instanceof Error && err.message.includes("Failed to fetch"))) {
          setOfflineQueue((prev) => {
            const updated = [...prev, item];
            localStorage.setItem("drrcs_offline_queue", JSON.stringify(updated));
            return updated;
          });
        }
      }
    }

    if (successCount > 0) {
      alert(`Sync Complete: ${successCount} queued offline action(s) synchronized successfully!`);
      refreshAllData();
    }
  }

  // Sync queue when online status restored
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      syncOfflineQueue();
    }
  }, [isOnline, offlineQueue]);

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
            ["overview", Activity, t("overview")],
            ["disasters", ShieldAlert, t("disasters")],
            ["requests", HandHeart, t("requests")],
            ["resources", Boxes, t("resources")],
            ["shelters", Home, t("shelters")],
            ["volunteers", Users, t("volunteers")],
            ["learning center", BookOpen, t("learning")],
            ["notifications", Bell, t("notifications")],
            ...(user && ["ADMIN", "AUTHORITY"].includes(user.role.name) ? [["audit logs", ShieldAlert, t("auditLogs")]] : [])
          ].map(([key, Icon, label]: any) => (
            <button key={key} onClick={() => setTab(key)} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${tab === key ? "bg-primary text-white" : "hover:bg-muted"}`}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="md:pl-64">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">
                {tab === "overview" ? t("dashboard") : (
                  tab === "learning center" ? t("learning") :
                  tab === "notifications" ? t("notifications") :
                  tab === "audit logs" ? t("auditLogs") :
                  t(tab)
                )}
              </h1>
              <p className="text-sm text-foreground/60">
                {user?.name} · {user?.role.name.replaceAll("_", " ")} · Realtime: {live}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5" size={16} />
                <Input className="w-56 pl-8" placeholder={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={lang} onChange={(e) => setLang(e.target.value as any)} className="w-24 h-10 py-1 text-xs">
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="pa">ਪੰਜਾਬੀ</option>
              </Select>
              <Button className="px-3" onClick={() => setDark((v) => !v)} aria-label="Toggle dark mode">{dark ? <Sun size={18} /> : <Moon size={18} />}</Button>
              <Button className="gap-2" onClick={exportCsv}><Download size={16} /> CSV</Button>
              <Button className="gap-2 bg-foreground/20 text-foreground" onClick={logout}><LogOut size={16} /> Logout</Button>
            </div>
          </div>
        </header>

        {!isOnline && (
          <div className="bg-red-600 text-white px-4 py-2.5 text-center text-xs font-semibold flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300 shadow-md">
            <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
            <span>{t("offlineBanner")}</span>
          </div>
        )}

        <div className="space-y-5 p-4">
          {tab === "overview" && (
            <>
              {/* Metrics Grid */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <Metric 
                  label={t("activeDisasters")} 
                  value={filteredDisasters.length} 
                  icon={ShieldAlert}
                  color="bg-red-500/10 text-red-600 dark:text-red-400"
                  trend="Priority-tracked"
                  indicatorColor="bg-red-500"
                />
                <Metric 
                  label={t("availableResources")} 
                  value={filteredResources.reduce((s, r) => s + r.quantity, 0)} 
                  icon={Boxes}
                  color="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  trend="In supply"
                  indicatorColor="bg-blue-500"
                />
                <Metric 
                  label={t("shelterOccupancy")} 
                  value={search ? `${filteredShelters.reduce((s, sh) => s + sh.occupiedBeds, 0)}/${filteredShelters.reduce((s, sh) => s + sh.capacity, 0)}` : (analytics?.shelterOccupancy ? `${analytics.shelterOccupancy.occupied}/${analytics.shelterOccupancy.capacity}` : `${shelters.reduce((s, sh) => s + sh.occupiedBeds, 0)}/${shelters.reduce((s, sh) => s + sh.capacity, 0)}`)} 
                  icon={Home}
                  color="bg-green-500/10 text-green-600 dark:text-green-400"
                  trend="Live occupancy"
                  indicatorColor="bg-green-500"
                />
                <Metric 
                  label={t("openRequests")} 
                  value={filteredRequests.filter((r) => r.status === "PENDING" || r.status === "IN_PROGRESS").length} 
                  icon={HandHeart}
                  color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  trend="Critical priority"
                  indicatorColor="bg-amber-500"
                />
                <Metric 
                  label={t("volunteers")} 
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

          {tab === "disasters" && <DisasterPanel disasters={filteredDisasters} user={user} onCreated={(newDisaster) => { setDisasters((prev) => [newDisaster, ...prev]); refreshAnalytics(); }} onUpdate={(updated) => { setDisasters((prev) => prev.map((d) => d.id === updated.id ? updated : d)); refreshAnalytics(); }} />}
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
          {tab === "audit logs" && <AuditLogsPanel />}
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

      const payload = {
        name,
        category: finalCategory,
        quantity: Number(quantity),
        location,
        provider,
        status,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
      };

      if (!navigator.onLine) {
        onCreated({
          id: "offline_" + Math.random().toString(36).substring(2, 9),
          name,
          category: finalCategory,
          quantity: Number(quantity),
          location,
          provider,
          status,
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined,
        });
        (window as any).queueOfflineAction("/api/resources", {
          method: "POST",
          body: JSON.stringify(payload)
        }, `Add resource: ${name}`);

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
        setMessage("Offline Mode: Resource queued. It will sync automatically when connection returns.");
        setSubmitting(false);
        return;
      }

      const created = await api<Resource>("/api/resources", {
        method: "POST",
        body: JSON.stringify(payload),
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

      const payload = {
        name,
        address,
        capacity: Number(capacity),
        occupiedBeds: Number(occupiedBeds),
        contactPerson,
        phone: phone || undefined,
        latitude: Number(latitude),
        longitude: Number(longitude)
      };

      if (!navigator.onLine) {
        onCreated({
          id: "offline_" + Math.random().toString(36).substring(2, 9),
          name,
          address,
          capacity: Number(capacity),
          occupiedBeds: Number(occupiedBeds),
          contactPerson,
          phone: phone || undefined,
          latitude: Number(latitude),
          longitude: Number(longitude)
        });
        (window as any).queueOfflineAction("/api/shelters", {
          method: "POST",
          body: JSON.stringify(payload)
        }, `Add shelter: ${name}`);

        setName("");
        setAddress("");
        setCapacity(0);
        setOccupiedBeds(0);
        setContactPerson("");
        setPhone("");
        setLatitude("");
        setLongitude("");
        setShowAddForm(false);
        setMessage("Offline Mode: Shelter queued. It will sync automatically when connection returns.");
        setSubmitting(false);
        return;
      }

      const created = await api<Shelter>("/api/shelters", {
        method: "POST",
        body: JSON.stringify(payload)
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

function DisasterPanel({ disasters, user, onCreated, onUpdate }: { disasters: Disaster[]; user: CurrentUser | null; onCreated: (disaster: Disaster) => void; onUpdate: (disaster: Disaster) => void }) {
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
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const canAdd = user && ["ADMIN", "AUTHORITY", "NGO_COORDINATOR"].includes(user.role.name);
  const canSettle = user && ["ADMIN", "NGO_COORDINATOR"].includes(user.role.name);

  async function handleSettleDisaster(id: string) {
    setSettlingId(id);
    try {
      const updated = await api<Disaster>(`/api/disasters/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "RESOLVED" })
      });
      onUpdate(updated);
      setSelectedDisaster(updated);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to settle disaster.");
    } finally {
      setSettlingId(null);
    }
  }

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

      const payload = {
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
      };

      if (!navigator.onLine) {
        onCreated({
          id: "offline_" + Math.random().toString(36).substring(2, 9),
          title,
          type,
          description,
          location,
          latitude: Number(latitude),
          longitude: Number(longitude),
          severity,
          status,
          imageUrl: photo || undefined
        });
        (window as any).queueOfflineAction("/api/disasters", {
          method: "POST",
          body: JSON.stringify(payload)
        }, `Report disaster: ${title}`);

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
        setMessage("Offline Mode: Disaster reported and queued. It will sync automatically when connection returns.");
        setSubmitting(false);
        return;
      }

      const created = await api<Disaster>("/api/disasters", {
        method: "POST",
        body: JSON.stringify(payload)
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

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/70">Interactive Location Picker (Click to Pick Location)</label>
              <LocationPickerMap
                latitude={latitude && !isNaN(Number(latitude)) ? Number(latitude) : null}
                longitude={longitude && !isNaN(Number(longitude)) ? Number(longitude) : null}
                onChange={(lat, lng) => {
                  setLatitude(lat.toFixed(6));
                  setLongitude(lng.toFixed(6));
                }}
              />
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

              <div className="flex justify-end gap-2 pt-2">
                {canSettle && selectedDisaster.status !== "RESOLVED" && (
                  <Button
                    onClick={() => handleSettleDisaster(selectedDisaster.id)}
                    disabled={settlingId === selectedDisaster.id}
                    className="bg-green-600 hover:bg-green-700 text-white border-none"
                  >
                    {settlingId === selectedDisaster.id ? "Settling..." : "Settle Disaster"}
                  </Button>
                )}
                <Button onClick={() => setSelectedDisaster(null)} className="px-5 bg-muted text-foreground hover:bg-muted/80 border-none">
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

function AllocationModal({
  requestId,
  onClose,
  onSuccess
}: {
  requestId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [resources, setResources] = useState<any[]>([]);
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<ApiList<any>>("/api/resources")
      .then((res) => {
        const available = res.data.filter((r: any) => r.quantity > 0 && r.status === "AVAILABLE");
        setResources(available);
        if (available.length > 0) {
          setSelectedResourceId(available[0].id);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedResourceId) return;
    setSubmitting(true);
    setError("");

    try {
      await api(`/api/requests/${requestId}/allocate`, {
        method: "POST",
        body: JSON.stringify({
          resourceId: selectedResourceId,
          allocatedQuantity: Number(quantity)
        })
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to allocate resources");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-md p-6 bg-background shadow-2xl rounded-2xl border border-border animate-in scale-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
          <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
            <Boxes className="text-primary" /> Allocate Relief Stock
          </h3>
          <button onClick={onClose} className="text-foreground/60 hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-foreground/60">Loading available inventory...</p>
        ) : resources.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
              No available resources in inventory. Please add resources first before allocating to this request.
            </p>
            <Button onClick={onClose} className="w-full">Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/70">Select Resource Stock *</label>
              <Select value={selectedResourceId} onChange={(e) => setSelectedResourceId(e.target.value)}>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.category}) - Stock: {r.quantity} available at {r.location}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground/70">Allocation Quantity *</label>
              <Input
                type="number"
                min={1}
                max={resources.find((r) => r.id === selectedResourceId)?.quantity || 1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                required
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                {error}
              </p>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" className="bg-foreground/10 text-foreground" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Allocating..." : "Confirm Allocation"}
              </Button>
            </div>
          </form>
        )}
      </Card>
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
  const [allocatingRequestId, setAllocatingRequestId] = useState<string | null>(null);

  const visibleRequests = requests.filter((r) => r.status === "PENDING" || r.status === "IN_PROGRESS");

  const canUpdateStatus = user && ["ADMIN", "AUTHORITY", "NGO_COORDINATOR", "VOLUNTEER"].includes(user.role.name);
  const canAllocate = user && ["ADMIN", "AUTHORITY", "NGO_COORDINATOR"].includes(user.role.name);

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

    const payload = {
      requestType,
      priority,
      description,
      latitude: 31.3959,
      longitude: 75.5350,
      imageUrl: photo || undefined
    };

    if (!navigator.onLine) {
      onCreated({
        id: "offline_" + Math.random().toString(36).substring(2, 9),
        requestType,
        description,
        latitude: 31.3959,
        longitude: 75.5350,
        priority,
        status: "PENDING",
        imageUrl: photo || undefined,
        user: { name: user?.name || "You", email: user?.email || "" }
      });
      (window as any).queueOfflineAction("/api/requests", {
        method: "POST",
        body: JSON.stringify(payload)
      }, `Report emergency request: ${requestType}`);

      setDescription("");
      setPhoto(null);
      setMessage("Offline Mode: Emergency request queued. It will sync automatically when connection returns.");
      setSubmitting(false);
      return;
    }

    try {
      const created = await api<Request>("/api/requests", {
        method: "POST",
        body: JSON.stringify(payload)
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
            <div className="space-y-2.5">
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
              {canAllocate && r.status === "PENDING" && (
                <Button onClick={() => setAllocatingRequestId(r.id)} className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs h-9 font-bold">
                  Allocate Resources
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {allocatingRequestId && (
        <AllocationModal
          requestId={allocatingRequestId}
          onClose={() => setAllocatingRequestId(null)}
          onSuccess={() => {
            onStatusChanged(allocatingRequestId, "ASSIGNED");
            if ((window as any).refreshAllData) {
              (window as any).refreshAllData();
            }
          }}
        />
      )}
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
  const [activeTopic, setActiveTopic] = useState("flood");
  const [activeSubTab, setActiveSubTab] = useState<"steps" | "checklist" | "quiz">("steps");

  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});
  const [certifications, setCertifications] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const savedCheck = localStorage.getItem("drrcs_learning_checklist");
    if (savedCheck) setChecklistState(JSON.parse(savedCheck));

    const savedCerts = localStorage.getItem("drrcs_learning_certs");
    if (savedCerts) setCertifications(JSON.parse(savedCerts));
  }, []);

  const toggleChecklistItem = (itemId: string) => {
    const nextState = { ...checklistState, [itemId]: !checklistState[itemId] };
    setChecklistState(nextState);
    localStorage.setItem("drrcs_learning_checklist", JSON.stringify(nextState));
  };

  const markCertified = (topicId: string) => {
    const nextCerts = { ...certifications, [topicId]: true };
    setCertifications(nextCerts);
    localStorage.setItem("drrcs_learning_certs", JSON.stringify(nextCerts));
  };

  const quizzes: Record<string, {
    question: string;
    options: string[];
    answerIndex: number;
    explanation: string;
  }[]> = {
    flood: [
      {
        question: "What is the minimum height of moving water that can knock an adult off their feet?",
        options: ["6 inches", "12 inches", "2 feet", "3 feet"],
        answerIndex: 0,
        explanation: "Just 6 inches of moving water can sweep a person off their feet, and 12 inches can float most small cars."
      },
      {
        question: "If advised to evacuate during a flood, when should you start moving?",
        options: ["Immediately", "Wait until floodwaters reach your doorstep", "Wait for secondary confirmation", "Pack all household belongings first"],
        answerIndex: 0,
        explanation: "Evacuate immediately. Delayed action often leads to citizens becoming trapped in rising waters."
      }
    ],
    earthquake: [
      {
        question: "When the ground starts shaking inside a building, what is the best immediate action?",
        options: ["Run outdoors as fast as possible", "Take the elevator to reach ground floor", "Drop, Cover, and Hold On under a sturdy table", "Stand firmly in a doorway"],
        answerIndex: 2,
        explanation: "Drop, Cover, and Hold On is the gold standard for indoor earthquake survival. Doors and hallways are not safer."
      },
      {
        question: "If you are driving when an earthquake starts, where should you stop?",
        options: ["Under an overpass for protection", "In an open area away from structures, trees, and power lines", "On a bridge to keep above ground levels", "Directly next to a tall building"],
        answerIndex: 1,
        explanation: "Avoid stopping near structures, overpasses, bridges, or trees that can collapse onto your vehicle."
      }
    ],
    fire: [
      {
        question: "Why should you crawl low on your hands and knees in a smoke-filled room?",
        options: ["It is faster than walking", "Smoke, heat, and toxic gases rise, leaving clean air closer to the floor", "It makes you less visible to the fire", "To avoid triggering automated sprinklers"],
        answerIndex: 1,
        explanation: "Smoke and poisonous gases accumulate at the ceiling. Crawling protects you from breathing toxic, superheated air."
      },
      {
        question: "What does the 'PASS' acronym stand for when using a fire extinguisher?",
        options: [
          "Push, Aim, Spray, Sweep",
          "Pull, Aim, Squeeze, Sweep",
          "Pin, Aim, Squeeze, Spread",
          "Pull, Activate, Spray, Settle"
        ],
        answerIndex: 1,
        explanation: "PASS stands for: Pull the pin, Aim at the base of the fire, Squeeze the lever, and Sweep side-to-side."
      }
    ],
    firstaid: [
      {
        question: "What is the correct compression rate for performing adult CPR?",
        options: ["60–80 compressions/minute", "80–100 compressions/minute", "100–120 compressions/minute", "120–140 compressions/minute"],
        answerIndex: 2,
        explanation: "The recommended rate is 100–120 compressions per minute, which matches the rhythm of the song 'Staying Alive'."
      },
      {
        question: "How should you control severe bleeding from an open wound?",
        options: ["Wash it with running tap water immediately", "Apply firm, direct pressure with a clean dressing", "Keep the limb lower than the heart", "Apply butter or oil to seal the wound"],
        answerIndex: 1,
        explanation: "Direct pressure is the most effective way to stop bleeding. Never apply fats or oils to wounds."
      }
    ]
  };

  const topics = [
    {
      id: "flood",
      title: "Flood Preparedness",
      category: "Floods",
      color: "border-blue-500/20 text-blue-500 bg-blue-500/5",
      badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      description: "Survival strategies and checklist for flood operations.",
      before: [
        "Map local evacuation routes to high-elevation areas.",
        "Secure emergency kit supplies (water, canned food, medicine, flashlight).",
        "Move high-value equipment and documents to upper floors.",
        "Know how to shut off home electricity and gas lines."
      ],
      during: [
        "Never walk or drive through moving water - 6 inches can knock you down.",
        "Evacuate immediately if instructed by disaster authority.",
        "Move to the roof or highest floor level if trapped; do not enter a closed attic.",
        "Keep listening to local emergency broadcasts."
      ],
      after: [
        "Only return home when local coordinators confirm it is safe.",
        "Avoid contact with floodwaters as they may be contaminated.",
        "Boil all drinking water until city pipes are tested and cleared.",
        "Document structural damage with photos before cleaning."
      ],
      checklist: [
        { id: "flood_kit_water", text: "3 gallons of water per person (1 gallon/day for 3 days)" },
        { id: "flood_kit_food", text: "3-day supply of non-perishable canned food" },
        { id: "flood_kit_radio", text: "Battery-powered NOAA weather radio" },
        { id: "flood_kit_docs", text: "Watertight envelope containing IDs and deeds" }
      ]
    },
    {
      id: "earthquake",
      title: "Earthquake Response",
      category: "Earthquakes",
      color: "border-amber-500/20 text-amber-500 bg-amber-500/5",
      badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      description: "Drop, Cover, and Hold survival drills.",
      before: [
        "Anchor heavy tall cupboards and shelves to wall studs.",
        "Avoid hanging heavy pictures or mirrors above beds.",
        "Identify secure spots in each room (under tables, interior walls).",
        "Keep solid shoes and a flashlight next to your bed."
      ],
      during: [
        "DROP to your hands and knees to prevent being thrown.",
        "COVER your head and neck under a heavy table or desk.",
        "HOLD ON to your shelter until the shaking fully stops.",
        "Do not run outside or stand in doorways - falling debris is the main hazard."
      ],
      after: [
        "Check yourself and nearby people for active injuries.",
        "Expect aftershocks - repeat Drop, Cover, and Hold on each shake.",
        "Check gas valves; shut them off if you smell gas leaks.",
        "Do not use elevators; walk down stairs carefully."
      ],
      checklist: [
        { id: "quake_kit_shoes", text: "Heavy-soled shoes next to the bed" },
        { id: "quake_kit_ext", text: "Working fire extinguisher in accessible spot" },
        { id: "quake_kit_firstaid", text: "Standard first aid dressing kit" },
        { id: "quake_kit_whistle", text: "Whistle to signal search teams if trapped" }
      ]
    },
    {
      id: "fire",
      title: "Fire Safety Plans",
      category: "Fires",
      color: "border-red-500/20 text-red-500 bg-red-500/5",
      badgeColor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
      description: "Evacuation paths and fire extinguisher training.",
      before: [
        "Install smoke alarms on every level of your house.",
        "Test smoke detectors monthly and replace batteries yearly.",
        "Establish two escape routes out of every room.",
        "Practice home fire escape drills at least twice a year."
      ],
      during: [
        "Crawl low on hands and knees to stay under toxic rising smoke.",
        "Feel doors with the back of your hand before opening; if hot, keep it closed.",
        "If clothing catches fire, STOP, DROP to the ground, and ROLL to extinguish.",
        "Once outside, do not re-enter for any reason; call emergency dispatch immediately."
      ],
      after: [
        "Wait for fire coordinators to declare the building safe before entering.",
        "Check with the local department to ensure utilities are safe to turn on.",
        "Discard any food, drink, or medicine exposed to heat or soot.",
        "Contact your insurance agent immediately."
      ],
      checklist: [
        { id: "fire_kit_detector", text: "Installed smoke detectors on all floors" },
        { id: "fire_kit_ladder", text: "Escape ladder for second-story rooms" },
        { id: "fire_kit_extinguisher", text: "Dry chemical ABC fire extinguisher" }
      ]
    },
    {
      id: "firstaid",
      title: "First Aid Training",
      category: "First Aid",
      color: "border-green-500/20 text-green-500 bg-green-500/5",
      badgeColor: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      description: "Life-saving medical techniques.",
      before: [
        "Store a complete first aid kit in your home and vehicle.",
        "Enroll in certified Red Cross first aid and CPR courses.",
        "Keep list of emergency contacts visible.",
        "Understand your family's specific medical histories."
      ],
      during: [
        "Ensure the scene is safe before approaching an injured person.",
        "For heavy bleeding, apply firm, direct pressure with a clean cloth.",
        "For cardiac arrest, call emergency services and begin rapid chest compressions.",
        "Keep the victim warm and calm until professional medics arrive."
      ],
      after: [
        "Replenish any used first aid supplies immediately.",
        "File an incident log if working under NGO command.",
        "Wash hands thoroughly after administering any medical aid."
      ],
      checklist: [
        { id: "aid_kit_bandage", text: "Sterile gauze pads and adhesive bandages" },
        { id: "aid_kit_gloves", text: "Nitrile disposable gloves (minimum 2 pairs)" },
        { id: "aid_kit_scissors", text: "Medical shears and tweezers" },
        { id: "aid_kit_antiseptic", text: "Antiseptic wipes and antibiotic ointment" }
      ]
    }
  ];

  const currentTopic = topics.find((t) => t.id === activeTopic) || topics[0];

  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  const handleSelectAnswer = (qIdx: number, oIdx: number) => {
    if (showQuizResults) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: oIdx }));
  };

  const handleGradeQuiz = () => {
    let score = 0;
    const questions = quizzes[activeTopic];
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.answerIndex) {
        score++;
      }
    });
    setQuizScore(score);
    setShowQuizResults(true);
    if (score === questions.length) {
      markCertified(activeTopic);
    }
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setShowQuizResults(false);
    setQuizScore(0);
  };

  useEffect(() => {
    handleResetQuiz();
  }, [activeTopic]);

  const getChecklistProgress = (topicId: string) => {
    const topic = topics.find((t) => t.id === topicId);
    if (!topic) return 0;
    const items = topic.checklist;
    const completed = items.filter((item) => checklistState[item.id]).length;
    return Math.round((completed / items.length) * 100);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr] items-start">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground/50 uppercase tracking-wider px-1">Training Modules</h2>
        <div className="space-y-2">
          {topics.map((topic) => {
            const isCertified = certifications[topic.id];
            const progress = getChecklistProgress(topic.id);
            return (
              <button
                key={topic.id}
                onClick={() => { setActiveTopic(topic.id); setActiveSubTab("steps"); }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  activeTopic === topic.id
                    ? "bg-primary text-white border-primary shadow-lg"
                    : "bg-background text-foreground border-border hover:bg-muted/40 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    activeTopic === topic.id ? "bg-white/20 text-white border-white/10" : topic.badgeColor
                  }`}>
                    {topic.category}
                  </span>
                  {isCertified && (
                    <span className="text-[10px] font-semibold flex items-center gap-0.5 text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                      ★ Certified
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-sm leading-tight">{topic.title}</h3>
                <p className={`text-xs mt-1 leading-normal ${activeTopic === topic.id ? "text-white/80" : "text-foreground/60"}`}>
                  {topic.description}
                </p>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className={activeTopic === topic.id ? "text-white/70" : "text-foreground/50"}>Kit Progress</span>
                    <span className="font-bold">{progress}%</span>
                  </div>
                  <div className={`h-1 w-full rounded-full ${activeTopic === topic.id ? "bg-white/25" : "bg-muted"}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${activeTopic === topic.id ? "bg-white" : "bg-primary"}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Card className="p-6 flex flex-col min-h-[500px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4 mb-6">
          <div>
            <h2 className="text-xl font-extrabold tracking-wide text-foreground flex items-center gap-2">
              {currentTopic.title}
              {certifications[currentTopic.id] && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-600 border border-teal-500/25">
                  Certified Relief Responder
                </span>
              )}
            </h2>
            <p className="text-xs text-foreground/60 mt-1">Review the emergency instructions, pack your safety kit, and complete the certification quiz.</p>
          </div>

          <div className="flex bg-muted/60 p-1 rounded-lg border border-border">
            {[
              { id: "steps", label: "Action Steps" },
              { id: "checklist", label: "Relief Kit" },
              { id: "quiz", label: "Certify Quiz" }
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setActiveSubTab(st.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeSubTab === st.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {activeSubTab === "steps" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-background/50 p-4 shadow-sm">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 font-bold text-xs mb-3 border border-blue-500/20">
                  1
                </div>
                <h4 className="font-bold text-sm text-foreground mb-3 uppercase tracking-wider text-blue-500">Before (Prepare)</h4>
                <ul className="space-y-2 text-xs text-foreground/80 leading-relaxed list-disc pl-4">
                  {currentTopic.before.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 font-bold text-xs mb-3 border border-amber-500/20">
                  2
                </div>
                <h4 className="font-bold text-sm mb-3 uppercase tracking-wider text-amber-600 dark:text-amber-400">During (Immediate)</h4>
                <ul className="space-y-2 text-xs text-foreground/80 leading-relaxed list-disc pl-4">
                  {currentTopic.during.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 shadow-sm">
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/10 text-green-500 font-bold text-xs mb-3 border border-green-500/20">
                  3
                </div>
                <h4 className="font-bold text-sm mb-3 uppercase tracking-wider text-green-600 dark:text-green-400">After (Recover)</h4>
                <ul className="space-y-2 text-xs text-foreground/80 leading-relaxed list-disc pl-4">
                  {currentTopic.after.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-xs">
              <ShieldAlert className="text-red-500 shrink-0 stroke-[2.5]" size={20} />
              <div className="space-y-1">
                <p className="font-bold text-red-700 dark:text-red-400">Critical Coordination Directive</p>
                <p className="text-foreground/80 leading-relaxed">
                  In all active disaster environments, standard operations must prioritize local command requests. Maintain live communication links with your assigned NGO Coordinator, check network status regularly, and do not attempt search actions without safety equipment.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === "checklist" && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <h4 className="font-bold text-sm text-foreground mb-1">Emergency Kit & Packing List</h4>
              <p className="text-xs text-foreground/60">Select items as you pack them. Responders carrying full kits receive higher task priority.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {currentTopic.checklist.map((item) => (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer select-none transition-all ${
                    checklistState[item.id]
                      ? "bg-primary/5 border-primary/30"
                      : "bg-background border-border hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!checklistState[item.id]}
                    onChange={() => toggleChecklistItem(item.id)}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0"
                  />
                  <div className="space-y-0.5">
                    <p className={`text-xs font-semibold ${checklistState[item.id] ? "text-primary line-through" : "text-foreground"}`}>
                      {item.text}
                    </p>
                    <span className="text-[10px] text-foreground/50">Required Equipment</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === "quiz" && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <h4 className="font-bold text-sm text-foreground mb-1">Knowledge Assessment Quiz</h4>
              <p className="text-xs text-foreground/60">Pass this 2-question assessment to earn your Certified responder status badge for {currentTopic.category}.</p>
            </div>

            <div className="space-y-4">
              {quizzes[activeTopic].map((q, qIdx) => {
                const selected = selectedAnswers[qIdx];
                return (
                  <div key={qIdx} className="space-y-2">
                    <h5 className="text-xs font-bold text-foreground">
                      Q{qIdx + 1}: {q.question}
                    </h5>
                    <div className="grid gap-2">
                      {q.options.map((option, oIdx) => {
                        let btnStyle = "bg-background border-border hover:bg-muted/40 text-foreground/80";
                        if (selected === oIdx) {
                          btnStyle = "bg-primary text-white border-primary shadow-sm";
                        }
                        if (showQuizResults) {
                          if (oIdx === q.answerIndex) {
                            btnStyle = "bg-green-600 text-white border-green-600 shadow-sm";
                          } else if (selected === oIdx && selected !== q.answerIndex) {
                            btnStyle = "bg-red-600 text-white border-red-600 shadow-sm";
                          } else {
                            btnStyle = "bg-background border-border opacity-50 text-foreground/40";
                          }
                        }

                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => handleSelectAnswer(qIdx, oIdx)}
                            className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-semibold transition-all ${btnStyle}`}
                            disabled={showQuizResults}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                    {showQuizResults && (
                      <p className="text-[11px] text-foreground/60 bg-muted/30 p-2.5 rounded-lg border border-border mt-1 leading-relaxed">
                        <strong>Explanation:</strong> {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border/60">
              <div>
                {showQuizResults && (
                  <p className="text-xs font-bold">
                    Score: <span className={quizScore === quizzes[activeTopic].length ? "text-green-600" : "text-red-600"}>
                      {quizScore}/{quizzes[activeTopic].length}
                    </span>
                    {quizScore === quizzes[activeTopic].length ? " - Certified! ★" : " - Try again."}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {showQuizResults && (
                  <Button onClick={handleResetQuiz} className="bg-foreground/10 text-foreground">
                    Reset
                  </Button>
                )}
                {!showQuizResults ? (
                  <Button
                    onClick={handleGradeQuiz}
                    disabled={Object.keys(selectedAnswers).length < quizzes[activeTopic].length}
                  >
                    Grade Answers
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function AuditLogsPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    api<ApiList<any>>("/api/audit-logs")
      .then((res) => {
        setLogs(res.data);
      })
      .catch((err) => console.error("Failed to load audit logs:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Card className="p-6">Loading audit logs...</Card>;
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-wide text-primary">System Audit Trail</h2>
        <p className="text-sm text-foreground/60 mt-1">Immutable record of all state modifications and operations.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-foreground/75">
              <th className="p-3">Time</th>
              <th className="p-3">Action</th>
              <th className="p-3">Actor (ID)</th>
              <th className="p-3">Entity</th>
              <th className="p-3">IP Address</th>
              <th className="p-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-foreground/50">No logs found.</td>
              </tr>
            ) : (
              logs.map((log) => (
                <>
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-xs text-foreground/60 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold border ${
                        log.action.startsWith("CREATE") ? "bg-green-500/10 text-green-600 border-green-500/25" :
                        log.action.startsWith("DELETE") ? "bg-red-500/10 text-red-600 border-red-500/25" :
                        "bg-blue-500/10 text-blue-600 border-blue-500/25"
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-mono max-w-[150px] truncate" title={log.actorId}>
                      {log.actorId || "System"}
                    </td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {log.entity} <span className="text-foreground/40 font-mono">({log.entityId?.slice(-6) || "N/A"})</span>
                    </td>
                    <td className="p-3 text-xs font-mono whitespace-nowrap text-foreground/60">
                      {log.ipAddress || "Unknown"}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button
                        onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                        className="py-1 px-2.5 text-xs h-7"
                      >
                        {expandedLogId === log.id ? "Hide" : "Show"}
                      </Button>
                    </td>
                  </tr>
                  {expandedLogId === log.id && (
                    <tr className="bg-muted/20">
                      <td colSpan={6} className="p-3 border-l-2 border-primary">
                        <div className="text-xs space-y-1">
                          <p className="font-semibold text-foreground/75">Metadata Payload:</p>
                          <pre className="p-2.5 bg-background border border-border rounded-md font-mono overflow-auto max-h-40 leading-relaxed text-foreground/90">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
