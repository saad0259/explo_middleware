const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");
const mssql = require("mssql");

const pool = require("../db/connection");

const placesTable = "places";

const getPlaces = async (req, res) => {
  const { lat, lon, radius = 200 } = req.query;
  if (!lat || !lon) {
    throw new BadRequestError(
      "Please provide lat, lon, and radius query parameters"
    );
  }
  const poolResult = await pool;

  const request = poolResult.request();

  const query = `
    SELECT *, 
    (6371 * acos(
      cos(radians(@lat)) * cos(radians(latitude)) * cos(radians(longitude) - radians(@lon)) + 
      sin(radians(@lat)) * sin(radians(latitude))
    )) AS distance
    FROM ${placesTable}
    WHERE (6371 * acos(
      cos(radians(@lat)) * cos(radians(latitude)) * cos(radians(longitude) - radians(@lon)) + 
      sin(radians(@lat)) * sin(radians(latitude))
    )) < @radius
    ORDER BY distance;
  `;

  request.input("lat", mssql.Float, lat);
  request.input("lon", mssql.Float, lon);
  request.input("radius", mssql.Float, radius);

  const result = await request.query(query);

  if (!result.recordset.length) {
    throw new NotFoundError("No places found");
  } else {
    console.log(result.recordset.length, "places found");
  }

  res.status(StatusCodes.OK).json({ places: result.recordset });
};

module.exports = { getPlaces };
