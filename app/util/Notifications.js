const Notifications = {
    onLeaveRoom: 3, // 玩家离开房间
    onReady: 5,     // 有玩家准备
    onNewRound: 6,    // 开局通知
    onGameStart: 7, // 游戏正式开始
    onDisCard: 8,     //等待玩家出牌
    onCard: 9,    	  // 玩家出的牌
    onEat: 10,         // 玩家吃牌
    onPeng: 11,       // 玩家碰牌
    onWei: 12,         // 玩家偎牌
    onWin: 13,         // 玩家胡牌
    onTi: 14,          // 玩家提牌
    onPao: 15,         // 玩家跑牌
    onNewCard: 16,    // 新底牌
    checkPeng: 17,    // 检查碰
    checkEat: 18,     // 检查吃
    checkNewCard: 19, // 检查出牌
    checkHu: 20,       // 检查胡
    onRoundEnd: 21,  // 一轮游戏结束
    onBi: 22,         // 玩家吃牌
    onResume: 23,      // 数据恢复
    onGroupStatus: 24,      // 群数据发生变化
    onRoomStatus: 25,    // 群数据发生变化
    onRoomMessage: 26,
    onGameOver: 27
}

module.exports = Notifications