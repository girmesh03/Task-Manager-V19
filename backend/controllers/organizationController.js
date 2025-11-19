/**
 * Organization Controllers
 * Handles organization management operations for platform admins
 */

import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Organization from "../models/Organization.js";
import Department from "../models/Department.js";
import User from "../models/User.js";
import CustomError from "../utils/CustomError.js";
import { PLATFORM_ORGANIZATION_ID } from "../constants/index.js";

/**
 * Get all organizations (Platform admins only)
 * @route GET /api/organizations
 * @access Private (Platform SuperAdmin only)
 */
export const getOrganizations = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    size,
    industry,
    sortBy = "createdAt",
    sortOrder = "desc",
    includeDeleted = false,
  } = req.query;

  try {
    // Build query filters
    const filters = {};

    // Exclude platform organization from customer organization listings
    filters._id = { $ne: mongoose.Types.ObjectId(PLATFORM_ORGANIZATION_ID) };

    // Include/exclude deleted organizations
    if (!includeDeleted) {
      filters.isDeleted = { $ne: true };
    }

    // Search filter
    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { industry: { $regex: search, $options: "i" } },
      ];
    }

    // Size filter
    if (size) {
      filters.size = size;
    }

    // Industry filter
    if (industry) {
      filters.industry = { $regex: industry, $options: "i" };
    }

    // Build sort object
    const sortOptions = {};
    const sortDirection = sortOrder === "asc" || sortOrder === "1" ? 1 : -1;
    sortOptions[sortBy] = sortDirection;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [organizations, totalCount] = await Promise.all([
      Organization.find(filters)
        .populate("createdBy", "firstName lastName email")
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Organization.countDocuments(filters),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      data: {
        organizations,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          limit: parseInt(limit),
          hasNextPage,
          hasPrevPage,
        },
      },
    });
  } catch (error) {
    console.error("Get organizations error:", error);
    throw CustomError.internalServer(
      "Failed to retrieve organizations. Please try again."
    );
  }
});

/**
 * Get single organization by ID (Platform admins only)
 * @route GET /api/organizations/:organizationId
 * @access Private (Platform SuperAdmin only)
 */
export const getOrganizationById = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  try {
    // Prevent access to platform organization details
    if (organizationId === PLATFORM_ORGANIZATION_ID) {
      throw CustomError.forbidden(
        "Cannot access platform organization details."
      );
    }

    const organization = await Organization.findById(organizationId)
      .populate("createdBy", "firstName lastName email")
      .populate({
        path: "departments",
        select: "name description createdAt usersCount",
        match: { isDeleted: { $ne: true } },
      });

    if (!organization) {
      throw CustomError.notFound("Organization not found.");
    }

    // Get additional statistics
    const [departmentCount, userCount, activeUserCount] = await Promise.all([
      Department.countDocuments({
        organization: organizationId,
        isDeleted: { $ne: true },
      }),
      User.countDocuments({
        organization: organizationId,
        isDeleted: { $ne: true },
      }),
      User.countDocuments({
        organization: organizationId,
        status: "online",
        isDeleted: { $ne: true },
      }),
    ]);

    const organizationWithStats = {
      ...organization.toObject(),
      statistics: {
        departmentCount,
        userCount,
        activeUserCount,
      },
    };

    res.status(200).json({
      success: true,
      data: {
        organization: organizationWithStats,
      },
    });
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    console.error("Get organization by ID error:", error);
    throw CustomError.internalServer(
      "Failed to retrieve organization. Please try again."
    );
  }
});

/**
 * Create new organization (Platform admins only)
 * @route POST /api/organizations
 * @access Private (Platform SuperAdmin only)
 */
