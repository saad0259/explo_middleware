const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");
const mssql = require("mssql");
const redis = require("redis");
const csv = require("csv-parser");
const stream = require("stream");

// const redisClient = redis.createClient({
//   socket: {
//     host: process.env.REDIS_HOST, // Replace with your Redis server host

//     port: process.env.REDIS_PORT, // Replace with your Redis server port
//     reconnectStrategy: (retries) => Math.min(retries * 50, 500),
//     connectTimeout: 10000, // Increase connection timeout to 10 seconds
//   },
//   password: process.env.REDIS_PASSWORD,
// });

// redisClient.on("error", (err) => console.error("Redis Client Error", err));
// redisClient.connect().catch(console.error);

const pool = require("../db/connection");

const minPlacesTable = "min_places";
const placesTable = "places";

const getPlacesByRadius = async (req, res) => {
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
      cos(radians(@lat)) * cos(radians(SUBSTRING(coordinates, 0, CHARINDEX(',', coordinates)))) * 
      cos(radians(SUBSTRING(coordinates, CHARINDEX(',', coordinates) + 1, LEN(coordinates))) - radians(@lon)) + 
      sin(radians(@lat)) * sin(radians(SUBSTRING(coordinates, 0, CHARINDEX(',', coordinates))))
    )) AS distance
    FROM ${minPlacesTable}
    WHERE (6371 * acos(
      cos(radians(@lat)) * cos(radians(SUBSTRING(coordinates, 0, CHARINDEX(',', coordinates)))) * 
      cos(radians(SUBSTRING(coordinates, CHARINDEX(',', coordinates) + 1, LEN(coordinates))) - radians(@lon)) + 
      sin(radians(@lat)) * sin(radians(SUBSTRING(coordinates, 0, CHARINDEX(',', coordinates))))
    )) < @radius
    ORDER BY distance;
  `;

  request.input("lat", mssql.Float, lat);
  request.input("lon", mssql.Float, lon);
  request.input("radius", mssql.Float, radius);

  const result = await request.query(query);

  res.status(StatusCodes.OK).json({ places: result.recordset });
};

const getPlaces = async (req, res) => {
  let { limit, offset, isAdmin } = req.query;

  // Default isAdmin to false
  isAdmin = isAdmin === "true";

  const table = isAdmin ? placesTable : minPlacesTable;
  const key = `places:${table}:${limit}:${offset}`;

  const result = await getOrSetCache(key, async () => {
    const poolResult = await pool;

    const request = poolResult.request();

    const query = `
      SELECT * FROM ${table}
      ORDER BY id DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY;
    `;

    request.input("limit", mssql.Int, limit);
    request.input("offset", mssql.Int, offset);

    const result = await request.query(query);
    return result.recordset;
  });

  res.status(StatusCodes.OK).json({ places: result });
};

const getPlaceByCode = async (req, res) => {
  const { code } = req.params;

  const poolResult = await pool;

  const request = poolResult.request();

  const query = `SELECT * FROM ${placesTable} WHERE CODE = @code;`;

  request.input("code", mssql.VarChar, code);

  const result = await request.query(query);

  if (!result.recordset.length) {
    throw new NotFoundError(`Place with Code ${code} not found`);
  }

  res.status(StatusCodes.OK).json({ place: result.recordset[0] });
};

const deletePlace = async (req, res) => {
  const { code } = req.params;

  const poolResult = await pool;
  const request = poolResult.request();

  // Delete from both tables in a transaction
  const transaction = new mssql.Transaction(poolResult);

  try {
    await transaction.begin();

    const placesRequest = new mssql.Request(transaction);
    placesRequest.input("code", mssql.VarChar, code);

    const deletePlacesQuery = `DELETE FROM ${placesTable} WHERE CODE = @code;`;
    const deleteMinPlacesQuery = `DELETE FROM ${minPlacesTable} WHERE CODE = @code;`;

    const placesResult = await placesRequest.query(deletePlacesQuery);
    const minPlacesResult = await placesRequest.query(deleteMinPlacesQuery);

    if (
      placesResult.rowsAffected[0] === 0 &&
      minPlacesResult.rowsAffected[0] === 0
    ) {
      await transaction.rollback();
      throw new NotFoundError(`Place with Code ${code} not found`);
    }

    await transaction.commit();

    res.status(StatusCodes.OK).json({ msg: "Place deleted successfully" });
  } catch (err) {
    await transaction.rollback();
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      msg: "Error deleting place",
      error: err.message,
    });
  }
};

module.exports = { getPlacesByRadius, getPlaces, getPlaceByCode, deletePlace };

async function getOrSetCache(key, cb) {
  // const response = await redisClient.get(key);
  // if (response) {
  //   console.log("Cache hit");
  //   return JSON.parse(response);
  // }
  // console.log("Cache miss");
  const freshData = await cb();
  // redisClient.setEx(key, 864000, JSON.stringify(freshData));
  return freshData;
}
