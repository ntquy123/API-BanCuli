// src/app.ts
import express from 'express';
import playerRoutes from './routes/playerRoutes';
import roomRoutes from './routes/roomRoutes';

const app = express();

app.use(express.json());
app.use('/api', playerRoutes);
app.use('/api', roomRoutes); // Assuming you have roomRoutes defined in a similar way
export default app;
