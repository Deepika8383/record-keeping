const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const router = require("./app"); // Adjust filename

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all origins
app.use(cors());

app.use(express.json());
app.use("/api", router);

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
