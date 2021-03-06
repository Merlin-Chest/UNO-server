"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCards = exports.emitGameOver = exports.emitToNextTurn = exports.updatePlayerCardInfo = exports.dealCardsToPlayers = exports.emitDealCardsToPlayer = exports.getSpecifiedCards = exports.useCards = void 0;
const card_1 = require("../configs/card");
const utils_1 = require("../utils");
const room_1 = require("./room");
// 生成游戏卡牌
const useCards = () => {
    return (0, utils_1.shuffle)((0, card_1.cardInfomation)());
};
exports.useCards = useCards;
// 获取指定数量的牌
function getSpecifiedCards(cards, num) {
    let res = [];
    for (let i = 0; i < num; i++) {
        if (cards.length < num) {
            // 牌不够了，补牌
            cards = cards.concat((0, exports.useCards)());
        }
        let card = cards.shift();
        res.push(card);
    }
    return res;
}
exports.getSpecifiedCards = getSpecifiedCards;
// 给指定玩家发指定数量的牌
function emitDealCardsToPlayer(io, socketId, newPlayerCards, num) {
    io.to(socketId).emit('DEAL_CARDS', {
        message: `获得卡牌 ${num} 张`,
        data: newPlayerCards,
        type: 'RES_DEAL_CARDS'
    });
}
exports.emitDealCardsToPlayer = emitDealCardsToPlayer;
// 游戏开始，给所有玩家发牌
function dealCardsToPlayers(io, roomCode, roomInfo) {
    io.sockets.in(roomCode).allSockets().then((res) => {
        for (const id of res) {
            const player = roomInfo.players.find((p) => p.socketId === id);
            console.log('player:', player);
            if (player) {
                const userCards = (player.cards = getSpecifiedCards(roomInfo.gameCards, card_1.InitCardNum));
                io.to(id).emit('GAME_IS_START', {
                    message: '游戏开始啦',
                    data: {
                        roomInfo,
                        userCards
                    },
                    type: 'GAME_IS_START'
                });
            }
        }
    });
}
exports.dealCardsToPlayers = dealCardsToPlayers;
// 更新玩家卡牌信息
function updatePlayerCardInfo(player, cardsIndex, roomInfo) {
    cardsIndex.forEach((i) => {
        var _a;
        const deleteCard = (_a = player.cards) === null || _a === void 0 ? void 0 : _a.splice(i, 1);
        player.lastCard = Object.assign({}, deleteCard[0]);
        roomInfo.lastCard = Object.assign({}, deleteCard[0]);
    });
    return player.cards;
}
exports.updatePlayerCardInfo = updatePlayerCardInfo;
// 通知玩家进入下一轮
function emitToNextTurn(io, roomCode, roomInfo) {
    roomInfo.order = getNextOrder(roomInfo);
    const nextPlayer = roomInfo.players.find((p, i) => i === roomInfo.order);
    if (nextPlayer) {
        (0, room_1.emitAllPlayers)(io, roomCode, 'NEXT_TURN', {
            message: `轮到玩家${nextPlayer.name}出牌`,
            type: 'NEXT_TURN',
            data: {
                players: roomInfo.players,
                lastCard: roomInfo.lastCard,
                order: roomInfo.order
            }
        });
    }
}
exports.emitToNextTurn = emitToNextTurn;
// 通知玩家游戏结束
function emitGameOver(roomInfo, io, roomCode) {
    (0, room_1.updateRoomInfoAtEnd)(roomInfo);
    // 通知玩家游戏结束
    (0, room_1.emitAllPlayers)(io, roomCode, 'GAME_IS_OVER', {
        type: 'GAME_IS_OVER',
        message: '游戏结束',
        data: {
            winnerOrder: roomInfo.winnerOrder,
            endTime: roomInfo.endTime
        }
    });
}
exports.emitGameOver = emitGameOver;
// 检测玩家卡牌
function checkCards(cards, cardsIndex, lastCard, tasks, roomInfo, io, sc) {
    for (let i = 0; i < cardsIndex.length; i++) {
        const target = cards[cardsIndex[i]];
        console.log('target:', target);
        console.log('lastCard:', lastCard);
        if (!checkCard(target, lastCard)) {
            return false;
        }
        else {
            tasks.addTask(handleCardByType(target, roomInfo, io, sc));
        }
    }
    return true;
}
exports.checkCards = checkCards;
// 检查单张卡牌
function checkCard(target, lastCard) {
    if (!lastCard || isUniversalCard(target))
        return true;
    return isSameColor(target, lastCard) || isSameType(target, lastCard);
}
function isSameColor(target, lastCard) {
    return target.color === lastCard.color;
}
function isSameType(target, lastCard) {
    return target.type === lastCard.type;
}
function isUniversalCard(target) {
    return target.type === 'palette' || target.type === 'add-4';
}
function handleCardByType(card, roomInfo, io, sc) {
    let fn;
    switch (card.type) {
        case 'exchange':
            fn = () => {
                roomInfo.playOrder = roomInfo.playOrder === 1 ? -1 : 1;
                // TODO 给全部玩家发出通知
            };
            break;
        case 'ban':
            fn = () => {
                roomInfo.order = getNextOrder(roomInfo);
                // TODO 给对应玩家发出通知
            };
            break;
        case 'add-2':
            fn = () => {
                dealCardsToPlayer(io, roomInfo, 2);
                roomInfo.order = getNextOrder(roomInfo);
            };
            break;
        case 'add-4':
            fn = () => {
                return new Promise((resolve, reject) => {
                    io.to(sc.id).emit('SELECT_COLOR', {
                        message: '请选择颜色',
                        type: 'SELECT_COLOR',
                        data: null
                    });
                    sc.once('SUBMIT_COLOR', (res) => {
                        const { data: { color, roomCode } } = res;
                        const roomInfo = (0, utils_1.get)(room_1.roomCollection, roomCode);
                        if (!roomInfo) {
                            resolve({
                                message: '房间不存在',
                                data: null,
                                type: 'RES_SUBMIT_COLOR'
                            });
                        }
                        roomInfo.lastCard.color = color;
                        // 更改房间颜色
                        (0, room_1.emitAllPlayers)(io, roomCode, 'COLOR_IS_CHANGE', {
                            message: '卡牌颜色更改为：' + card_1.colorList[color],
                            type: 'COLOR_IS_CHANGE',
                            data: color
                        });
                        dealCardsToPlayer(io, roomInfo, 4);
                        roomInfo.order = getNextOrder(roomInfo);
                        resolve({
                            message: '卡牌颜色更改为：' + card_1.colorList[color],
                            data: null,
                            type: 'RES_SUBMIT_COLOR'
                        });
                    });
                });
            };
            break;
        case 'palette':
            fn = () => {
                return new Promise((resolve, reject) => {
                    io.to(sc.id).emit('SELECT_COLOR', {
                        message: '请选择颜色',
                        type: 'SELECT_COLOR',
                        data: null
                    });
                    sc.once('SUBMIT_COLOR', (res) => {
                        const { data } = res;
                        const { color, roomCode } = data;
                        const roomInfo = (0, utils_1.get)(room_1.roomCollection, roomCode);
                        if (!roomInfo) {
                            resolve({
                                message: '房间不存在',
                                data: null,
                                type: 'RES_SUBMIT_COLOR'
                            });
                        }
                        roomInfo.lastCard.color = color;
                        // 更改房间颜色
                        (0, room_1.emitAllPlayers)(io, roomCode, 'COLOR_IS_CHANGE', {
                            message: '卡牌颜色更改为：' + card_1.colorList[color],
                            type: 'COLOR_IS_CHANGE',
                            data: color
                        });
                        resolve({
                            data: null,
                            type: 'RES_SUBMIT_COLOR'
                        });
                    });
                });
            };
            break;
        default:
            fn = () => { };
            break;
    }
    return fn;
}
// 获取下一轮的玩家序号
function getNextOrder(roomInfo) {
    return (roomInfo.order + roomInfo.playOrder + roomInfo.players.length) % roomInfo.players.length;
}
// 给玩家添加牌
function dealCardsToPlayer(io, roomInfo, num) {
    const nextPlayer = roomInfo.players[getNextOrder(roomInfo)];
    nextPlayer.cards.push(...getSpecifiedCards(roomInfo.gameCards, num));
    // 通知玩家
    emitDealCardsToPlayer(io, nextPlayer.socketId, nextPlayer.cards, num);
}
