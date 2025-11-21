/**
 * Main Routes Index
 * Centralizes all route imports and exports
 */

import express from "express";

import authRoutes from "./authRoutes.js";
import organizationRoutes from "./organizationRoutes.js";

import AuthRoutes from "./authRoutes.js";
import OrganizationRoutes from "./organizationRoutes.js";

const router = express.Router();

router.use("/auth", AuthRoutes);
router.use("/organizations", OrganizationRoutes);

export default router;
