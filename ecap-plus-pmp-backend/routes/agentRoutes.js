const express = require("express");
const router = express.Router();
const agentController = require("./../controllers/agentController");

router.route("/chat").post(agentController.chat);
router.route("/health").get(agentController.health);

module.exports = router;
