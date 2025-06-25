"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlayerByListId = exports.getPlayerByAccountId = void 0;
// src/services/playerService.ts
const prismaClient_1 = __importDefault(require("../models/prismaClient")); // Import Prisma Client
const getPlayerByAccountId = async (accountId) => {
    return await prismaClient_1.default.player.findFirst({
        where: { IdAccount: accountId },
    });
};
exports.getPlayerByAccountId = getPlayerByAccountId;
const getPlayerByListId = async (ids) => {
    return await prismaClient_1.default.player.findMany({
        where: {
            IdAccount: {
                in: ids.map(String), // nếu IdAccount là string trong DB
            },
        },
    });
};
exports.getPlayerByListId = getPlayerByListId;
