const notificationsRouter = require("express").Router();
const { AppError } = require("../errors");
const { UserNotifications } = require("../models/index");
const { requireAuth } = require("../utils/middleware/middleware");

notificationsRouter.patch(
  "/:notificationId/confirm-delivery",
  requireAuth,
  async (request, response) => {
    const { notificationId } = request.params;
    const userId = request.user.id;
    const dbNotification = await UserNotifications.findOne({
      where: { id: notificationId },
    });

    if (!dbNotification) {
      throw new AppError({
        status: 404,
        code: "NOTIFICATION_NOT_FOUND",
        message: "notification not found",
        details: {},
      });
    }

    if (dbNotification.userId !== userId) {
      throw new AppError({
        status: 403,
        code: "FORBIDDEN",
        message: "forbidden",
        details: {},
      });
    }

    await dbNotification.update({ deliveredAt: new Date() });

    response.status(200).json("notification status succesfully updated");
  },
);

module.exports = notificationsRouter;
