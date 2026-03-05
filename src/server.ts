import express, { Request, Response } from 'express';
import { json } from 'express';

const app = express();
const PORT = 8080;

// Middleware
app.use(json());

// Routes
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to the Express server!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
