import express from "express";
import {
  joinQueue,
  cancelQueue,
  matchReady,
  matchResult,
  dsRegister,
} from "../controllers/matchQueueController";

const router = express.Router();

// Client actions
router.post("/queue/join", joinQueue);
router.post("/queue/cancel", cancelQueue);

// Dedicated server callbacks
router.post("/internal/match/ready", matchReady);
router.post("/internal/match/result", matchResult);

// Warm pool: DS idle đăng ký về backend
router.post("/internal/ds/register", dsRegister);

export default router;
