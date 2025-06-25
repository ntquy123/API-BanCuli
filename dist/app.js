"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/app.ts
const express_1 = __importDefault(require("express"));
const playerRoutes_1 = __importDefault(require("./routes/playerRoutes"));
const roomRoutes_1 = __importDefault(require("./routes/roomRoutes"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use('/api', playerRoutes_1.default);
app.use('/api', roomRoutes_1.default); // Assuming you have roomRoutes defined in a similar way
exports.default = app;
