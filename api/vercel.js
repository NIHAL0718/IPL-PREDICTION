const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(bodyParser.json());
app.use(cors());

// MongoDB Atlas
const MONGO_URI = process.env.MONGO_URI;
const DATABASE_NAME = "AMMAMOGUDU";

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET;

// Flask API URL
const FLASK_API_URL = process.env.FLASK_API_URL;

let db, collection, usersCollection;

// Connect to MongoDB Atlas
(async () => {
  try {
    const client = await MongoClient.connect(MONGO_URI);
    db = client.db(DATABASE_NAME);
    collection = db.collection("cd");
    usersCollection = db.collection("users");
    console.log("✅ Connected to MongoDB Atlas");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
  }
})();

/* ========== Routes ========== */

// Signup
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await usersCollection.insertOne({ username, password: hashedPassword });
    res.status(200).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Signup failed" });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await usersCollection.findOne({ username });
    if (!user) return res.status(400).json({ error: "Invalid username or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid username or password" });

    const token = jwt.sign({ userId: user._id, username }, JWT_SECRET, { expiresIn: "1h" });
    res.status(200).json({ message: "Login successful", token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Predict
app.post("/predict", async (req, res) => {
  try {
    await collection.insertOne({ ...req.body, timestamp: new Date() });

    const flaskResponse = await axios.post(FLASK_API_URL, req.body);

    const battingTeamProbability = flaskResponse.data.batting_team?.winning_probability;
    const bowlingTeamProbability = flaskResponse.data.bowling_team?.winning_probability;

    res.status(200).json({
      batting_team: { winning_probability: battingTeamProbability },
      bowling_team: { winning_probability: bowlingTeamProbability }
    });
  } catch (err) {
    console.error("Prediction error:", err.message || err);
    res.status(500).json({ error: "Prediction failed" });
  }
});

// Redirect root to login page
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

module.exports = app; // Vercel serverless function
