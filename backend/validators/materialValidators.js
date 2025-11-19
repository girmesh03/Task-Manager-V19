/**
 * Material Validators
 * Validation rules for material management endpoints
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
 * Validation rules for material ID parameter
 */
export const validateMaterialId = [
  param("id")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid material ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("Material")),
];

/**
 * Validation rules for creating a material
 */
export const validateCreateMaterial = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Material name is required")
    .isLength({ min: 2, max: VALIDATION_LIMITS.MATERIAL_NAME_MAX })
    .withMessage(
      `Material name must be between 2 and ${VALIDATION_LIMITS.MATERIAL_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC_WITH_SPECIAL)
    .withMessage("Material name contains invalid characters")
    .custom(isUniqueInOrganization("Material", "name")),

  body("description")
    .optional()
    .trim()
    .isLength({ max: VALIDATION_LIMITS.MATERIAL_DESCRIPTION_MAX })
    .withMessage(
      `Material description cannot exceed ${VALIDATION_LIMITS.MATERIAL_DESCRIPTION_MAX} characters`
    ),

  body("unit")
    .trim()
    .notEmpty()
    .withMessage("Material unit is required")
    .isLength({ min: 1, max: 20 })
    .withMessage("Material unit must be between 1 and 20 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Material unit can only contain letters and spaces"),

  body("currentQuantity")
    .optional()
    .isFloat({
      min: VALIDATION_LIMITS.MATERIAL_QUANTITY_MIN,
      max: VALIDATION_LIMITS.MATERIAL_QUANTITY_MAX,
    })
    .withMessage(
      `Current quantity must be between ${VALIDATION_LIMITS.MATERIAL_QUANTITY_MIN} and ${VALIDATION_LIMITS.MATERIAL_QUANTITY_MAX}`
    )
    .toFloat(),

  body("minimumQuantity")
    .optional()
    .isFloat({
      min: VALIDATION_LIMITS.MATERIAL_QUANTITY_MIN,
      max: VALIDATION_LIMITS.MATERIAL_QUANTITY_MAX,
    })
    .withMessage(
      `Minimum quantity must be between ${VALIDATION_LIMITS.MATERIAL_QUANTITY_MIN} and ${VALIDATION_LIMITS.MATERIAL_QUANTITY_MAX}`
    )
    .toFloat(),

  body("costPerUnit")
    .optional()
    .isFloat({
      min: VALIDATION_LIMITS.COST_MIN,
      max: VALIDATION_LIMITS.COST_MAX,
    })
    .withMessage(
      `Cost per unit must be between ${VALIDATION_LIMITS.COST_MIN} and ${VALIDATION_LIMITS.COST_MAX}`
    )
    .toFloat(),

  body("supplier")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Supplier name cannot exceed 100 characters"),

  body("category")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Category cannot exceed 50 characters"),

  body("location")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location cannot exceed 100 characters"),
];

/**
 * Validation rules for updating a material
 */
export const validateUpdateMaterial = [
  ...validateMaterialId,

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Material name cannot be empty")
    .isLength({ min: 2, max: VALIDATION_LIMITS.MATERIAL_NAME_MAX })
    .withMessage(
      `Material name must be between 2 and ${VALIDATION_LIMITS.MATERIAL_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC_WITH_SPECIAL)
    .withMessage("Material name contains invalid characters")
    .custom(isUniqueInOrganization("Material", "name")),

  body("description")
    .optional()
    .trim()
    .isLength({ max: VALIDATION_LIMITS.MATERIAL_DESCRIPTION_MAX })
    .withMessage(
      `Material description cannot exceed ${VALIDATION_LIMITS.MATERIAL_DESCRIPTION_MAX} characters`
    ),

  body("unit")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Material unit cannot be empty")
    .isLength({ min: 1, max: 20 })
    .withMessage("Material unit must be between 1 and 20 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Material unit can only contain letters and spaces"),

  body("currentQuantity")
    .optional()
    .isFloat({
      min: VALIDATION_LIMITS.MATERIAL_QUANTITY_MIN,
      max: VALIDATION_LIMITS.MATERIAL_QUANTITY_MAX,
    })
    .withMessage(
      `Current quantity must be between ${VALIDATION_LIMITS.MATERIAL_QUANTITY_MIN} and ${VALIDATION_LIMITS.MATERIAL_QUANTITY_MAX}`
    )
    .toFloat(),

  body("minimumQuantity")
    .optional()
    .isFloat({
      min: VALIDATION_LIMITS.MATERIAL_QUANTITY_MIN,
      max: VALIDATION_LIMITS.MATERIAL_QUANTITY_MAX,
    })
    .withMessage(
      `Minimum quantity must be between ${VALIDATION_LIMITS.MATERIAL_QUANTITY_MIN} and ${VALIDATION_LIMITS.MATERIAL_QUANTITY_MAX}`
    )
    .toFloat(),

  body("costPerUnit")
    .optional()
    .isFloat({
      min: VALIDATION_LIMITS.COST_MIN,
      max: VALIDATION_LIMITS.COST_MAX,
    })
    .withMessage(
      `Cost per unit must be between ${VALIDATION_LIMITS.COST_MIN} and ${VALIDATION_LIMITS.COST_MAX}`
    )
    .toFloat(),

  body("supplier")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Supplier name cannot exceed 100 characters"),

  body("category")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("Category cannot exceed 50 characters"),

  body("location")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location cannot exceed 100 characters"),
];

