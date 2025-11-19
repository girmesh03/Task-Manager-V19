/**
 * Task Validators
 * Validation rules for task management endpoints
 */

import { body, param, query } from "express-validator";
import {
  isValidObjectId,
  objectIdExistsInOrganization,
  objectIdExistsInDepartment,
  isValidObjectIdArrayInOrganization,
  isFutureDate,
  validators,
} from "./validationMiddleware.js";
import {
  VALIDATION_LIMITS,
  TASK_STATUS,
  TASK_PRIORITY,
  TASK_TYPES,
  BUSINESS_RULES,
} from "../constants/index.js";

/**
 * Validation rules for task ID parameter
 */
export const validateTaskId = [
  param("id")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid task ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("BaseTask")),
];

/**
 * Custom validator for RoutineTask restrictions
 */
const validateRoutineTaskRestrictions = (value, { req }) => {
  const taskType = req.body.taskType;
  const status = req.body.status;
  const priority = req.body.priority;

  if (taskType === TASK_TYPES.ROUTINE_TASK) {
    if (
      status &&
      BUSINESS_RULES.ROUTINE_TASK_FORBIDDEN_STATUS.includes(status)
    ) {
      throw new Error(`RoutineTask cannot have "${status}" status`);
    }

    if (
      priority &&
      BUSINESS_RULES.ROUTINE_TASK_FORBIDDEN_PRIORITY.includes(priority)
    ) {
      throw new Error(`RoutineTask cannot have "${priority}" priority`);
    }
  }

  return true;
};

/**
 * Custom validator for task type determination
 */
const validateTaskTypeFields = (value, { req }) => {
  const {
    assignedTo,
    vendor,
    estimatedCost,
    actualCost,
    frequency,
    estimatedDuration,
  } = req.body;

  // Determine task type based on fields
  let determinedType = TASK_TYPES.ROUTINE_TASK;

  if (assignedTo && assignedTo.length > 0) {
    determinedType = TASK_TYPES.ASSIGNED_TASK;
  }

  if (vendor || estimatedCost !== undefined || actualCost !== undefined) {
    determinedType = TASK_TYPES.PROJECT_TASK;
  }

  // If taskType is explicitly provided, validate it matches the determined type
  if (value && value !== determinedType) {
    throw new Error(
      `Task type "${value}" does not match the provided fields. Expected: ${determinedType}`
    );
  }

  // Set the determined type
  req.body.taskType = determinedType;

  return true;
};

/**
 * Validation rules for creating a task
 */
