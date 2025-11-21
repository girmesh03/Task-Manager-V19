import mongoose from "mongoose";
import softDeletePlugin from "./plugins/softDelete.js";

const attachmentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: [true, "Filename is required"],
      trim: true,
      maxlength: [255, "Filename cannot exceed 255 characters"],
    },
    originalName: {
      type: String,
      required: [true, "Original filename is required"],
      trim: true,
      maxlength: [255, "Original filename cannot exceed 255 characters"],
    },
    mimeType: {
      type: String,
      required: [true, "MIME type is required"],
      trim: true,
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
      min: [1, "File size must be greater than 0"],
    },
    cloudinaryUrl: {
      type: String,
      required: [true, "Cloudinary URL is required"],
      trim: true,
      match: [/^https?:\/\/.+/, "Cloudinary URL must be a valid URL"],
    },
    cloudinaryPublicId: {
      type: String,
      required: [true, "Cloudinary public ID is required"],
      trim: true,
    },
    // Polymorphic relationship - can be attached to different models
    attachedTo: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Attached to reference is required"],
      index: true,
    },
    attachedToModel: {
      type: String,
      required: [true, "Attached to model is required"],
      enum: {
        values: ["BaseTask", "TaskActivity", "TaskComment"],
        message:
          "Attached to model must be one of: BaseTask, TaskActivity, TaskComment",
      },
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Uploaded by is required"],
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization is required"],
      index: true,
    },
    // File metadata
    fileCategory: {
      type: String,
      enum: {
        values: ["image", "document", "video", "audio", "other"],
        message:
          "File category must be one of: image, document, video, audio, other",
      },
      required: [true, "File category is required"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Apply soft delete plugin
attachmentSchema.plugin(softDeletePlugin);
// Indexes for better query performance
attachmentSchema.index({ attachedTo: 1, attachedToModel: 1 });
attachmentSchema.index({ organization: 1, fileCategory: 1 });
attachmentSchema.index({ uploadedBy: 1, createdAt: -1 });
attachmentSchema.index({ organization: 1, createdAt: -1 });
attachmentSchema.index({ cloudinaryPublicId: 1 });

// Virtual for file size in human readable format
attachmentSchema.virtual("fileSizeFormatted").get(function () {
  const bytes = this.fileSize;
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
});

// Virtual for file extension
attachmentSchema.virtual("fileExtension").get(function () {
  return this.originalName.split(".").pop().toLowerCase();
});

// Pre-save middleware to determine file category based on MIME type
attachmentSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("mimeType")) {
    const mimeType = this.mimeType.toLowerCase();

    if (mimeType.startsWith("image/")) {
      this.fileCategory = "image";
    } else if (mimeType.startsWith("video/")) {
      this.fileCategory = "video";
    } else if (mimeType.startsWith("audio/")) {
      this.fileCategory = "audio";
    } else if (
      mimeType.includes("pdf") ||
      mimeType.includes("document") ||
      mimeType.includes("text") ||
      mimeType.includes("spreadsheet") ||
      mimeType.includes("presentation")
    ) {
      this.fileCategory = "document";
    } else {
      this.fileCategory = "other";
    }
  }
  next();
});

// Static method to find attachments by parent entity
attachmentSchema.statics.findByParent = function (
  parentId,
  parentModel,
  conditions = {}
) {
  return this.find({
    ...conditions,
    attachedTo: parentId,
    attachedToModel: parentModel,
  }).sort({ createdAt: -1 });
};

// Static method to find attachments by organization
attachmentSchema.statics.findByOrganization = function (
  organizationId,
  conditions = {}
) {
  return this.find({
    ...conditions,
    organization: organizationId,
  });
};

// Static method to find attachments by file category
attachmentSchema.statics.findByCategory = function (
  organizationId,
  category,
  conditions = {}
) {
  return this.find({
    ...conditions,
    organization: organizationId,
    fileCategory: category,
  });
};

// Static method to get storage statistics for organization
attachmentSchema.statics.getStorageStats = async function (organizationId) {
  const stats = await this.aggregate([
    {
      $match: {
        organization: mongoose.Types.ObjectId(organizationId),
      },
    },
    {
      $group: {
        _id: "$fileCategory",
        count: { $sum: 1 },
        totalSize: { $sum: "$fileSize" },
      },
    },
  ]);

  const totalStats = await this.aggregate([
    {
      $match: {
        organization: mongoose.Types.ObjectId(organizationId),
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: "$fileSize" },
      },
    },
  ]);

  return {
    byCategory: stats,
    total: totalStats[0] || { totalFiles: 0, totalSize: 0 },
  };
};

// Instance method to check if file is an image
attachmentSchema.methods.isImage = function () {
  return this.fileCategory === "image";
};

// Instance method to check if file is a document
attachmentSchema.methods.isDocument = function () {
  return this.fileCategory === "document";
};

// Instance method to get secure URL (for future implementation with signed URLs)
attachmentSchema.methods.getSecureUrl = function () {
  // For now, return the Cloudinary URL directly
  // In production, this could generate signed URLs for additional security
  return this.cloudinaryUrl;
};

const Attachment = mongoose.model("Attachment", attachmentSchema);

export default Attachment;
