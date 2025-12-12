import { Router } from 'express';
import {
  createAccountController,
  checkAccountController,
  socialLoginController,
  confirmSocialLoginNameController,
  loginSessionController,
  logoutSessionController,
} from '../controllers/accountController';

const router = Router();

router.post('/create-account', createAccountController);
router.post('/check-account', checkAccountController);
router.post('/social-login', socialLoginController);
router.post('/social-login/confirm-name', confirmSocialLoginNameController);
router.post('/login', loginSessionController);
router.post('/logout', logoutSessionController);

export default router;
