/**
 * Organization Routes
 * Routes for organization management (Platform admins only)
 */

import express from "express";
import {
  getOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  restoreOrganization,
  getOrganizationStatistics,
} from "../controllers/organizationController.js";
import {
  validateOrganizationId,
  validateCreateOrganization,
  validateUpdateOrganization,
  validateOrganizationQuery,
  validateDeleteOrganization,
  validateRestoreOrganization,
} from "../validators/organizationValidators.js";
import { handleValidationErrors } from "../validators/validationMiddleware.js";
import { authenticate, requirePlatformAdmin } from "../middleware/auth.js";

const router = express.Router();

// All organization routes require platform admin access
router.use(authenticate, requirePlatformAdmin);

/**
 * @route   GET /api/organizations
 * @desc    Get all customer organizations with filtering and pagination
 * @access  Private (Platform SuperAdmin only)
 */
router.get(
  "/",
  validateOrganizationQuery,
  handleValidationErrors,
  getOrganizations
);

/**
 * @route   GET /api/organizations/statistics
 * @desc    Get organization statistics for platform dashboard
 * @access  Private (Platform SuperAdmin only)
 */
router.get("/statistics", getOrganizationStatistics);

/**
 * @route   GET /api/organizations/:organizationId
 * @desc    Get single organization by ID with details
 * @access  Private (Platform SuperAdmin only)
 */
router.get(
  "/:organizationId",
  validateOrganizationId,
  handleValidationErrors,
  getOrganizationById
);

/**
 * @route   POST /api/organizations
 * @desc    Create new customer organization
 * @access  Private (Platform SuperAdmin only)
 */
router.post(
  "/",
  validateCreateOrganization,
  handleValidationErrors,
  createOrganization
);

/**
 * @route   PUT /api/organizations/:organizationId
 * @desc    Update organization details
 * @access  Private (Platform SuperAdmin only)
 */
router.put(
  "/:organizationId",
  validateUpdateOrganization,
  handleValidationErrors,
  updateOrganization
);

/**
 * @route   DELETE /api/organizations/:organizationId
 * @desc    Soft delete organization
 * @access  Private (Platform SuperAdmin only)
 */
router.delete(
  "/:organizationId",
  validateDeleteOrganization,
  handleValidationErrors,
  deleteOrganization
);

/**
 * @route   POST /api/organizations/:organizationId/restore
 * @desc    Restore soft deleted organization
 * @access  Private (Platform SuperAdmin only)
 */
router.post(
  "/:organizationId/restore",
  validateRestoreOrganization,
  handleValidationErrors,
  restoreOrganization
);

export default router;
