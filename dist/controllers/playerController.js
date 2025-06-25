"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlayerByIdsController = exports.getPlayerController = void 0;
const playerService_1 = require("../services/playerService");
const getPlayerController = async (req, res) => {
    try {
        const playerId = req.params.id;
        const player = await (0, playerService_1.getPlayerByAccountId)(playerId);
        if (player) {
            res.json(player);
        }
        else {
            res.status(404).json({ message: 'Player not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getPlayerController = getPlayerController;
const getPlayerByIdsController = async (req, res) => {
    try {
        let ids = req.body.ids;
        const players = await (0, playerService_1.getPlayerByListId)(ids);
        res.json({ players });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getPlayerByIdsController = getPlayerByIdsController;