export const createOrganization = asyncHandler(async (req, res) => {
  const { name, description, email, phone, address, size, industry, logo } =
    req.body;

  try {
    // Check if organization name already exists
    const existingOrgByName = await Organization.findOne({
      name,
      isDeleted: { $ne: true },
    });

    if (existingOrgByName) {
      throw CustomError.conflict(
        "Organization name already exists. Please choose a different name."
      );
    }

    // Check if organization email already exists
    const existingOrgByEmail = await Organization.findOne({
      email: email.toLowerCase(),
      isDeleted: { $ne: true },
    });

    if (existingOrgByEmail) {
      throw CustomError.conflict(
        "Organization email already exists. Please use a different email."
      );
    }

    // Create organization
    const organizationData = {
      name,
      description,
      email: email.toLowerCase(),
      phone,
      address,
      size,
      industry,
      logo,
      createdBy: req.user._id,
    };

    const organization = await Organization.create(organizationData);

    // Populate created organization
    const populatedOrganization = await Organization.findById(
      organization._id
    ).populate("createdBy", "firstName lastName email");

    res.status(201).json({
      success: true,
      message: "Organization created successfully",
      data: {
        organization: populatedOrganization,
      },
    });
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      throw CustomError.conflict(
        `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`
      );
    }

    console.error("Create organization error:", error);
    throw CustomError.internalServer(
      "Failed to create organization. Please try again."
    );
  }
});

/**
 * Update organization (Platform admins only)
 * @route PUT /api/organizations/:organizationId
 * @access Private (Platform SuperAdmin only)
 */
export const updateOrganization = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const updateData = req.body;

  try {
    // Prevent updating platform organization
    if (organizationId === PLATFORM_ORGANIZATION_ID) {
      throw CustomError.forbidden("Cannot update platform organization.");
    }

    // Find organization
    const organization = await Organization.findById(organizationId);

    if (!organization) {
      throw CustomError.notFound("Organization not found.");
    }

    if (organization.isDeleted) {
      throw CustomError.badRequest(
        "Cannot update deleted organization. Restore it first."
      );
    }

    // Check for name uniqueness if name is being updated
    if (updateData.name && updateData.name !== organization.name) {
      const existingOrgByName = await Organization.findOne({
        name: updateData.name,
        _id: { $ne: organizationId },
        isDeleted: { $ne: true },
      });

      if (existingOrgByName) {
        throw CustomError.conflict(
          "Organization name already exists. Please choose a different name."
        );
      }
    }

    // Check for email uniqueness if email is being updated
    if (
      updateData.email &&
      updateData.email.toLowerCase() !== organization.email
    ) {
      const existingOrgByEmail = await Organization.findOne({
        email: updateData.email.toLowerCase(),
        _id: { $ne: organizationId },
        isDeleted: { $ne: true },
      });

      if (existingOrgByEmail) {
        throw CustomError.conflict(
          "Organization email already exists. Please use a different email."
        );
      }
    }

    // Normalize email if provided
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    // Update organization
    const updatedOrganization = await Organization.findByIdAndUpdate(
      organizationId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).populate("createdBy", "firstName lastName email");

    res.status(200).json({
      success: true,
      message: "Organization updated successfully",
      data: {
        organization: updatedOrganization,
      },
    });
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      throw CustomError.conflict(
        `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`
      );
    }

    console.error("Update organization error:", error);
    throw CustomError.internalServer(
      "Failed to update organization. Please try again."
    );
  }
});

/**
 * Soft delete organization (Platform admins only)
 * @route DELETE /api/organizations/:organizationId
 * @access Private (Platform SuperAdmin only)
 */
export const deleteOrganization = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { reason } = req.body;

  try {
    // Prevent deleting platform organization
    if (organizationId === PLATFORM_ORGANIZATION_ID) {
      throw CustomError.forbidden("Cannot delete platform organization.");
    }

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      throw CustomError.notFound("Organization not found.");
    }

    if (organization.isDeleted) {
      throw CustomError.badRequest("Organization is already deleted.");
    }

    // Perform soft delete (this will cascade to departments and users)
    await organization.softDelete(req.user._id, reason);

    res.status(200).json({
      success: true,
      message: "Organization deleted successfully",
    });
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    console.error("Delete organization error:", error);
    throw CustomError.internalServer(
      "Failed to delete organization. Please try again."
    );
  }
});

