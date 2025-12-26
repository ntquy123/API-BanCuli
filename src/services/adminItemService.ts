import prisma from '../models/prismaClient';

export interface ItemPayload {
  id: number;
  name: string;
  ElementType?: number | null;
  description: string;
  level: number;
  typeGid: number;
  price: number;
  priceByBall?: number | null;
  isLevelUp: boolean;
  isOpen: boolean;
  isCateye: boolean;
  locationGid: number;
  Levelrequired?: number | null;
  Mass?: number | null;
  GravityScale?: number | null;
  Drag?: number | null;
  Bounciness?: number | null;
  Elasticity?: number | null;
  ImpactResistance?: number | null;
}

export const getAllItems = async () => {
  return prisma.item.findMany({ orderBy: { id: 'asc' } });
};

export const createItem = async (payload: ItemPayload) => {
  return prisma.item.create({ data: payload });
};

export const updateItem = async (id: number, payload: Partial<ItemPayload>) => {
  return prisma.item.update({
    where: { id },
    data: payload,
  });
};

export const deleteItem = async (id: number) => {
  return prisma.item.delete({ where: { id } });
};

export const getItemSelectOptions = async () => {
  return prisma.item.findMany({
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  });
};
