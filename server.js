const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const { MongoClient } = require('mongodb');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 10000;

console.log(`Server configured to listen on port ${PORT}`);

// Serve static frontend files (login.html, signup.html, home.html etc. must be inside "public")
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Config
const MONGO_URI = 'mongodb+srv://IPL_pred:Nihal2020@cluster0.wizo9.mongodb.net/ipldb?retryWrites=true&w=majority';
const DATABASE_NAME = 'AMMAMOGUDU';
const COLLECTION_NAME = 'cd';
const COLLECTION_NAME_1 = 'users';

let db, collection, usersCollection;
MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db(DATABASE_NAME);
    collection = db.collection(COLLECTION_NAME);
    usersCollection = db.collection(COLLECTION_NAME_1);
    console.log('Connected to MongoDB + Users Collection');
  })
  .catch(error => {
    console.error('Error connecting to MongoDB:', error);
  });

// Middleware
app.use(bodyParser.json());

// ✅ CORS setup (allow your deployed frontend)
app.use(
  cors({
    origin: 'https://ipl-prediction-2iij.onrender.com', // your frontend Render domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.options('*', cors());

// -------------------- AUTH ROUTES --------------------

// Signup
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await usersCollection.insertOne({ username, password: hashedPassword });

    res.status(200).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error during signup:', error);
    res.status(500).json({ error: 'An error occurred while signing up' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await usersCollection.findOne({ username });
    if (!user) return res.status(400).json({ error: 'Invalid username or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid username or password' });

    const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

const token = jwt.sign(
  { userId: user._id, username: user.username },
  JWT_SECRET,
  { expiresIn: '1h' }
);


    res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'An error occurred while logging in' });
  }
});

// -------------------- ROUTES --------------------

// Redirect root → login.html
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

// Prediction route
app.post('/predict', async (req, res) => {
  try {
    console.log('Received data from frontend:', req.body);

    // Save input to MongoDB
    const inputData = { ...req.body, timestamp: new Date() };
    await collection.insertOne(inputData);
    console.log('Inserted into MongoDB:', inputData);

    // Forward request to Flask API
    const flaskResponse = await axios.post(
      'https://ipl-prediction-1-vbsv.onrender.com/predict',
      req.body
    );

    // Extract probabilities
    const battingTeamProbability = flaskResponse.data.batting_team?.winning_probability;
    const bowlingTeamProbability = flaskResponse.data.bowling_team?.winning_probability;

    const response = {
      batting_team: { winning_probability: battingTeamProbability },
      bowling_team: { winning_probability: bowlingTeamProbability },
    };

    console.log('Returning to frontend:', response);
    res.status(200).json(response);
  } catch (error) {
    console.error('Error while connecting to Flask or MongoDB:', error.message || error);
    res.status(500).json({
      error:
        'Failed to fetch prediction from Flask or save data to MongoDB. Please check backend logs.',
    });
  }
});

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`Node.js server running on http://localhost:${PORT}`);
});
