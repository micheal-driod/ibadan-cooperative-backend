const express = require("express");
const router = express.Router();

const { lookupMemberByStaffNo } = require("../controllers/memberLookupController");
const { protect, authorize } = require("../middleware/authMiddleware");

router.get(
  "/:staff_no",
  protect,
  authorize("member", "admin", "ict_officer", "loan_officer"),
  lookupMemberByStaffNo
);

module.exports = router;