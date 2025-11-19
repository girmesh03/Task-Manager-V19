/**
 * Authentication Controllers
 * Handles user authentication, registration, and token management
 */

import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import Department from "../models/Department.js";
import CustomError from "../utils/CustomError.js";
import {
  generateTokenPair,
  setAuthCookies,
  clearAuthCookies,
  extractTokensFromCookies,
  verifyRefreshToken,
  refreshAccessToken,
} from "../utils/jwtUtils.js";
import { PLATFORM_ORGANIZATION_ID } from "../constants/index.js";

/**
 * Register new organization with SuperAdmin user
 * Creates Organization, Department, and SuperAdmin user in sequence
 * @route POST /api/auth/register
 * @access Public
 */
export const registerOrganization = asyncHandler(async (req, res) => {
  const {
    // Organization fields
    organizationName,
    organizationDescription,
    organizationEmail,
    organizationPhone,
    organizationAddress,
    organizationSize,
    organizationIndustry,
    organizationLogo,
    // Department fields
    departmentName,
    departmentDescription,
    // SuperAdmin user fields
    firstName,
    lastName,
    email,
    password,
    position,
    profilePicture,
  } = req.body;

  // Start database transaction for sequential creation
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if organization name already exists
    const existingOrgByName = await Organization.findOne({
      name: organizationName,
      isDeleted: { $ne: true },
    }).lean();

    if (existingOrgByName) {
      throw CustomError.conflict(
        "Organization name already exists. Please choose a different name."
      );
    }

    // Check if organization email already exists
    const existingOrgByEmail = await Organization.findOne({
      email: organizationEmail.toLowerCase(),
      isDeleted: { $ne: true },
    }).lean();

    if (existingOrgByEmail) {
      throw CustomError.conflict(
        "Organization email already exists. Please use a different email."
      );
    }

    // Step 1: Create Organization
    const organizationData = {
      name: organizationName,
      description: organizationDescription,
      email: organizationEmail.toLowerCase(),
      phone: organizationPhone,
      address: organizationAddress,
      size: organizationSize,
      industry: organizationIndustry,
      logo: organizationLogo,
      createdBy: null, // Will be updated after user creation
    };

    const [organization] = await Organization.create([organizationData], {
      session,
    });

    // Step 2: Create Department
    const departmentData = {
      name: departmentName,
      description: departmentDescription,
      organization: organization._id,
      createdBy: null, // Will be updated after user creation
    };

    const [department] = await Department.create([departmentData], { session });

    // Step 3: Check if user email already exists in this organization
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      organization: organization._id,
      isDeleted: { $ne: true },
    }).lean();

    if (existingUser) {
      throw CustomError.conflict(
        "User email already exists in this organization."
      );
    }

    // Step 4: Create SuperAdmin user
    const userData = {
      firstName,
      lastName,
      email: email.toLowerCase(),
      password, // Will be hashed by pre-save middleware
      role: "SuperAdmin",
      position,
      profilePicture,
      organization: organization._id,
      department: department._id,
      status: "offline",
    };

    const [user] = await User.create([userData], { session });

    // Step 5: Update createdBy fields in Organization and Department
    await Organization.findByIdAndUpdate(
      organization._id,
      { createdBy: user._id },
      { session }
    );

    await Department.findByIdAndUpdate(
      department._id,
      { createdBy: user._id },
      { session }
    );

    // Commit transaction
    await session.commitTransaction();

    // Populate user data for response
    const populatedUser = await User.findById(user._id)
      .populate("organization", "name _id")
      .populate("department", "name _id")
      .select("-password -refreshToken -refreshTokenExpiry");

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokenPair(populatedUser);

    // Set HTTP-only cookies
    setAuthCookies(res, accessToken, refreshToken);

    // Update user's last login
    await populatedUser.updateLastLogin();

    res.status(201).json({
      success: true,
      message: "Organization registered successfully",
      data: {
        user: populatedUser,
        organization: {
          _id: organization._id,
          name: organization.name,
          email: organization.email,
          size: organization.size,
          industry: organization.industry,
        },
        department: {
          _id: department._id,
          name: department.name,
        },
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();

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

    console.error("Organization registration error:", error);
    throw CustomError.internalServer(
      "Failed to register organization. Please try again."
    );
  } finally {
    session.endSession();
  }
});

/**
 * Login user with credentials
 * Validates credentials and generates JWT tokens
 * @route POST /api/auth/login
 * @access Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password, organizationId } = req.body;

  try {
    let user;

    if (organizationId) {
      // Login with specific organization ID
      user = await User.authenticate(email, password, organizationId);
    } else {
      // Find user across all organizations (excluding platform org)
      const users = await User.find({
        email: email.toLowerCase(),
        isDeleted: { $ne: true },
      })
        .populate("organization", "name _id")
        .populate("department", "name _id")
        .select("+password");

      // Filter out platform organization users for regular login
      const customerUsers = users.filter(
        (u) => u.organization._id.toString() !== PLATFORM_ORGANIZATION_ID
      );

      if (customerUsers.length === 0) {
        throw CustomError.unauthorized("Invalid email or password.");
      }

      if (customerUsers.length > 1) {
        // Multiple organizations found, require organization selection
        const organizations = customerUsers.map((u) => ({
          id: u.organization._id,
          name: u.organization.name,
        }));

        return res.status(200).json({
          success: false,
          requireOrganizationSelection: true,
          message: "Multiple organizations found. Please select one.",
          organizations,
        });
      }

      // Single user found, authenticate
      const candidateUser = customerUsers[0];
      const isPasswordValid = await candidateUser.comparePassword(password);

      if (!isPasswordValid) {
        throw CustomError.unauthorized("Invalid email or password.");
      }

      user = candidateUser;
      await user.updateLastLogin();
    }

    if (!user) {
      throw CustomError.unauthorized("Invalid email or password.");
    }

    // Remove password from user object
    user.password = undefined;

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Set HTTP-only cookies
    setAuthCookies(res, accessToken, refreshToken);

    // Update user status to online
    await user.updateStatus("online");

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user,
      },
    });
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    console.error("Login error:", error);
    throw CustomError.internalServer("Login failed. Please try again.");
  }
});

/**
 * Logout user
 * Invalidates tokens and clears cookies
 * @route POST /api/auth/logout
 * @access Private
 */
