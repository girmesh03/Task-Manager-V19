/**
 * Authentication Controllers
 * Handles user authentication, registration, and token management
 */

import asyncHandler from "express-async-handler";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import Department from "../models/Department.js";
import CustomError from "../utils/CustomError.js";
import {
  generateTokenPair,
  setAuthCookies,
  clearAuthCookies,
  extractTokensFromCookies,
  refreshAccessToken,
} from "../utils/jwtUtils.js";
import { PLATFORM_ORGANIZATION_ID } from "../constants/index.js";
import { extractUserContext } from "../utils/controllerHelpers.js";

/**
 * Register new organization with SuperAdmin user
 * Creates Organization, Department, and SuperAdmin user in sequence
 * @route POST /api/auth/register
 * @access Public
 */
export const registerOrganization = asyncHandler(async (req, res, next) => {
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

  try {
    // Check if organization name already exists
    const existingOrgByName = await Organization.findOne({
      name: organizationName,
    }).lean();

    if (existingOrgByName) {
      return next(
        CustomError.conflict(
          "Organization name already exists. Please choose a different name."
        )
      );
    }

    // Check if organization email already exists
    const existingOrgByEmail = await Organization.findOne({
      email: organizationEmail.toLowerCase(),
    }).lean();

    if (existingOrgByEmail) {
      return next(
        CustomError.conflict(
          "Organization email already exists. Please use a different email."
        )
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

    const organization = await Organization.create(organizationData);

    // Step 2: Create Department
    const departmentData = {
      name: departmentName,
      description: departmentDescription,
      organization: organization._id,
      createdBy: null, // Will be updated after user creation
    };

    const department = await Department.create(departmentData);

    // Step 3: Check if user email already exists in this organization
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
      organization: organization._id,
    }).lean();

    if (existingUser) {
      return next(
        CustomError.conflict("User email already exists in this organization.")
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

    const user = await User.create(userData);

    // Step 5: Update createdBy fields in Organization and Department
    await Organization.findByIdAndUpdate(organization._id, {
      createdBy: user._id,
    });

    await Department.findByIdAndUpdate(department._id, {
      createdBy: user._id,
    });

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
    if (error instanceof CustomError) {
      return next(error);
    }

    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return next(
        CustomError.conflict(
          `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`
        )
      );
    }

    console.error("Organization registration error:", error);
    return next(
      CustomError.internalServer(
        "Failed to register organization. Please try again."
      )
    );
  }
});

/**
 * Login user with credentials
 * Validates credentials and generates JWT tokens
 * @route POST /api/auth/login
 * @access Public
 */
export const login = asyncHandler(async (req, res, next) => {
  const { email, password, organizationId } = req.body;

  try {
    let user;

    if (organizationId) {
      // Login with specific organization ID - use the static authenticate method
      user = await User.authenticate(email, password, organizationId);

      if (!user) {
        return next(CustomError.unauthorized("Invalid email or password."));
      }
    } else {
      // Find users across all organizations (excluding platform org)
      const users = await User.find({
        email: email.toLowerCase(),
        isDeleted: { $ne: true }, // Exclude soft-deleted users
      })
        .populate("organization", "name _id")
        .populate("department", "name _id")
        .select("+password");

      // Filter out platform organization users for regular login and deleted organizations
      const customerUsers = users.filter(
        (u) =>
          u.organization &&
          !u.organization.isDeleted &&
          u.organization._id.toString() !== PLATFORM_ORGANIZATION_ID()
      );

      if (customerUsers.length === 0) {
        return next(CustomError.unauthorized("Invalid email or password."));
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

      // Single user found, authenticate password
      const candidateUser = customerUsers[0];
      const isPasswordValid = await candidateUser.comparePassword(password);

      if (!isPasswordValid) {
        return next(CustomError.unauthorized("Invalid email or password."));
      }

      user = candidateUser;

      // Update last login
      await user.updateLastLogin();
    }

    // Ensure user object has populated organization and department for token generation
    if (!user.organization || !user.department) {
      // Re-populate if needed
      user = await User.findById(user._id)
        .populate("organization", "name _id")
        .populate("department", "name _id")
        .select("-password -refreshToken -refreshTokenExpiry");

      if (!user) {
        return next(CustomError.notFound("User not found."));
      }
    }

    // Final validation before token generation
    if (!user.organization || !user.department) {
      return next(
        CustomError.internalServer("User organization or department not found.")
      );
    }

    // Verify user and related entities are not deleted
    if (
      user.isDeleted ||
      user.organization?.isDeleted ||
      user.department?.isDeleted
    ) {
      return next(CustomError.unauthorized("Account is deactivated."));
    }

    // Generate JWT tokens with properly populated user object
    const { accessToken, refreshToken } = generateTokenPair(user);

    // Set HTTP-only cookies
    setAuthCookies(res, accessToken, refreshToken);

    // Update user status to online
    await user.updateStatus("online");

    // Remove sensitive fields from response
    const userResponse = {
      ...user.toObject(),
      password: undefined,
      refreshToken: undefined,
      refreshTokenExpiry: undefined,
    };

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: userResponse,
      },
    });
  } catch (error) {
    if (error instanceof CustomError) {
      return next(error);
    }

    console.error("Login error:", error);
    return next(CustomError.internalServer("Login failed. Please try again."));
  }
});

/**
 * Logout user
 * Invalidates tokens and clears cookies
 * @route POST /api/auth/logout
 * @access Private
 */
export const logout = asyncHandler(async (req, res, next) => {
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
export const refreshToken = asyncHandler(async (req, res, next) => {
  try {
    const { refreshToken: refreshTokenFromCookie } =
      extractTokensFromCookies(req);

    if (!refreshTokenFromCookie) {
      return next(
        CustomError.unauthorized(
          "Refresh token not found. Please log in again."
        )
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
      return next(CustomError.unauthorized("User account is deactivated."));
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
      return next(error);
    }

    console.error("Token refresh error:", error);
    return next(
      CustomError.unauthorized("Token refresh failed. Please log in again.")
    );
  }
});

/**
 * Forgot password - Send reset token
 * @route POST /api/auth/forgot-password
 * @access Public
 */
export const forgotPassword = asyncHandler(async (req, res, next) => {
  const { email, organizationId } = req.body;

  try {
    let user;

    if (organizationId) {
      // Find user in specific organization
      user = await User.findOne({
        email: email.toLowerCase(),
        organization: organizationId,
      }).populate("organization", "name");
    } else {
      // Find user across all customer organizations
      const users = await User.find({
        email: email.toLowerCase(),
      }).populate("organization", "name _id");

      const customerUsers = users.filter(
        (u) => u.organization._id.toString() !== PLATFORM_ORGANIZATION_ID()
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
      // Password reset requested - email would be sent in production
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
export const resetPassword = asyncHandler(async (req, res, next) => {
  // TODO: Implement password reset token validation
  // This would typically involve:
  // 1. Validate reset token from req.body
  // 2. Check token expiration
  // 3. Find user by token
  // 4. Update password from req.body
  // 5. Invalidate reset token

  return next(
    CustomError.badRequest(
      "Password reset functionality is not yet implemented."
    )
  );
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
export const updateProfile = asyncHandler(async (req, res, next) => {
  // Standard pattern for tenant and caller identification
  const { callerId } = extractUserContext(req);

  const { firstName, lastName, position, profilePicture } = req.body;

  try {
    const user = await User.findById(callerId);

    if (!user) {
      return next(CustomError.notFound("User not found."));
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
      return next(error);
    }

    console.error("Update profile error:", error);
    return next(
      CustomError.internalServer("Failed to update profile. Please try again.")
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
