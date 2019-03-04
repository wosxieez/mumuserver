const Notifications = {
    onJoinRoom: 1,    // 新玩家加入房间
    onJoinGroup: 301, // 新玩家加入群
    onLevelRoom: 101, // 玩家离开房间
    onLevelGroup: 401,// 玩家离开群
    onNewRound: 2,    // 开局通知
    onDisCard: 3,     //等待玩家出牌
    onCard: 4,    	  // 玩家出的牌
    onEat: 5,         // 玩家吃牌
    onPeng: 11,       // 玩家碰牌
    onWei: 6,         // 玩家偎牌
    onWin: 7,         // 玩家胡牌
    onTi: 8,          // 玩家提牌
    onPao: 9,         // 玩家跑牌
    onNewCard: 10,    // 新底牌
    checkPeng: 12,    // 检查碰
    checkEat: 13,     // 检查吃
    checkNewCard: 14, // 检查出牌
    checkHu: 15       // 检查胡
}

module.exports = Notifications