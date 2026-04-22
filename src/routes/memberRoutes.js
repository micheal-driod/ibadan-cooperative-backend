const express = require("express");
const router = express.Router();

const {
  createMember,
  getAllMembers,
  getMemberById,
  updateMember,
} = require("../controllers/memberController");

const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/", protect, authorize("admin", "ict_officer"), createMember);
router.get("/", protect, authorize("admin", "ict_officer"), getAllMembers);
router.get("/:id", protect, authorize("admin", "ict_officer"), getMemberById);
router.put("/:id", protect, authorize("admin", "ict_officer"), updateMember);

module.exports = router;