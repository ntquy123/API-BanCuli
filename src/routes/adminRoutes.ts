import express from 'express';
import path from 'path';
import {
  getActiveContainers,
  getAdminSession,
  getContainerLogs,
  loginAdmin,
  shutdownServersAdmin,
  shutdownTestServerController,
  startServers,
  startTestServer,
} from '../controllers/adminController';
import {
  createLanguage,
  deleteLanguage,
  getLanguages,
  updateLanguage,
} from '../controllers/languageController';
import { requireAdminAuth } from '../middleware/adminAuth';

const router = express.Router();

router.post('/admin/login', loginAdmin);
router.get('/admin/session', requireAdminAuth, getAdminSession);
router.get('/admin/start', requireAdminAuth, startServers);
router.get('/admin/test-server/start', requireAdminAuth, startTestServer);
router.post('/admin/shutdown', requireAdminAuth, shutdownServersAdmin);
router.post('/admin/test-server/shutdown', requireAdminAuth, shutdownTestServerController);
router.get('/admin/containers', requireAdminAuth, getActiveContainers);
router.get('/admin/containers/:id/logs', requireAdminAuth, getContainerLogs);
router.get('/admin/languages', requireAdminAuth, getLanguages);
router.post('/admin/languages', requireAdminAuth, createLanguage);
router.put('/admin/languages/:code', requireAdminAuth, updateLanguage);
router.delete('/admin/languages/:code', requireAdminAuth, deleteLanguage);

router.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/index.html'));
});

router.get('/admin/config', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/config.html'));
});

router.get('/admin/docker', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../public/admin/docker.html'));
});

export default router;
