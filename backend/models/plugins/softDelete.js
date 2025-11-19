import mongoose from "mongoose";

/**
 * Soft Delete Plugin for Mongoose Models
 * Adds soft delete functionality with isDeleted flag and cascade operations
 * Provides restore functionality and proper query filtering
 */
const softDeletePlugin = function (schema, options = {}) {
  // Add soft delete fields to schema
  schema.add({
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  });

  // Override find methods to exclude soft deleted documents by default
  const excludeDeleted = function () {
    const query = this.getQuery();
    if (!query.hasOwnProperty("isDeleted")) {
      this.where({ isDeleted: { $ne: true } });
    }
    return this;
  };

  // Apply to all find methods
  schema.pre(
    ["find", "findOne", "findOneAndUpdate", "count", "countDocuments"],
    excludeDeleted
  );

  // Instance method to soft delete a document
  schema.methods.softDelete = function (deletedBy = null) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    if (deletedBy) {
      this.deletedBy = deletedBy;
    }
    return this.save();
  };

  // Instance method to restore a soft deleted document
  schema.methods.restore = function () {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    return this.save();
  };

  // Static method to find deleted documents
  schema.statics.findDeleted = function (conditions = {}) {
    return this.find({ ...conditions, isDeleted: true });
  };

  // Static method to find all documents including deleted
  schema.statics.findWithDeleted = function (conditions = {}) {
    return this.find(conditions);
  };

  // Static method to restore a document by ID
  schema.statics.restoreById = function (id) {
    return this.findByIdAndUpdate(
      id,
      {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      },
      { new: true }
    );
  };

  // Static method to permanently delete a document
  schema.statics.hardDelete = function (conditions) {
    return this.deleteOne(conditions);
  };

  // Cascade soft delete functionality
  if (options.cascadeDelete && Array.isArray(options.cascadeDelete)) {
    schema.pre("save", async function () {
      if (this.isModified("isDeleted") && this.isDeleted) {
        // Perform cascade soft delete on related documents
        for (const cascade of options.cascadeDelete) {
          const Model = mongoose.model(cascade.model);
          const query = { [cascade.field]: this._id };

          if (cascade.deletedBy) {
            await Model.updateMany(query, {
              isDeleted: true,
              deletedAt: new Date(),
              deletedBy: this.deletedBy || null,
            });
          } else {
            await Model.updateMany(query, {
              isDeleted: true,
              deletedAt: new Date(),
            });
          }
        }
      }
    });
  }

  // Add compound index for better query performance
  schema.index({ isDeleted: 1, createdAt: -1 });
};

export default softDeletePlugin;
