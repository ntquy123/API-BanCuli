import express from 'express';
import playerRoutes from './routes/playerRoutes';
import roomRoutes from './routes/roomRoutes';
import itemRoutes from './routes/itemRoutes';
import gameRoutes from './routes/gameRoutes';
import languageRoutes from './routes/languageRoutes';
import effectPlayerRoutes from './routes/effectPlayerRoutes';
import playerItemRoutes from './routes/playerItemRoutes';
import ballPhysicsRoutes from './routes/ballPhysicsRoutes';
import achievementRoutes from './routes/achievementRoutes';
import historyRoutes from './routes/historyRoutes';
import drawRoutes from './routes/drawRoutes';
import marketRoutes from './routes/marketRoutes';
import accountRoutes from './routes/accountRoutes';
import friendRoutes from './routes/friendRoutes';

const app = express();

// Middleware để parse body JSON
app.use(express.json());

// Các route API của bạn
app.use('/api', playerRoutes);
app.use('/api', roomRoutes);
app.use('/api', itemRoutes);
app.use('/api', gameRoutes);
app.use('/api', languageRoutes);
app.use('/api', effectPlayerRoutes);
app.use('/api', playerItemRoutes);
app.use('/api', ballPhysicsRoutes);
app.use('/api', achievementRoutes);
app.use('/api', historyRoutes);
app.use('/api', drawRoutes);
app.use('/api', marketRoutes);
app.use('/api', accountRoutes);
app.use('/api', friendRoutes);

// KHÔNG CÒN BẤT KỲ ĐOẠN app.listen() hay new WebSocket.Server() nào ở đây

export default app;