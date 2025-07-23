import { Router } from 'express';
import { createAccountController } from '../controllers/accountController';

const router = Router();

router.post('/create-account', createAccountController);

export default router;
