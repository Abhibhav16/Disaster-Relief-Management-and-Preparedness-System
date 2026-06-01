import { Router } from "express";
import { Prisma } from "@prisma/client";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { pagination } from "../utils/pagination";

export const coreRouter = Router();
coreRouter.use(authenticate);

const disasterSchema = z.object({
  title: z.string().min(3),
  type: z.enum(["FLOOD", "EARTHQUAKE", "FIRE", "PANDEMIC", "CYCLONE", "LANDSLIDE", "OTHER"]),
  description: z.string().min(5),
  location: z.string().min(2),
  latitude: z.number(),
  longitude: z.number(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  startDate: z.coerce.date(),
  status: z.enum(["ACTIVE", "MONITORING", "CONTAINED", "RESOLVED"]).optional()
});

coreRouter.get("/disasters", async (req, res) => {
  const { skip, take, page, pageSize } = pagination(req.query);
  const where: Prisma.DisasterWhereInput = {
    status: typeof req.query.status === "string" ? (req.query.status as any) : undefined,
    severity: typeof req.query.severity === "string" ? (req.query.severity as any) : undefined,
    title: typeof req.query.search === "string" ? { contains: req.query.search, mode: "insensitive" } : undefined
  };
  const [data, total] = await Promise.all([prisma.disaster.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }), prisma.disaster.count({ where })]);
  res.json({ data, meta: { page, pageSize, total } });
});

coreRouter.post("/disasters", authorize("ADMIN", "AUTHORITY"), validate(disasterSchema), async (req, res) => {
  const item = await prisma.disaster.create({ data: req.body });
  res.status(201).json(item);
});

coreRouter.get("/disasters/:id", async (req, res) => res.json(await prisma.disaster.findUniqueOrThrow({ where: { id: paramId(req.params.id) }, include: { requests: true, tasks: true } })));
coreRouter.put("/disasters/:id", authorize("ADMIN", "AUTHORITY"), validate(disasterSchema), async (req, res) => res.json(await prisma.disaster.update({ where: { id: paramId(req.params.id) }, data: req.body })));
coreRouter.patch("/disasters/:id/status", authorize("ADMIN", "AUTHORITY"), validate(z.object({ status: z.enum(["ACTIVE", "MONITORING", "CONTAINED", "RESOLVED"]) })), async (req, res) => res.json(await prisma.disaster.update({ where: { id: paramId(req.params.id) }, data: { status: req.body.status } })));
coreRouter.delete("/disasters/:id", authorize("ADMIN"), async (req, res) => res.json(await prisma.disaster.delete({ where: { id: paramId(req.params.id) } })));

