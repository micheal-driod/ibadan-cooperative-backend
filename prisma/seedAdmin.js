const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const adminRole = await prisma.role.findUnique({
    where: { role_name: "admin" },
  });

  if (!adminRole) {
    throw new Error("Admin role not found. Seed roles first.");
  }

  const existingAdmin = await prisma.staffUser.findUnique({
    where: { email: "admin@akurecoop.com" },
  });

  if (existingAdmin) {
    console.log("Admin already exists");
    return;
  }

  const hashedPassword = await bcrypt.hash("Admin123@", 10);

  await prisma.staffUser.create({
    data: {
      full_name: "System Admin",
      email: "admin@akurecoop.com",
      password_hash: hashedPassword,
      phone: "08000000000",
      role_id: adminRole.id,
      is_active: true,
    },
  });

  console.log("Admin user seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });