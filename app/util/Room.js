const CardUtil = require('./CardUtil')
const Notifications = require('./Notifications')
const Feadback = require('./Feadback')

function Room(channel, config) {
    this.channel = channel
    this.count = config.count
    this.users = []
    this.feadback = new Feadback(channel)
}

//---------------------------------------------------------------------------------------------------------------
// 添加用户到渠道
//---------------------------------------------------------------------------------------------------------------
Room.prototype.addUser = function (username) {
    this.users.push({ username })
}

//---------------------------------------------------------------------------------------------------------------
// 删除用户从渠道
//---------------------------------------------------------------------------------------------------------------
Room.prototype.deleteUser = function (username) {
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username === username) {
            this.users.splice(i, 1)
            return
        }
    }
}

//---------------------------------------------------------------------------------------------------------------
// 检查游戏是否能开始
//---------------------------------------------------------------------------------------------------------------
Room.prototype.setReady = function (username, isReady) {
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username === username) {
            this.users[i].isReady = isReady
            return
        }
    }
}

//---------------------------------------------------------------------------------------------------------------
// 检查游戏是否能开始
//---------------------------------------------------------------------------------------------------------------
Room.prototype.checkGameStart = function () {
    for (var i = 0; i < this.users.length; i++) {
        if (!this.users[i].isReady) {
            return
        }
    }

    console.log('游戏可以开始')

    this.gameStart()

}

Room.prototype.gameStart = function () {
    console.log('游戏开始')
    this.initRoom()
    this.xiPai()
    this.selectZhuang()
    this.faPai()
    this.faZhuangPai()

    // 新的一轮开始了 通知每个玩家
    this.channel.pushMessage({
        route: 'onNotification',
        name: Notifications.onNewRound,
        data: { users: this.users, zhuang_card: this.zhuang_card }
    })

    this.checkAllUserCanHuWith3Ti5Kan()
}

Room.prototype.initRoom = function () {
    console.log('初始化房间信息')
    this.winner = null
    this.zhuang = null
    this.zhuang_card = 0
    this.player = null
    this.player_card = 0

    this.users.forEach(user => {
        user.handCards = []
        user.groupCards = []
        user.passCards = []
    })
}

Room.prototype.xiPai = function () {
    console.log('洗牌')
    this.cards = CardUtil.shufflePoker(CardUtil.generatePoker())
}

Room.prototype.selectZhuang = function () {
    console.log('选中庄家')
    const random = Math.floor(Math.random() * this.count)
    this.zhuang = this.users[random]

    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.zhuang.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            this.users = endUsers.concat(startUsers)
            break
        }
    }
}

Room.prototype.faPai = function () {
    console.log('发牌')
    for (var i = 0; i < 20; i++) {
        for (var j = 0; j < this.users.length; j++) {
            this.users[j].handCards.push(this.cards.pop())
        }
    }
}

Room.prototype.faZhuangPai = function () {
    console.log('发庄牌')
    this.zhuang_card = this.cards.pop()
}

/**
 * 参见流程图 check1
 */
Room.prototype.checkAllUserCanHuWith3Ti5Kan = function () {
    console.log('检查所有玩家是否有三提五坎')
    for (var i = 0; i < this.users.length; i++) {
        if (CardUtil.has3Ti5Kan(this.users[i].handCards)) {
            // todo 胡操作
            return
        }
    }

    this.checkAllUserCanHuWithZhuangCard()
}

/**
 * 参见流程图 check2
 */
Room.prototype.checkAllUserCanHuWithZhuangCard = function () {
    console.log('检查所有玩家手里牌 + 庄牌是否胡牌')
    this.loopUsers = []
    this.users.forEach(user => {
        this.loopUsers.push(user)
    })
    this.loopAllUserCanHuWithZhuangCard()
}

Room.prototype.loopAllUserCanHuWithZhuangCard = function () {
    const user = this.loopUsers.shift()
    if (user) {
        const canHuData = CardUtil.canHu(user.handCards, user.groupCards, this.zhuang_card)
        if (canHuData && canHuData[0]) {
            this.feadback.send(user.username,
                {
                    route: 'onNotification',
                    name: Notifications.checkHu,
                    data: { username: user.username, data: canHuData }
                })
                .thenOk((data) => { 
                    // 胡牌
                }) 
                .thenCancel(() => { this.loopAllUserCanHuWithZhuangCard() }) 
        } else {
            this.loopAllUserCanHuWithZhuangCard()
        }
    } else {
        // loop执行完了执行下步操作
        this.zhuangStart()
    }
}

/**
 * 参考流程 Fun1
 */
Room.prototype.zhuangStart = function () {
    console.log('庄家操作')
    this.checkZhuangCanTi()

    // 新的一轮开始了 通知每个玩家
    this.channel.pushMessage({
        route: 'onNotification',
        name: Notifications.onNewRound,
        data: { users: this.users, zhuang_card: this.zhuang_card }
    })
}

/**
 * 参见流程图 check3
 */
Room.prototype.checkZhuangCanTi = function () {
    console.log('检查庄能否提')

    const canTiCards = CardUtil.hasTi(this.zhuang.handCards)
    if (canTiCards) {
        // todo  提起操作

        // 参见流程图 check4
        if (canTiCards.length > 1) {
            this.checkXianCanTi()
        } else {
            this.zhuangPlayCard()
        }
    } else {
        this.zhuangPlayCard()
    }
}

/**
 * 参见流程图 check5
 */
Room.prototype.checkXianCanTi = function () {
    console.log('检查闲家能否提')

    this.users.forEach(user => {
        if (user.username !== this.zhuang.username) {
            // 闲家 看看有没有提
            const canTiCards = CardUtil.hasTi(user.handCards)
            if (canTiCards) {
                // todo 提起
            }
        }
    })

    this.nextPlayCard(this.zhuang)
}

Room.prototype.zhuangPlayCard = function () {
    console.log('庄家出牌')
    this.feadback.send(this.zhuang.username,
        {
            route: 'onNotification',
            name: Notifications.checkNewCard,
            data: { username: this.zhuang.username, data: 'oc' }
        })
        .thenOk((data) => {
            console.log('收到用户反馈', data)
            this.player = this.zhuang
            this.player_card = data
            this.checkXianCanTi2()
        })
        .thenCancel(() => {
            console.log('取消或无反应')
            // todo
        })
}

/**
 * 参见流程图 check6
 */
Room.prototype.checkXianCanTi2 = function () {
    console.log('检查闲家能否提')

    this.users.forEach(user => {
        if (user.username !== this.zhuang.username) {
            // 闲家 看看有没有提
            const canTiCards = CardUtil.hasTi(user.handCards)
            if (canTiCards) {
                // todo 提起
            }
        }
    })

    this.checkOtherUserCanHuWithPlayerCard()
}

/**
 * 参见流程图 check7
 */
Room.prototype.checkOtherUserCanHuWithPlayerCard = function () {
    console.log('检查其他玩家手里牌 + player_card 是否胡牌')
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            this.loopUsers = endUsers.concat(startUsers).shift()
            break
        }
    }
    this.loopOtherUserCanHuWithPlayerCard()
}
Room.prototype.loopOtherUserCanHuWithPlayerCard = function () {
    const user = this.loopUsers.shift()
    if (user) {
        const canHuData = CardUtil.canHu(user.handCards, user.groupCards, this.player_card)
        if (canHuData && canHuData[0]) {
            this.feadback.send(user.username,
                {
                    route: 'onNotification',
                    name: Notifications.checkHu,
                    data: { username: user.username, data: canHuData }
                })
                .thenOk((data) => {
                    // todo 胡牌操作
                })
                .thenCancel(() => { this.loopOtherUserCanHuWithPlayerCard() })
        } else {
            this.loopOtherUserCanHuWithPlayerCard()
        }
    } else {
        // loop执行完了 没有玩家能胡
        this.checkOtherUserCanPaoWithPlayerCard()
    }
}

/**
 * 参见流程图 check8
 */
Room.prototype.checkOtherUserCanPaoWithPlayerCard = function () {
    console.log('检查其他玩家手里牌 + player_card 是否能跑')
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            this.loopUsers = endUsers.concat(startUsers).shift()
            break
        }
    }
    this.loopOtherUserCanPaoWithPlayerCard()
}
Room.prototype.loopOtherUserCanPaoWithPlayerCard = function () {
    const user = this.loopUsers.shift()
    if (user) {
        const canPaoData1 = CardUtil.canTi(user.handCards, this.player_card)
        if (canPaoData1) {
            // todo 手里牌能跑 跑起操作
            if (CardUtil.tiPaoCount(user.groupCards) >= 2) {
                this.nextPlayCard(user) // 让user用户的下家出牌
            } else {
                this.playerPlayCard(user) 
            }
        } else {
            const canPaoData2 = CardUtil.canTi2(user.groupCards, this.player_card)
            if (canPaoData2) {
                // todo 组合牌里能跑 跑起操作
                if (CardUtil.tiPaoCount(user.groupCards) >= 2) {
                    this.nextPlayCard(user) // 让user用户的下家出牌
                } else {
                    this.playerPlayCard(user) 
                }
            } else {
                // 这个玩家不能跑操作，循环检查下个玩家
                this.loopOtherUserCanPaoWithPlayerCard()
            }
        }
    } else {
        // loop执行完了，没有玩家能跑，开始检查其他玩家能否碰
        this.checkOtherUserCanPengWithPlayerCard()
    }
}


/**
 * 参见流程图 check9
 */
Room.prototype.checkOtherUserCanPengWithPlayerCard = function () {
    console.log('检查其他玩家手里牌 + player_card 是否能碰')
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            this.loopUsers = endUsers.concat(startUsers).shift()
            break
        }
    }
    this.loopOtherUserCanPengWithPlayerCard()
}
Room.prototype.loopOtherUserCanPengWithPlayerCard = function () {
    const user = this.loopUsers.shift()
    if (user) {
        const canPengData = CardUtil.canPeng(user.handCards, this.player_card)
        if (canPengData) {
            // 通知玩家是否要碰
            this.feadback.send(user.username, {
                route: 'onNotification',
                name: Notifications.checkPeng,
                data: { username: user.username, data: canPengData }
            }).thenOk((data) => {
                // todo 玩家碰操作
                // 碰完了通知玩家出牌
                this.playerPlayCard(user)
            }).thenCancel(() => {
                this.loopOtherUserCanPengWithPlayerCard()
            })
        } else {
            this.loopOtherUserCanPengWithPlayerCard()
        }
    } else {
        // loop执行完了，没有其他玩家能碰, 判断出牌玩家能否吃
        this.checkPlayerUserCanChiWithPlayerCard()
    }
}

/**
 * 参见流程图 check10
 */
Room.prototype.checkPlayerUserCanChiWithPlayerCard = function () {
    console.log('检查出牌玩家手里牌 + player_card 是否能吃')
    const canChiData = CardUtil.canChi(this.player.handCards, this.player_card)
    if (canChiData) {
        // 通知出牌玩家是否要吃
        this.feadback.send(this.player.username, {
            route: 'onNotification',
            name: Notifications.checkEat,
            data: { username: this.player.username, data: canChiData }
        }).thenOk((data) => {
            // todo 出牌玩家吃操作
            // 吃完了通知玩家出牌
            this.playerPlayCard(this.player)
        }).thenCancel(() => {
            // 出牌玩家不想吃 或者 超时了
            this.checkNextUserCanChiWithPlayerCard()
        })
    } else {
        // 出牌玩家不能吃
        this.checkNextUserCanChiWithPlayerCard()
    }
}

/**
 * 参见流程图 check11
 */
Room.prototype.checkNextUserCanChiWithPlayerCard = function () {
    console.log('检查下家手里牌 + player_card 是否能吃')

    // 找到下家
    var nextUser
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            var orderUsers = endUsers.concat(startUsers).shift()
            if (orderUsers.length > 0) {
                nextUser = orderUsers[0]
            } else {
                nextUser = null
            }
            break
        }
    }

    if (nextUser) {
        const canChiData = CardUtil.canChi(nextUser.handCards, this.player_card)
        if (canChiData) {
            // 通知出牌玩家是否要吃
            this.feadback.send(nextUser.username, {
                route: 'onNotification',
                name: Notifications.checkEat,
                data: { username: nextUser.username, data: canChiData }
            }).thenOk((data) => {
                // todo 下家吃操作
                // 下家吃完了 通下家出牌
                this.playerPlayCard(nextUser)
            }).thenCancel(() => {
                // 下家不想吃 或者 超时了
                this.passCard()
            })
        } else {
            // 下家不能吃
            this.passCard()
        }
    } else {
        // 没有下家 执行下部操作
        this.passCard()
    }
}


/**
 * 废牌操作
 */
Room.prototype.passCard = function () {
    this.player.passCards.push(this.player_card)
    this.player_card = 0

    // 参见流程 check12
    if (this.cards.length > 0) {
        this.nextPlayCard(this.player)
    } else {
        // todo game over 荒庄
    }
}


/**
 *  下家出牌 
 *  参见流程图 check19
 */
Room.prototype.nextPlayCard = function (user) {
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == user.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            var orderUsers = endUsers.concat(startUsers).shift()
            if (orderUsers.length > 0) {
                this.player = orderUsers[0]
            } else {
                this.player = user
            }
            break
        }
    }

    this.player_card = this.cards.pop()
    this.checkPlayerUserCanTiWithPlayerCard()
}


/**
 * 翻牌玩家是否可以提
 * 参见流程图 check13
 */
Room.prototype.checkPlayerUserCanTiWithPlayerCard = function () {
    const canTiData1 = CardUtil.canTi(this.player.handCards, this.player_card)
    if (canTiData1) {
        // todo 提起
        // 提完成操作
        // 参见流程 check18
        if (CardUtil.tiPaoCount(this.player.groupCards) >= 2) {
            this.nextPlayCard(this.player)
        } else {
            this.playerPlayCard(this.player)
        }
    } else {
        const canTiData2 = CardUtil.canTi2(this.player.groupCards, this.player_card)
        if (canTiData2) {
            // todo 提起
            // 提完成操作
            // 参见流程 check18
            if (CardUtil.tiPaoCount(this.player.groupCards) >= 2) {
                this.nextPlayCard(this.player)
            } else {
                this.playerPlayCard(this.player)
            }
        } else {
            this.checkPlayerUserCanWeiWithPlayerCard()
        }
    }
}

/**
 * 翻牌玩家是否可以偎
 * 参见流程图 check14
 */
Room.prototype.checkPlayerUserCanWeiWithPlayerCard = function () {
    const canWeiData = CardUtil.canWei(this.player.handCards, this.player_card)
    if (canWeiData) {
        // todo 有偎必须偎

        this.checkPlayerUserCanHuWithPlayerCard2()
    } else {
        this.checkPlayerUserCanHuWithPlayerCard()
    }
}

/**
 * 翻牌玩家是否可以胡
 * 参见流程图 check15
 */
Room.prototype.checkPlayerUserCanHuWithPlayerCard = function () {
    const canHuData = CardUtil.canHu(this.player.handCards, this.player.groupCards, this.player_card)
    if (canHuData) {
        // 通知翻牌玩家是否要胡
        this.feadback.send(this.player.username, {
            route: 'onNotification',
            name: Notifications.checkHu,
            data: { username: this.player.username, data: canHuData }
        }).thenOk((data) => {
            // todo 翻牌玩家胡牌操作
        }).thenCancel(() => {
            // 翻牌玩家不想胡 / 超时
            this.checkOtherUserCanHuWithPlayerCard()
        })
    } else {
        this.checkOtherUserCanHuWithPlayerCard()
    }
}

/**
 * 翻牌玩家是否可以胡
 * 参见流程图 check16
 */
Room.prototype.checkPlayerUserCanHuWithPlayerCard2 = function () {
    const canHuData = CardUtil.canHu(this.player.handCards, this.player.groupCards, this.player_card)
    if (canHuData) {
        // 通知翻牌玩家是否要胡
        this.feadback.send(this.player.username, {
            route: 'onNotification',
            name: Notifications.checkHu,
            data: { username: this.player.username, data: canHuData }
        }).thenOk((data) => {
            // todo 翻牌玩家胡牌操作
        }).thenCancel(() => {
            // 翻牌玩家不想胡 / 超时
            this.playerPlayCard(this.player)
        })
    } else {
        this.playerPlayCard(this.player)
    }
}


/**
 * 本人出牌
 * 参见流程图 check17
 */
Room.prototype.playerPlayCard = function (user) {
    console.log('本人出牌')
    this.feadback.send(user.username,
        {
            route: 'onNotification',
            name: Notifications.checkNewCard,
            data: { username: user.username, data: 'oc' }
        })
        .thenOk((data) => {
            console.log('收到用户反馈', data)
            // todo 出牌操作
            this.player = user
            this.player_card = this.player.handCards.pop()
            this.checkOtherUserCanHuWithPlayerCard()
        })
        .thenCancel(() => {
            console.log('取消或无反应')
            // todo 出牌操作
            this.player = user
            this.player_card = this.player.handCards.pop()
            this.checkOtherUserCanHuWithPlayerCard()
        })
}


module.exports = Room