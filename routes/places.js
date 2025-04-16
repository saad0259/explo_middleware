const express = require("express");
const router = express.Router();

const {
  getPlacesByRadius,
  getPlaces,
  getPlaceById,
} = require("../controllers/places");
const { addPlaces } = require("../controllers/create_places");

router.route("/radius").get(getPlacesByRadius);
router.route("/").get(getPlaces).post(addPlaces);
router.route("/:id").get(getPlaceById);

module.exports = router;
