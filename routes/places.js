const express = require("express");
const router = express.Router();

const {
  getPlacesByRadius,
  getPlaces,
  getPlaceByCode,
} = require("../controllers/places");
const { addPlaces } = require("../controllers/create_places");

router.route("/radius").get(getPlacesByRadius);
router.route("/").get(getPlaces).post(addPlaces);
router.route("/:code").get(getPlaceByCode);

module.exports = router;
