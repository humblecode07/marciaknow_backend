require('dotenv').config(); 
const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("./config/dbConn");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
connectDB();

app.get("/", (req, res) => {
    res.send("Backend is running!");
});

// Connection event listener
mongoose.connection.once('open', () => {
   console.log('Connected to MongoDB');
   app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
});