import { Router } from "express";
import { Prisma } from "@prisma/client";
import PDFDocument from "pdfkit";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { prisma } from "../config/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { pagination } from "../utils/pagination";

export const coreRouter = Router();

function saveBase64Image(base64Str: string): string | null {
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return null;
    }
    const ext = matches[1].split("/")[1];
    const dataBuffer = Buffer.from(matches[2], "base64");
    const fileName = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, dataBuffer);
    return `/uploads/${fileName}`;
  } catch (err) {
    console.error("Failed to save base64 image:", err);
    return null;
  }
}
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
  status: z.enum(["ACTIVE", "MONITORING", "CONTAINED", "RESOLVED"]).optional(),
  imageUrl: z.string().optional()
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

coreRouter.post("/disasters", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"), validate(disasterSchema), async (req, res) => {
  let imageUrl = req.body.imageUrl || null;
  if (imageUrl && imageUrl.startsWith("data:image")) {
    const savedPath = saveBase64Image(imageUrl);
    if (savedPath) {
      imageUrl = savedPath;
    }
  }
  const item = await prisma.disaster.create({ data: { ...req.body, imageUrl } });
  res.status(201).json(item);
});

coreRouter.get("/disasters/:id", async (req, res) => res.json(await prisma.disaster.findUniqueOrThrow({ where: { id: paramId(req.params.id) }, include: { requests: true, tasks: true } })));
coreRouter.put("/disasters/:id", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"), validate(disasterSchema), async (req, res) => res.json(await prisma.disaster.update({ where: { id: paramId(req.params.id) }, data: req.body })));
coreRouter.patch("/disasters/:id/status", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"), validate(z.object({ status: z.enum(["ACTIVE", "MONITORING", "CONTAINED", "RESOLVED"]) })), async (req, res) => res.json(await prisma.disaster.update({ where: { id: paramId(req.params.id) }, data: { status: req.body.status } })));
coreRouter.delete("/disasters/:id", authorize("ADMIN"), async (req, res) => res.json(await prisma.disaster.delete({ where: { id: paramId(req.params.id) } })));

const requestSchema = z.object({
  disasterId: z.string().optional(),
  requestType: z.string().min(2),
  description: z.string().min(5),
  latitude: z.number(),
  longitude: z.number(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CANCELLED"]).optional(),
  imageUrl: z.string().optional()
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
  let imageUrl = req.body.imageUrl || null;
  if (imageUrl && imageUrl.startsWith("data:image")) {
    const savedPath = saveBase64Image(imageUrl);
    if (savedPath) {
      imageUrl = savedPath;
    }
  }
  const item = await prisma.emergencyRequest.create({
    data: { ...req.body, imageUrl, userId: req.user!.id },
    include: { user: { select: { id: true, name: true, email: true } } }
  });
  res.status(201).json(item);
});
coreRouter.get("/requests/:id", async (req, res) => res.json(await prisma.emergencyRequest.findUniqueOrThrow({ where: { id: paramId(req.params.id) }, include: { user: true, disaster: true, tasks: true } })));
coreRouter.put("/requests/:id", authorize("ADMIN", "AUTHORITY"), validate(requestSchema), async (req, res) => res.json(await prisma.emergencyRequest.update({ where: { id: paramId(req.params.id) }, data: req.body })));
coreRouter.patch(
  "/requests/:id/status",
  authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR", "VOLUNTEER"),
  validate(z.object({ status: z.enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CANCELLED"]) })),
  async (req, res) => {
    res.json(await prisma.emergencyRequest.update({
      where: { id: paramId(req.params.id) },
      data: { status: req.body.status },
      include: { user: { select: { id: true, name: true, email: true } } }
    }));
  }
);
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
coreRouter.post("/resources", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR", "VOLUNTEER"), validate(resourceSchema), create("resource"));
coreRouter.get("/resources/:id", async (req, res) => res.json(await prisma.resource.findUniqueOrThrow({ where: { id: paramId(req.params.id) } })));
coreRouter.put("/resources/:id", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR", "VOLUNTEER"), validate(resourceSchema), update("resource"));
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
coreRouter.post("/shelters", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"), validate(shelterSchema), create("shelter"));
coreRouter.get("/shelters/:id", async (req, res) => res.json(await prisma.shelter.findUniqueOrThrow({ where: { id: paramId(req.params.id) } })));
coreRouter.put("/shelters/:id", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"), validate(shelterSchema), update("shelter"));
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

coreRouter.get(
  "/users/recipients",
  authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"),
  async (req, res) => {
    const users = await prisma.user.findMany({
      where: {
        role: {
          name: {
            in: ["AFFECTED_INDIVIDUAL", "VOLUNTEER"]
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: {
          select: {
            name: true
          }
        }
      },
      orderBy: { name: "asc" }
    });
    res.json({ data: users });
  }
);

coreRouter.get("/notifications", async (req, res) => res.json({ data: await prisma.notification.findMany({ where: { OR: [{ userId: req.user!.id }, { userId: null }] }, orderBy: { createdAt: "desc" } }) }));

coreRouter.post(
  "/notifications/send",
  authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR"),
  validate(z.object({
    title: z.string().min(1),
    message: z.string().min(1),
    targetType: z.enum(["ROLE", "USER"]),
    targetRole: z.enum(["AFFECTED_INDIVIDUAL", "VOLUNTEER"]).optional(),
    targetUserId: z.string().optional()
  })),
  async (req, res) => {
    const { title, message, targetType, targetRole, targetUserId } = req.body;

    if (targetType === "USER") {
      if (!targetUserId) {
        return res.status(400).json({ message: "targetUserId is required for targetType USER" });
      }
      const item = await prisma.notification.create({
        data: {
          title,
          message,
          userId: targetUserId,
          channel: "SYSTEM"
        }
      });
      res.status(201).json(item);
    } else if (targetType === "ROLE") {
      if (!targetRole) {
        return res.status(400).json({ message: "targetRole is required for targetType ROLE" });
      }
      const users = await prisma.user.findMany({
        where: {
          role: {
            name: targetRole
          }
        },
        select: { id: true }
      });

      const notificationsData = users.map(user => ({
        title,
        message,
        userId: user.id,
        channel: "SYSTEM"
      }));

      if (notificationsData.length > 0) {
        await prisma.notification.createMany({
          data: notificationsData
        });
      }

      res.status(201).json({ message: `Message sent to all ${targetRole}s` });
    }
  }
);

coreRouter.delete("/notifications/:id", async (req, res) => {
  const { id } = req.params;
  const notification = await prisma.notification.findUniqueOrThrow({
    where: { id: paramId(id) }
  });

  if (notification.userId !== req.user!.id) {
    return res.status(403).json({ message: "Forbidden: You cannot delete someone else's notification." });
  }

  await prisma.notification.delete({
    where: { id: paramId(id) }
  });

  res.json({ message: "Notification removed" });
});

coreRouter.post("/notifications/broadcast", authorize("ADMIN", "AUTHORITY"), validate(z.object({ title: z.string(), message: z.string(), channel: z.string().default("EMAIL") })), create("notification"));

coreRouter.get("/analytics", authorize("ADMIN", "AUTHORITY", "NGO_COORDINATOR", "VOLUNTEER", "AFFECTED_INDIVIDUAL"), async (_req, res) => {
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

coreRouter.post("/chat", async (req, res) => {
  const message = String(req.body.message || "").toLowerCase().trim();
  let response = "";

  try {
    // 1. Fetch current database state in parallel
    const [disasters, resources, shelters, volunteers, requests] = await Promise.all([
      prisma.disaster.findMany(),
      prisma.resource.findMany(),
      prisma.shelter.findMany(),
      prisma.volunteer.findMany({ include: { user: true } }),
      prisma.emergencyRequest.findMany({ include: { user: true } })
    ]);

    const activeDisasters = disasters.filter(d => d.status === "ACTIVE");
    const totalCap = shelters.reduce((s, sh) => s + sh.capacity, 0);
    const totalOcc = shelters.reduce((s, sh) => s + sh.occupiedBeds, 0);
    const availableVolunteers = volunteers.filter(v => v.availability);

    // 2. Format live context
    const context = `
Current System Time: ${new Date().toISOString()}
Active Disasters (${activeDisasters.length}):
${activeDisasters.map(d => `- ${d.title} (${d.type}) in ${d.location} (Severity: ${d.severity})`).join("\n") || "None"}

Shelters (${shelters.length}):
Total occupancy: ${totalOcc}/${totalCap} beds occupied.
${shelters.map(s => `- ${s.name}: ${s.occupiedBeds}/${s.capacity} occupied beds. Address: ${s.address}`).join("\n") || "None"}

Resources (${resources.length}):
${resources.map(r => `- ${r.name} (${r.category}): ${r.quantity} available at ${r.location} [Status: ${r.status}]`).join("\n") || "None"}

Volunteers (${volunteers.length}):
${volunteers.map(v => `- ${v.user.name} in ${v.location} (Skills: ${v.skills.join(", ")}) [Status: ${v.availability ? "Available" : "Busy"}]`).join("\n") || "None"}

Emergency Requests (${requests.length}):
${requests.map(r => `- ${r.requestType} [Priority: ${r.priority}] Status: ${r.status} (${r.description}) Requested by: ${r.user?.name || "Unknown"}`).slice(0, 10).join("\n") || "None"}
`;

    const systemPrompt = `You are the DRRCS Relief Assistant, an advanced AI chatbot operating within the Disaster Response and Relief Coordination System.
Help the user by answering queries using this real-time database state:
${context}

Always answer the user's specific question directly, professionally, and briefly. Format lists using markdown bullet points. If the question is general or not about system status, answer it politely using your general knowledge.`;

    let llmResponse = "";
    try {
      const response = await fetch("https://text.pollinations.ai/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: req.body.message || "" }
          ],
          stream: false
        })
      });

      if (response.ok) {
        llmResponse = await response.text();
      } else {
        // Try GET fallback
        const getUrl = `https://text.pollinations.ai/${encodeURIComponent(req.body.message || "")}?system=${encodeURIComponent(systemPrompt)}`;
        const fallbackRes = await fetch(getUrl);
        if (fallbackRes.ok) {
          llmResponse = await fallbackRes.text();
        }
      }
    } catch (err) {
      console.error("LLM fetch failed, falling back to local rule-based answers:", err);
    }

    // 3. Process LLM response or run local rule-based fallback
    if (llmResponse && !llmResponse.includes("Queue full") && !llmResponse.includes(`"error"`) && !llmResponse.startsWith(`{"error"`)) {
      response = llmResponse;
    } else {
      // Local fallback parsing
      if (message.includes("disaster") || message.includes("incident") || message.includes("active")) {
        if (activeDisasters.length === 0) {
          response = "There are currently no active disasters reported in the system.";
        } else {
          response = `There are ${activeDisasters.length} active disaster(s):\n` +
            activeDisasters.map(d => `- **${d.title}** (${d.type}) in *${d.location}* (Severity: ${d.severity})`).join("\n");
        }
      }
      else if (message.includes("resource") || message.includes("water") || message.includes("medicine") || message.includes("food") || message.includes("blanket") || message.includes("kit")) {
        if (resources.length === 0) {
          response = "No relief resources are registered in the system yet.";
        } else {
          response = `Here is the current resource inventory:\n` +
            resources.map(r => `- **${r.name}** (${r.category}): ${r.quantity} available at *${r.location}* [Status: ${r.status}]`).join("\n");
        }
      }
      else if (message.includes("shelter") || message.includes("capacity") || message.includes("bed") || message.includes("occupancy")) {
        if (shelters.length === 0) {
          response = "No emergency shelters are registered in the system.";
        } else {
          response = `We have ${shelters.length} shelter(s) registered with a total occupancy of **${totalOcc}/${totalCap}** beds:\n` +
            shelters.map(s => `- **${s.name}**: ${s.occupiedBeds}/${s.capacity} beds occupied (Address: *${s.address}*)`).join("\n");
        }
      }
      else if (message.includes("volunteer") || message.includes("skills")) {
        if (volunteers.length === 0) {
          response = "There are no registered volunteers in the system.";
        } else {
          response = `There are ${volunteers.length} volunteer(s) registered (${availableVolunteers.length} currently available):\n` +
            volunteers.map(v => `- **${v.user.name}** in *${v.location}* (Skills: ${v.skills.join(", ")}) [Status: ${v.availability ? "Available" : "Busy"}]`).join("\n");
        }
      }
      else if (message.includes("request") || message.includes("my request") || message.includes("status")) {
        const userRequests = req.user!.role === "AFFECTED_INDIVIDUAL"
          ? requests.filter(r => r.userId === req.user!.id)
          : requests;

        if (userRequests.length === 0) {
          response = "No emergency resource requests found.";
        } else {
          response = `Here are the emergency requests:\n` +
            userRequests.map(r => `- **${r.requestType}** [Priority: ${r.priority}] Status: **${r.status}** (${r.description})`).slice(0, 8).join("\n");
        }
      }
      else if (message.includes("hello") || message.includes("hi") || message.includes("hey") || message.includes("help")) {
        response = "Hello! I am your DRRCS Assistant. I can help you with real-time operations info. You can ask me about:\n" +
          "- **Active disasters**: 'Are there active disasters?'\n" +
          "- **Resources**: 'What resources are available?'\n" +
          "- **Shelters**: 'Show me shelter occupancy'\n" +
          "- **Volunteers**: 'Who are the available volunteers?'\n" +
          "- **Emergency Requests**: 'What is the status of requests?'";
      }
      else {
        response = "I'm not sure how to answer that. I can assist with queries about active disasters, resource stock, shelter capacities, volunteer availabilities, or emergency request status. Try asking 'help' to see what I can do!";
      }
    }
  } catch (err: any) {
    console.error(err);
    response = "Sorry, I encountered an issue querying the operational database. Please try again in a moment.";
  }

  res.json({ response });
});

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
