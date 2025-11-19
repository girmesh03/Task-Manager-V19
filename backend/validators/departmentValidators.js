/**
 * Department Validators
 * Validation rules for department management endpoints
 */

import { body, param, query } from "express-validator";
import {
  isValidObjectId,
  objectIdExistsInOrganization,
  isUniqueInOrganization,
  validators,
} from "./validationMiddleware.js";
import { VALIDATION_LIMITS, REGEX_PATTERNS } from "../constants/index.js";

/**
 * Validation rules for department ID parameter
 */
export const validateDepartmentId = [
  param("id")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid department ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("Department")),
];

/**
 * Validation rules for creating a department
 */
export const validateCreateDepartment = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Department name is required")
    .isLength({ min: 2, max: VALIDATION_LIMITS.DEPARTMENT_NAME_MAX })
    .withMessage(
      `Department name must be between 2 and ${VALIDATION_LIMITS.DEPARTMENT_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC_WITH_SPECIAL)
    .withMessage("Department name contains invalid characters")
    .custom(isUniqueInOrganization("Department", "name")),

  body("description")
    .optional()
    .trim()
    .isLength({ max: VALIDATION_LIMITS.DEPARTMENT_DESCRIPTION_MAX })
    .withMessage(
      `Department description cannot exceed ${VALIDATION_LIMITS.DEPARTMENT_DESCRIPTION_MAX} characters`
    ),
];

/**
 * Validation rules for updating a department
 */
export const validateUpdateDepartment = [
  ...validateDepartmentId,

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Department name cannot be empty")
    .isLength({ min: 2, max: VALIDATION_LIMITS.DEPARTMENT_NAME_MAX })
    .withMessage(
      `Department name must be between 2 and ${VALIDATION_LIMITS.DEPARTMENT_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC_WITH_SPECIAL)
    .withMessage("Department name contains invalid characters")
    .custom(isUniqueInOrganization("Department", "name")),

  body("description")
    .optional()
    .trim()
    .isLength({ max: VALIDATION_LIMITS.DEPARTMENT_DESCRIPTION_MAX })
    .withMessage(
      `Department description cannot exceed ${VALIDATION_LIMITS.DEPARTMENT_DESCRIPTION_MAX} characters`
    ),
];

/**
 * Validation rules for department listing query parameters
 */
export const validateDepartmentQuery = [
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

  query("sortBy")
    .optional()
    .isIn(["name", "description", "createdAt", "updatedAt"])
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

  query("includeUserCount")
    .optional()
    .isBoolean()
    .withMessage("includeUserCount must be a boolean")
    .toBoolean(),
];

/**
 * Validation rules for department soft delete
 */
export const validateDeleteDepartment = [
  ...validateDepartmentId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Deletion reason cannot exceed 500 characters"),
];

/**
 * Validation rules for department restore
 */
export const validateRestoreDepartment = [
  ...validateDepartmentId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Restore reason cannot exceed 500 characters"),
];

export default {
  validateDepartmentId,
  validateCreateDepartment,
  validateUpdateDepartment,
  validateDepartmentQuery,
  validateDeleteDepartment,
  validateRestoreDepartment,
};
