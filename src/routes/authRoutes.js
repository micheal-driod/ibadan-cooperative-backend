const express = require("express");
const router = express.Router();

const {
  staffLogin,
  memberLogin,
  memberChangePassword,
} = require("../controllers/authController");

router.post("/staff/login", staffLogin);
router.post("/member/login", memberLogin);
router.post("/member/change-password", memberChangePassword);

module.exports = router;