/**
 * Validation rules for material quantity adjustment
 */
export const validateAdjustMaterialQuantity = [
  ...validateMaterialId,

  body("adjustment")
    .notEmpty()
    .withMessage("Quantity adjustment is required")
    .isFloat()
    .withMessage("Quantity adjustment must be a number")
    .toFloat(),

  body("reason")
    .trim()
    .notEmpty()
    .withMessage("Adjustment reason is required")
    .isLength({ min: 3, max: 200 })
    .withMessage("Adjustment reason must be between 3 and 200 characters"),
];

/**
 * Validation rules for material-task association
 */
export const validateMaterialTaskAssociation = [
  body("materialId")
    .notEmpty()
    .withMessage("Material ID is required")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid material ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("Material")),

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

  body("quantityUsed")
    .notEmpty()
    .withMessage("Quantity used is required")
    .isFloat({ min: 0.01, max: VALIDATION_LIMITS.MATERIAL_QUANTITY_MAX })
    .withMessage(
      `Quantity used must be between 0.01 and ${VALIDATION_LIMITS.MATERIAL_QUANTITY_MAX}`
    )
    .toFloat(),

  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes cannot exceed 500 characters"),
];

/**
 * Validation rules for material listing query parameters
 */
export const validateMaterialQuery = [
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

  query("category")
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("Category filter must be between 1 and 50 characters"),

  query("supplier")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Supplier filter must be between 1 and 100 characters"),

  query("location")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Location filter must be between 1 and 100 characters"),

  query("lowStock")
    .optional()
    .isBoolean()
    .withMessage("Low stock filter must be a boolean")
    .toBoolean(),

  query("sortBy")
    .optional()
    .isIn([
      "name",
      "category",
      "supplier",
      "currentQuantity",
      "minimumQuantity",
      "costPerUnit",
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
 * Validation rules for material soft delete
 */
export const validateDeleteMaterial = [
  ...validateMaterialId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Deletion reason cannot exceed 500 characters"),
];

/**
 * Validation rules for material restore
 */
export const validateRestoreMaterial = [
  ...validateMaterialId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Restore reason cannot exceed 500 characters"),
];

export default {
  validateMaterialId,
  validateCreateMaterial,
  validateUpdateMaterial,
  validateAdjustMaterialQuantity,
  validateMaterialTaskAssociation,
  validateMaterialQuery,
  validateDeleteMaterial,
  validateRestoreMaterial,
};
