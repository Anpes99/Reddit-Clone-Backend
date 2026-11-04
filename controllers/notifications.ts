import { Router } from "express";
import { AppError } from "../errors";
import { UserNotifications } from "../models/index";
import { requireAuth } from "../utils/middleware/middleware";

const notificationsRouter = Router();

notificationsRouter.patch(
  "/:notificationId/confirm-delivery",
  requireAuth,
  async (request, response) => {
    const { notificationId } = request.params;
    const userId = request.user!.id;
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

export = notificationsRouter;
