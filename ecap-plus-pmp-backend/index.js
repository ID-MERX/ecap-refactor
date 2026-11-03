const express = require("express");
const dotenv = require("dotenv");
const app = express();
const cors = require("cors"); // Import the cors middleware
const compression = require("compression");
const path = require("path");
const householdRouter = require("./routes/householdRoutes");
const childRouter = require("./routes/childRoutes");
const etlRouter = require("./routes/etlRoutes");
const motherRouter = require("./routes/motherRoutes");
const agentRouter = require("./routes/agentRoutes");

dotenv.config();

// Gzip all responses — same big API win as the dqa backend.
app.use(compression());

// Use cors middleware with specific options
app.use(
  cors({
    origin: [
      "https://ecapplus.pmp.bluecodeltd.com",
      "https://ecapplus.stage.pmp.bluecodeltd.com",
    ],
    credentials: true, // Add this if your client needs to send cookies or authentication headers
    methods: "GET,POST,PUT,DELETE",
    allowedHeaders: "Content-Type,Authorization,X-Requested-With",
    exposedHeaders: "Content-Range,X-Content-Range",
  }),
);

app.use(express.json());
app.use("/household", householdRouter);
app.use("/child", childRouter);
app.use("/etl", etlRouter);
app.use("/mother", motherRouter);
app.use("/agent", agentRouter);

app.get("/", (req, res) => {
  const imagePath = path.join(
    __dirname,
    "assets/project_concern_zambia_logo.jpeg",
  );
  res.status(200).sendFile(imagePath);
});

app.get("/clear-cache", (req, res) => {
  redisClient.flushdb(function (err, succeeded) {});
});

app.all("*", (req, res, next) => {
  res.status(404).json({
    status: "error",
    message: `Can't find ${req.originalUrl} on this server`,
  });
});

module.exports = app;
