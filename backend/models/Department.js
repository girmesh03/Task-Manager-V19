import mongoose from "mongoose";
import softDeletePlugin from "./plugins/softDelete.js";

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      trim: true,
      maxlength: [100, "Department name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization is required"],
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Apply soft delete plugin with cascade options
departmentSchema.plugin(softDeletePlugin, {
  cascadeDelete: [
    { model: "User", field: "department", deletedBy: true },
    { model: "BaseTask", field: "department", deletedBy: true },
  ],
});

// Compound index for unique department name within organization
departmentSchema.index({ name: 1, organization: 1 }, { unique: true });

// Additional indexes for better query performance
departmentSchema.index({ organization: 1, createdAt: -1 });
departmentSchema.index({ organization: 1, isDeleted: 1 });

// Virtual for users in this department
departmentSchema.virtual("users", {
  ref: "User",
  localField: "_id",
  foreignField: "department",
});

// Virtual for users count
departmentSchema.virtual("usersCount", {
  ref: "User",
  localField: "_id",
  foreignField: "department",
  count: true,
});

// Virtual for tasks in this department
departmentSchema.virtual("tasks", {
  ref: "BaseTask",
  localField: "_id",
  foreignField: "department",
});

// Note: Department name uniqueness is enforced by compound unique index

// Pre-remove middleware to check for users
departmentSchema.pre("remove", async function (next) {
  const userCount = await mongoose.model("User").countDocuments({
    department: this._id,
    isDeleted: { $ne: true },
  });

  if (userCount > 0) {
    const error = new Error("Cannot delete department with existing users");
    error.code = "DEPARTMENT_HAS_USERS";
    return next(error);
  }
  next();
});

// Static method to find departments by organization
departmentSchema.statics.findByOrganization = function (
  organizationId,
  conditions = {}
) {
  return this.find({
    ...conditions,
    organization: organizationId,
  });
};

// Static method to check if department name exists in organization
departmentSchema.statics.nameExistsInOrganization = async function (
  name,
  organizationId,
  excludeId = null
) {
  const query = {
    name: name,
    organization: organizationId,
    isDeleted: { $ne: true },
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existing = await this.findOne(query);
  return !!existing;
};

// Instance method to check if department has users
departmentSchema.methods.hasUsers = async function () {
  const userCount = await mongoose.model("User").countDocuments({
    department: this._id,
    isDeleted: { $ne: true },
  });
  return userCount > 0;
};

// Instance method to get HOD (Head of Department)
departmentSchema.methods.getHOD = function () {
  return mongoose.model("User").findOne({
    department: this._id,
    role: { $in: ["SuperAdmin", "Admin"] },
    isDeleted: { $ne: true },
  });
};

const Department = mongoose.model("Department", departmentSchema);

export default Department;
