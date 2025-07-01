import { Request, Response } from 'express';
import { getAllLanguages } from '../services/languageService';

export const getLanguages = async (_req: Request, res: Response) => {
  try {
    const languages = await getAllLanguages();
    res.json(languages);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
