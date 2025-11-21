/**
 * Authentication Routes
 * Routes for user authentication, registration, and token management
 */

import express from "express";
import {
  registerOrganization,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfile,
} from "../controllers/authController.js";
import {
  validateOrganizationRegistration,
  validateLogin,
  validateForgotPassword,
  validatePasswordReset,
} from "../validators/authValidators.js";
import { handleValidationErrors } from "../validators/validationMiddleware.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register new organization with SuperAdmin user
 * @access  Public
 */
router.post(
  "/register",
  validateOrganizationRegistration,
  handleValidationErrors,
  registerOrganization
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user with credentials
 * @access  Public
 */
router.post("/login", validateLogin, handleValidationErrors, login);

/**
 * @route   DELETE /api/auth/logout
 * @desc    Logout user and clear cookies
 * @access  Public (but uses optional auth to update user status)
 */
router.delete("/logout", optionalAuth, logout);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public (requires refresh token in cookies)
 */
router.post("/refresh", refreshToken);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post(
  "/forgot-password",
  validateForgotPassword,
  handleValidationErrors,
  forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  "/reset-password",
  validatePasswordReset,
  handleValidationErrors,
  resetPassword
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/me", authenticate, getCurrentUser);

/**
 * @route   PUT /api/auth/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put("/me", authenticate, updateProfile);

export default router;
