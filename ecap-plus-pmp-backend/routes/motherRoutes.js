const express = require("express");
const router = express.Router();
const motherController = require("./../controllers/motherController");

router.get("/district/:district(*)/filtered", motherController.getMothersByDistrict);
router.get("/district/:district(*)", motherController.getMothersByDistrict);
router.get("/total/count", motherController.getTotalMothersCount);
router.get("/district/count/:district(*)", motherController.getMothersCountByDistrict);
router.get("/count/:district(*)", motherController.getMothersCountByDistrict);
router.get("/members-count/:district(*)", motherController.getMothersCountByDistrict);

module.exports = router;
