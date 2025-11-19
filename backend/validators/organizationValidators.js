/**
 * Organization Validators
 * Validation rules for organization management endpoints
 */

import { body, param, query } from "express-validator";
import {
  isValidObjectId,
  objectIdExists,
  validators,
} from "./validationMiddleware.js";
import { VALIDATION_LIMITS, REGEX_PATTERNS } from "../constants/index.js";

/**
 * Validation rules for organization ID parameter
 */
export const validateOrganizationId = [
  param("organizationId")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid organization ID format");
      }
      return true;
    })
    .custom(objectIdExists("Organization")),
];

/**
 * Validation rules for creating an organization
 */
export const validateCreateOrganization = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Organization name is required")
    .isLength({ min: 2, max: VALIDATION_LIMITS.ORGANIZATION_NAME_MAX })
    .withMessage(
      `Organization name must be between 2 and ${VALIDATION_LIMITS.ORGANIZATION_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC_WITH_SPECIAL)
    .withMessage("Organization name contains invalid characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: VALIDATION_LIMITS.ORGANIZATION_DESCRIPTION_MAX })
    .withMessage(
      `Organization description cannot exceed ${VALIDATION_LIMITS.ORGANIZATION_DESCRIPTION_MAX} characters`
    ),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Organization email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail()
    .isLength({ max: VALIDATION_LIMITS.EMAIL_MAX })
    .withMessage(
      `Email cannot exceed ${VALIDATION_LIMITS.EMAIL_MAX} characters`
    ),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Organization phone is required")
    .matches(REGEX_PATTERNS.PHONE)
    .withMessage("Please provide a valid phone number"),

  body("address")
    .trim()
    .notEmpty()
    .withMessage("Organization address is required")
    .isLength({ min: 5, max: VALIDATION_LIMITS.ORGANIZATION_ADDRESS_MAX })
    .withMessage(
      `Address must be between 5 and ${VALIDATION_LIMITS.ORGANIZATION_ADDRESS_MAX} characters`
    ),

  body("size")
    .notEmpty()
    .withMessage("Organization size is required")
    .custom(validators.organizationSize),

  body("industry")
    .trim()
    .notEmpty()
    .withMessage("Industry is required")
    .isLength({ min: 2, max: VALIDATION_LIMITS.ORGANIZATION_INDUSTRY_MAX })
    .withMessage(
      `Industry must be between 2 and ${VALIDATION_LIMITS.ORGANIZATION_INDUSTRY_MAX} characters`
    ),

  body("logo")
    .optional()
    .trim()
    .matches(REGEX_PATTERNS.URL)
    .withMessage("Logo must be a valid URL"),
];

/**
 * Validation rules for updating an organization
 */
export const validateUpdateOrganization = [
  ...validateOrganizationId,

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Organization name cannot be empty")
    .isLength({ min: 2, max: VALIDATION_LIMITS.ORGANIZATION_NAME_MAX })
    .withMessage(
      `Organization name must be between 2 and ${VALIDATION_LIMITS.ORGANIZATION_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC_WITH_SPECIAL)
    .withMessage("Organization name contains invalid characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: VALIDATION_LIMITS.ORGANIZATION_DESCRIPTION_MAX })
    .withMessage(
      `Organization description cannot exceed ${VALIDATION_LIMITS.ORGANIZATION_DESCRIPTION_MAX} characters`
    ),

  body("email")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Organization email cannot be empty")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail()
    .isLength({ max: VALIDATION_LIMITS.EMAIL_MAX })
    .withMessage(
      `Email cannot exceed ${VALIDATION_LIMITS.EMAIL_MAX} characters`
    ),

  body("phone")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Organization phone cannot be empty")
    .matches(REGEX_PATTERNS.PHONE)
    .withMessage("Please provide a valid phone number"),

  body("address")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Organization address cannot be empty")
    .isLength({ min: 5, max: VALIDATION_LIMITS.ORGANIZATION_ADDRESS_MAX })
    .withMessage(
      `Address must be between 5 and ${VALIDATION_LIMITS.ORGANIZATION_ADDRESS_MAX} characters`
    ),

  body("size")
    .optional()
    .notEmpty()
    .withMessage("Organization size cannot be empty")
    .custom(validators.organizationSize),

  body("industry")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Industry cannot be empty")
    .isLength({ min: 2, max: VALIDATION_LIMITS.ORGANIZATION_INDUSTRY_MAX })
    .withMessage(
      `Industry must be between 2 and ${VALIDATION_LIMITS.ORGANIZATION_INDUSTRY_MAX} characters`
    ),

  body("logo")
    .optional()
    .trim()
    .matches(REGEX_PATTERNS.URL)
    .withMessage("Logo must be a valid URL"),
];

/**
 * Validation rules for organization listing query parameters
 */
export const validateOrganizationQuery = [
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

  query("size").optional().custom(validators.organizationSize),

  query("industry")
    .optional()
    .trim()
    .isLength({ min: 1, max: VALIDATION_LIMITS.ORGANIZATION_INDUSTRY_MAX })
    .withMessage(
      `Industry filter must be between 1 and ${VALIDATION_LIMITS.ORGANIZATION_INDUSTRY_MAX} characters`
    ),

  query("sortBy")
    .optional()
    .isIn(["name", "email", "industry", "size", "createdAt", "updatedAt"])
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
 * Validation rules for organization soft delete
 */
export const validateDeleteOrganization = [
  ...validateOrganizationId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Deletion reason cannot exceed 500 characters"),
];

/**
 * Validation rules for organization restore
 */
export const validateRestoreOrganization = [
  ...validateOrganizationId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Restore reason cannot exceed 500 characters"),
];

export default {
  validateOrganizationId,
  validateCreateOrganization,
  validateUpdateOrganization,
  validateOrganizationQuery,
  validateDeleteOrganization,
  validateRestoreOrganization,
};
