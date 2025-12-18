import express from 'express';
import path from 'path';
import { getAdminSession, loginAdmin, shutdownServersAdmin, startServers } from '../controllers/adminController';
import { requireAdminAuth } from '../middleware/adminAuth';

const router = express.Router();

router.post('/admin/login', loginAdmin);
router.get('/admin/session', requireAdminAuth, getAdminSession);
router.get('/admin/start', requireAdminAuth, startServers);
router.post('/admin/shutdown', requireAdminAuth, shutdownServersAdmin);

router.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/index.html'));
});

export default router;
