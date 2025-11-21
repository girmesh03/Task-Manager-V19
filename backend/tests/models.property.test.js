import fc from "fast-check";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import {
  User,
  Material,
  Vendor,
  Organization,
  Department,
} from "../models/index.js";
import { USER_ROLES_ARRAY } from "../constants/index.js";

describe("Data Models Property Tests", () => {
  /**
   * **Feature: task-manager-saasy 15: Password security**
   * For any user password storage, the password should be hashed using bcrypt and never stored in plain text
   * **Validates: Requirements 5.5**
   */
  describe("Property 15: Password security", () => {
    it("should hash passwords using bcrypt and never store plain text", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            firstName: fc
              .string({ minLength: 2, maxLength: 50 })
              .filter((s) => s.trim().length >= 2),
            lastName: fc
              .string({ minLength: 2, maxLength: 50 })
              .filter((s) => s.trim().length >= 2),
            email: fc.emailAddress(),
            password: fc
              .string({ minLength: 8, maxLength: 50 })
              .filter((s) => s.trim().length >= 8),
            role: fc.constantFrom(...USER_ROLES_ARRAY),
            position: fc
              .string({ minLength: 2, maxLength: 100 })
              .filter((s) => s.trim().length >= 2),
          }),
          async (userData) => {
            // Create organization and department first
            const organization = new Organization({
              name: `Test Org ${Date.now()}-${Math.random()}`,
              email: `org${Date.now()}-${Math.random()}@test.com`,
              phone: "+1234567890",
              address: "Test Address",
              size: "Small",
              industry: "Technology",
            });
            await organization.save();

            const department = new Department({
              name: `Test Dept ${Date.now()}-${Math.random()}`,
              organization: organization._id,
            });
            await department.save();

            const originalPassword = userData.password;

            const user = new User({
              ...userData,
              email: `${Date.now()}-${Math.random()}@test.com`, // Ensure unique email
              organization: organization._id,
              department: department._id,
            });

            await user.save();

            // Retrieve user with password field
            const savedUser = await User.findById(user._id).select("+password");

            // Password should be hashed, not plain text
            expect(savedUser.password).not.toBe(originalPassword);
            expect(savedUser.password).toMatch(/^\$2[aby]\$\d{1,2}\$.{53}$/); // bcrypt hash pattern

            // Should be able to compare with original password
            const isValid = await bcrypt.compare(
              originalPassword,
              savedUser.password
            );
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    }, 60000);
  });

  /**
   * **Feature: task-manager-saas, Property 32: Material name uniqueness within organization**
   * For any organization, material names should be unique within that organization
   * **Validates: Requirements 9.3**
   */
  describe("Property 32: Material name uniqueness within organization", () => {
    it("should enforce unique material names within the same organization", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc
              .string({ minLength: 2, maxLength: 100 })
              .filter((s) => s.trim().length >= 2),
            category: fc
              .string({ minLength: 2, maxLength: 50 })
              .filter((s) => s.trim().length >= 2),
            unit: fc.constantFrom(
              "piece",
              "kg",
              "liter",
              "meter",
              "box",
              "pack",
              "bottle",
              "bag",
              "roll",
              "sheet"
            ),
          }),
          async (materialData) => {
            // Create two organizations
            const org1 = new Organization({
              name: `Test Org 1 ${Date.now()}-${Math.random()}`,
              email: `org1${Date.now()}-${Math.random()}@test.com`,
              phone: "+1234567890",
              address: "Test Address",
              size: "Small",
              industry: "Technology",
            });
            await org1.save();

            const org2 = new Organization({
              name: `Test Org 2 ${Date.now()}-${Math.random()}`,
              email: `org2${Date.now()}-${Math.random()}@test.com`,
              phone: "+1234567891",
              address: "Test Address",
              size: "Small",
              industry: "Technology",
            });
            await org2.save();

            // Create departments and users
            const department1 = new Department({
              name: `Test Dept 1 ${Date.now()}-${Math.random()}`,
              organization: org1._id,
            });
            await department1.save();

            const user1 = new User({
              firstName: "Test",
              lastName: "User",
              email: `test1${Date.now()}-${Math.random()}@test.com`,
              password: "password123",
              role: "User",
              position: "Test Position",
              organization: org1._id,
              department: department1._id,
            });
            await user1.save();

            const department2 = new Department({
              name: `Test Dept 2 ${Date.now()}-${Math.random()}`,
              organization: org2._id,
            });
            await department2.save();

            const user2 = new User({
              firstName: "Test",
              lastName: "User",
              email: `test2${Date.now()}-${Math.random()}@test.com`,
              password: "password123",
              role: "User",
              position: "Test Position",
              organization: org2._id,
              department: department2._id,
            });
            await user2.save();

            // Create first material in org1
            const material1 = new Material({
              ...materialData,
              organization: org1._id,
              createdBy: user1._id,
            });
            await material1.save();

            // Should be able to create material with same name in different organization
            const material2 = new Material({
              ...materialData,
              organization: org2._id,
              createdBy: user2._id,
            });
            await material2.save();

            // Should NOT be able to create material with same name in same organization
            const duplicateMaterial = new Material({
              ...materialData,
              organization: org1._id,
              createdBy: user1._id,
            });

            // Expect MongoDB duplicate key error (E11000)
            await expect(duplicateMaterial.save()).rejects.toThrow(
              /E11000|duplicate key/
            );
          }
        ),
        { numRuns: 20 }
      );
    }, 60000);
  });

  /**
   * **Feature: task-manager-saas, Property 35: Vendor required fields**
   * For any vendor creation, the system should require name, contact information, and service categories
   * **Validates: Requirements 10.3**
   */
  describe("Property 35: Vendor required fields", () => {
    it("should require all mandatory fields for vendor creation", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc
              .string({ minLength: 2, maxLength: 100 })
              .filter((s) => s.trim().length >= 2),
            contactPerson: fc
              .string({ minLength: 2, maxLength: 100 })
              .filter((s) => s.trim().length >= 2),
            email: fc.emailAddress(),
            phone: fc
              .string({ minLength: 10, maxLength: 15 })
              .map((s) => "+1" + s.replace(/\D/g, "").slice(0, 10)),
            serviceCategories: fc.array(
              fc
                .string({ minLength: 2, maxLength: 50 })
                .filter((s) => s.trim().length >= 2),
              { minLength: 1, maxLength: 3 }
            ),
          }),
          async (vendorData) => {
            // Create organization and user
            const organization = new Organization({
              name: `Test Org ${Date.now()}-${Math.random()}`,
              email: `org${Date.now()}-${Math.random()}@test.com`,
              phone: "+1234567890",
              address: "Test Address",
              size: "Small",
              industry: "Technology",
            });
            await organization.save();

            const department = new Department({
              name: `Test Dept ${Date.now()}-${Math.random()}`,
              organization: organization._id,
            });
            await department.save();

            const user = new User({
              firstName: "Test",
              lastName: "User",
              email: `test${Date.now()}-${Math.random()}@test.com`,
              password: "password123",
              role: "User",
              position: "Test Position",
              organization: organization._id,
              department: department._id,
            });
            await user.save();

            // Should successfully create vendor with all required fields
            const vendor = new Vendor({
              ...vendorData,
              organization: organization._id,
              createdBy: user._id,
            });
            await vendor.save();

            expect(vendor.name).toBe(vendorData.name.trim());
            expect(vendor.contactPerson).toBe(vendorData.contactPerson.trim());
            expect(vendor.email).toBe(vendorData.email.toLowerCase());
            expect(vendor.phone).toBe(vendorData.phone);
            expect(vendor.serviceCategories).toEqual(
              vendorData.serviceCategories.map((cat) => cat.trim())
            );

            // Test missing required fields
            const requiredFields = ["name", "contactPerson", "email", "phone"];

            for (const field of requiredFields) {
              const incompleteData = { ...vendorData };
              delete incompleteData[field];

              const incompleteVendor = new Vendor({
                ...incompleteData,
                organization: organization._id,
                createdBy: user._id,
              });

              await expect(incompleteVendor.save()).rejects.toThrow();
            }

            // Test empty service categories
            const vendorWithoutCategories = new Vendor({
              ...vendorData,
              serviceCategories: [],
              organization: organization._id,
              createdBy: user._id,
            });

            await expect(vendorWithoutCategories.save()).rejects.toThrow();
          }
        ),
        { numRuns: 20 }
      );
    }, 60000);
  });
});
