"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const room_1 = require("../services/room");
const customCRUD_1 = require("../utils/customCRUD");
const game_1 = require("../services/game");
const gameControllers = {
    START_GAME: (roomCode, sc, io) => {
        const roomInfo = (0, customCRUD_1.get)(room_1.roomCollection, roomCode);
        if (roomInfo) {
            // 更新roomInfo
            (0, room_1.updateRoomInfo)(roomInfo);
            // 给所有玩家发牌
            (0, game_1.dealCardsToPlayers)(io, roomCode, roomInfo);
            // 进入第一轮
            (0, game_1.emitToNextTurn)(io, roomCode, roomInfo);
            return {
                message: '成功开始游戏',
                data: null,
                type: 'RES_START_GAME'
            };
        }
        // 房间code有误
        return {
            message: '房间不存在',
            data: null,
            type: 'RES_START_GAME'
        };
    },
    OUT_OF_THE_CARD: (data, sc, io) => {
        const { roomCode, cardsIndex } = data;
        const roomInfo = (0, customCRUD_1.get)(room_1.roomCollection, roomCode);
        if (roomInfo) {
            // 判断牌的类型，做出操作
            // TODO
            // 更新玩家信息
            const player = roomInfo.players.find((item) => item.socketId === sc.id);
            if (player) {
                const res = (0, game_1.updatePlayerCardInfo)(player, cardsIndex, roomInfo);
                // 通知所有玩家进入下一轮，更新客户端信息
                (0, game_1.emitToNextTurn)(io, roomCode, roomInfo);
                return {
                    message: '出牌成功',
                    data: res,
                    type: 'RES_OUT_OF_THE_CARD'
                };
            }
            return {
                message: '玩家不存在',
                data: null,
                type: 'RES_OUT_OF_THE_CARD'
            };
        }
        return {
            message: '房间不存在',
            data: null,
            type: 'RES_OUT_OF_THE_CARD'
        };
    }
};
exports.default = gameControllers;
