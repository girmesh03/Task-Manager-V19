/**
 * Authentication Validators
 * Validation rules for authentication endpoints
 */

import { body, param } from "express-validator";
import {
  isValidObjectId,
  isStrongPassword,
  validators,
} from "./validationMiddleware.js";
import {
  VALIDATION_LIMITS,
  REGEX_PATTERNS,
  ORGANIZATION_SIZES_ARRAY,
} from "../constants/index.js";

/**
 * Validation rules for organization registration
 */
export const validateOrganizationRegistration = [
  // Organization fields
  body("organizationName")
    .trim()
    .notEmpty()
    .withMessage("Organization name is required")
    .isLength({ min: 2, max: VALIDATION_LIMITS.ORGANIZATION_NAME_MAX })
    .withMessage(
      `Organization name must be between 2 and ${VALIDATION_LIMITS.ORGANIZATION_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC_WITH_SPECIAL)
    .withMessage("Organization name contains invalid characters"),

  body("organizationDescription")
    .optional()
    .trim()
    .isLength({ max: VALIDATION_LIMITS.ORGANIZATION_DESCRIPTION_MAX })
    .withMessage(
      `Organization description cannot exceed ${VALIDATION_LIMITS.ORGANIZATION_DESCRIPTION_MAX} characters`
    ),

  body("organizationEmail")
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

  body("organizationPhone")
    .trim()
    .notEmpty()
    .withMessage("Organization phone is required")
    .matches(REGEX_PATTERNS.PHONE)
    .withMessage("Please provide a valid phone number"),

  body("organizationAddress")
    .trim()
    .notEmpty()
    .withMessage("Organization address is required")
    .isLength({ min: 5, max: VALIDATION_LIMITS.ORGANIZATION_ADDRESS_MAX })
    .withMessage(
      `Address must be between 5 and ${VALIDATION_LIMITS.ORGANIZATION_ADDRESS_MAX} characters`
    ),

  body("organizationSize")
    .notEmpty()
    .withMessage("Organization size is required")
    .custom(validators.organizationSize),

  body("organizationIndustry")
    .trim()
    .notEmpty()
    .withMessage("Industry is required")
    .isLength({ min: 2, max: VALIDATION_LIMITS.ORGANIZATION_INDUSTRY_MAX })
    .withMessage(
      `Industry must be between 2 and ${VALIDATION_LIMITS.ORGANIZATION_INDUSTRY_MAX} characters`
    ),

  body("organizationLogo")
    .optional()
    .trim()
    .matches(REGEX_PATTERNS.URL)
    .withMessage("Logo must be a valid URL"),

  // Department fields
  body("departmentName")
    .trim()
    .notEmpty()
    .withMessage("Department name is required")
    .isLength({ min: 2, max: VALIDATION_LIMITS.DEPARTMENT_NAME_MAX })
    .withMessage(
      `Department name must be between 2 and ${VALIDATION_LIMITS.DEPARTMENT_NAME_MAX} characters`
    )
    .matches(REGEX_PATTERNS.ALPHANUMERIC_WITH_SPECIAL)
    .withMessage("Department name contains invalid characters"),

  body("departmentDescription")
    .optional()
    .trim()
    .isLength({ max: VALIDATION_LIMITS.DEPARTMENT_DESCRIPTION_MAX })
    .withMessage(
      `Department description cannot exceed ${VALIDATION_LIMITS.DEPARTMENT_DESCRIPTION_MAX} characters`
    ),

  // SuperAdmin user fields
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
    ),

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

  body("position")
    .trim()
    .notEmpty()
    .withMessage("Position is required")
    .isLength({ min: 2, max: VALIDATION_LIMITS.POSITION_MAX })
    .withMessage(
      `Position must be between 2 and ${VALIDATION_LIMITS.POSITION_MAX} characters`
    ),

  body("profilePicture")
    .optional()
    .trim()
    .matches(REGEX_PATTERNS.URL)
    .withMessage("Profile picture must be a valid URL"),
];

/**
 * Validation rules for user login
 */
export const validateLogin = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("password").notEmpty().withMessage("Password is required"),

  body("organizationId")
    .optional()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error("Invalid organization ID format");
      }
      return true;
    }),
];

/**
 * Validation rules for forgot password
 */
export const validateForgotPassword = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please provide a valid email address")
    .normalizeEmail(),

  body("organizationId")
    .optional()
    .custom((value) => {
      if (value && !isValidObjectId(value)) {
        throw new Error("Invalid organization ID format");
      }
      return true;
    }),
];

/**
 * Validation rules for password reset
 */
export const validatePasswordReset = [
  body("token").notEmpty().withMessage("Reset token is required"),

  body("password")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({
      min: VALIDATION_LIMITS.PASSWORD_MIN,
      max: VALIDATION_LIMITS.PASSWORD_MAX,
    })
    .withMessage(
      `Password must be between ${VALIDATION_LIMITS.PASSWORD_MIN} and ${VALIDATION_LIMITS.PASSWORD_MAX} characters`
    )
    .custom(isStrongPassword),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Password confirmation is required")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Password confirmation does not match password");
      }
      return true;
    }),
];

/**
 * Validation rules for password change
 */
export const validatePasswordChange = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),

  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({
      min: VALIDATION_LIMITS.PASSWORD_MIN,
      max: VALIDATION_LIMITS.PASSWORD_MAX,
    })
    .withMessage(
      `Password must be between ${VALIDATION_LIMITS.PASSWORD_MIN} and ${VALIDATION_LIMITS.PASSWORD_MAX} characters`
    )
    .custom(isStrongPassword)
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error("New password must be different from current password");
      }
      return true;
    }),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Password confirmation is required")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Password confirmation does not match new password");
      }
      return true;
    }),
];

/**
 * Validation rules for refresh token
 */
export const validateRefreshToken = [
  body("refreshToken")
    .optional()
    .isString()
    .withMessage("Refresh token must be a string"),
];

export default {
  validateOrganizationRegistration,
  validateLogin,
  validateForgotPassword,
  validatePasswordReset,
  validatePasswordChange,
  validateRefreshToken,
};
