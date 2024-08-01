const express = require("express");
const router = express.Router();

const { getPlacesByRadius, getPlaces } = require("../controllers/places");

router.route("/radius").get(getPlacesByRadius);
router.route("/").get(getPlaces);

module.exports = router;
