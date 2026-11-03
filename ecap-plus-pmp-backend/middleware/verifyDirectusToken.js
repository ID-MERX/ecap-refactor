const jwt = require("jsonwebtoken");

const verifyDirectusToken = (req, res, next) => {
  try {
    let token;

    // 1. Standard Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 2. Query-string fallback — used by browser-native file downloads
    //    (anchor href clicks) where the Authorization header cannot be set.
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({
        status: "fail",
        message: "You are not logged in! Please log in to get access.",
      });
    }

    jwt.verify(token, process.env.DIRECTUS_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          status: "fail",
          message: "Invalid token, please log in again",
        });
      }
      req.user = decoded;
      next();
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "An unexpected error occurred.",
      error: error.message,
    });
  }
};

module.exports = verifyDirectusToken;
