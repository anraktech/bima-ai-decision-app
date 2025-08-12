import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
});