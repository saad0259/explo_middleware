const express = require("express");

const { updateSettings } = require("../controllers/settings");

const router = express.Router();

router.patch("/", updateSettings);

module.exports = router;
