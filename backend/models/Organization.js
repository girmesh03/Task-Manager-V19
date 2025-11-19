import mongoose from "mongoose";
import softDeletePlugin from "./plugins/softDelete.js";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      // unique: true,
      trim: true,
      maxlength: [100, "Organization name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    email: {
      type: String,
      required: [true, "Organization email is required"],
      // unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^[\+]?[1-9][\d]{0,15}$/, "Please provide a valid phone number"],
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
      maxlength: [200, "Address cannot exceed 200 characters"],
    },
    size: {
      type: String,
      enum: {
        values: ["Small", "Medium", "Large", "Enterprise"],
        message: "Size must be one of: Small, Medium, Large, Enterprise",
      },
      required: [true, "Organization size is required"],
    },
    industry: {
      type: String,
      required: [true, "Industry is required"],
      trim: true,
      maxlength: [100, "Industry cannot exceed 100 characters"],
    },
    logo: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Logo must be a valid URL"],
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
organizationSchema.plugin(softDeletePlugin, {
  cascadeDelete: [
    { model: "Department", field: "organization", deletedBy: true },
    { model: "User", field: "organization", deletedBy: true },
    { model: "BaseTask", field: "organization", deletedBy: true },
    { model: "Material", field: "organization", deletedBy: true },
    { model: "Vendor", field: "organization", deletedBy: true },
    { model: "Notification", field: "organization", deletedBy: true },
  ],
});

// Indexes for better query performance
// organizationSchema.index({ name: 1 });
// organizationSchema.index({ email: 1 });
organizationSchema.index({ industry: 1 });
organizationSchema.index({ size: 1 });
organizationSchema.index({ createdAt: -1 });

// Virtual for departments
organizationSchema.virtual("departments", {
  ref: "Department",
  localField: "_id",
  foreignField: "organization",
});

// Virtual for users count
organizationSchema.virtual("usersCount", {
  ref: "User",
  localField: "_id",
  foreignField: "organization",
  count: true,
});

// Pre-save middleware for validation
organizationSchema.pre("save", function (next) {
  // Ensure email is lowercase
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
  next();
});

// Static method to find platform organization
organizationSchema.statics.findPlatformOrganization = function () {
  return this.findById("000000000000000000000000");
};

// Static method to find customer organizations (excluding platform)
organizationSchema.statics.findCustomerOrganizations = function (
  conditions = {}
) {
  return this.find({
    ...conditions,
    _id: { $ne: mongoose.Types.ObjectId("000000000000000000000000") },
  });
};

// Instance method to check if this is the platform organization
organizationSchema.methods.isPlatformOrganization = function () {
  return this._id.toString() === "000000000000000000000000";
};

const Organization = mongoose.model("Organization", organizationSchema);

export default Organization;
