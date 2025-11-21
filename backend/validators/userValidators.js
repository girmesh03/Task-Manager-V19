/**
 * User Validators
 * Validation rules for user management endpoints
 */

import { body, param, query } from "express-validator";
import {
  isValidObjectId,
  objectIdExistsInOrganization,
  objectIdExistsInDepartment,
  isUniqueInOrganization,
  isStrongPassword,
  validators,
} from "./validationMiddleware.js";
import {
  VALIDATION_LIMITS,
  REGEX_PATTERNS,
  USER_ROLES,
  BUSINESS_RULES,
} from "../constants/index.js";

/**
 * Validation rules for user ID parameter
 */
export const validateUserId = [
  param("userId")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid user ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("User")),
];

/**
 * Custom validator for HOD position uniqueness
 */
const validateHODPosition = async (value, { req }) => {
  const role = req.body.role;
  const departmentId = req.body.department;

  // Only check for HOD roles
  if (!BUSINESS_RULES.HOD_ROLES.includes(role)) {
    return true;
  }

  if (!departmentId || !isValidObjectId(departmentId)) {
    throw new Error("Department is required for HOD roles");
  }

  // Check if position is unique for HOD roles within department
  const mongoose = await import("mongoose");
  const User = mongoose.default.model("User");

  const query = {
    department: departmentId,
    position: value,
    role: { $in: BUSINESS_RULES.HOD_ROLES },
    isDeleted: { $ne: true },
  };

  // Exclude current user from check (for updates)
  if (req.params) {
    // Check for any ID parameter in params and use it for exclusion
    const idParam = Object.keys(req.params).find(
      (key) => key.endsWith("Id") && isValidObjectId(req.params[key])
    );
    if (idParam) {
      query._id = { $ne: req.params[idParam] };
    }
  }

  const existingUser = await User.findOne(query);
  if (existingUser) {
    throw new Error("Position already exists for HOD role in this department");
  }

  return true;
};

/**
 * Validation rules for creating a user
 */
export const validateCreateUser = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: VALIDATION_LIMITS.FIRST_NAME_MAX })
    .withMessage(
      `First name must be between 2 and ${VALIDATION_LIMITS.FIRST_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC)
    .withMessage("First name can only contain letters, numbers, and spaces"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: VALIDATION_LIMITS.LAST_NAME_MAX })
    .withMessage(
      `Last name must be between 2 and ${VALIDATION_LIMITS.LAST_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC)
    .withMessage("Last name can only contain letters, numbers, and spaces"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail()
    .isLength({ max: VALIDATION_LIMITS.EMAIL_MAX })
    .withMessage(
      `Email cannot exceed ${VALIDATION_LIMITS.EMAIL_MAX} characters`
    )
    .custom(isUniqueInOrganization("User", "email")),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({
      min: VALIDATION_LIMITS.PASSWORD_MIN,
      max: VALIDATION_LIMITS.PASSWORD_MAX,
    })
    .withMessage(
      `Password must be between ${VALIDATION_LIMITS.PASSWORD_MIN} and ${VALIDATION_LIMITS.PASSWORD_MAX} characters`
    )
    .custom(isStrongPassword),

  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .custom(validators.userRole),

  body("position")
    .trim()
    .notEmpty()
    .withMessage("Position is required")
    .isLength({ min: 2, max: VALIDATION_LIMITS.POSITION_MAX })
    .withMessage(
      `Position must be between 2 and ${VALIDATION_LIMITS.POSITION_MAX} characters`
    )
    .custom(validateHODPosition),

  body("department")
    .notEmpty()
    .withMessage("Department is required")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid department ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("Department")),

  body("profilePicture")
    .optional()
    .trim()
    .matches(REGEX_PATTERNS.URL)
    .withMessage("Profile picture must be a valid URL"),

  body("status").optional().custom(validators.userStatus),
];

/**
 * Validation rules for updating a user
 */
