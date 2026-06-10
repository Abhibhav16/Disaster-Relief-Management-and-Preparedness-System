import { Router } from "express";
import bcrypt from "bcryptjs";
import { RoleName } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { signToken } from "../utils/tokens";
import { sendEmail } from "../services/email.service";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  role: z.enum(["AFFECTED_INDIVIDUAL", "VOLUNTEER", "NGO_COORDINATOR"]).default("AFFECTED_INDIVIDUAL"),
  latitude: z.number().optional(),
  longitude: z.number().optional()
});

authRouter.post("/register", validate(registerSchema), async (req, res) => {
  const { password, role, ...data } = req.body;
  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  const roleRecord = await prisma.role.findUniqueOrThrow({ where: { name: role } });
  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: { ...data, passwordHash: await bcrypt.hash(password, 12), roleId: roleRecord.id },
      include: { role: true }
    });

    if (role === "VOLUNTEER") {
      await tx.volunteer.create({
        data: {
          userId: createdUser.id,
          skills: [],
          phone: data.phone || "Not provided",
          location: "Not provided",
          latitude: data.latitude,
          longitude: data.longitude,
          availability: true
        }
      });
    }

    return createdUser;
  });

  await prisma.auditLog.create({ data: { actorId: user.id, action: "REGISTER", entity: "User", entityId: user.id } });
  res.status(201).json({ token: signToken(user), user: sanitize(user) });
});

authRouter.post(
  "/login",
  validate(z.object({ email: z.string().email(), password: z.string().min(1) })),
  async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email }, include: { role: true } });
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (!user.isActive) return res.status(403).json({ message: "User account is disabled" });
    if (user.role.name === "VOLUNTEER") {
      await prisma.volunteer.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          skills: [],
          phone: user.phone || "Not provided",
          location: "Not provided",
          latitude: user.latitude,
          longitude: user.longitude,
          availability: true
        }
      });
    }
    await prisma.auditLog.create({ data: { actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id } });
    res.json({ token: signToken(user), user: sanitize(user) });
  }
);

authRouter.post("/logout", authenticate, async (req, res) => {
  await prisma.auditLog.create({ data: { actorId: req.user?.id, action: "LOGOUT", entity: "User", entityId: req.user?.id } });
  res.status(204).send();
});

authRouter.post(
  "/forgot-password",
  validate(z.object({ email: z.string().email() })),
  async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (user) await sendEmail(user.email, "DRRCS password reset", "Use the reset-password endpoint with your reset token placeholder.");
    res.json({ message: "If the email exists, reset instructions have been sent." });
  }
);

authRouter.post(
  "/reset-password",
  validate(z.object({ email: z.string().email(), newPassword: z.string().min(8), token: z.string().min(1) })),
  async (req, res) => {
    await prisma.user.update({
      where: { email: req.body.email },
      data: { passwordHash: await bcrypt.hash(req.body.newPassword, 12) }
    });
    res.json({ message: "Password reset successful" });
  }
);

authRouter.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, include: { role: true } });
  res.json(sanitize(user));
});

function sanitize<T extends { passwordHash: string }>(user: T) {
  const { passwordHash, ...safe } = user;
  return safe;
}
