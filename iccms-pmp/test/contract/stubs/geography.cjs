// Stand-in for the backend's `../config/geography` require. It points at the verbatim extract of the
// real `config/geography.js`, so the backend rule set under test uses the backend's own map.
module.exports = require("../backend-geography.cjs");
