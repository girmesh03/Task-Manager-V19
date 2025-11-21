import fc from "fast-check";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { User, Organization, Department } from "../models/index.js";
import {
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  extractTokensFromCookies,
  refreshAccessToken,
} from "../utils/jwtUtils.js";
import { USER_ROLES_ARRAY } from "../constants/index.js";

describe("Authentication System Property Tests", () => {
  /**
   * **Feature: task-manager-saas, Property 7: Authentication token security**
   * For any successful user authentication, the system should generate JWT tokens with correct expiration times
   * and store them as HTTP-only cookies, never in accessible client storage
   * **Validates: Requirements 3.2, 3.3**
   */
  describe("Property 7: Authentication token security", () => {
    it("should generate secure JWT tokens with proper expiration and HTTP-only cookie storage", async () => {
      // Create test organization and department once
      const organization = new Organization({
        name: `Test Org ${Date.now()}`,
        email: `org${Date.now()}@test.com`,
        phone: "+1234567890",
        address: "Test Address",
        size: "Small",
        industry: "Technology",
      });
      await organization.save();

      const department = new Department({
        name: `Test Dept ${Date.now()}`,
        organization: organization._id,
      });
      await department.save();

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom("SuperAdmin", "Admin", "Manager", "User"),
          async (role) => {
            // Create user with fixed valid data
            const user = new User({
              firstName: "Test",
              lastName: "User",
              email: `test${Date.now()}-${Math.random()}@test.com`,
              password: "password123",
              role: role,
              position: "Test Position",
              organization: organization._id,
              department: department._id,
            });
            await user.save();

            // Create a user object with populated fields for token generation
            const userForToken = {
              _id: user._id,
              email: user.email,
              role: user.role,
              organization: { _id: organization._id },
              department: { _id: department._id },
            };

            // Generate token pair
            const { accessToken, refreshToken } =
              generateTokenPair(userForToken);

            // Verify tokens are strings and not empty
            expect(typeof accessToken).toBe("string");
            expect(typeof refreshToken).toBe("string");
            expect(accessToken.length).toBeGreaterThan(0);
            expect(refreshToken.length).toBeGreaterThan(0);

            // Verify access token structure and claims
            const accessDecoded = verifyAccessToken(accessToken);
            expect(accessDecoded.userId).toBe(user._id.toString());
            expect(accessDecoded.email).toBe(user.email);
            expect(accessDecoded.role).toBe(user.role);
            expect(accessDecoded.organizationId).toBe(
              organization._id.toString()
            );
            expect(accessDecoded.departmentId).toBe(department._id.toString());
            expect(accessDecoded.iss).toBe("task-manager-saas");
            expect(accessDecoded.aud).toBe("task-manager-users");

            // Verify refresh token structure
            const refreshDecoded = verifyRefreshToken(refreshToken);
            expect(refreshDecoded.userId).toBe(user._id.toString());
            expect(refreshDecoded.iss).toBe("task-manager-saas");
            expect(refreshDecoded.aud).toBe("task-manager-users");

            // Verify token expiration times are set correctly
            const now = Math.floor(Date.now() / 1000);
            expect(accessDecoded.exp).toBeGreaterThan(now);
            expect(refreshDecoded.exp).toBeGreaterThan(now);
            expect(refreshDecoded.exp).toBeGreaterThan(accessDecoded.exp); // Refresh should expire later

            // Test HTTP-only cookie setting
            const mockRes = {
              cookies: {},
              cookie: function (name, value, options) {
                this.cookies[name] = { value, options };
              },
            };

            setAuthCookies(mockRes, accessToken, refreshToken);

            // Verify cookies are set with proper security options
            expect(mockRes.cookies.accessToken).toBeDefined();
            expect(mockRes.cookies.refreshToken).toBeDefined();
            expect(mockRes.cookies.accessToken.value).toBe(accessToken);
            expect(mockRes.cookies.refreshToken.value).toBe(refreshToken);
            expect(mockRes.cookies.accessToken.options.httpOnly).toBe(true);
            expect(mockRes.cookies.refreshToken.options.httpOnly).toBe(true);
            expect(mockRes.cookies.accessToken.options.sameSite).toBe("strict");
            expect(mockRes.cookies.refreshToken.options.sameSite).toBe(
              "strict"
            );
          }
        ),
        { numRuns: 4 }
      );
    }, 10000);
  });

  /**
   * **Feature: task-manager-saas, Property 8: Authentication logout cleanup**
   * For any user logout operation, all authentication tokens should be invalidated
   * and authentication cookies should be cleared from the client
   * **Validates: Requirements 3.4**
   */
  describe("Property 8: Authentication logout cleanup", () => {
    it("should properly clear authentication cookies on logout", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: fc.string({ minLength: 10, maxLength: 100 }),
            refreshToken: fc.string({ minLength: 10, maxLength: 100 }),
          }),
          async (tokenData) => {
            const mockRes = {
              cookies: {},
              clearedCookies: {},
              cookie: function (name, value, options) {
                this.cookies[name] = { value, options };
              },
              clearCookie: function (name, options) {
                this.clearedCookies[name] = { options };
                delete this.cookies[name];
              },
            };

            // Set cookies first
            setAuthCookies(
              mockRes,
              tokenData.accessToken,
              tokenData.refreshToken
            );
            expect(mockRes.cookies.accessToken).toBeDefined();
            expect(mockRes.cookies.refreshToken).toBeDefined();

            // Clear cookies (logout)
            clearAuthCookies(mockRes);

            // Verify cookies are cleared
            expect(mockRes.cookies.accessToken).toBeUndefined();
            expect(mockRes.cookies.refreshToken).toBeUndefined();
            expect(mockRes.clearedCookies.accessToken).toBeDefined();
            expect(mockRes.clearedCookies.refreshToken).toBeDefined();

            // Verify clear cookie options match security requirements
            expect(mockRes.clearedCookies.accessToken.options.httpOnly).toBe(
              true
            );
            expect(mockRes.clearedCookies.refreshToken.options.httpOnly).toBe(
              true
            );
            expect(mockRes.clearedCookies.accessToken.options.sameSite).toBe(
              "strict"
            );
            expect(mockRes.clearedCookies.refreshToken.options.sameSite).toBe(
              "strict"
            );
          }
        ),
        { numRuns: 10 }
      );
    }, 5000);
  });

  /**
   * **Feature: task-manager-saas, Property 9: Token refresh mechanism**
   * For any valid refresh token, the system should generate new access tokens
   * while maintaining the same user identity and permissions
   * **Validates: Requirements 3.5**
   */
  describe("Property 9: Token refresh mechanism", () => {
    it("should generate new access tokens from valid refresh tokens while maintaining user identity", async () => {
      // Create test organization and department once
      const organization = new Organization({
        name: `Test Org Refresh ${Date.now()}`,
        email: `orgrefresh${Date.now()}@test.com`,
        phone: "+1234567891",
        address: "Test Address",
        size: "Small",
        industry: "Technology",
      });
      await organization.save();

      const department = new Department({
        name: `Test Dept Refresh ${Date.now()}`,
        organization: organization._id,
      });
      await department.save();

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom("SuperAdmin", "Admin", "Manager", "User"),
          async (role) => {
            // Create user with fixed valid data
            const user = new User({
              firstName: "Test",
              lastName: "User",
              email: `refresh${Date.now()}-${Math.random()}@test.com`,
              password: "password123",
              role: role,
              position: "Test Position",
              organization: organization._id,
              department: department._id,
            });
            await user.save();

            // Create a user object with populated fields for token generation
            const userForToken = {
              _id: user._id,
              email: user.email,
              role: user.role,
              organization: { _id: organization._id },
              department: { _id: department._id },
            };

            // Generate initial token pair
            const { accessToken: originalAccessToken, refreshToken } =
              generateTokenPair(userForToken);

            // Decode original access token for comparison
            const originalDecoded = verifyAccessToken(originalAccessToken);

            // Add a small delay to ensure different timestamps
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Mock getUserById function for refresh
            const getUserById = async (userId) => {
              // Return user data directly to avoid Mongoose query issues
              return {
                _id: user._id,
                email: user.email,
                role: user.role,
                organization: { _id: organization._id },
                department: { _id: department._id },
              };
            };

            // Refresh access token
            const refreshResult = await refreshAccessToken(
              refreshToken,
              getUserById
            );

            // Verify refresh result structure
            expect(refreshResult).toHaveProperty("accessToken");
            expect(refreshResult).toHaveProperty("user");
            expect(typeof refreshResult.accessToken).toBe("string");
            expect(refreshResult.accessToken.length).toBeGreaterThan(0);

            // Verify new access token is different from original
            expect(refreshResult.accessToken).not.toBe(originalAccessToken);

            // Decode new access token
            const newDecoded = verifyAccessToken(refreshResult.accessToken);

            // Verify user identity and permissions are maintained
            expect(newDecoded.userId).toBe(originalDecoded.userId);
            expect(newDecoded.email).toBe(originalDecoded.email);
            expect(newDecoded.role).toBe(originalDecoded.role);
            expect(newDecoded.organizationId).toBe(
              originalDecoded.organizationId
            );
            expect(newDecoded.departmentId).toBe(originalDecoded.departmentId);
            expect(newDecoded.iss).toBe(originalDecoded.iss);
            expect(newDecoded.aud).toBe(originalDecoded.aud);

            // Verify new token has different issued time (iat)
            expect(newDecoded.iat).toBeGreaterThan(originalDecoded.iat);

            // Verify returned user object matches expected structure
            expect(refreshResult.user._id.toString()).toBe(user._id.toString());
            expect(refreshResult.user.email).toBe(user.email);
            expect(refreshResult.user.role).toBe(user.role);

            // Test with invalid refresh token should fail
            const invalidRefreshToken = refreshToken.slice(0, -5) + "XXXXX";
            await expect(
              refreshAccessToken(invalidRefreshToken, getUserById)
            ).rejects.toThrow(
              /Invalid refresh token|Refresh token verification failed/
            );
          }
        ),
        { numRuns: 4 }
      );
    }, 20000);
  });

  /**
   * Test cookie extraction functionality
   */
  describe("Cookie extraction functionality", () => {
    it("should properly extract tokens from request cookies", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            accessToken: fc.string({ minLength: 10, maxLength: 100 }),
            refreshToken: fc.string({ minLength: 10, maxLength: 100 }),
          }),
          async (tokenData) => {
            // Mock request object with cookies
            const mockReq = {
              cookies: {
                accessToken: tokenData.accessToken,
                refreshToken: tokenData.refreshToken,
                otherCookie: "should-be-ignored",
              },
            };

            const extractedTokens = extractTokensFromCookies(mockReq);

            expect(extractedTokens.accessToken).toBe(tokenData.accessToken);
            expect(extractedTokens.refreshToken).toBe(tokenData.refreshToken);
            expect(extractedTokens).not.toHaveProperty("otherCookie");

            // Test with missing cookies
            const mockReqNoCookies = { cookies: {} };
            const extractedEmpty = extractTokensFromCookies(mockReqNoCookies);
            expect(extractedEmpty.accessToken).toBeUndefined();
            expect(extractedEmpty.refreshToken).toBeUndefined();

            // Test with no cookies property
            const mockReqNoProperty = {};
            const extractedNoProperty =
              extractTokensFromCookies(mockReqNoProperty);
            expect(extractedNoProperty.accessToken).toBeUndefined();
            expect(extractedNoProperty.refreshToken).toBeUndefined();
          }
        ),
        { numRuns: 10 }
      );
    }, 5000);
  });
});
