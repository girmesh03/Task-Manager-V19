/**
 * Vendor Validators
 * Validation rules for vendor management endpoints
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
 * Validation rules for vendor ID parameter
 */
export const validateVendorId = [
  param("vendorId")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid vendor ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("Vendor")),
];

/**
 * Validation rules for creating a vendor
 */
export const validateCreateVendor = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Vendor name is required")
    .isLength({ min: 2, max: VALIDATION_LIMITS.VENDOR_NAME_MAX })
    .withMessage(
      `Vendor name must be between 2 and ${VALIDATION_LIMITS.VENDOR_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC_WITH_SPECIAL)
    .withMessage("Vendor name contains invalid characters")
    .custom(isUniqueInOrganization("Vendor", "name")),

  body("contactPerson")
    .trim()
    .notEmpty()
    .withMessage("Contact person is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Contact person must be between 2 and 100 characters")
    .matches(REGEX_PATTERNS.ALPHANUMERIC)
    .withMessage(
      "Contact person can only contain letters, numbers, and spaces"
    ),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Vendor email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail()
    .isLength({ max: VALIDATION_LIMITS.VENDOR_CONTACT_INFO_MAX })
    .withMessage(
      `Email cannot exceed ${VALIDATION_LIMITS.VENDOR_CONTACT_INFO_MAX} characters`
    ),

  body("phone")
    .trim()
    .notEmpty()
    .withMessage("Vendor phone is required")
    .matches(REGEX_PATTERNS.PHONE)
    .withMessage("Please provide a valid phone number"),

  body("address")
    .trim()
    .notEmpty()
    .withMessage("Vendor address is required")
    .isLength({ min: 5, max: VALIDATION_LIMITS.VENDOR_CONTACT_INFO_MAX })
    .withMessage(
      `Address must be between 5 and ${VALIDATION_LIMITS.VENDOR_CONTACT_INFO_MAX} characters`
    ),

  body("serviceCategories")
    .trim()
    .notEmpty()
    .withMessage("Service categories are required")
    .isLength({ min: 3, max: VALIDATION_LIMITS.VENDOR_SERVICE_CATEGORIES_MAX })
    .withMessage(
      `Service categories must be between 3 and ${VALIDATION_LIMITS.VENDOR_SERVICE_CATEGORIES_MAX} characters`
    ),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("website")
    .optional()
    .trim()
    .matches(REGEX_PATTERNS.URL)
    .withMessage("Website must be a valid URL"),

  body("taxId")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Tax ID cannot exceed 50 characters"),

  body("paymentTerms")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Payment terms cannot exceed 200 characters"),

  body("rating")
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5")
    .toFloat(),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean")
    .toBoolean(),
];

/**
 * Validation rules for updating a vendor
 */
export const validateUpdateVendor = [
  ...validateVendorId,

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Vendor name cannot be empty")
    .isLength({ min: 2, max: VALIDATION_LIMITS.VENDOR_NAME_MAX })
    .withMessage(
      `Vendor name must be between 2 and ${VALIDATION_LIMITS.VENDOR_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC_WITH_SPECIAL)
    .withMessage("Vendor name contains invalid characters")
    .custom(isUniqueInOrganization("Vendor", "name")),

  body("contactPerson")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Contact person cannot be empty")
    .isLength({ min: 2, max: 100 })
    .withMessage("Contact person must be between 2 and 100 characters")
    .matches(REGEX_PATTERNS.ALPHANUMERIC)
    .withMessage(
      "Contact person can only contain letters, numbers, and spaces"
    ),

  body("email")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Vendor email cannot be empty")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail()
    .isLength({ max: VALIDATION_LIMITS.VENDOR_CONTACT_INFO_MAX })
    .withMessage(
      `Email cannot exceed ${VALIDATION_LIMITS.VENDOR_CONTACT_INFO_MAX} characters`
    ),

  body("phone")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Vendor phone cannot be empty")
    .matches(REGEX_PATTERNS.PHONE)
    .withMessage("Please provide a valid phone number"),

  body("address")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Vendor address cannot be empty")
    .isLength({ min: 5, max: VALIDATION_LIMITS.VENDOR_CONTACT_INFO_MAX })
    .withMessage(
      `Address must be between 5 and ${VALIDATION_LIMITS.VENDOR_CONTACT_INFO_MAX} characters`
    ),

  body("serviceCategories")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Service categories cannot be empty")
    .isLength({ min: 3, max: VALIDATION_LIMITS.VENDOR_SERVICE_CATEGORIES_MAX })
    .withMessage(
      `Service categories must be between 3 and ${VALIDATION_LIMITS.VENDOR_SERVICE_CATEGORIES_MAX} characters`
    ),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot exceed 1000 characters"),

  body("website")
    .optional()
    .trim()
    .matches(REGEX_PATTERNS.URL)
    .withMessage("Website must be a valid URL"),

  body("taxId")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Tax ID cannot exceed 50 characters"),

  body("paymentTerms")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Payment terms cannot exceed 200 characters"),

  body("rating")
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5")
    .toFloat(),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean")
    .toBoolean(),
];

/**
 * Validation rules for vendor-task association
 */
export const validateVendorTaskAssociation = [
  body("vendorId")
    .notEmpty()
    .withMessage("Vendor ID is required")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid vendor ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("Vendor")),

  body("taskId")
    .notEmpty()
    .withMessage("Task ID is required")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid task ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("BaseTask")),

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

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

/**
 * Validation rules for vendor listing query parameters
 */
export const validateVendorQuery = [
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

  query("serviceCategory")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage(
      "Service category filter must be between 1 and 100 characters"
    ),

  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive filter must be a boolean")
    .toBoolean(),

  query("minRating")
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage("Minimum rating must be between 1 and 5")
    .toFloat(),

  query("maxRating")
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage("Maximum rating must be between 1 and 5")
    .toFloat(),

  query("sortBy")
    .optional()
    .isIn([
      "name",
      "contactPerson",
      "email",
      "serviceCategories",
      "rating",
      "isActive",
      "createdAt",
      "updatedAt",
    ])
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
 * Validation rules for vendor soft delete
 */
export const validateDeleteVendor = [
  ...validateVendorId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Deletion reason cannot exceed 500 characters"),
];

/**
 * Validation rules for vendor restore
 */
export const validateRestoreVendor = [
  ...validateVendorId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Restore reason cannot exceed 500 characters"),
];

export default {
  validateVendorId,
  validateCreateVendor,
  validateUpdateVendor,
  validateVendorTaskAssociation,
  validateVendorQuery,
  validateDeleteVendor,
  validateRestoreVendor,
};
