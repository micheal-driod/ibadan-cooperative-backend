const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const generateToken = require("../utils/generateToken");

const staffLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const staff = await prisma.staffUser.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!staff) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!staff.is_active) {
      return res.status(403).json({ message: "Account is inactive" });
    }

    const isMatch = await bcrypt.compare(password, staff.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken({
      id: staff.id,
      type: "staff",
      role: staff.role.role_name,
    });

    return res.status(200).json({
      message: "Staff login successful",
      token,
      user: {
        id: staff.id,
        full_name: staff.full_name,
        email: staff.email,
        role: staff.role.role_name,
      },
    });
  } catch (error) {
    console.error("staffLogin error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const memberLogin = async (req, res) => {
  try {
    const { staff_no, password } = req.body;

    if (!staff_no || !password) {
      return res.status(400).json({
        message: "staff_no and password are required.",
      });
    }

    const member = await prisma.member.findUnique({
      where: { staff_no },
      include: { user_account: true },
    });

    if (!member || !member.user_account) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (member.status !== "active") {
      return res.status(403).json({ message: "Member account is not active" });
    }

    if (!member.user_account.is_active) {
      return res.status(403).json({ message: "Login access is disabled" });
    }

    const isMatch = await bcrypt.compare(
      password,
      member.user_account.password_hash
    );

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken({
      id: member.id,
      type: "member",
      role: "member",
    });

    return res.status(200).json({
      message: "Member login successful",
      token,
      user: {
        id: member.id,
        staff_no: member.staff_no,
        first_name: member.first_name,
        middle_name: member.middle_name,
        last_name: member.last_name,
        department: member.department,
        grade_level: member.grade_level,
        must_change_password: member.user_account.must_change_password,
      },
    });
  } catch (error) {
    console.error("memberLogin error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const memberChangePassword = async (req, res) => {
  try {
    const { staff_no, old_password, new_password } = req.body;

    const member = await prisma.member.findUnique({
      where: { staff_no },
      include: { user_account: true },
    });

    if (!member || !member.user_account) {
      return res.status(404).json({ message: "Member account not found" });
    }

    const isMatch = await bcrypt.compare(
      old_password,
      member.user_account.password_hash
    );

    if (!isMatch) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await prisma.userAccount.update({
      where: { member_id: member.id },
      data: {
        password_hash: hashedPassword,
        must_change_password: false,
        last_login: new Date(),
      },
    });

    return res.status(200).json({
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("memberChangePassword error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  staffLogin,
  memberLogin,
  memberChangePassword,
};