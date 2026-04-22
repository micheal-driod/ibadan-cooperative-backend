const bcrypt = require("bcryptjs");
const prisma = require("../src/config/prisma");

async function main() {
  const roleName = "admin";
  const adminEmail = "newadmin@ibarffscoops.com";
  const adminPassword = "Admin@12345";
  const adminFullName = "IBARFFS Super Admin";
  const adminPhone = "08030000000";

  // Ensure admin role exists
  let role = await prisma.role.findUnique({
    where: { role_name: roleName },
  });

  if (!role) {
    role = await prisma.role.create({
      data: {
        role_name: roleName,
      },
    });
  }

  // Check if admin already exists
  const existingAdmin = await prisma.staffUser.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log("Admin already exists with this email.");
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.staffUser.create({
    data: {
      full_name: adminFullName,
      email: adminEmail,
      password_hash: hashedPassword,
      phone: adminPhone,
      role_id: role.id,
      is_active: true,
    },
    include: {
      role: true,
    },
  });

  console.log("New admin created successfully");
  console.log({
    id: admin.id,
    full_name: admin.full_name,
    email: admin.email,
    phone: admin.phone,
    role: admin.role.role_name,
    password: adminPassword,
  });
}

main()
  .catch((error) => {
    console.error("createAdmin error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });