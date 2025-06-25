// src/services/playerService.ts
import prisma from '../models/prismaClient'; // Import Prisma Client
import { Request, Response } from 'express';

export const getPlayerByAccountId = async (accountId: string) => {
  return await prisma.player.findFirst({
    where: { IdAccount: accountId },
  });
};

 
export const getPlayerByListId = async (ids: number[]) => {
  return await prisma.player.findMany({
    where: {
      IdAccount: {
        in: ids.map(String), // nếu IdAccount là string trong DB
      },
    },
  });
};


