const express = require("express");
const router = express.Router();
const childController = require("./../controllers/childController");

router
  .route("/vcas-count/:district(*)")
  .get(childController.allAssessedVCAsCount);

router
  .route("/vcas-assessed-register/:district(*)")
  .get(childController.getAllVCAsAssessedRegister);

router
  .route("/vcas-archived-register/:district(*)")
  .get(childController.getAllVCAsArchivedRegister);

router.route("/vca-profile/:unique_id(*)").get(childController.getVcaProfile);

router
  .route("/vca-services-by-month/:district(*)")
  .get(childController.getAllVCAServicesByDistrict);

// GET /child/vca-services-by-district/:district(*)
// - Aggregates VCA services by district (no monthly breakdown)
// - `:district` can be `All`, single, or comma-separated list
router
  .route("/vca-services-by-district/:district(*)")
  .get(childController.getVCAServicesByDistrict);

router.route("/vca-services/:vcaid(*)").get(childController.getVcaServices);

router
  .route("/vca-caseplans/:unique_id(*)")
  .get(childController.getVcaCasePlans);

router
  .route("/vca-caseplan-domains/:unique_id(*)")
  .get(childController.getVcaCasePlanDomains);

router
  .route("/vca-referrals/:unique_id(*)")
  .get(childController.getAllReferrals);

router
  .route("/vca-referrals-by-month/:district(*)")
  .get(childController.getAllVCAReferralsByDistrict);

module.exports = router;
