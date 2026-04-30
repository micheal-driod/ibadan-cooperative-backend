const prisma = require("../config/prisma");

const getMyNotifications = async (req, res) => {
  try {
    const memberId = req.user.id;

    const notifications = await prisma.notification.findMany({
      where: { member_id: memberId },
      orderBy: { created_at: "desc" },
      take: 50,
    });

    res.json({ notifications });
  } catch (error) {
    console.error("getMyNotifications error:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const memberId = req.user.id;
    const { id } = req.params;

    const notification = await prisma.notification.updateMany({
      where: {
        id: Number(id),
        member_id: memberId,
      },
      data: { is_read: true },
    });

    res.json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("markNotificationAsRead error:", error);
    res.status(500).json({ message: "Failed to update notification" });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  try {
    const memberId = req.user.id;

    await prisma.notification.updateMany({
      where: {
        member_id: memberId,
        is_read: false,
      },
      data: { is_read: true },
    });

    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("markAllNotificationsAsRead error:", error);
    res.status(500).json({ message: "Failed to update notifications" });
  }
};

module.exports = {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};