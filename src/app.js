const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const testRoutes = require("./routes/testRoutes");
const loanRoutes = require("./routes/loanRoutes");
const memberRoutes = require("./routes/memberRoutes");
const ledgerRoutes = require("./routes/ledgerRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const loanTypeRoutes = require("./routes/loanTypeRoutes");
const memberLookupRoutes = require("./routes/memberLookupRoutes");
const memberSelfRoutes = require("./routes/memberSelfRoutes");
const passwordRequestAdminRoutes = require("./routes/passwordRequestAdminRoutes");
const memberRegistrationRoutes = require("./routes/memberRegistrationRoutes");
const adminMemberOnboardingRoutes = require("./routes/adminMemberOnboardingRoutes");
const adminSearchRoutes = require("./routes/adminSearchRoutes");
const bulkOnboardingRoutes = require("./routes/bulkOnboardingRoutes");
const bulkMonthlyPostingRoutes = require("./routes/bulkMonthlyPostingRoutes");
const openingBalanceRoutes = require("./routes/openingBalanceRoutes");
const passwordChangeRequestRoutes = require("./routes/passwordChangeRequestRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "IBARFFS COOPs Backend is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/test", testRoutes);
app.use("/api/loans", loanRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/loan-types", loanTypeRoutes);
app.use("/api/member-lookup", memberLookupRoutes);
app.use("/api/me", memberSelfRoutes);
app.use("/api/password-requests", passwordRequestAdminRoutes);
app.use("/api/registration-requests", memberRegistrationRoutes);
app.use("/api/admin-onboarding", adminMemberOnboardingRoutes);
app.use("/api/admin-search", adminSearchRoutes);
app.use("/api/bulk-onboarding", bulkOnboardingRoutes);
app.use("/api/bulk-monthly-posting", bulkMonthlyPostingRoutes);
app.use("/api/opening-balances", openingBalanceRoutes);
app.use("/api/password-change-requests", passwordChangeRequestRoutes);
app.use("/uploads", express.static("uploads"));
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});