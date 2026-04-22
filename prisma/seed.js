const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.role.createMany({
    data: [
      { role_name: "admin" },
      { role_name: "ict_officer" },
      { role_name: "loan_officer" },
      { role_name: "member" }
    ],
    skipDuplicates: true
  });

  console.log("Roles seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });