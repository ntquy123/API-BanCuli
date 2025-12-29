import { Request, Response } from 'express';
import {
  createItem as createItemService,
  deleteItem as deleteItemService,
  getAllItems,
  getItemSelectOptions,
  updateItem as updateItemService,
} from '../services/adminItemService';

const parseNumber = (value: any, field: string, allowNull = false) => {
  if (value === undefined || value === null || value === '') {
    return allowNull ? null : { error: `${field} không được để trống.` } as const;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return { error: `${field} phải là số.` } as const;
  }

  return parsed;
};

const parseBoolean = (value: any, field: string) => {
  if (value === undefined || value === null || value === '') {
    return { error: `${field} không được để trống.` } as const;
  }

  if (value === true || value === false) return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;

  return { error: `${field} phải là true/false.` } as const;
};

const parseItemPayload = (req: Request) => {
  const id = parseNumber(req.body?.id, 'ID');
  if (typeof id === 'object' && 'error' in id) return id;

  const name = (req.body?.name ?? '').toString().trim();
  if (!name) return { error: 'Tên item không được để trống.' } as const;

  const description = (req.body?.description ?? '').toString().trim();
  if (!description) return { error: 'Mô tả không được để trống.' } as const;

  const level = parseNumber(req.body?.level, 'Level');
  if (typeof level === 'object' && 'error' in level) return level;

  const typeGid = parseNumber(req.body?.typeGid, 'TypeGid');
  if (typeof typeGid === 'object' && 'error' in typeGid) return typeGid;

  const rarityGidRaw = req.body?.rarityGid;
  const rarityGidParsed = parseNumber(rarityGidRaw, 'RarityGid', true);
  if (typeof rarityGidParsed === 'object' && 'error' in rarityGidParsed) return rarityGidParsed;
  const rarityGid = rarityGidParsed ?? 11300001;

  const price = parseNumber(req.body?.price, 'Giá');
  if (typeof price === 'object' && 'error' in price) return price;

  const locationGid = parseNumber(req.body?.locationGid, 'LocationGid');
  if (typeof locationGid === 'object' && 'error' in locationGid) return locationGid;

  const isLevelUp = parseBoolean(req.body?.isLevelUp, 'isLevelUp');
  if (typeof isLevelUp === 'object' && 'error' in isLevelUp) return isLevelUp;

  const isOpen = parseBoolean(req.body?.isOpen, 'isOpen');
  if (typeof isOpen === 'object' && 'error' in isOpen) return isOpen;

  let isCateye = true;
  if (req.body?.isCateye !== undefined && req.body?.isCateye !== null && req.body?.isCateye !== '') {
    const parsedIsCateye = parseBoolean(req.body?.isCateye, 'isCateye');
    if (typeof parsedIsCateye === 'object' && 'error' in parsedIsCateye) return parsedIsCateye;
    isCateye = parsedIsCateye;
  }

  const ElementType = parseNumber(req.body?.ElementType, 'ElementType', true);
  if (typeof ElementType === 'object' && 'error' in ElementType) return ElementType;

  const priceByBall = parseNumber(req.body?.priceByBall, 'priceByBall', true);
  if (typeof priceByBall === 'object' && 'error' in priceByBall) return priceByBall;

  const Levelrequired = parseNumber(req.body?.Levelrequired, 'Levelrequired', true);
  if (typeof Levelrequired === 'object' && 'error' in Levelrequired) return Levelrequired;

  const Mass = parseNumber(req.body?.Mass, 'Mass', true);
  if (typeof Mass === 'object' && 'error' in Mass) return Mass;

  const GravityScale = parseNumber(req.body?.GravityScale, 'GravityScale', true);
  if (typeof GravityScale === 'object' && 'error' in GravityScale) return GravityScale;

  const Drag = parseNumber(req.body?.Drag, 'Drag', true);
  if (typeof Drag === 'object' && 'error' in Drag) return Drag;

  const Bounciness = parseNumber(req.body?.Bounciness, 'Bounciness', true);
  if (typeof Bounciness === 'object' && 'error' in Bounciness) return Bounciness;

  const Elasticity = parseNumber(req.body?.Elasticity, 'Elasticity', true);
  if (typeof Elasticity === 'object' && 'error' in Elasticity) return Elasticity;

  const ImpactResistance = parseNumber(req.body?.ImpactResistance, 'ImpactResistance', true);
  if (typeof ImpactResistance === 'object' && 'error' in ImpactResistance) return ImpactResistance;

  return {
    id,
    name,
    ElementType,
    description,
    level,
    typeGid,
    rarityGid,
    price,
    priceByBall,
    isLevelUp,
    isOpen,
    isCateye,
    locationGid,
    Levelrequired,
    Mass,
    GravityScale,
    Drag,
    Bounciness,
    Elasticity,
    ImpactResistance,
  } as const;
};

export const getItems = async (_req: Request, res: Response): Promise<void> => {
  try {
    const items = await getAllItems();
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createItem = async (req: Request, res: Response): Promise<void> => {
  const payload = parseItemPayload(req);
  if ('error' in payload) {
    res.status(400).json({ message: payload.error });
    return;
  }

  try {
    const item = await createItemService(payload);
    res.status(201).json({ message: 'Thêm item thành công.', item });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateItem = async (req: Request, res: Response): Promise<void> => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId)) {
    res.status(400).json({ message: 'Thiếu ID item cần cập nhật.' });
    return;
  }

  const payload = parseItemPayload(req);
  if ('error' in payload) {
    res.status(400).json({ message: payload.error });
    return;
  }

  try {
    const item = await updateItemService(targetId, {
      name: payload.name,
      ElementType: payload.ElementType,
      description: payload.description,
      level: payload.level,
      typeGid: payload.typeGid,
      rarityGid: payload.rarityGid,
      price: payload.price,
      priceByBall: payload.priceByBall,
      isLevelUp: payload.isLevelUp,
      isOpen: payload.isOpen,
      isCateye: payload.isCateye,
      locationGid: payload.locationGid,
      Levelrequired: payload.Levelrequired,
      Mass: payload.Mass,
      GravityScale: payload.GravityScale,
      Drag: payload.Drag,
      Bounciness: payload.Bounciness,
      Elasticity: payload.Elasticity,
      ImpactResistance: payload.ImpactResistance,
    });
    res.json({ message: 'Cập nhật item thành công.', item });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      res.status(404).json({ message: 'Không tìm thấy item cần cập nhật.' });
      return;
    }
    res.status(500).json({ message: error.message });
  }
};

export const deleteItem = async (req: Request, res: Response): Promise<void> => {
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId)) {
    res.status(400).json({ message: 'Thiếu ID item cần xóa.' });
    return;
  }

  try {
    await deleteItemService(targetId);
    res.json({ message: 'Xóa item thành công.' });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      res.status(404).json({ message: 'Không tìm thấy item cần xóa.' });
      return;
    }
    res.status(500).json({ message: error.message });
  }
};

export const getItemOptions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const options = await getItemSelectOptions();
    res.json({
      options: options.map((option) => ({
        value: option.id,
        label: option.name,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
