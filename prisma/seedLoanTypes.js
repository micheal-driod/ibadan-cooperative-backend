const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const loanTypes = [
    {
      name: "commodity_loan",
      interest_rate: 12.0,
      min_duration_months: 3,
      max_duration_months: 3,
      min_amount: 1000,
      max_amount: 1000000,
      is_active: true,
    },
    {
      name: "soft_loan",
      interest_rate: 10.0,
      min_duration_months: 3,
      max_duration_months: 3,
      min_amount: 1000,
      max_amount: 1000000,
      is_active: true,
    },
    {
      name: "long_term_loan",
      interest_rate: 6.0,
      min_duration_months: 1,
      max_duration_months: 15,
      min_amount: 1000,
      max_amount: 5000000,
      is_active: true,
    },
  ];

  for (const loanType of loanTypes) {
    await prisma.loanType.upsert({
      where: { name: loanType.name },
      update: {
        interest_rate: loanType.interest_rate,
        min_duration_months: loanType.min_duration_months,
        max_duration_months: loanType.max_duration_months,
        min_amount: loanType.min_amount,
        max_amount: loanType.max_amount,
        is_active: loanType.is_active,
      },
      create: loanType,
    });
  }

  console.log("Loan types seeded successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });