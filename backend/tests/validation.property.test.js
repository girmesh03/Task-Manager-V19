import fc from "fast-check";
import mongoose from "mongoose";
import { validationResult } from "express-validator";
import { validateOrganizationRegistration } from "../validators/authValidators.js";
import {
  isValidObjectId,
  validators,
} from "../validators/validationMiddleware.js";
import {
  USER_ROLES_ARRAY,
  ORGANIZATION_SIZES_ARRAY,
  TASK_STATUS_ARRAY,
  TASK_PRIORITY_ARRAY,
} from "../constants/index.js";

// Mock request object for testing
const createMockReq = (body = {}, user = null) => ({
  body,
  user,
  params: {},
  query: {},
});

describe("Validation System Property Tests", () => {
  /**
   * **Feature: task-manager-saas, Property 6: Registration validation completeness**
   * For any organization registration attempt missing required fields (name, email, phone, address, size, industry),
   * the system should reject the registration with appropriate validation errors
   * **Validates: Requirements 2.3**
   */
  describe("Property 6: Registration validation completeness", () => {
    it("should reject registration when required fields are missing", async () => {
      const requiredFields = [
        "organizationName",
        "organizationEmail",
        "organizationPhone",
        "organizationAddress",
        "organizationSize",
        "organizationIndustry",
      ];

      // Test each required field individually
      for (const missingField of requiredFields) {
        const validData = {
          organizationName: "Test Organization",
          organizationEmail: "test@example.com",
          organizationPhone: "+1234567890",
          organizationAddress: "123 Test Street, Test City",
          organizationSize: "Small",
          organizationIndustry: "Technology",
          departmentName: "Test Department",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
          password: "Password123!",
          position: "Manager",
        };

        // Remove the required field
        const invalidData = { ...validData };
        delete invalidData[missingField];

        const req = createMockReq(invalidData);

        // Run validation middleware
        for (const validator of validateOrganizationRegistration) {
          await validator.run(req);
        }

        const errors = validationResult(req);

        // Should have validation errors
        expect(errors.isEmpty()).toBe(false);

        // Should have error for the missing field
        const errorFields = errors.array().map((error) => error.path);
        expect(errorFields).toContain(missingField);

        // Should have "required" error message for the missing field
        const fieldErrors = errors
          .array()
          .filter((error) => error.path === missingField);
        const hasRequiredError = fieldErrors.some(
          (error) =>
            error.msg.includes("required") || error.msg.includes("is required")
        );
        expect(hasRequiredError).toBe(true);
      }
    });
  });

  /**
   * **Feature: task-manager-saas, Property 13: Role enumeration validation**
   * For any user role assignment, the role should be one of the four valid values: SuperAdmin, Admin, Manager, or User
   * **Validates: Requirements 5.2**
   */
  describe("Property 13: Role enumeration validation", () => {
    it("should only accept valid user roles", async () => {
      await fc.assert(
        fc.property(
          fc.oneof(
            fc.constantFrom(...USER_ROLES_ARRAY), // Valid roles
            fc.string().filter((s) => !USER_ROLES_ARRAY.includes(s)) // Invalid roles
          ),
          (role) => {
            try {
              const result = validators.userRole(role);

              if (USER_ROLES_ARRAY.includes(role)) {
                // Valid role should return true
                expect(result).toBe(true);
              } else {
                // Invalid role should throw error - this line should not be reached
                expect(true).toBe(false); // Force failure if we get here
              }
            } catch (error) {
              // Invalid role should throw error
              expect(USER_ROLES_ARRAY.includes(role)).toBe(false);
              expect(error.message).toContain("Role must be one of:");
              expect(error.message).toContain("SuperAdmin");
              expect(error.message).toContain("Admin");
              expect(error.message).toContain("Manager");
              expect(error.message).toContain("User");
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: task-manager-saas, Property 48: Enum validation**
   * For any enum field submission, the system should validate the value against predefined constants and reject invalid enum values
   * **Validates: Requirements 14.3**
   */
  describe("Property 48: Enum validation", () => {
    it("should validate enum values against predefined constants", async () => {
      await fc.assert(
        fc.property(
          fc.record({
            enumType: fc.constantFrom(
              "userRole",
              "userStatus",
              "organizationSize",
              "taskStatus",
              "taskPriority"
            ),
            value: fc.string(),
          }),
          ({ enumType, value }) => {
            const enumArrays = {
              userRole: USER_ROLES_ARRAY,
              userStatus: ["online", "offline", "away"],
              organizationSize: ORGANIZATION_SIZES_ARRAY,
              taskStatus: TASK_STATUS_ARRAY,
              taskPriority: TASK_PRIORITY_ARRAY,
            };

            const validValues = enumArrays[enumType];
            const validator = validators[enumType];

            try {
              const result = validator(value);

              if (validValues.includes(value)) {
                // Valid enum value should return true
                expect(result).toBe(true);
              } else {
                // Invalid enum value should throw error - this line should not be reached
                expect(true).toBe(false); // Force failure if we get here
              }
            } catch (error) {
              // Invalid enum value should throw error
              expect(validValues.includes(value)).toBe(false);
              expect(error.message).toContain("must be one of:");

              // Error message should contain all valid values
              for (const validValue of validValues) {
                expect(error.message).toContain(validValue);
              }
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  /**
   * **Feature: task-manager-saas, Property 49: ObjectId format validation**
   * For any ObjectId field submission, the system should validate proper MongoDB ObjectId format
   * **Validates: Requirements 14.4**
   */
  describe("Property 49: ObjectId format validation", () => {
    it("should validate MongoDB ObjectId format", async () => {
      await fc.assert(
        fc.property(
          fc.oneof(
            // Valid ObjectIds
            fc.hexaString({ minLength: 24, maxLength: 24 }),
            // Invalid ObjectIds
            fc
              .string()
              .filter((s) => s.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(s))
          ),
          (objectIdString) => {
            const isValid = isValidObjectId(objectIdString);
            const expectedValid =
              /^[0-9a-fA-F]{24}$/.test(objectIdString) &&
              objectIdString.length === 24 &&
              mongoose.Types.ObjectId.isValid(objectIdString);

            expect(isValid).toBe(expectedValid);

            if (expectedValid) {
              // Valid ObjectId should pass validation
              expect(isValid).toBe(true);
            } else {
              // Invalid ObjectId should fail validation
              expect(isValid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("should handle edge cases for ObjectId validation", async () => {
      const testCases = [
        { value: "", expected: false },
        { value: null, expected: false },
        { value: undefined, expected: false },
        { value: "123", expected: false },
        { value: "12345678901234567890123g", expected: false }, // Invalid character
        { value: "1234567890123456789012345", expected: false }, // Too long
        { value: "12345678901234567890123", expected: false }, // Too short
        { value: "000000000000000000000000", expected: true }, // Valid
        { value: "507f1f77bcf86cd799439011", expected: true }, // Valid
        { value: "FFFFFFFFFFFFFFFFFFFFFFFF", expected: true }, // Valid uppercase
      ];

      for (const testCase of testCases) {
        const result = isValidObjectId(testCase.value);
        expect(result).toBe(testCase.expected);
      }
    });
  });
});
