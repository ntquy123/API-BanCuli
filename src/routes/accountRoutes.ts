import { Router } from 'express';
import {
  createAccountController,
  checkAccountController,
  socialLoginController,
} from '../controllers/accountController';

const router = Router();

router.post('/create-account', createAccountController);
router.post('/check-account', checkAccountController);
router.post('/social-login', socialLoginController);

export default router;
