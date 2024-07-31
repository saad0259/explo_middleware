const express = require("express");
const router = express.Router();

const { getPlaces } = require("../controllers/places");

router.route("/").get(getPlaces);

module.exports = router;
