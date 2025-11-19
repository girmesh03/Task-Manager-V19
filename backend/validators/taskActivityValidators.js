/**
 * Task Activity Validators
 * Validation rules for task activity management endpoints
 */

import { body, param, query } from "express-validator";
import {
  isValidObjectId,
  objectIdExistsInOrganization,
  validators,
} from "./validationMiddleware.js";
import {
  VALIDATION_LIMITS,
  BUSINESS_RULES,
  TASK_TYPES,
} from "../constants/index.js";

/**
 * Validation rules for task activity ID parameter
 */
export const validateTaskActivityId = [
  param("id")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid task activity ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("TaskActivity")),
];

/**
 * Custom validator to ensure task supports activities
 */
const validateTaskSupportsActivities = async (taskId, { req }) => {
  if (!isValidObjectId(taskId)) {
    throw new Error("Invalid task ID format");
  }

  const mongoose = await import("mongoose");
  const BaseTask = mongoose.default.model("BaseTask");

  const task = await BaseTask.findOne({
    _id: taskId,
    organization: req.user.organization._id,
    isDeleted: { $ne: true },
  });

  if (!task) {
    throw new Error("Task not found in your organization");
  }

  if (!BUSINESS_RULES.ACTIVITY_SUPPORTED_TASK_TYPES.includes(task.taskType)) {
    throw new Error(
      `Activities are not supported for ${
        task.taskType
      }. Only ${BUSINESS_RULES.ACTIVITY_SUPPORTED_TASK_TYPES.join(
        ", "
      )} support activities.`
    );
  }

  return true;
};

/**
 * Validation rules for creating a task activity
 */
export const validateCreateTaskActivity = [
  body("task")
    .notEmpty()
    .withMessage("Task ID is required")
    .custom(validateTaskSupportsActivities),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Activity description is required")
    .isLength({ min: 3, max: VALIDATION_LIMITS.ACTIVITY_DESCRIPTION_MAX })
    .withMessage(
      `Activity description must be between 3 and ${VALIDATION_LIMITS.ACTIVITY_DESCRIPTION_MAX} characters`
    ),

  body("status").optional().custom(validators.taskStatus),

  body("hoursSpent")
    .optional()
    .isFloat({ min: 0, max: 24 })
    .withMessage("Hours spent must be between 0 and 24")
    .toFloat(),

  body("progressPercentage")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Progress percentage must be between 0 and 100")
    .toInt(),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters"),

  body("isPrivate")
    .optional()
    .isBoolean()
    .withMessage("isPrivate must be a boolean")
    .toBoolean(),
];

/**
 * Validation rules for updating a task activity
 */
export const validateUpdateTaskActivity = [
  ...validateTaskActivityId,

  body("description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Activity description cannot be empty")
    .isLength({ min: 3, max: VALIDATION_LIMITS.ACTIVITY_DESCRIPTION_MAX })
    .withMessage(
      `Activity description must be between 3 and ${VALIDATION_LIMITS.ACTIVITY_DESCRIPTION_MAX} characters`
    ),

  body("status").optional().custom(validators.taskStatus),

  body("hoursSpent")
    .optional()
    .isFloat({ min: 0, max: 24 })
    .withMessage("Hours spent must be between 0 and 24")
    .toFloat(),

  body("progressPercentage")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Progress percentage must be between 0 and 100")
    .toInt(),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Notes cannot exceed 1000 characters"),

  body("isPrivate")
    .optional()
    .isBoolean()
    .withMessage("isPrivate must be a boolean")
    .toBoolean(),
];

/**
 * Validation rules for task activity listing query parameters
 */
export const validateTaskActivityQuery = [
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

  query("task")
    .optional()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid task ID format");
      }
      return true;
    }),

  query("user")
    .optional()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid user ID format");
      }
      return true;
    }),

  query("status").optional().custom(validators.taskStatus),

  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Date from must be a valid date"),

  query("dateTo")
    .optional()
    .isISO8601()
    .withMessage("Date to must be a valid date"),

  query("minHours")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum hours must be a non-negative number")
    .toFloat(),

  query("maxHours")
    .optional()
    .isFloat({ min: 0, max: 24 })
    .withMessage("Maximum hours must be between 0 and 24")
    .toFloat(),

  query("minProgress")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Minimum progress must be between 0 and 100")
    .toInt(),

  query("maxProgress")
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage("Maximum progress must be between 0 and 100")
    .toInt(),

  query("includePrivate")
    .optional()
    .isBoolean()
    .withMessage("includePrivate must be a boolean")
    .toBoolean(),

  query("sortBy")
    .optional()
    .isIn([
      "description",
      "status",
      "hoursSpent",
      "progressPercentage",
      "createdAt",
      "updatedAt",
    ])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc", "1", "-1"])
    .withMessage("Sort order must be asc, desc, 1, or -1"),
];

/**
 * Validation rules for task activity soft delete
 */
export const validateDeleteTaskActivity = [
  ...validateTaskActivityId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Deletion reason cannot exceed 500 characters"),
];

export default {
  validateTaskActivityId,
  validateCreateTaskActivity,
  validateUpdateTaskActivity,
  validateTaskActivityQuery,
  validateDeleteTaskActivity,
};
