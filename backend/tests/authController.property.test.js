import fc from "fast-check";
import mongoose from "mongoose";
import request from "supertest";
import app from "../app.js";
import { User, Organization, Department } from "../models/index.js";
import { PLATFORM_ORGANIZATION_ID } from "../constants/index.js";

// Disable rate limiting for tests
process.env.NODE_ENV = "test";

describe("Authentication Controller Property Tests", () => {
  let testOrganization;
  let testDepartment;
  let platformOrganization;
  let platformDepartment;

  beforeAll(async () => {
    // Create platform organization
    platformOrganization = new Organization({
      _id: PLATFORM_ORGANIZATION_ID,
      name: "Task Manager Platform",
      email: "platform@taskmanager.com",
      phone: "+1000000000",
      address: "Platform Address",
      size: "Enterprise",
      industry: "Technology",
    });
    await platformOrganization.save();

    // Create platform department
    platformDepartment = new Department({
      name: "Platform Administration",
      organization: PLATFORM_ORGANIZATION_ID,
    });
    await platformDepartment.save();
  });

  beforeEach(async () => {
    // Create test organization and department for each test
    testOrganization = new Organization({
      name: `Test Org ${Date.now()}-${Math.random()}`,
      email: `org${Date.now()}-${Math.random()}@test.com`,
      phone: "+1234567890",
      address: "Test Address",
      size: "Small",
      industry: "Technology",
    });
    await testOrganization.save();

    testDepartment = new Department({
      name: `Test Dept ${Date.now()}-${Math.random()}`,
      organization: testOrganization._id,
    });
    await testDepartment.save();
  });

  /**
   * **Feature: task-manager-saas, Property 4: Registration sequence integrity**
   * For any valid organization registration data, the system should create Organization, Department,
   * and SuperAdmin user in sequence, with the createdBy fields in Organization and Department
   * properly referencing the created SuperAdmin user
   * **Validates: Requirements 2.1, 2.2**
   */
  describe("Property 4: Registration sequence integrity", () => {
    it("should create Organization, Department, and SuperAdmin user in proper sequence with correct references", async () => {
      const registrationData = {
        organizationName: "Test Company Alpha",
        organizationEmail: "alpha@testcompany.com",
        organizationPhone: "+1234567890",
        organizationAddress: "123 Alpha Street, Test City",
        organizationSize: "Small",
        organizationIndustry: "Technology",
        departmentName: "Engineering",
        firstName: "John",
        lastName: "Smith",
        email: "john.smith@testcompany.com",
        password: "Password123!",
        position: "CTO",
      };

      // Make registration request
      const response = await request(app)
        .post("/api/auth/register")
        .send(registrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        "Organization registered successfully"
      );
      expect(response.body.data).toHaveProperty("user");
      expect(response.body.data).toHaveProperty("organization");
      expect(response.body.data).toHaveProperty("department");

      const { user, organization, department } = response.body.data;

      // Verify user is SuperAdmin
      expect(user.role).toBe("SuperAdmin");
      expect(user.firstName).toBe(registrationData.firstName);
      expect(user.lastName).toBe(registrationData.lastName);
      expect(user.email).toBe(registrationData.email.toLowerCase());
      expect(user.position).toBe(registrationData.position);

      // Verify organization data
      expect(organization.name).toBe(registrationData.organizationName);
      expect(organization.email).toBe(
        registrationData.organizationEmail.toLowerCase()
      );

      // Verify department data
      expect(department.name).toBe(registrationData.departmentName);

      // Verify relationships
      expect(user.organization._id).toBe(organization._id);
      expect(user.department._id).toBe(department._id);

      // Verify sequence integrity by checking database directly
      const dbOrganization = await Organization.findById(organization._id);
      const dbDepartment = await Department.findById(department._id);
      const dbUser = await User.findById(user._id);

      // Verify createdBy fields reference the SuperAdmin user
      expect(dbOrganization.createdBy.toString()).toBe(user._id);
      expect(dbDepartment.createdBy.toString()).toBe(user._id);

      // Verify user belongs to created organization and department
      expect(dbUser.organization.toString()).toBe(organization._id);
      expect(dbUser.department.toString()).toBe(department._id);

      // Verify authentication cookies are set
      const cookies = response.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const accessTokenCookie = cookies.find((cookie) =>
        cookie.startsWith("accessToken=")
      );
      const refreshTokenCookie = cookies.find((cookie) =>
        cookie.startsWith("refreshToken=")
      );
      expect(accessTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toBeDefined();

      // Verify HTTP-only and security flags
      expect(accessTokenCookie).toMatch(/HttpOnly/);
      expect(refreshTokenCookie).toMatch(/HttpOnly/);
      expect(accessTokenCookie).toMatch(/SameSite=Strict/);
      expect(refreshTokenCookie).toMatch(/SameSite=Strict/);
    }, 15000);
  });

  /**
   * **Feature: task-manager-saas, Property 5: Organization name uniqueness**
   * For any organization name, if it already exists in the system, attempting to create
   * another organization with the same name should be rejected
   * **Validates: Requirements 2.4**
   */
  describe("Property 5: Organization name uniqueness", () => {
    it("should reject registration attempts with duplicate organization names", async () => {
      const firstRegistration = {
        organizationName: "Unique Test Company",
        organizationEmail: "first@unique.com",
        organizationPhone: "+1234567890",
        organizationAddress: "123 First Street",
        organizationSize: "Small",
        organizationIndustry: "Technology",
        departmentName: "Engineering",
        firstName: "John",
        lastName: "First",
        email: "john.first@unique.com",
        password: "Password123!",
        position: "CTO",
      };

      const secondRegistration = {
        ...firstRegistration,
        organizationEmail: "second@unique.com", // Different email
        email: "john.second@unique.com", // Different user email
        organizationName: "Unique Test Company", // Same organization name
      };

      // First registration should succeed
      const firstResponse = await request(app)
        .post("/api/auth/register")
        .send(firstRegistration)
        .expect(201);

      expect(firstResponse.body.success).toBe(true);

      // Second registration with same organization name should fail
      const secondResponse = await request(app)
        .post("/api/auth/register")
        .send(secondRegistration)
        .expect(409);

      expect(secondResponse.body.success).toBe(false);
      expect(secondResponse.body.message).toMatch(
        /organization name already exists/i
      );
    }, 15000);
  });

  /**
   * **Feature: task-manager-saas, Property 1: Platform admin cross-organization access**
   * For any platform administrator (user whose organization ID equals PLATFORM_ORGANIZATION_ID),
   * they should be able to list and access all customer organizations while non-platform users cannot
   * access organizations other than their own
   * **Validates: Requirements 1.2, 1.4**
   */
  describe("Property 1: Platform admin cross-organization access", () => {
    it("should allow platform admins to access all organizations while restricting customer users", async () => {
      // Create platform admin user
      const platformUser = new User({
        firstName: "Platform",
        lastName: "Admin",
        email: "platform.admin@test.com",
        password: "Password123!",
        role: "SuperAdmin",
        position: "Platform Administrator",
        organization: PLATFORM_ORGANIZATION_ID,
        department: platformDepartment._id,
      });
      await platformUser.save();

      // Create customer user
      const customerUser = new User({
        firstName: "Customer",
        lastName: "User",
        email: "customer.user@test.com",
        password: "Password123!",
        role: "SuperAdmin",
        position: "Customer Admin",
        organization: testOrganization._id,
        department: testDepartment._id,
      });
      await customerUser.save();

      // Login as platform admin
      const platformLoginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: "platform.admin@test.com",
          password: "Password123!",
          organizationId: PLATFORM_ORGANIZATION_ID,
        })
        .expect(200);

      expect(platformLoginResponse.body.success).toBe(true);
      const platformCookies = platformLoginResponse.headers["set-cookie"];

      // Login as customer user
      const customerLoginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: "customer.user@test.com",
          password: "Password123!",
          organizationId: testOrganization._id.toString(),
        })
        .expect(200);

      expect(customerLoginResponse.body.success).toBe(true);
      const customerCookies = customerLoginResponse.headers["set-cookie"];

      // Platform admin should be able to access organizations endpoint
      const platformOrgResponse = await request(app)
        .get("/api/organizations")
        .set("Cookie", platformCookies)
        .expect(200);

      expect(platformOrgResponse.body.success).toBe(true);
      expect(platformOrgResponse.body.data).toHaveProperty("organizations");
      expect(Array.isArray(platformOrgResponse.body.data.organizations)).toBe(
        true
      );

      // Customer user should NOT be able to access organizations endpoint
      const customerOrgResponse = await request(app)
        .get("/api/organizations")
        .set("Cookie", customerCookies)
        .expect(403);

      expect(customerOrgResponse.body.success).toBe(false);
      expect(customerOrgResponse.body.message).toMatch(
        /platform administrator access required/i
      );

      // Platform admin should be able to access specific customer organization
      const platformSpecificOrgResponse = await request(app)
        .get(`/api/organizations/${testOrganization._id}`)
        .set("Cookie", platformCookies)
        .expect(200);

      expect(platformSpecificOrgResponse.body.success).toBe(true);
      expect(platformSpecificOrgResponse.body.data.organization._id).toBe(
        testOrganization._id.toString()
      );

      // Customer user should NOT be able to access organizations endpoint at all
      const customerSpecificOrgResponse = await request(app)
        .get(`/api/organizations/${testOrganization._id}`)
        .set("Cookie", customerCookies)
        .expect(403);

      expect(customerSpecificOrgResponse.body.success).toBe(false);
    }, 20000);
  });

  /**
   * **Feature: task-manager-saas, Property 3: Platform organization restriction**
   * For any platform management operation (creating organizations, listing all organizations),
   * only users whose organization ID matches PLATFORM_ORGANIZATION_ID should be able to perform these operations
   * **Validates: Requirements 1.5**
   */
  describe("Property 3: Platform organization restriction", () => {
    it("should restrict platform management operations to platform organization users only", async () => {
      // Create customer user with SuperAdmin role (highest role in customer org)
      const customerUser = new User({
        firstName: "Customer",
        lastName: "SuperAdmin",
        email: "customer.superadmin@test.com",
        password: "Password123!",
        role: "SuperAdmin",
        position: "Organization Administrator",
        organization: testOrganization._id,
        department: testDepartment._id,
      });
      await customerUser.save();

      // Login as customer SuperAdmin
      const loginResponse = await request(app)
        .post("/api/auth/login")
        .send({
          email: "customer.superadmin@test.com",
          password: "Password123!",
          organizationId: testOrganization._id.toString(),
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      const cookies = loginResponse.headers["set-cookie"];

      // Customer SuperAdmin should NOT be able to list all organizations
      const listOrgResponse = await request(app)
        .get("/api/organizations")
        .set("Cookie", cookies)
        .expect(403);

      expect(listOrgResponse.body.success).toBe(false);
      expect(listOrgResponse.body.message).toMatch(
        /platform administrator access required/i
      );

      // Customer SuperAdmin should NOT be able to create new organizations
      const createOrgResponse = await request(app)
        .post("/api/organizations")
        .set("Cookie", cookies)
        .send({
          name: "New Test Organization",
          email: "neworg@test.com",
          phone: "+1234567890",
          address: "Test Address",
          size: "Small",
          industry: "Technology",
        })
        .expect(403);

      expect(createOrgResponse.body.success).toBe(false);
      expect(createOrgResponse.body.message).toMatch(
        /platform administrator access required/i
      );

      // Customer SuperAdmin should NOT be able to access organization statistics
      const statsResponse = await request(app)
        .get("/api/organizations/statistics")
        .set("Cookie", cookies)
        .expect(403);

      expect(statsResponse.body.success).toBe(false);
      expect(statsResponse.body.message).toMatch(
        /platform administrator access required/i
      );
    }, 15000);
  });
});
