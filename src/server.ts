import express from "express";

import matchesRouter from './routes/matches.js'

const app = express();
const PORT = 8080;

// Middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Express server!' });
});

app.use('/matches', matchesRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