export const validateCreateTask = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Task title is required")
    .isLength({ min: 3, max: VALIDATION_LIMITS.TASK_TITLE_MAX })
    .withMessage(
      `Task title must be between 3 and ${VALIDATION_LIMITS.TASK_TITLE_MAX} characters`
    ),

  body("description")
    .optional()
    .trim()
    .isLength({ max: VALIDATION_LIMITS.TASK_DESCRIPTION_MAX })
    .withMessage(
      `Task description cannot exceed ${VALIDATION_LIMITS.TASK_DESCRIPTION_MAX} characters`
    ),

  body("status")
    .optional()
    .custom(validators.taskStatus)
    .custom(validateRoutineTaskRestrictions),

  body("priority")
    .optional()
    .custom(validators.taskPriority)
    .custom(validateRoutineTaskRestrictions),

  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Due date must be a valid date")
    .custom(isFutureDate),

  body("department")
    .optional()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error("Invalid department ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("Department")),

  // Task type determination
  body("taskType")
    .optional()
    .custom(validators.taskType)
    .custom(validateTaskTypeFields),

  // RoutineTask specific fields
  body("frequency").optional().custom(validators.taskFrequency),

  body("estimatedDuration")
    .optional()
    .isInt({
      min: VALIDATION_LIMITS.ESTIMATED_DURATION_MIN,
      max: VALIDATION_LIMITS.ESTIMATED_DURATION_MAX,
    })
    .withMessage(
      `Estimated duration must be between ${VALIDATION_LIMITS.ESTIMATED_DURATION_MIN} and ${VALIDATION_LIMITS.ESTIMATED_DURATION_MAX} minutes`
    )
    .toInt(),

  // AssignedTask specific fields
  body("assignedTo")
    .optional()
    .isArray({ min: 1 })
    .withMessage("Assigned users must be a non-empty array")
    .custom(isValidObjectIdArrayInOrganization("User")),

  body("assignedBy")
    .optional()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error("Invalid assigned by user ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("User")),

  // ProjectTask specific fields
  body("vendor")
    .optional()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error("Invalid vendor ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("Vendor")),

  body("estimatedCost")
    .optional()
    .isFloat({
      min: VALIDATION_LIMITS.COST_MIN,
      max: VALIDATION_LIMITS.COST_MAX,
    })
    .withMessage(
      `Estimated cost must be between ${VALIDATION_LIMITS.COST_MIN} and ${VALIDATION_LIMITS.COST_MAX}`
    )
    .toFloat(),

  body("actualCost")
    .optional()
    .isFloat({
      min: VALIDATION_LIMITS.COST_MIN,
      max: VALIDATION_LIMITS.COST_MAX,
    })
    .withMessage(
      `Actual cost must be between ${VALIDATION_LIMITS.COST_MIN} and ${VALIDATION_LIMITS.COST_MAX}`
    )
    .toFloat(),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  body("projectManager")
    .optional()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error("Invalid project manager ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("User")),
];

/**
 * Validation rules for updating a task
 */
export const validateUpdateTask = [
  ...validateTaskId,

  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Task title cannot be empty")
    .isLength({ min: 3, max: VALIDATION_LIMITS.TASK_TITLE_MAX })
    .withMessage(
      `Task title must be between 3 and ${VALIDATION_LIMITS.TASK_TITLE_MAX} characters`
    ),

  body("description")
    .optional()
    .trim()
    .isLength({ max: VALIDATION_LIMITS.TASK_DESCRIPTION_MAX })
    .withMessage(
      `Task description cannot exceed ${VALIDATION_LIMITS.TASK_DESCRIPTION_MAX} characters`
    ),

  body("status")
    .optional()
    .custom(validators.taskStatus)
    .custom(validateRoutineTaskRestrictions),

  body("priority")
    .optional()
    .custom(validators.taskPriority)
    .custom(validateRoutineTaskRestrictions),

  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Due date must be a valid date")
    .custom(isFutureDate),

  // RoutineTask specific fields
  body("frequency").optional().custom(validators.taskFrequency),

  body("estimatedDuration")
    .optional()
    .isInt({
      min: VALIDATION_LIMITS.ESTIMATED_DURATION_MIN,
      max: VALIDATION_LIMITS.ESTIMATED_DURATION_MAX,
    })
    .withMessage(
      `Estimated duration must be between ${VALIDATION_LIMITS.ESTIMATED_DURATION_MIN} and ${VALIDATION_LIMITS.ESTIMATED_DURATION_MAX} minutes`
    )
    .toInt(),

  // AssignedTask specific fields
  body("assignedTo")
    .optional()
    .isArray({ min: 1 })
    .withMessage("Assigned users must be a non-empty array")
    .custom(isValidObjectIdArrayInOrganization("User")),

  // ProjectTask specific fields
  body("vendor")
    .optional()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error("Invalid vendor ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("Vendor")),

  body("estimatedCost")
    .optional()
    .isFloat({
      min: VALIDATION_LIMITS.COST_MIN,
      max: VALIDATION_LIMITS.COST_MAX,
    })
    .withMessage(
      `Estimated cost must be between ${VALIDATION_LIMITS.COST_MIN} and ${VALIDATION_LIMITS.COST_MAX}`
    )
    .toFloat(),

  body("actualCost")
    .optional()
    .isFloat({
      min: VALIDATION_LIMITS.COST_MIN,
      max: VALIDATION_LIMITS.COST_MAX,
    })
    .withMessage(
      `Actual cost must be between ${VALIDATION_LIMITS.COST_MIN} and ${VALIDATION_LIMITS.COST_MAX}`
    )
    .toFloat(),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  body("projectManager")
    .optional()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error("Invalid project manager ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("User")),
];

/**
 * Validation rules for task listing query parameters
 */
export const validateTaskQuery = [
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

  query("search")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),

  query("status").optional().custom(validators.taskStatus),

  query("priority").optional().custom(validators.taskPriority),

  query("taskType").optional().custom(validators.taskType),

  query("department")
    .optional()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid department ID format");
      }
      return true;
    }),

  query("assignedTo")
    .optional()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid assigned user ID format");
      }
      return true;
    }),

  query("createdBy")
    .optional()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid created by user ID format");
      }
      return true;
    }),

  query("vendor")
    .optional()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid vendor ID format");
      }
      return true;
    }),

  query("overdue")
    .optional()
    .isBoolean()
    .withMessage("Overdue filter must be a boolean")
    .toBoolean(),

  query("dueDateFrom")
    .optional()
    .isISO8601()
    .withMessage("Due date from must be a valid date"),

  query("dueDateTo")
    .optional()
    .isISO8601()
    .withMessage("Due date to must be a valid date"),

  query("sortBy")
    .optional()
    .isIn(["title", "status", "priority", "dueDate", "createdAt", "updatedAt"])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc", "1", "-1"])
    .withMessage("Sort order must be asc, desc, 1, or -1"),

  query("includeDeleted")
    .optional()
    .isBoolean()
    .withMessage("includeDeleted must be a boolean")
    .toBoolean(),
];

/**
 * Validation rules for task soft delete
 */
export const validateDeleteTask = [
  ...validateTaskId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Deletion reason cannot exceed 500 characters"),
];

/**
 * Validation rules for task restore
 */
export const validateRestoreTask = [
  ...validateTaskId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Restore reason cannot exceed 500 characters"),
];

export default {
  validateTaskId,
  validateCreateTask,
  validateUpdateTask,
  validateTaskQuery,
  validateDeleteTask,
  validateRestoreTask,
};
