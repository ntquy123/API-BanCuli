import prisma from '../models/prismaClient';

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

export const sendMessage = async (
  senderId: number,
  receiverId: number,
  message: string,
  itemId?: number,
  seqId?: number
) => {
  try {
    const msg = await prisma.friendMessage.create({
      data: { senderId, receiverId, message, itemId, seqId },
    });
    return { success: true, data: msg };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

