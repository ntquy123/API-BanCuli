import { Router } from 'express';
import {
  createAccountController,
  checkAccountController,
  socialLoginController,
  confirmSocialLoginNameController,
} from '../controllers/accountController';

const router = Router();

router.post('/create-account', createAccountController);
router.post('/check-account', checkAccountController);
router.post('/social-login', socialLoginController);
router.post('/social-login/confirm-name', confirmSocialLoginNameController);

export default router;
