require("dotenv").config();
require("express-async-errors");
const packageJson = require("./package.json");
const version = packageJson.version;
//extra security
const helmet = require("helmet");
const cors = require("cors");
const xss = require("xss-clean");
const rateLimiter = require("express-rate-limit");

const express = require("express");
const app = express();

const placesRouter = require("./routes/places");

const notFoundMiddleware = require("./middleware/not-found");
const errorHandlerMiddleware = require("./middleware/error-handler");

app.set("trust proxy", 1);
app.use(
  rateLimiter({
    windowMs: 30 * 60 * 1000, // 1 hour window
    max: 500, // start blocking after 500 requests
    message:
      "Too many requests from this IP, please try again after half an hour",
  })
);
app.use(express.json());
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

app.use("/api/v1/places", placesRouter);

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
