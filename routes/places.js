const express = require("express");
const router = express.Router();

const {
  getPlacesByRadius,
  getPlaces,
  getPlaceById,
} = require("../controllers/places");

router.route("/radius").get(getPlacesByRadius);
router.route("/").get(getPlaces);
router.route("/:id").get(getPlaceById);

module.exports = router;
