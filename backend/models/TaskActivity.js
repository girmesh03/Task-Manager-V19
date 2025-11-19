import mongoose from "mongoose";
import softDeletePlugin from "./plugins/softDelete.js";

const taskActivitySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Activity title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      required: [true, "Activity description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    status: {
      type: String,
      enum: {
        values: ["Not Started", "In Progress", "Completed", "Blocked"],
        message:
          "Status must be one of: Not Started, In Progress, Completed, Blocked",
      },
      required: [true, "Status is required"],
      default: "Not Started",
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
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    estimatedHours: {
      type: Number,
      min: [0.1, "Estimated hours must be at least 0.1"],
      max: [100, "Estimated hours cannot exceed 100"],
    },
    actualHours: {
      type: Number,
      min: [0, "Actual hours cannot be negative"],
      max: [200, "Actual hours cannot exceed 200"],
    },
    completedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Apply soft delete plugin
taskActivitySchema.plugin(softDeletePlugin, {
  cascadeDelete: [
    { model: "Attachment", field: "attachedTo", deletedBy: true },
  ],
});

// Indexes for better query performance
taskActivitySchema.index({ task: 1, createdAt: 1 });
taskActivitySchema.index({ createdBy: 1, createdAt: -1 });
taskActivitySchema.index({ assignedTo: 1, status: 1 });
taskActivitySchema.index({ status: 1 });

// Virtual for attachments
taskActivitySchema.virtual("attachments", {
  ref: "Attachment",
  localField: "_id",
  foreignField: "attachedTo",
  match: { attachedToModel: "TaskActivity" },
});

// Pre-save middleware to validate task type
taskActivitySchema.pre("save", async function (next) {
  try {
    // Check if the task exists and is of correct type (AssignedTask or ProjectTask)
    const task = await mongoose.model("BaseTask").findById(this.task);

    if (!task) {
      const error = new Error("Referenced task does not exist");
      error.code = "TASK_NOT_FOUND";
      return next(error);
    }

    // TaskActivity can only be attached to AssignedTask or ProjectTask, not RoutineTask
    if (task.taskType === "RoutineTask") {
      const error = new Error("TaskActivity cannot be created for RoutineTask");
      error.code = "INVALID_TASK_TYPE_FOR_ACTIVITY";
      return next(error);
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to set completedAt when status changes to Completed
taskActivitySchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status === "Completed" && !this.completedAt) {
      this.completedAt = new Date();
    } else if (this.status !== "Completed") {
      this.completedAt = null;
    }
  }
  next();
});

// Static method to find activities by task
taskActivitySchema.statics.findByTask = function (taskId, conditions = {}) {
  return this.find({
    ...conditions,
    task: taskId,
  }).sort({ createdAt: 1 }); // Chronological order
};

// Static method to find activities by user
taskActivitySchema.statics.findByUser = function (userId, conditions = {}) {
  return this.find({
    ...conditions,
    $or: [{ createdBy: userId }, { assignedTo: userId }],
  }).sort({ createdAt: -1 });
};

// Instance method to check if activity is overdue
taskActivitySchema.methods.isOverdue = function () {
  // An activity is considered overdue if the parent task is overdue and this activity is not completed
  return (
    this.status !== "Completed" &&
    this.task &&
    this.task.isOverdue &&
    this.task.isOverdue()
  );
};

// Instance method to calculate hours variance
taskActivitySchema.methods.getHoursVariance = function () {
  if (!this.estimatedHours || this.estimatedHours === 0) return 0;
  const actual = this.actualHours || 0;
  return ((actual - this.estimatedHours) / this.estimatedHours) * 100;
};

const TaskActivity = mongoose.model("TaskActivity", taskActivitySchema);

export default TaskActivity;
