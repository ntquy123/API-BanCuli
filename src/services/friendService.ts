import prisma from '../models/prismaClient';
import { getPlayerByListId } from './playerService';

export const sendFriendRequest = async (senderId: number, receiverId: number) => {
  try {
    const alreadyFriend = await prisma.friendship.findFirst({
      where: {
        OR: [
          { playerId: senderId, friendId: receiverId },
          { playerId: receiverId, friendId: senderId },
        ],
      },
    });
    if (alreadyFriend) {
      return { success: false, message: 'Already friends' };
    }

    const existing = await prisma.friendRequest.findUnique({
      where: { senderId_receiverId: { senderId, receiverId } },
    });
    if (existing) {
      return { success: false, message: 'Request already sent' };
    }

    const request = await prisma.friendRequest.create({
      data: { senderId, receiverId },
    });
    return { success: true, data: request };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const removeFriend = async (playerId: number, friendId: number) => {
  try {
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { playerId, friendId },
          { playerId: friendId, friendId: playerId },
        ],
      },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const respondFriendRequest = async (
  senderId: number,
  receiverId: number,
  accept: boolean
) => {
  try {
    const request = await prisma.friendRequest.update({
      where: { senderId_receiverId: { senderId, receiverId } },
      data: { status: accept ? 'ACCEPTED' : 'REJECTED' },
    });

    if (accept) {
      await prisma.friendship.createMany({
        data: [
          { playerId: senderId, friendId: receiverId },
          { playerId: receiverId, friendId: senderId },
        ],
        skipDuplicates: true,
      });
    }

    return { success: true, data: request };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const getFriendList = async (playerId: number) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: { playerId },
      select: { friendId: true },
    });
    const friendIds = friendships.map((f) => f.friendId);
    if (friendIds.length === 0) {
      return { success: true, data: [] };
    }
    const players = await getPlayerByListId(friendIds);
    return { success: true, data: players };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const getPendingFriendRequests = async (
  receiverId: number
) => {
  try {
    const requests = await prisma.friendRequest.findMany({
      where: { receiverId, status: 'PENDING' },
      include: { sender: true },
    });
    const senders = requests.map((r) => r.sender);
    return { success: true, data: senders };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const getFriendMessages = async (receiverId: number) => {
  try {
    const messages = await prisma.friendMessage.findMany({
      where: { receiverId },
      include: { sender: true },
    });
    return { success: true, data: messages };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const sendMessage = async (
  senderId: number,
  receiverId: number,
  message: string,
  itemId?: number,
  seqId?: number
) => {
  const messageCount = await prisma.friendMessage.count({
    where: { senderId },
  });

  if (messageCount >= 100) {
    throw new Error('Message limit reached');
  }

  const last = await prisma.friendMessage.findFirst({
    where: { senderId },
    orderBy: { seqMess: 'desc' },
    select: { seqMess: true },
  });

  const seqMess = (last?.seqMess ?? 0) + 1;

  return prisma.friendMessage.create({
    data: { senderId, receiverId, message, itemId, seqId, seqMess },
  });
};

export const receiveItems = async (
  senderId: number,
  receiverId: number,
  items: Array<{ itemId: number; seq: number }>,
  seqMess?: number
) => {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.friendMessage.updateMany({
        where: {
          senderId,
          receiverId,
          ...(seqMess !== undefined ? { seqMess } : {}),
        },
        data: { status: 'READ' },
      });

      for (const { itemId, seq } of items) {
        if (itemId === 0) {
          const quantity = seq;
          const sender = await tx.player.findUnique({
            where: { id: senderId },
            select: { RingBall: true },
          });
          if (!sender || (sender.RingBall ?? 0) < quantity) {
            throw new Error('Not enough RingBall');
          }
          await tx.player.update({
            where: { id: senderId },
            data: { RingBall: { decrement: quantity } },
          });
          await tx.player.update({
            where: { id: receiverId },
            data: { RingBall: { increment: quantity } },
          });
        } else {
          const playerItem = await tx.playerItem.findUnique({
            where: {
              playerId_itemId_seq: { playerId: senderId, itemId, seq },
            },
          });
          if (!playerItem) {
            throw new Error('Sender does not own item');
          }
          await tx.playerItem.delete({
            where: {
              playerId_itemId_seq: { playerId: senderId, itemId, seq },
            },
          });
          const lastSeq = await tx.playerItem.findFirst({
            where: { playerId: receiverId, itemId },
            orderBy: { seq: 'desc' },
            select: { seq: true },
          });
          const newSeq = lastSeq ? lastSeq.seq + 1 : 0;
          await tx.playerItem.create({
            data: {
              playerId: receiverId,
              itemId,
              seq: newSeq,
              level: playerItem.level,
              description: `item được gửi từ user: ${senderId}`,
            },
          });
        }
      }
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