/**
 * Restore soft deleted organization (Platform admins only)
 * @route POST /api/organizations/:organizationId/restore
 * @access Private (Platform SuperAdmin only)
 */
export const restoreOrganization = asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { reason } = req.body;

  try {
    // Prevent restoring platform organization
    if (organizationId === PLATFORM_ORGANIZATION_ID) {
      throw CustomError.forbidden("Cannot restore platform organization.");
    }

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      throw CustomError.notFound("Organization not found.");
    }

    if (!organization.isDeleted) {
      throw CustomError.badRequest("Organization is not deleted.");
    }

    // Check for name conflicts before restoring
    const existingOrgByName = await Organization.findOne({
      name: organization.name,
      _id: { $ne: organizationId },
      isDeleted: { $ne: true },
    });

    if (existingOrgByName) {
      throw CustomError.conflict(
        "Cannot restore organization. Name conflicts with existing organization."
      );
    }

    // Check for email conflicts before restoring
    const existingOrgByEmail = await Organization.findOne({
      email: organization.email,
      _id: { $ne: organizationId },
      isDeleted: { $ne: true },
    });

    if (existingOrgByEmail) {
      throw CustomError.conflict(
        "Cannot restore organization. Email conflicts with existing organization."
      );
    }

    // Restore organization
    await organization.restore(reason);

    // Get restored organization with populated data
    const restoredOrganization = await Organization.findById(
      organizationId
    ).populate("createdBy", "firstName lastName email");

    res.status(200).json({
      success: true,
      message: "Organization restored successfully",
      data: {
        organization: restoredOrganization,
      },
    });
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    console.error("Restore organization error:", error);
    throw CustomError.internalServer(
      "Failed to restore organization. Please try again."
    );
  }
});

/**
 * Get organization statistics (Platform admins only)
 * @route GET /api/organizations/statistics
 * @access Private (Platform SuperAdmin only)
 */
export const getOrganizationStatistics = asyncHandler(async (req, res) => {
  try {
    const [
      totalOrganizations,
      activeOrganizations,
      deletedOrganizations,
      organizationsBySize,
      recentOrganizations,
    ] = await Promise.all([
      // Total customer organizations (excluding platform)
      Organization.countDocuments({
        _id: { $ne: mongoose.Types.ObjectId(PLATFORM_ORGANIZATION_ID) },
      }),
      // Active customer organizations
      Organization.countDocuments({
        _id: { $ne: mongoose.Types.ObjectId(PLATFORM_ORGANIZATION_ID) },
        isDeleted: { $ne: true },
      }),
      // Deleted customer organizations
      Organization.countDocuments({
        _id: { $ne: mongoose.Types.ObjectId(PLATFORM_ORGANIZATION_ID) },
        isDeleted: true,
      }),
      // Organizations by size
      Organization.aggregate([
        {
          $match: {
            _id: { $ne: mongoose.Types.ObjectId(PLATFORM_ORGANIZATION_ID) },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: "$size",
            count: { $sum: 1 },
          },
        },
      ]),
      // Recent organizations (last 30 days)
      Organization.countDocuments({
        _id: { $ne: mongoose.Types.ObjectId(PLATFORM_ORGANIZATION_ID) },
        isDeleted: { $ne: true },
        createdAt: {
          $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    const statistics = {
      totalOrganizations,
      activeOrganizations,
      deletedOrganizations,
      recentOrganizations,
      organizationsBySize: organizationsBySize.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };

    res.status(200).json({
      success: true,
      data: {
        statistics,
      },
    });
  } catch (error) {
    console.error("Get organization statistics error:", error);
    throw CustomError.internalServer(
      "Failed to retrieve organization statistics. Please try again."
    );
  }
});

export default {
  getOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  restoreOrganization,
  getOrganizationStatistics,
};
