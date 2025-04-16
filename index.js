require("dotenv").config();
require("express-async-errors");
const packageJson = require("./package.json");
const version = packageJson.version;
//extra security
const helmet = require("helmet");
const cors = require("cors");
const xss = require("xss-clean");
// import { rateLimit } from "express-rate-limit";

const express = require("express");
const app = express();

const placesRouter = require("./routes/places");
// const settingsRouter = require("./routes/settings");

const notFoundMiddleware = require("./middleware/not-found");
const errorHandlerMiddleware = require("./middleware/error-handler");

app.set("trust proxy", 1);
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   limit: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes).
//   standardHeaders: "draft-8", // draft-6: `RateLimit-*` headers; draft-7 & draft-8: combined `RateLimit` header
//   legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
//   // store: ... , // Redis, Memcached, etc. See below.
// });
// app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      "img-src": ["'self'", "https: data:"],
    },
  })
);
app.use(cors());
app.use(xss());

app.get("/", (req, res) => {
  res.send(
    `<h1>Smart AI API (${version}-${packageJson.config.environment})</h1>`
  );
});

// Multer setup for file upload

const multer = require("multer");
const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

app.use("/api/v1/places", upload.single("file"), placesRouter);
// app.use("/api/v1/settings", settingsRouter);

app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

const port = process.env.PORT || 5506;

const start = async () => {
  try {
    app.listen(port, () =>
      console.log(`Server is listening at http://localhost:${port} ...`)
    );
  } catch (error) {
    console.log(error);
  }
};

start();

// Export the Express API

module.exports = app;
