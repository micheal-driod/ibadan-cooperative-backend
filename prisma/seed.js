const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // Seed roles
  await prisma.role.createMany({
    data: [
      { role_name: "admin" },
      { role_name: "ict_officer" },
      { role_name: "loan_officer" },
      { role_name: "member" }
    ],
    skipDuplicates: true
  });

  // Get admin role
  const adminRole = await prisma.role.findUnique({
    where: { role_name: "admin" }
  });

  if (!adminRole) {
    throw new Error("Admin role not found after seeding roles");
  }

  // Seed admin user
  const adminEmail = "admin@ibarffscoops.com";
  const adminPassword = "Admin@12345";
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const existingAdmin = await prisma.staffUser.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    await prisma.staffUser.create({
      data: {
        full_name: "Super Admin",
        email: adminEmail,
        password_hash: hashedPassword,
        phone: "08000000000",
        role_id: adminRole.id,
        is_active: true
      }
    });

    console.log("Admin user seeded successfully");
    console.log("Admin email:", adminEmail);
    console.log("Admin password:", adminPassword);
  } else {
    console.log("Admin user already exists, skipped");
  }

  // Seed loan types
  await prisma.loanType.createMany({
    data: [
      {
        name: "Commodity Loan",
        interest_rate: 5.0,
        min_duration_months: 3,
        max_duration_months: 3,
        min_amount: 0,
        max_amount: 100000000,
        is_active: true
      },
      {
        name: "Soft Loan",
        interest_rate: 5.0,
        min_duration_months: 3,
        max_duration_months: 3,
        min_amount: 0,
        max_amount: 100000000,
        is_active: true
      },
      {
        name: "Long-Term Loan",
        interest_rate: 5.0,
        min_duration_months: 15,
        max_duration_months: 18,
        min_amount: 0,
        max_amount: 100000000,
        is_active: true
      }
    ],
    skipDuplicates: true
  });

  console.log("Roles seeded successfully");
  console.log("Loan types seeded successfully");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });