import prisma from '../models/prismaClient';

export const getAllLanguages = async () => {
  return prisma.sysMasLanguage.findMany();
};
