/**
 * Task Comment Validators
 * Validation rules for task comment management endpoints
 */

import { body, param, query } from "express-validator";
import {
  isValidObjectId,
  objectIdExistsInOrganization,
  validators,
} from "./validationMiddleware.js";
import { VALIDATION_LIMITS } from "../constants/index.js";

/**
 * Validation rules for task comment ID parameter
 */
export const validateTaskCommentId = [
  param("id")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid task comment ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("TaskComment")),
];

/**
 * Custom validator for parent comment (threading)
 */
const validateParentComment = async (parentId, { req }) => {
  if (!parentId) return true; // Parent is optional

  if (!isValidObjectId(parentId)) {
    throw new Error("Invalid parent comment ID format");
  }

  const mongoose = await import("mongoose");
  const TaskComment = mongoose.default.model("TaskComment");

  const parentComment = await TaskComment.findOne({
    _id: parentId,
    organization: req.user.organization._id,
    isDeleted: { $ne: true },
  });

  if (!parentComment) {
    throw new Error("Parent comment not found in your organization");
  }

  // Ensure parent comment belongs to the same task
  if (req.body.task && parentComment.task.toString() !== req.body.task) {
    throw new Error("Parent comment must belong to the same task");
  }

  // Prevent deep nesting (max 2 levels: parent -> child)
  if (parentComment.parent) {
    throw new Error("Cannot reply to a reply. Maximum nesting level is 2.");
  }

  return true;
};

/**
 * Custom validator for user mentions in content
 */
const validateMentions = async (content, { req }) => {
  // Extract mentions from content using @username pattern
  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }

  if (mentions.length === 0) return true;

  // Validate mentioned users exist in organization
  const mongoose = await import("mongoose");
  const User = mongoose.default.model("User");

  const mentionedUsers = await User.find({
    $or: [
      { firstName: { $in: mentions } },
      { lastName: { $in: mentions } },
      { email: { $in: mentions.map((m) => `${m}@`) } }, // Partial email match
    ],
    organization: req.user.organization._id,
    isDeleted: { $ne: true },
  });

  const foundMentions = mentionedUsers
    .map((user) => [user.firstName, user.lastName, user.email.split("@")[0]])
    .flat();

  const invalidMentions = mentions.filter(
    (mention) => !foundMentions.includes(mention)
  );

  if (invalidMentions.length > 0) {
    throw new Error(
      `Invalid user mentions: ${invalidMentions.join(
        ", "
      )}. Users not found in your organization.`
    );
  }

  return true;
};

/**
 * Validation rules for creating a task comment
 */
export const validateCreateTaskComment = [
  body("task")
    .notEmpty()
    .withMessage("Task ID is required")
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid task ID format");
      }
      return true;
    })
    .custom(objectIdExistsInOrganization("BaseTask")),

  body("content")
    .trim()
    .notEmpty()
    .withMessage("Comment content is required")
    .isLength({ min: 1, max: VALIDATION_LIMITS.COMMENT_CONTENT_MAX })
    .withMessage(
      `Comment content must be between 1 and ${VALIDATION_LIMITS.COMMENT_CONTENT_MAX} characters`
    )
    .custom(validateMentions),

  body("parent").optional().custom(validateParentComment),

  body("isPrivate")
    .optional()
    .isBoolean()
    .withMessage("isPrivate must be a boolean")
    .toBoolean(),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (tags.length > 5) {
        throw new Error("Cannot have more than 5 tags per comment");
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
 * Validation rules for updating a task comment
 */
export const validateUpdateTaskComment = [
  ...validateTaskCommentId,

  body("content")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Comment content cannot be empty")
    .isLength({ min: 1, max: VALIDATION_LIMITS.COMMENT_CONTENT_MAX })
    .withMessage(
      `Comment content must be between 1 and ${VALIDATION_LIMITS.COMMENT_CONTENT_MAX} characters`
    )
    .custom(validateMentions),

  body("isPrivate")
    .optional()
    .isBoolean()
    .withMessage("isPrivate must be a boolean")
    .toBoolean(),

  body("tags")
    .optional()
    .isArray()
    .withMessage("Tags must be an array")
    .custom((tags) => {
      if (tags.length > 5) {
        throw new Error("Cannot have more than 5 tags per comment");
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
 * Validation rules for task comment listing query parameters
 */
export const validateTaskCommentQuery = [
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

  query("author")
    .optional()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid author ID format");
      }
      return true;
    }),

  query("parent")
    .optional()
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error("Invalid parent comment ID format");
      }
      return true;
    }),

  query("search")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Search term must be between 1 and 100 characters"),

  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Date from must be a valid date"),

  query("dateTo")
    .optional()
    .isISO8601()
    .withMessage("Date to must be a valid date"),

  query("includePrivate")
    .optional()
    .isBoolean()
    .withMessage("includePrivate must be a boolean")
    .toBoolean(),

  query("includeReplies")
    .optional()
    .isBoolean()
    .withMessage("includeReplies must be a boolean")
    .toBoolean(),

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
    .isIn(["content", "createdAt", "updatedAt"])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc", "1", "-1"])
    .withMessage("Sort order must be asc, desc, 1, or -1"),
];

/**
 * Validation rules for comment reactions
 */
export const validateCommentReaction = [
  ...validateTaskCommentId,

  body("reaction")
    .notEmpty()
    .withMessage("Reaction is required")
    .isIn(["like", "dislike", "love", "laugh", "angry", "sad"])
    .withMessage(
      "Reaction must be one of: like, dislike, love, laugh, angry, sad"
    ),
];

/**
 * Validation rules for task comment soft delete
 */
export const validateDeleteTaskComment = [
  ...validateTaskCommentId,

  body("reason")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Deletion reason cannot exceed 500 characters"),

  body("deleteReplies")
    .optional()
    .isBoolean()
    .withMessage("deleteReplies must be a boolean")
    .toBoolean(),
];

export default {
  validateTaskCommentId,
  validateCreateTaskComment,
  validateUpdateTaskComment,
  validateTaskCommentQuery,
  validateCommentReaction,
  validateDeleteTaskComment,
};
