const express = require("express");
const router = express.Router();
const householdController = require("./../controllers/householdController");

router
  .route("/households-count/:district(*)")
  .get(householdController.allAssessedHouseholdsCount);

router
  .route("/all-households/:district(*)")
  .get(householdController.getAllHouseholds);

router
  .route("/all-households-archived/:district(*)")
  .get(householdController.getAllArchivedHouseholds);

router
  .route("/all-household-members-register")
  .get(householdController.getAllHouseholdMemberRegister);

router
  .route("/caregiver-services/:household_id(*)")
  .get(householdController.getAllCaregiverServices);

router
  .route("/caregiver-services-by-month/:district(*)")
  .get(householdController.getAllCaregiverServicesByDistrict);

// GET /household/caregiver-services-by-district/:district(*)
// - Aggregates caregiver services by district (no monthly breakdown)
// - `:district` can be `All`, single, or comma-separated list
router
  .route("/caregiver-services-by-district/:district(*)")
  .get(householdController.getCaregiverServicesByDistrict);

router
  .route("/caregiver-referrals-by-month/:district(*)")
  .get(householdController.getAllCaregiverReferralsByDistrict);

// GET /household/household-services-by-district/:district(*)
// - Aggregates household services by district (no monthly breakdown)
// - `:district` can be `All`, single, or comma-separated list
router
  .route("/household-services-by-district/:district(*)")
  .get(householdController.getHouseholdServicesByDistrict);

// GET /household/hts-register-by-district/:district(*)
// - Returns raw HTS register records (no filters applied)
// - Note: `:district` and `?province` are ignored as requested
router
  .route("/hts-register-by-district/:district(*)")
  .get(householdController.getHTSRegisterByDistrict);

router
  .route("/caregiver-referrals/:household_id(*)")
  .get(householdController.getAllReferrals);

router
  .route("/caregiver-caseplans/:household_id(*)")
  .get(householdController.getAllCaregiverCasePlans);

router
  .route("/caregiver-caseplan-domains/:household_id(*)")
  .get(householdController.getAllCaregiverCasePlanDomains);

router
  .route("/members/:household_id(*)")
  .get(householdController.getHouseholdFamilyMembers);

// Removed external script and CSV routes that referenced local filesystem paths.

module.exports = router;