const requestSchema = z.object({
  disasterId: z.string().optional(),
  requestType: z.string().min(2),
  description: z.string().min(5),
  latitude: z.number(),
  longitude: z.number(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CANCELLED"]).optional()
});

coreRouter.get("/requests", async (req, res) => {
  const { skip, take, page, pageSize } = pagination(req.query);
  const where: Prisma.EmergencyRequestWhereInput = {
    status: typeof req.query.status === "string" ? (req.query.status as any) : undefined,
    userId: req.user!.role === "AFFECTED_INDIVIDUAL" ? req.user!.id : undefined
  };
  const [data, total] = await Promise.all([
    prisma.emergencyRequest.findMany({ where, include: { user: { select: { id: true, name: true, email: true } }, disaster: true }, skip, take, orderBy: { createdAt: "desc" } }),
    prisma.emergencyRequest.count({ where })
  ]);
  res.json({ data, meta: { page, pageSize, total } });
});

coreRouter.post("/requests", validate(requestSchema), async (req, res) => {
  const item = await prisma.emergencyRequest.create({ data: { ...req.body, userId: req.user!.id } });
  res.status(201).json(item);
});
coreRouter.get("/requests/:id", async (req, res) => res.json(await prisma.emergencyRequest.findUniqueOrThrow({ where: { id: paramId(req.params.id) }, include: { user: true, disaster: true, tasks: true } })));
coreRouter.put("/requests/:id", authorize("ADMIN", "AUTHORITY"), validate(requestSchema), async (req, res) => res.json(await prisma.emergencyRequest.update({ where: { id: paramId(req.params.id) }, data: req.body })));
coreRouter.patch("/requests/:id/status", authorize("ADMIN", "AUTHORITY"), validate(z.object({ status: z.enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CANCELLED"]) })), async (req, res) => res.json(await prisma.emergencyRequest.update({ where: { id: paramId(req.params.id) }, data: { status: req.body.status } })));
coreRouter.delete("/requests/:id", authorize("ADMIN"), async (req, res) => res.json(await prisma.emergencyRequest.delete({ where: { id: paramId(req.params.id) } })));

const resourceSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(2),
  quantity: z.number().int().nonnegative(),
  location: z.string().min(2),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  provider: z.string().min(2),
  expiryDate: z.coerce.date().optional(),
  status: z.enum(["AVAILABLE", "RESERVED", "ALLOCATED", "EXPIRED"]).optional()
});

coreRouter.get("/resources", list("resource", { orderBy: { createdAt: "desc" } }));
coreRouter.post("/resources", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"), validate(resourceSchema), create("resource"));
coreRouter.get("/resources/:id", async (req, res) => res.json(await prisma.resource.findUniqueOrThrow({ where: { id: paramId(req.params.id) } })));
coreRouter.put("/resources/:id", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"), validate(resourceSchema), update("resource"));
coreRouter.delete("/resources/:id", authorize("ADMIN"), remove("resource"));

const shelterSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(2),
  latitude: z.number(),
  longitude: z.number(),
  capacity: z.number().int().positive(),
  occupiedBeds: z.number().int().nonnegative().default(0),
  contactPerson: z.string().min(2),
  phone: z.string().optional()
});

coreRouter.get("/shelters", list("shelter", { orderBy: { createdAt: "desc" } }));
coreRouter.get("/shelters/nearby", async (req, res) => {
  const lat = Number(req.query.latitude);
  const lon = Number(req.query.longitude);
  const shelters = await prisma.shelter.findMany();
  res.json(shelters.map((s) => ({ ...s, distanceKm: distanceKm(lat, lon, s.latitude, s.longitude) })).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 10));
});
coreRouter.post("/shelters", authorize("ADMIN", "AUTHORITY"), validate(shelterSchema), create("shelter"));
coreRouter.get("/shelters/:id", async (req, res) => res.json(await prisma.shelter.findUniqueOrThrow({ where: { id: paramId(req.params.id) } })));
coreRouter.put("/shelters/:id", authorize("ADMIN", "AUTHORITY"), validate(shelterSchema), update("shelter"));
coreRouter.delete("/shelters/:id", authorize("ADMIN"), remove("shelter"));

const volunteerSchema = z.object({
  skills: z.array(z.string()).default([]),
  phone: z.string().min(7),
  location: z.string().min(2),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  availability: z.boolean().default(true)
});

coreRouter.get("/volunteers", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR", "VOLUNTEER"), async (req, res) => {
  const { skip, take, page, pageSize } = pagination(req.query);
  const where = req.user!.role === "VOLUNTEER" ? { userId: req.user!.id } : {};
  const [data, total] = await Promise.all([
    prisma.volunteer.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } }, tasks: true },
      skip,
      take
    }),
    prisma.volunteer.count({ where })
  ]);
  res.json({ data, meta: { page, pageSize, total } });
});
coreRouter.post("/volunteers", validate(volunteerSchema), async (req, res) => {
  const item = await prisma.volunteer.create({ data: { ...req.body, userId: req.user!.id } });
  res.status(201).json(item);
});
coreRouter.get("/volunteers/:id", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"), async (req, res) => res.json(await prisma.volunteer.findUniqueOrThrow({ where: { id: paramId(req.params.id) }, include: { user: true, tasks: true } })));
coreRouter.put("/volunteers/:id", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"), validate(volunteerSchema), update("volunteer"));
coreRouter.delete("/volunteers/:id", authorize("ADMIN"), remove("volunteer"));

const taskSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(5),
  disasterId: z.string().optional(),
  emergencyRequestId: z.string().optional(),
  volunteerId: z.string().optional(),
  dueAt: z.coerce.date().optional()
});