export const validateUpdateUser = [
  ...validateUserId,

  body("firstName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("First name cannot be empty")
    .isLength({ min: 2, max: VALIDATION_LIMITS.FIRST_NAME_MAX })
    .withMessage(
      `First name must be between 2 and ${VALIDATION_LIMITS.FIRST_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC)
    .withMessage("First name can only contain letters, numbers, and spaces"),

  body("lastName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Last name cannot be empty")
    .isLength({ min: 2, max: VALIDATION_LIMITS.LAST_NAME_MAX })
    .withMessage(
      `Last name must be between 2 and ${VALIDATION_LIMITS.LAST_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC)
    .withMessage("Last name can only contain letters, numbers, and spaces"),

  body("email")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Email cannot be empty")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail()
    .isLength({ max: VALIDATION_LIMITS.EMAIL_MAX })
    .withMessage(
      `Email cannot exceed ${VALIDATION_LIMITS.EMAIL_MAX} characters`
    )
    .custom(isUniqueInOrganization("User", "email")),

  body("role")
    .optional()
    .notEmpty()
    .withMessage("Role cannot be empty")
    .custom(validators.userRole),

  body("position")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Position cannot be empty")
    .isLength({ min: 2, max: VALIDATION_LIMITS.POSITION_MAX })
    .withMessage(
      `Position must be between 2 and ${VALIDATION_LIMITS.POSITION_MAX} characters`
    )
    .custom(validateHODPosition),

  body("department")
    .optional()
    .notEmpty()
    .withMessage("Department cannot be empty")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid department ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("Department")),

  body("profilePicture")
    .optional()
    .trim()
    .matches(REGEX_PATTERNS.URL)
    .withMessage("Profile picture must be a valid URL"),

  body("status").optional().custom(validators.userStatus),
];

/**
 * Validation rules for updating user profile (self-update)
 */
export const validateUpdateProfile = [
  body("firstName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("First name cannot be empty")
    .isLength({ min: 2, max: VALIDATION_LIMITS.FIRST_NAME_MAX })
    .withMessage(
      `First name must be between 2 and ${VALIDATION_LIMITS.FIRST_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC)
    .withMessage("First name can only contain letters, numbers, and spaces"),

  body("lastName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Last name cannot be empty")
    .isLength({ min: 2, max: VALIDATION_LIMITS.LAST_NAME_MAX })
    .withMessage(
      `Last name must be between 2 and ${VALIDATION_LIMITS.LAST_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC)
    .withMessage("Last name can only contain letters, numbers, and spaces"),

  body("profilePicture")
    .optional()
    .trim()
    .matches(REGEX_PATTERNS.URL)
    .withMessage("Profile picture must be a valid URL"),

  body("status").optional().custom(validators.userStatus),
];

/**
 * Validation rules for user listing query parameters
 */
export const validateUserQuery = [
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

  query("role").optional().custom(validators.userRole),

  query("department")
    .optional()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid department ID format");
      }
      return true;
    }),

  query("status").optional().custom(validators.userStatus),

  query("sortBy")
    .optional()
    .isIn([
      "firstName",
      "lastName",
      "email",
      "role",
      "position",
      "status",
      "createdAt",
      "updatedAt",
      "lastLogin",
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
 * Validation rules for user status update
 */
export const validateUpdateUserStatus = [
  ...validateUserId,

  body("status")
    .notEmpty()
    .withMessage("Status is required")
    .custom(validators.userStatus),
];

/**
 * Validation rules for user soft delete
 */
export const validateDeleteUser = [
  ...validateUserId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Deletion reason cannot exceed 500 characters"),
];

/**
 * Validation rules for user restore
 */
export const validateRestoreUser = [
  ...validateUserId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Restore reason cannot exceed 500 characters"),
];

export default {
  validateUserId,
  validateCreateUser,
  validateUpdateUser,
  validateUpdateProfile,
  validateUserQuery,
  validateUpdateUserStatus,
  validateDeleteUser,
  validateRestoreUser,
};
