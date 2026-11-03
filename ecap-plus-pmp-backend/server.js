const app = require("./index");
const dotenv = require("dotenv");

dotenv.config();

const port = process.env.PORT;

app.listen(port, () => {
  if (process.env.ENV == "PRODUCTION") {
    console.log(`ECAP+ PMP Server listening on port ${port}`);
  }
});