coreRouter.get("/tasks", async (req, res) => {
  const volunteer = req.user!.role === "VOLUNTEER" ? await prisma.volunteer.findUnique({ where: { userId: req.user!.id } }) : null;
  const where = volunteer ? { volunteerId: volunteer.id } : {};
  res.json({ data: await prisma.task.findMany({ where, include: { disaster: true, emergencyRequest: true, volunteer: true }, orderBy: { createdAt: "desc" } }) });
});
coreRouter.post("/tasks", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"), validate(taskSchema), create("task"));
coreRouter.get("/tasks/:id", async (req, res) => res.json(await prisma.task.findUniqueOrThrow({ where: { id: paramId(req.params.id) }, include: { disaster: true, emergencyRequest: true, volunteer: true } })));
coreRouter.put("/tasks/:id", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"), validate(taskSchema), update("task"));
coreRouter.patch(
  "/tasks/:id/status",
  validate(z.object({ status: z.enum(["OPEN", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]) })),
  async (req, res) => {
    const id = paramId(req.params.id);
    const status = String(req.body.status) as "OPEN" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    res.json(await prisma.task.update({ where: { id }, data: { status } }));
  }
);
coreRouter.delete("/tasks/:id", authorize("ADMIN"), remove("task"));

coreRouter.get("/notifications", async (req, res) => res.json({ data: await prisma.notification.findMany({ where: { OR: [{ userId: req.user!.id }, { userId: null }] }, orderBy: { createdAt: "desc" } }) }));
coreRouter.post("/notifications/broadcast", authorize("ADMIN", "AUTHORITY"), validate(z.object({ title: z.string(), message: z.string(), channel: z.string().default("EMAIL") })), create("notification"));

coreRouter.get("/analytics", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"), async (_req, res) => {
  const [activeDisasters, resourcesAvailable, requests, shelters, volunteers] = await Promise.all([
    prisma.disaster.count({ where: { status: "ACTIVE" } }),
    prisma.resource.aggregate({ where: { status: "AVAILABLE" }, _sum: { quantity: true } }),
    prisma.emergencyRequest.groupBy({ by: ["status"], _count: true }),
    prisma.shelter.findMany(),
    prisma.volunteer.count({ where: { availability: true } })
  ]);
  const capacity = shelters.reduce((sum, s) => sum + s.capacity, 0);
  const occupied = shelters.reduce((sum, s) => sum + s.occupiedBeds, 0);
  res.json({ activeDisasters, resourcesAvailable: resourcesAvailable._sum.quantity ?? 0, emergencyRequests: requests, shelterOccupancy: { capacity, occupied }, availableVolunteers: volunteers });
});

coreRouter.get("/reports/export.csv", authorize("ADMIN", "AUTHORITY"), async (_req, res) => {
  const rows = await prisma.emergencyRequest.findMany({ include: { user: true, disaster: true } });
  res.type("text/csv").send(["id,user,disaster,type,priority,status", ...rows.map((r) => `${r.id},${r.user.name},${r.disaster?.title ?? ""},${r.requestType},${r.priority},${r.status}`)].join("\n"));
});

coreRouter.get("/reports/export.pdf", authorize("ADMIN", "AUTHORITY"), async (_req, res) => {
  const rows = await prisma.emergencyRequest.findMany({ include: { user: true, disaster: true }, take: 50, orderBy: { createdAt: "desc" } });
  const doc = new PDFDocument({ margin: 48 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=drrcs-report.pdf");
  doc.pipe(res);
  doc.fontSize(18).text("DRRCS Emergency Request Report");
  doc.moveDown().fontSize(10).text(`Generated: ${new Date().toISOString()}`);
  doc.moveDown();
  rows.forEach((r) => {
    doc.fontSize(11).text(`${r.requestType} | ${r.priority} | ${r.status}`);
    doc.fontSize(9).text(`${r.user.name} | ${r.disaster?.title ?? "No disaster linked"}`);
    doc.moveDown(0.5);
  });
  doc.end();
});

coreRouter.get("/audit-logs", authorize("ADMIN"), list("auditLog", { orderBy: { createdAt: "desc" } }));

function list(model: keyof typeof prisma, options: Record<string, unknown> = {}) {
  return async (req: any, res: any) => {
    const { skip, take, page, pageSize } = pagination(req.query);
    const delegate = (prisma as any)[model];
    const [data, total] = await Promise.all([delegate.findMany({ ...options, skip, take }), delegate.count()]);
    res.json({ data, meta: { page, pageSize, total } });
  };
}

function create(model: keyof typeof prisma) {
  return async (req: any, res: any) => res.status(201).json(await (prisma as any)[model].create({ data: req.body }));
}

function update(model: keyof typeof prisma) {
  return async (req: any, res: any) => res.json(await (prisma as any)[model].update({ where: { id: req.params.id }, data: req.body }));
}

function remove(model: keyof typeof prisma) {
  return async (req: any, res: any) => res.json(await (prisma as any)[model].delete({ where: { id: paramId(req.params.id) } }));
}

function paramId(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : String(value);
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
