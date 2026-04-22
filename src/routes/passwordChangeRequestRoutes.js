const express = require("express");
const router = express.Router();

const {
  submitPasswordChangeRequest,
  getMyPasswordChangeRequests,
} = require("../controllers/passwordChangeRequestController");

const { protect, authorize } = require("../middleware/authMiddleware");

router.post("/", protect, authorize("member"), submitPasswordChangeRequest);
router.get("/mine", protect, authorize("member"), getMyPasswordChangeRequests);

module.exports = router;