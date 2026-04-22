const express = require("express");
const router = express.Router();

const {
  submitRegistrationRequest,
  getAllRegistrationRequests,
  approveRegistrationRequest,
  rejectRegistrationRequest,
} = require("../controllers/memberRegistrationController");

const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/signup", submitRegistrationRequest);

router.get("/", protect, authorize("admin", "ict_officer"), getAllRegistrationRequests);
router.patch("/:id/approve", protect, authorize("admin", "ict_officer"), approveRegistrationRequest);
router.patch("/:id/reject", protect, authorize("admin", "ict_officer"), rejectRegistrationRequest);

module.exports = router;