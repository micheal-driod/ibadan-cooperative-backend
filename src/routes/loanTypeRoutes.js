const express = require("express");
const router = express.Router();
const { getLoanTypes } = require("../controllers/loanTypeController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/", protect, authorize("member", "admin", "ict_officer", "loan_officer"), getLoanTypes);

module.exports = router;