// src/app.ts
import express from 'express';
import playerRoutes from './routes/playerRoutes';
import roomRoutes from './routes/roomRoutes';
import itemRoutes from './routes/itemRoutes';
import gameRoutes from './routes/gameRoutes';
import languageRoutes from './routes/languageRoutes';
import effectPlayerRoutes from './routes/effectPlayerRoutes';
import playerItemRoutes from './routes/playerItemRoutes';

const app = express();

app.use(express.json());
app.use('/api', playerRoutes);
app.use('/api', roomRoutes); // Assuming you have roomRoutes defined in a similar way
app.use('/api', itemRoutes);
app.use('/api', gameRoutes);
app.use('/api', languageRoutes);
app.use('/api', effectPlayerRoutes);
app.use('/api', playerItemRoutes);
export default app;
