const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const generatePassword = require("../utils/generatePassword");

const buildFullName = (firstName, middleName, lastName) => {
  return `${firstName || ""}${middleName ? ` ${middleName}` : ""} ${lastName || ""}`
    .replace(/\s+/g, " ")
    .trim();
};

const attachLatestCredential = (member) => {
  const latestCredential = member.credential_logs?.[0] || null;

  return {
    ...member,
    latest_password: latestCredential?.plain_password || null,
    credential_type: latestCredential?.credential_type || null,
    password_generated_at: latestCredential?.created_at || null,
  };
};

const createMember = async (req, res) => {
  try {
    const {
      staff_no,
      membership_no,
      first_name,
      middle_name,
      last_name,
      phone,
      email,
      department,
      address,
      employment_status,
      grade_level,
      purpose,
      date_joined,
      status,
      bank_name,
      account_name,
      account_number,
    } = req.body;

    if (!staff_no || !first_name || !last_name) {
      return res.status(400).json({
        message: "staff_no, first_name, and last_name are required.",
      });
    }

    const existingMember = await prisma.member.findFirst({
      where: {
        OR: [
          { staff_no },
          ...(email ? [{ email }] : []),
          ...(membership_no ? [{ membership_no }] : []),
        ],
      },
    });

    if (existingMember) {
      return res.status(400).json({
        message:
          "Member with this staff number, email, or membership number already exists.",
      });
    }

    const generatedPassword = generatePassword(8);
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const member = await tx.member.create({
        data: {
          staff_no,
          membership_no,
          first_name,
          middle_name,
          last_name,
          phone,
          email,
          department,
          address,
          employment_status,
          grade_level,
          purpose,
          date_joined: date_joined ? new Date(date_joined) : null,
          status: status || "active",
          bank_name,
          account_name,
          account_number,
          user_account: {
            create: {
              username: staff_no,
              password_hash: hashedPassword,
              must_change_password: true,
              is_active: true,
            },
          },
        },
        include: {
          user_account: true,
        },
      });

      const credentialLog = await tx.memberCredentialLog.create({
        data: {
          member_id: member.id,
          staff_no: member.staff_no,
          full_name: buildFullName(
            member.first_name,
            member.middle_name,
            member.last_name
          ),
          credential_type: "INITIAL",
          plain_password: generatedPassword,
          generated_by: req.user.id,
        },
      });

      return { member, credentialLog };
    });

    return res.status(201).json({
      message: "Member created successfully",
      member: {
        id: result.member.id,
        staff_no: result.member.staff_no,
        first_name: result.member.first_name,
        middle_name: result.member.middle_name,
        last_name: result.member.last_name,
        phone: result.member.phone,
        email: result.member.email,
        department: result.member.department,
        grade_level: result.member.grade_level,
        address: result.member.address,
        employment_status: result.member.employment_status,
        bank_name: result.member.bank_name,
        account_name: result.member.account_name,
        account_number: result.member.account_number,
        status: result.member.status,
        username: result.member.user_account.username,
      },
      temporary_password: generatedPassword,
      credential: result.credentialLog,
    });
  } catch (error) {
    console.error("createMember error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getAllMembers = async (req, res) => {
  try {
    const { search = "" } = req.query;
    const trimmedSearch = String(search).trim();

    const members = await prisma.member.findMany({
      where: trimmedSearch
        ? {
            OR: [
              { staff_no: { contains: trimmedSearch, mode: "insensitive" } },
              { membership_no: { contains: trimmedSearch, mode: "insensitive" } },
              { first_name: { contains: trimmedSearch, mode: "insensitive" } },
              { middle_name: { contains: trimmedSearch, mode: "insensitive" } },
              { last_name: { contains: trimmedSearch, mode: "insensitive" } },
              { phone: { contains: trimmedSearch, mode: "insensitive" } },
              { email: { contains: trimmedSearch, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: {
        created_at: "desc",
      },
      include: {
        user_account: {
          select: {
            username: true,
            is_active: true,
            must_change_password: true,
            last_login: true,
          },
        },
        credential_logs: {
          orderBy: {
            created_at: "desc",
          },
          take: 1,
        },
      },
    });

    const formattedMembers = members.map(attachLatestCredential);

    return res.status(200).json({
      message: "Members retrieved successfully",
      count: formattedMembers.length,
      members: formattedMembers,
    });
  } catch (error) {
    console.error("getAllMembers error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getMemberById = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await prisma.member.findUnique({
      where: { id: Number(id) },
      include: {
        user_account: {
          select: {
            username: true,
            is_active: true,
            must_change_password: true,
            last_login: true,
          },
        },
        credential_logs: {
          orderBy: {
            created_at: "desc",
          },
          take: 1,
        },
      },
    });

    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    return res.status(200).json({
      message: "Member retrieved successfully",
      member: attachLatestCredential(member),
    });
  } catch (error) {
    console.error("getMemberById error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

const updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const memberId = Number(id);

    const existingMember = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!existingMember) {
      return res.status(404).json({ message: "Member not found" });
    }

    const {
      staff_no,
      membership_no,
      first_name,
      middle_name,
      last_name,
      phone,
      email,
      department,
      address,
      employment_status,
      grade_level,
      purpose,
      date_joined,
      status,
      bank_name,
      account_name,
      account_number,
    } = req.body;

    if (!staff_no || !first_name || !last_name) {
      return res.status(400).json({
        message: "staff_no, first_name, and last_name are required.",
      });
    }

    const conflictMember = await prisma.member.findFirst({
      where: {
        id: { not: memberId },
        OR: [
          { staff_no },
          ...(email ? [{ email }] : []),
          ...(membership_no ? [{ membership_no }] : []),
        ],
      },
    });

    if (conflictMember) {
      return res.status(400).json({
        message:
          "Another member already uses this staff number, email, or membership number.",
      });
    }

    const updatedMember = await prisma.$transaction(async (tx) => {
      const member = await tx.member.update({
        where: { id: memberId },
        data: {
          staff_no,
          membership_no: membership_no || null,
          first_name,
          middle_name: middle_name || null,
          last_name,
          phone: phone || null,
          email: email || null,
          department: department || null,
          address: address || null,
          employment_status: employment_status || null,
          grade_level: grade_level || null,
          purpose: purpose || null,
          date_joined: date_joined ? new Date(date_joined) : null,
          status: status || "active",
          bank_name: bank_name || null,
          account_name: account_name || null,
          account_number: account_number || null,
        },
        include: {
          user_account: {
            select: {
              username: true,
              is_active: true,
              must_change_password: true,
              last_login: true,
            },
          },
          credential_logs: {
            orderBy: {
              created_at: "desc",
            },
            take: 1,
          },
        },
      });

      if (existingMember.staff_no !== staff_no) {
        await tx.userAccount.update({
          where: { member_id: memberId },
          data: {
            username: staff_no,
          },
        });
      }

      return member;
    });

    return res.status(200).json({
      message: "Member updated successfully",
      member: attachLatestCredential(updatedMember),
    });
  } catch (error) {
    console.error("updateMember error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createMember,
  getAllMembers,
  getMemberById,
  updateMember,
};