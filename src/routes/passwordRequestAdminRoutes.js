const express = require("express");
const router = express.Router();

const {
  getAllPasswordChangeRequests,
  approvePasswordChangeRequest,
  rejectPasswordChangeRequest,
} = require("../controllers/passwordRequestAdminController");

const { protect, authorize } = require("../middleware/authMiddleware");

router.get("/", protect, authorize("admin", "ict_officer"), getAllPasswordChangeRequests);
router.patch("/:id/approve", protect, authorize("admin", "ict_officer"), approvePasswordChangeRequest);
router.patch("/:id/reject", protect, authorize("admin", "ict_officer"), rejectPasswordChangeRequest);

module.exports = router;