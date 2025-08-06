import { Request, Response } from 'express';
import {
  sendFriendRequest,
  removeFriend,
  respondFriendRequest,
  sendMessage,
} from '../services/friendService';

export const sendFriendRequestController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const senderId = Number(req.body.senderId ?? req.params.senderId);
    const receiverId = Number(req.body.receiverId ?? req.params.receiverId);

    if (isNaN(senderId) || isNaN(receiverId)) {
      res.status(400).json({ message: 'Invalid senderId or receiverId' });
      return;
    }

    const result = await sendFriendRequest(senderId, receiverId);
    if (result.success) {
      res.json(result.data);
      return;
    }
    res.status(400).json({ message: result.message });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const removeFriendController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const playerId = Number(req.body.playerId ?? req.params.playerId);
    const friendId = Number(req.body.friendId ?? req.params.friendId);

    if (isNaN(playerId) || isNaN(friendId)) {
      res.status(400).json({ message: 'Invalid playerId or friendId' });
      return;
    }

    const result = await removeFriend(playerId, friendId);
    if (result.success) {
      res.json({ success: true });
      return;
    }
    res.status(400).json({ message: result.message });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const respondFriendRequestController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const senderId = Number(req.body.senderId ?? req.params.senderId);
    const receiverId = Number(req.body.receiverId ?? req.params.receiverId);
    const acceptParam = req.body.accept ?? req.params.accept;
    const accept =
      typeof acceptParam === 'string'
        ? acceptParam.toLowerCase() === 'true'
        : Boolean(acceptParam);

    if (isNaN(senderId) || isNaN(receiverId)) {
      res.status(400).json({ message: 'Invalid senderId or receiverId' });
      return;
    }

    const result = await respondFriendRequest(senderId, receiverId, accept);
    if (result.success) {
      res.json(result.data);
      return;
    }
    res.status(400).json({ message: result.message });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const sendMessageController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const senderId = Number(req.body.senderId ?? req.params.senderId);
    const receiverId = Number(req.body.receiverId ?? req.params.receiverId);
    const { message } = req.body;
    const itemId =
      req.body.itemId !== undefined ? Number(req.body.itemId) : undefined;
    const seqId =
      req.body.seqId !== undefined ? Number(req.body.seqId) : undefined;

    if (
      isNaN(senderId) ||
      isNaN(receiverId) ||
      typeof message !== 'string' ||
      (itemId !== undefined && isNaN(itemId)) ||
      (seqId !== undefined && isNaN(seqId))
    ) {
      res.status(400).json({ message: 'Invalid parameters' });
      return;
    }

    const result = await sendMessage(
      senderId,
      receiverId,
      message,
      itemId,
      seqId
    );
    if (result.success) {
      res.json(result.data);
      return;
    }
    res.status(400).json({ message: result.message });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

