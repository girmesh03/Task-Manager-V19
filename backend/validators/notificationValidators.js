/**
 * Notification Validators
 * Validation rules for notification management endpoints
 */

import { body, param, query } from "express-validator";
import {
  isValidObjectId,
  objectIdExistsInOrganization,
  validators,
} from "./validationMiddleware.js";
import { NOTIFICATION_PRIORITY_ARRAY } from "../constants/index.js";
import { VALIDATION_LIMITS } from "../constants/index.js";

/**
 * Validation rules for notification ID parameter
 */
export const validateNotificationId = [
  param("notificationId")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid notification ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("Notification")),
];

/**
 * Validation rules for creating a notification (system use only)
 */
export const validateCreateNotification = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Notification title is required")
    .isLength({ min: 3, max: VALIDATION_LIMITS.NOTIFICATION_TITLE_MAX })
    .withMessage(
      `Notification title must be between 3 and ${VALIDATION_LIMITS.NOTIFICATION_TITLE_MAX} characters`
    ),

  body("message")
    .trim()
    .notEmpty()
    .withMessage("Notification message is required")
    .isLength({ min: 3, max: VALIDATION_LIMITS.NOTIFICATION_MESSAGE_MAX })
    .withMessage(
      `Notification message must be between 3 and ${VALIDATION_LIMITS.NOTIFICATION_MESSAGE_MAX} characters`
    ),

  body("type")
    .notEmpty()
    .withMessage("Notification type is required")
    .custom(validators.notificationType),

  body("recipient")
    .notEmpty()
    .withMessage("Notification recipient is required")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid recipient ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("User")),

  body("relatedEntity")
    .optional()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error("Invalid related entity ID format");
      }
      return true;
    }),

  body("relatedEntityModel").optional().custom(validators.attachmentModel), // Reuse attachment model validator as they share similar models

  body("metadata")
    .optional()
    .isObject()
    .withMessage("Metadata must be an object"),

  body("priority")
    .optional()
    .isIn(NOTIFICATION_PRIORITY_ARRAY)
    .withMessage(
      `Priority must be one of: ${NOTIFICATION_PRIORITY_ARRAY.join(", ")}`
    ),

  body("channels")
    .optional()
    .isArray()
    .withMessage("Channels must be an array")
    .custom((channels) => {
      const validChannels = ["email", "realtime", "sms"];
      const invalidChannels = channels.filter(
        (channel) => !validChannels.includes(channel)
      );
      if (invalidChannels.length > 0) {
        throw new Error(
          `Invalid channels: ${invalidChannels.join(
            ", "
          )}. Valid channels: ${validChannels.join(", ")}`
        );
      }
      return true;
    }),
];

/**
 * Validation rules for updating notification status
 */
export const validateUpdateNotificationStatus = [
  ...validateNotificationId,

  body("status")
    .notEmpty()
    .withMessage("Notification status is required")
    .custom(validators.notificationStatus),
];

/**
 * Validation rules for marking multiple notifications as read
 */
export const validateMarkNotificationsRead = [
  body("notificationIds")
    .isArray({ min: 1 })
    .withMessage("Notification IDs must be a non-empty array")
    .custom((ids) => {
      const invalidIds = ids.filter((id) => !isValidObjectId(id));
      if (invalidIds.length > 0) {
        throw new Error(
          `Invalid notification ID format: ${invalidIds.join(", ")}`
        );
      }
      return true;
    }),
];

/**
 * Validation rules for notification listing query parameters
 */
export const validateNotificationQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: VALIDATION_LIMITS.PAGE_SIZE_MAX })
    .withMessage(
      `Limit must be between 1 and ${VALIDATION_LIMITS.PAGE_SIZE_MAX}`
    )
    .toInt(),

  query("status").optional().custom(validators.notificationStatus),

  query("type").optional().custom(validators.notificationType),

  query("priority")
    .optional()
    .isIn(NOTIFICATION_PRIORITY_ARRAY)
    .withMessage(
      `Priority must be one of: ${NOTIFICATION_PRIORITY_ARRAY.join(", ")}`
    ),

  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Date from must be a valid date"),

  query("dateTo")
    .optional()
    .isISO8601()
    .withMessage("Date to must be a valid date"),

  query("sortBy")
    .optional()
    .isIn(["title", "type", "status", "priority", "createdAt", "readAt"])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc", "1", "-1"])
    .withMessage("Sort order must be asc, desc, 1, or -1"),

  query("unreadOnly")
    .optional()
    .isBoolean()
    .withMessage("unreadOnly must be a boolean")
    .toBoolean(),
];

/**
 * Validation rules for notification preferences
 */
export const validateNotificationPreferences = [
  body("emailNotifications")
    .optional()
    .isBoolean()
    .withMessage("Email notifications preference must be a boolean")
    .toBoolean(),

  body("realtimeNotifications")
    .optional()
    .isBoolean()
    .withMessage("Realtime notifications preference must be a boolean")
    .toBoolean(),

  body("smsNotifications")
    .optional()
    .isBoolean()
    .withMessage("SMS notifications preference must be a boolean")
    .toBoolean(),

  body("notificationTypes")
    .optional()
    .isObject()
    .withMessage("Notification types preferences must be an object")
    .custom((types) => {
      const validTypes = [
        "task_assigned",
        "task_updated",
        "task_completed",
        "comment_added",
        "mention",
        "activity_added",
        "system",
      ];
      const invalidTypes = Object.keys(types).filter(
        (type) => !validTypes.includes(type)
      );
      if (invalidTypes.length > 0) {
        throw new Error(
          `Invalid notification types: ${invalidTypes.join(
            ", "
          )}. Valid types: ${validTypes.join(", ")}`
        );
      }

      // Check that all values are booleans
      const nonBooleanValues = Object.entries(types).filter(
        ([key, value]) => typeof value !== "boolean"
      );
      if (nonBooleanValues.length > 0) {
        throw new Error(`Notification type preferences must be boolean values`);
      }

      return true;
    }),
];

/**
 * Validation rules for notification soft delete
 */
export const validateDeleteNotification = [
  ...validateNotificationId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Deletion reason cannot exceed 500 characters"),
];

export default {
  validateNotificationId,
  validateCreateNotification,
  validateUpdateNotificationStatus,
  validateMarkNotificationsRead,
  validateNotificationQuery,
  validateNotificationPreferences,
  validateDeleteNotification,
};