export const logout = asyncHandler(async (req, res) => {
  try {
    // Update user status to offline if user is authenticated
    if (req.user) {
      await req.user.updateStatus("offline");
    }

    // Clear authentication cookies
    clearAuthCookies(res);

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);
    // Even if there's an error, clear cookies and respond successfully
    clearAuthCookies(res);
    res.status(200).json({
      success: true,
      message: "Logout completed",
    });
  }
});

/**
 * Refresh access token using refresh token
 * @route POST /api/auth/refresh
 * @access Public (requires refresh token in cookies)
 */
export const refreshToken = asyncHandler(async (req, res) => {
  try {
    const { refreshToken: refreshTokenFromCookie } =
      extractTokensFromCookies(req);

    if (!refreshTokenFromCookie) {
      throw CustomError.unauthorized(
        "Refresh token not found. Please log in again."
      );
    }

    // Function to get user by ID for token refresh
    const getUserById = async (userId) => {
      return await User.findById(userId)
        .populate("organization", "name _id")
        .populate("department", "name _id")
        .select("-password -refreshToken -refreshTokenExpiry");
    };

    // Refresh access token
    const { accessToken, user } = await refreshAccessToken(
      refreshTokenFromCookie,
      getUserById
    );

    // Verify user is still active
    if (
      user.isDeleted ||
      user.organization?.isDeleted ||
      user.department?.isDeleted
    ) {
      throw CustomError.unauthorized("User account is deactivated.");
    }

    // Set new access token cookie (refresh token remains the same)
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        user,
      },
    });
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    console.error("Token refresh error:", error);
    throw CustomError.unauthorized(
      "Token refresh failed. Please log in again."
    );
  }
});

/**
 * Forgot password - Send reset token
 * @route POST /api/auth/forgot-password
 * @access Public
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email, organizationId } = req.body;

  try {
    let user;

    if (organizationId) {
      // Find user in specific organization
      user = await User.findOne({
        email: email.toLowerCase(),
        organization: organizationId,
        isDeleted: { $ne: true },
      }).populate("organization", "name");
    } else {
      // Find user across all customer organizations
      const users = await User.find({
        email: email.toLowerCase(),
        isDeleted: { $ne: true },
      }).populate("organization", "name _id");

      const customerUsers = users.filter(
        (u) => u.organization._id.toString() !== PLATFORM_ORGANIZATION_ID
      );

      if (customerUsers.length > 1) {
        const organizations = customerUsers.map((u) => ({
          id: u.organization._id,
          name: u.organization.name,
        }));

        return res.status(200).json({
          success: false,
          requireOrganizationSelection: true,
          message: "Multiple organizations found. Please select one.",
          organizations,
        });
      }

      user = customerUsers[0];
    }

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // TODO: Implement password reset token generation and email sending
      // This would typically involve:
      // 1. Generate secure reset token
      // 2. Store token with expiration in database
      // 3. Send email with reset link
      console.log(`Password reset requested for user: ${user.email}`);
    }

    res.status(200).json({
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    // Always return success to prevent information leakage
    res.status(200).json({
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  }
});

/**
 * Reset password with token
 * @route POST /api/auth/reset-password
 * @access Public
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  try {
    // TODO: Implement password reset token validation
    // This would typically involve:
    // 1. Validate reset token
    // 2. Check token expiration
    // 3. Find user by token
    // 4. Update password
    // 5. Invalidate reset token

    throw CustomError.badRequest(
      "Password reset functionality is not yet implemented."
    );
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    console.error("Reset password error:", error);
    throw CustomError.internalServer(
      "Password reset failed. Please try again."
    );
  }
});

/**
 * Get current user profile
 * @route GET /api/auth/me
 * @access Private
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
});

/**
 * Update current user profile
 * @route PUT /api/auth/me
 * @access Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, position, profilePicture } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      throw CustomError.notFound("User not found.");
    }

    // Update allowed fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (position !== undefined) user.position = position;
    if (profilePicture !== undefined) user.profilePicture = profilePicture;

    await user.save();

    // Return updated user with populated fields
    const updatedUser = await User.findById(user._id)
      .populate("organization", "name _id")
      .populate("department", "name _id")
      .select("-password -refreshToken -refreshTokenExpiry");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: updatedUser,
      },
    });
  } catch (error) {
    if (error instanceof CustomError) {
      throw error;
    }

    console.error("Update profile error:", error);
    throw CustomError.internalServer(
      "Failed to update profile. Please try again."
    );
  }
});

export default {
  registerOrganization,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfile,
};
