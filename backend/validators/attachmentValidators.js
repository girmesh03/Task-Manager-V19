/**
 * Attachment Validators
 * Validation rules for attachment management endpoints
 */

import { body, param, query } from "express-validator";
import {
  isValidObjectId,
  objectIdExistsInOrganization,
  isAllowedFileType,
  isValidFileSize,
  validators,
} from "./validationMiddleware.js";
import {
  VALIDATION_LIMITS,
  FILE_UPLOAD,
  ATTACHMENT_MODELS_ARRAY,
} from "../constants/index.js";

/**
 * Validation rules for attachment ID parameter
 */
export const validateAttachmentId = [
  param("id")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid attachment ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("Attachment")),
];

/**
 * Validation rules for creating an attachment
 */
export const validateCreateAttachment = [
  body("fileName")
    .trim()
    .notEmpty()
    .withMessage("File name is required")
    .isLength({ min: 1, max: 255 })
    .withMessage("File name must be between 1 and 255 characters"),

  body("originalName")
    .trim()
    .notEmpty()
    .withMessage("Original file name is required")
    .isLength({ min: 1, max: 255 })
    .withMessage("Original file name must be between 1 and 255 characters"),

  body("mimeType")
    .trim()
    .notEmpty()
    .withMessage("MIME type is required")
    .custom((value) => isAllowedFileType(value)),

  body("size")
    .notEmpty()
    .withMessage("File size is required")
    .isInt({ min: 1, max: FILE_UPLOAD.MAX_FILE_SIZE })
    .withMessage(
      `File size must be between 1 byte and ${Math.round(
        FILE_UPLOAD.MAX_FILE_SIZE / (1024 * 1024)
      )}MB`
    )
    .toInt()
    .custom((value) => isValidFileSize(value, FILE_UPLOAD.MAX_FILE_SIZE)),

  body("cloudinaryUrl")
    .trim()
    .notEmpty()
    .withMessage("Cloudinary URL is required")
    .isURL()
    .withMessage("Cloudinary URL must be a valid URL"),

  body("cloudinaryPublicId")
    .trim()
    .notEmpty()
    .withMessage("Cloudinary public ID is required")
    .isLength({ min: 1, max: 255 })
    .withMessage("Cloudinary public ID must be between 1 and 255 characters"),

  body("attachmentType")
    .notEmpty()
    .withMessage("Attachment type is required")
    .custom(validators.attachmentType),

  body("attachedTo")
    .notEmpty()
    .withMessage("Attached entity ID is required")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid attached entity ID format");
      }
      return true;
    }),

  body("attachedToModel")
    .notEmpty()
    .withMessage("Attached entity model is required")
    .custom(validators.attachmentModel),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (tags.length > 10) {
        throw new Error("Cannot have more than 10 tags");
      }
      const invalidTags = tags.filter(
        (tag) => typeof tag !== "string" || tag.trim().length === 0
      );
      if (invalidTags.length > 0) {
        throw new Error("All tags must be non-empty strings");
      }
      return true;
    }),
];

/**
 * Validation rules for updating an attachment
 */
export const validateUpdateAttachment = [
  ...validateAttachmentId,

  body("fileName")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("File name cannot be empty")
    .isLength({ min: 1, max: 255 })
    .withMessage("File name must be between 1 and 255 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (tags.length > 10) {
        throw new Error("Cannot have more than 10 tags");
      }
      const invalidTags = tags.filter(
        (tag) => typeof tag !== "string" || tag.trim().length === 0
      );
      if (invalidTags.length > 0) {
        throw new Error("All tags must be non-empty strings");
      }
      return true;
    }),
];

/**
 * Validation rules for file upload
 */
export const validateFileUpload = [
  body("attachedTo")
    .notEmpty()
    .withMessage("Attached entity ID is required")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid attached entity ID format");
      }
      return true;
    }),

  body("attachedToModel")
    .notEmpty()
    .withMessage("Attached entity model is required")
    .custom(validators.attachmentModel),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot exceed 500 characters"),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (tags && tags.length > 10) {
        throw new Error("Cannot have more than 10 tags");
      }
      if (tags) {
        const invalidTags = tags.filter(
          (tag) => typeof tag !== "string" || tag.trim().length === 0
        );
        if (invalidTags.length > 0) {
          throw new Error("All tags must be non-empty strings");
        }
      }
      return true;
    }),
];

/**
 * Validation rules for attachment listing query parameters
 */
export const validateAttachmentQuery = [
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

  query("attachmentType").optional().custom(validators.attachmentType),

  query("attachedToModel").optional().custom(validators.attachmentModel),

  query("attachedTo")
    .optional()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid attached entity ID format");
      }
      return true;
    }),

  query("mimeType")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("MIME type filter must be between 1 and 100 characters"),

  query("minSize")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Minimum size must be a non-negative integer")
    .toInt(),

  query("maxSize")
    .optional()
    .isInt({ min: 1, max: FILE_UPLOAD.MAX_FILE_SIZE })
    .withMessage(
      `Maximum size must be between 1 and ${FILE_UPLOAD.MAX_FILE_SIZE} bytes`
    )
    .toInt(),

  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Date from must be a valid date"),

  query("dateTo")
    .optional()
    .isISO8601()
    .withMessage("Date to must be a valid date"),

  query("tags")
    .optional()
    .isArray()
    .withMessage("Tags filter must be an array")
    .custom((tags) => {
      const invalidTags = tags.filter(
        (tag) => typeof tag !== "string" || tag.trim().length === 0
      );
      if (invalidTags.length > 0) {
        throw new Error("All tag filters must be non-empty strings");
      }
      return true;
    }),

  query("sortBy")
    .optional()
    .isIn([
      "fileName",
      "originalName",
      "size",
      "attachmentType",
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
 * Validation rules for bulk attachment operations
 */
export const validateBulkAttachmentOperation = [
  body("attachmentIds")
    .isArray({ min: 1 })
    .withMessage("Attachment IDs must be a non-empty array")
    .custom((ids) => {
      const invalidIds = ids.filter((id) => !isValidObjectId(id));
      if (invalidIds.length > 0) {
        throw new Error(
          `Invalid attachment ID format: ${invalidIds.join(", ")}`
        );
      }
      if (ids.length > 50) {
        throw new Error("Cannot process more than 50 attachments at once");
      }
      return true;
    }),

  body("operation")
    .notEmpty()
    .withMessage("Operation is required")
    .isIn(["delete", "updateTags", "move"])
    .withMessage("Operation must be one of: delete, updateTags, move"),

  body("operationData")
    .optional()
    .isObject()
    .withMessage("Operation data must be an object"),
];

/**
 * Validation rules for attachment soft delete
 */
export const validateDeleteAttachment = [
  ...validateAttachmentId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Deletion reason cannot exceed 500 characters"),

  body("deleteFromCloudinary")
    .optional()
    .isBoolean()
    .withMessage("deleteFromCloudinary must be a boolean")
    .toBoolean(),
];

export default {
  validateAttachmentId,
  validateCreateAttachment,
  validateUpdateAttachment,
  validateFileUpload,
  validateAttachmentQuery,
  validateBulkAttachmentOperation,
  validateDeleteAttachment,
};
