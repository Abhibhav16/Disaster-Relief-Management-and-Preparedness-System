import bcrypt from "bcryptjs";
import { PrismaClient, RoleName } from "@prisma/client";

const prisma = new PrismaClient();
const passwordHash = bcrypt.hashSync("Password123!", 12);

async function main() {
  const roles = await Promise.all(Object.values(RoleName).map((name) => prisma.role.upsert({ where: { name }, update: {}, create: { name } })));
  const role = (name: RoleName) => roles.find((r) => r.name === name)!;

  const admin = await user("Admin User", "admin@drrcs.local", RoleName.ADMIN);
  await user("District Authority", "authority@drrcs.local", RoleName.AUTHORITY);
  const ngoUser = await user("NGO Coordinator", "ngo@drrcs.local", RoleName.NGO_COORDINATOR);
  const volunteerUser = await user("Volunteer Responder", "volunteer@drrcs.local", RoleName.VOLUNTEER);
  const citizen = await user("Affected Citizen", "citizen@drrcs.local", RoleName.AFFECTED_INDIVIDUAL);

  if ((await prisma.disaster.count()) > 0) return;

  const ngo = await prisma.nGO.upsert({
    where: { registrationNo: "NGO-DRRCS-001" },
    update: {},
    create: { name: "Rapid Relief Foundation", registrationNo: "NGO-DRRCS-001", userId: ngoUser.id }
  });

  const volunteer = await prisma.volunteer.upsert({
    where: { userId: volunteerUser.id },
    update: {},
    create: { userId: volunteerUser.id, skills: ["First Aid", "Rescue", "Logistics"], phone: "+919999999999", location: "Mumbai", latitude: 19.076, longitude: 72.8777 }
  });

  const disaster = await prisma.disaster.create({
    data: {
      title: "Jalandhar Urban Flood Alert",
      type: "FLOOD",
      description: "Localized waterlogging near Jalandhar after intense rainfall.",
      location: "Jalandhar, Punjab",
      latitude: 31.326,
      longitude: 75.5762,
      severity: "MEDIUM",
      startDate: new Date(),
      status: "ACTIVE"
    }
  });

  await prisma.disaster.create({
    data: {
      title: "Minor Earthquake Near NIT Jalandhar",
      type: "EARTHQUAKE",
      description: "Minor tremors reported around NIT Jalandhar and nearby localities.",
      location: "NIT Jalandhar, Punjab",
      latitude: 31.3959,
      longitude: 75.5350,
      severity: "LOW",
      startDate: new Date(),
      status: "MONITORING"
    }
  });

  await prisma.emergencyRequest.create({
    data: {
      userId: citizen.id,
      disasterId: disaster.id,
      requestType: "Medical Assistance",
      description: "Elderly patient needs urgent medicine and evacuation support.",
      latitude: 19.081,
      longitude: 72.88,
      priority: "URGENT"
    }
  });

  await prisma.resource.createMany({
    data: [
      { name: "Drinking Water Cans", category: "Water", quantity: 500, location: "NIT Jalandhar Relief Store", provider: "Rapid Relief Foundation", ngoId: ngo.id, latitude: 31.3959, longitude: 75.5350 },
      { name: "First Aid Kits", category: "Medicine", quantity: 120, location: "Civil Hospital Jalandhar Supply Desk", provider: "Health Dept", latitude: 31.3260, longitude: 75.5762 },
      { name: "Blankets", category: "Shelter", quantity: 300, location: "Jalandhar District Relief Warehouse", provider: "Municipal Store", latitude: 31.3314, longitude: 75.5762 }
    ]
  });

  await prisma.shelter.createMany({
    data: [
      { name: "NIT Jalandhar Relief Shelter", address: "NIT Jalandhar Campus, GT Road, Jalandhar", latitude: 31.3959, longitude: 75.5350, capacity: 250, occupiedBeds: 144, contactPerson: "Asha Mehta", phone: "+911812345678" },
      { name: "Jalandhar Community Shelter", address: "Guru Gobind Singh Stadium, Jalandhar", latitude: 31.3260, longitude: 75.5762, capacity: 400, occupiedBeds: 220, contactPerson: "Rahul Nair", phone: "+911817654321" }
    ]
  });

  await prisma.task.create({
    data: {
      title: "Deliver medicine kit",
      description: "Pick up first aid kit from BKC Warehouse and deliver to request location.",
      disasterId: disaster.id,
      volunteerId: volunteer.id,
      status: "ACCEPTED"
    }
  });

  await prisma.notification.create({
    data: { userId: admin.id, title: "Seed data loaded", message: "DRRCS sample disaster response data is ready.", channel: "SYSTEM" }
  });

  async function user(name: string, email: string, roleName: RoleName) {
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: { name, email, passwordHash, phone: "+910000000000", roleId: role(roleName).id },
      include: { role: true }
    });
  }
}

main().finally(async () => prisma.$disconnect());
