import { Request, Response } from 'express';
import {
  sendFriendRequest,
  removeFriend,
  respondFriendRequest,
  sendMessage,
  readMessage,
  deleteFriendMessage,
  receiveItems,
  getFriendList,
  getPendingFriendRequests,
  getFriendMessages,
  searchPlayerById,
} from '../services/friendService';

export const searchPlayerByIdController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const raw =
      (req.params.id as string | undefined) ??
      (req.query.search as string | undefined);
    if (raw === undefined) {
      res.status(400).json({ message: 'Invalid id' });
      return;
    }

    const id = Number(raw);
    if (isNaN(id) || String(id) !== raw) {
      res.status(400).json({ message: 'Invalid id' });
      return;
    }

    const result = await searchPlayerById(id);
    if (result.success) {
      res.json(result.data);
      return;
    }
    res.status(404).json({ message: result.message });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const sendFriendRequestController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const senderId = Number(req.body.senderId ?? req.params.senderId);
    const friendCode =
      (req.body.friendCode ?? req.params.friendCode)?.toString();

    if (isNaN(senderId) || !friendCode) {
      res.status(400).json({ message: 'Invalid senderId or friendCode' });
      return;
    }

    const result = await sendFriendRequest(senderId, friendCode);
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
    const acceptParam = req.body.status ?? req.params.status;
    const accept = acceptParam === 1;

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

export const getFriendListController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const playerId = Number(req.params.playerId);
    if (isNaN(playerId)) {
      res.status(400).json({ message: 'Invalid playerId' });
      return;
    }
    const result = await getFriendList(playerId);
    if (result.success) {
      res.json(result.data);
      return;
    }
    res.status(400).json({ message: result.message });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getPendingFriendRequestsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const receiverId = Number(req.params.receiverId);
    if (isNaN(receiverId)) {
      res.status(400).json({ message: 'Invalid receiverId' });
      return;
    }
    const result = await getPendingFriendRequests(receiverId);
    if (result.success) {
      res.json(result.data);
      return;
    }
    res.status(400).json({ message: result.message });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getFriendMessagesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const receiverId = Number(req.params.receiverId);
    if (isNaN(receiverId)) {
      res.status(400).json({ message: 'Invalid receiverId' });
      return;
    }
    const result = await getFriendMessages(receiverId);
    if (result.success) {
      res.json(result.data);
      return;
    }
    res.status(400).json({ message: result.message });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const readFriendMessageController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const playerId = Number(req.body.playerId ?? req.params.playerId);
    const seqMess = Number(req.body.seqMess ?? req.params.seqMess);
    const receiverIdRaw = req.body.receiverId ?? req.params.receiverId;
    const receiverId =
      receiverIdRaw !== undefined ? Number(receiverIdRaw) : undefined;

    if (
      isNaN(playerId) ||
      isNaN(seqMess) ||
      (receiverIdRaw !== undefined && isNaN(receiverId))
    ) {
      res.status(400).json({ message: 'Invalid parameters' });
      return;
    }

    // Optional validation: ensure requester is the intended receiver
    if (
      receiverId !== undefined &&
      Number(req.body.requesterId ?? req.params.requesterId ?? receiverId) !==
        receiverId
    ) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const result = await readMessage(playerId, seqMess, receiverId);
    if (result.success) {
      res.json({ success: true });
      return;
    }
    res.status(400).json({ message: result.message });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteFriendMessageController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const senderId = Number(req.params.senderId ?? req.body.senderId);
    const seqMess = Number(req.params.seqMess ?? req.body.seqMess);
    if (isNaN(senderId) || isNaN(seqMess)) {
      res.status(400).json({ message: 'Invalid senderId or seqMess' });
      return;
    }
    const result = await deleteFriendMessage(senderId, seqMess);
    if (result.success) {
      res.json({ success: true });
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
  const senderId = Number(req.body.senderId ?? req.params.senderId);
  const receiverId = Number(req.body.receiverId ?? req.params.receiverId);
  const message = req.body.content;
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

  try {
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
    const status =
      result.message === 'Message limit reached' ? 400 : 500;
    res.status(status).json({ message: result.message });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const receiveItemsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const senderId = Number(req.body.senderId ?? req.params.senderId);
    const receiverId = Number(req.body.receiverId ?? req.params.receiverId);
    const items = req.body.items;
    const seqMess =
      req.body.seqMess !== undefined ? Number(req.body.seqMess) : undefined;

    if (
      isNaN(senderId) ||
      isNaN(receiverId) ||
      !Array.isArray(items) ||
      !items.every(
        (it: any) =>
          it &&
          typeof it === 'object' &&
          !isNaN(Number(it.itemId)) &&
          !isNaN(Number(it.seq))
      )
      || (seqMess !== undefined && isNaN(seqMess))
    ) {
      res.status(400).json({ message: 'Invalid parameters' });
      return;
    }

    const parsedItems = items.map((it: any) => ({
      itemId: Number(it.itemId),
      seq: Number(it.seq),
    }));

    const result = await receiveItems(
      senderId,
      receiverId,
      parsedItems,
      seqMess
    );
    if (result.success) {
      res.json(result);
      return;
    }
    res.status(400).json({ message: result.message });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

