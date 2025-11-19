import mongoose from "mongoose";
import softDeletePlugin from "./plugins/softDelete.js";

const taskCommentSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      maxlength: [2000, "Comment cannot exceed 2000 characters"],
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BaseTask",
      required: [true, "Task reference is required"],
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by is required"],
      index: true,
    },
    // Threading support - parent comment for replies
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskComment",
      default: null,
      index: true,
    },
    // Mentions in the comment
    mentions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        mentionText: {
          type: String,
          trim: true,
        },
      },
    ],
    // Comment type for different kinds of comments
    commentType: {
      type: String,
      enum: {
        values: ["general", "status_update", "question", "feedback", "system"],
        message:
          "Comment type must be one of: general, status_update, question, feedback, system",
      },
      default: "general",
    },
    // For system-generated comments
    isSystemGenerated: {
      type: Boolean,
      default: false,
    },
    // Edit tracking
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    editHistory: [
      {
        content: String,
        editedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Apply soft delete plugin
taskCommentSchema.plugin(softDeletePlugin, {
  cascadeDelete: [
    { model: "TaskComment", field: "parentComment", deletedBy: true }, // Delete child comments
    { model: "Attachment", field: "attachedTo", deletedBy: true },
  ],
});

// Indexes for better query performance
taskCommentSchema.index({ task: 1, createdAt: 1 });
taskCommentSchema.index({ createdBy: 1, createdAt: -1 });
taskCommentSchema.index({ parentComment: 1, createdAt: 1 });
taskCommentSchema.index({ task: 1, parentComment: 1, createdAt: 1 });
taskCommentSchema.index({ "mentions.user": 1 });

// Virtual for replies (child comments)
taskCommentSchema.virtual("replies", {
  ref: "TaskComment",
  localField: "_id",
  foreignField: "parentComment",
});

// Virtual for attachments
taskCommentSchema.virtual("attachments", {
  ref: "Attachment",
  localField: "_id",
  foreignField: "attachedTo",
  match: { attachedToModel: "TaskComment" },
});

// Virtual to check if this is a root comment (not a reply)
taskCommentSchema.virtual("isRootComment").get(function () {
  return !this.parentComment;
});

// Virtual to get the depth level of the comment in the thread
taskCommentSchema.virtual("threadDepth").get(function () {
  // This would need to be calculated by traversing up the parent chain
  // For now, return 0 for root comments, 1 for direct replies
  return this.parentComment ? 1 : 0;
});

// Pre-save middleware to detect and extract mentions
taskCommentSchema.pre("save", function (next) {
  if (this.isModified("content")) {
    // Extract mentions from content (e.g., @username or @"Full Name")
    const mentionRegex = /@([a-zA-Z0-9._-]+|"[^"]+"|'[^']+')/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(this.content)) !== null) {
      const mentionText = match[1].replace(/['"]/g, ""); // Remove quotes
      mentions.push({
        mentionText: mentionText,
        user: null, // Will be resolved later by the controller
      });
    }

    this.mentions = mentions;

    // Track edit history if content is being modified (not on creation)
    if (!this.isNew && this.isModified("content")) {
      this.editHistory.push({
        content: this.content,
        editedAt: new Date(),
      });
      this.isEdited = true;
      this.editedAt = new Date();
    }
  }
  next();
});

// Pre-save middleware to validate parent comment
taskCommentSchema.pre("save", async function (next) {
  if (this.parentComment) {
    try {
      const parentComment = await this.constructor.findById(this.parentComment);

      if (!parentComment) {
        const error = new Error("Parent comment does not exist");
        error.code = "PARENT_COMMENT_NOT_FOUND";
        return next(error);
      }

      // Ensure parent comment belongs to the same task
      if (parentComment.task.toString() !== this.task.toString()) {
        const error = new Error("Parent comment must belong to the same task");
        error.code = "INVALID_PARENT_COMMENT_TASK";
        return next(error);
      }

      // Prevent deep nesting (limit to 2 levels: root -> reply)
      if (parentComment.parentComment) {
        const error = new Error("Comments can only be nested one level deep");
        error.code = "MAX_NESTING_EXCEEDED";
        return next(error);
      }

      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Static method to find comments by task with threading
taskCommentSchema.statics.findByTaskWithThreading = function (
  taskId,
  conditions = {}
) {
  return this.find({
    ...conditions,
    task: taskId,
  })
    .populate("createdBy", "firstName lastName profilePicture")
    .populate("mentions.user", "firstName lastName")
    .populate({
      path: "replies",
      populate: {
        path: "createdBy",
        select: "firstName lastName profilePicture",
      },
    })
    .sort({ createdAt: 1 });
};

// Static method to find root comments (not replies)
taskCommentSchema.statics.findRootComments = function (
  taskId,
  conditions = {}
) {
  return this.find({
    ...conditions,
    task: taskId,
    parentComment: null,
  }).sort({ createdAt: 1 });
};

// Static method to find comments by user
taskCommentSchema.statics.findByUser = function (userId, conditions = {}) {
  return this.find({
    ...conditions,
    createdBy: userId,
  }).sort({ createdAt: -1 });
};

// Static method to find comments mentioning a user
taskCommentSchema.statics.findMentioningUser = function (
  userId,
  conditions = {}
) {
  return this.find({
    ...conditions,
    "mentions.user": userId,
  }).sort({ createdAt: -1 });
};

// Instance method to get all replies recursively
taskCommentSchema.methods.getAllReplies = async function () {
  const replies = await this.constructor
    .find({ parentComment: this._id })
    .populate("createdBy", "firstName lastName profilePicture")
    .sort({ createdAt: 1 });

  return replies;
};

// Instance method to check if user is mentioned
taskCommentSchema.methods.mentionsUser = function (userId) {
  return this.mentions.some(
    (mention) => mention.user && mention.user.toString() === userId.toString()
  );
};

const TaskComment = mongoose.model("TaskComment", taskCommentSchema);

export default TaskComment;
