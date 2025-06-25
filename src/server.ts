// src/server.ts
import dotenv from 'dotenv';
import app from './app';

dotenv.config();  // Load biến môi trường từ file .env

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
