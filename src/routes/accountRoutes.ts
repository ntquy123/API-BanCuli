import { Router } from 'express';
import { createAccountController, checkAccountController } from '../controllers/accountController';

const router = Router();

router.post('/create-account', createAccountController);
router.post('/check-account', checkAccountController);

export default router;
