const jwt = require("jsonwebtoken");
const prisma = require("../config/prisma");

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === "staff") {
      const staff = await prisma.staffUser.findUnique({
        where: { id: decoded.id },
        include: { role: true },
      });

      if (!staff || !staff.is_active) {
        return res.status(401).json({ message: "Staff account not found or inactive" });
      }

      req.user = {
        id: staff.id,
        type: "staff",
        role: staff.role.role_name,
        email: staff.email,
        full_name: staff.full_name,
      };
    } else if (decoded.type === "member") {
      const member = await prisma.member.findUnique({
        where: { id: decoded.id },
      });

      if (!member || member.status !== "active") {
        return res.status(401).json({ message: "Member account not found or inactive" });
      }

      req.user = {
        id: member.id,
        type: "member",
        role: "member",
        staff_no: member.staff_no,
      };
    } else {
      return res.status(401).json({ message: "Invalid token type" });
    }

    next();
  } catch (error) {
    console.error("protect middleware error:", error);
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};

module.exports = { protect, authorize };