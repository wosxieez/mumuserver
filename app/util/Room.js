const CardUtil = require('./CardUtil')
const Notifications = require('./Notifications')
const HuXiUtil = require('./HuXiUtil')
const HuActions = require('./HuActions')
const Actions = require('./Actions')
const Feadback = require('./Feadback')
const logger = require('pomelo-logger').getLogger('pomelo', __filename);
const axios = require('axios')

function Room(channel, rule) {
    this.channel = channel
    this.rule = rule
    this.users = []
    this.isZhuangFirstOutCard = false
    this.feadback = new Feadback(channel)
    this.timeout = 0
    this.cards = []
    this.isGaming = false // 是否正在游戏中


    var params = { winner: 'wosxieez', loser: 'wosxieez2', score: 100, gid: 2, rid: this.rule.id }
    axios.post('http://127.0.0.1:3008/update_score', params).catch(error => {})
}

Room.prototype.release = function () {
    logger.info('Room release')
    this.channel = null
    clearTimeout(this.timeout)
}

//---------------------------------------------------------------------------------------------------------------
// 添加用户到渠道
//---------------------------------------------------------------------------------------------------------------
Room.prototype.addUser = function (username) {
    if (this.isGaming) {
        return
    }
    this.users.push({ username, hx: 0 })
}

//---------------------------------------------------------------------------------------------------------------
// 删除用户从渠道
//---------------------------------------------------------------------------------------------------------------
Room.prototype.deleteUser = function (username) {
    if (this.isGaming) {
        return
    }
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username === username) {
            this.users.splice(i, 1)
            return
        }
    }
}

//---------------------------------------------------------------------------------------------------------------
// 用户是否在房间里
//---------------------------------------------------------------------------------------------------------------
Room.prototype.hasUser = function (username) {
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username === username) {
            return true
        }
    }
    return false
}

//---------------------------------------------------------------------------------------------------------------
// 检查游戏是否能开始
//---------------------------------------------------------------------------------------------------------------
Room.prototype.setReady = function (username, isReady) {
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username === username) {
            this.users[i].isReady = isReady
        }
    }

    this.noticeAllUserOnReady()
}

//---------------------------------------------------------------------------------------------------------------
// 检查游戏是否能开始
//---------------------------------------------------------------------------------------------------------------
Room.prototype.checkGameStart = function () {
    if (this.users.length < this.rule.cc) {
        return
    }

    for (var i = 0; i < this.users.length; i++) {
        if (!this.users[i].isReady) {
            return
        }
    }

    logger.info('游戏可以开始')

    this.gameStart()

}

Room.prototype.gameStart = function () {
    logger.info('游戏开始')
    this.isGaming = true // 游戏开始
    this.initRoom()
    this.xiPai()
    this.selectZhuang()
    this.faPai()
    this.faZhuangPai()

    // 新的一轮开始了 通知每个玩家
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onNewRound,
        data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username, cc: this.cards.length }
    })

    this.timeout = setTimeout(this.checkAllUserCanHuWith3Ti5Kan.bind(this), 2000)
}

Room.prototype.initRoom = function () {
    logger.info('初始化房间信息')
    this.zhuang = null
    this.zhuang_card = 0
    this.isZhuangFirstOutCard = false
    this.player = null
    this.player_card = 0

    this.users.forEach(user => {
        user.handCards = []
        user.groupCards = []
        user.passCards = []
        user.ucCards = [] // 不吃的牌
        user.upCards = [] // 不碰的牌
    })
}

Room.prototype.xiPai = function () {
    logger.info('洗牌')
    this.cards = CardUtil.shufflePoker(CardUtil.generatePoker())
}

Room.prototype.selectZhuang = function () {
    logger.info('选中庄家')
    const random = Math.floor(Math.random() * this.rule.cc)
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
    logger.info('发牌')

    // 删除多余的牌
    const more = (3 - this.users.length) * 20
    for (var m = 0; m < more; m++) {
        this.cards.pop()
    }

    for (var i = 0; i < 20; i++) {
        for (var j = 0; j < this.users.length; j++) {
            this.users[j].handCards.push(this.cards.pop())
        }
    }
}

Room.prototype.faZhuangPai = function () {
    logger.info('发庄牌')
    this.zhuang_card = this.cards.pop()
}

/**
 * 参见流程图 check1
 */
Room.prototype.checkAllUserCanHuWith3Ti5Kan = function () {
    logger.info('check1')
    for (var i = 0; i < this.users.length; i++) {
        if (CardUtil.has3Ti5Kan(this.users[i].handCards)) {
            // 胡牌 3提 5坎 胡牌  天胡
            const huXi = HuXiUtil.getHuXi(this.users[i].groupCards, HuActions.Is3Ti5KanCard)
            this.noticeAllUserOnWin({ wn: this.users[i].username, ...huXi })
            return
        }
    }

    this.checkAllUserCanHuWithZhuangCard()
}

/**
 * 参见流程图 check2
 */
Room.prototype.checkAllUserCanHuWithZhuangCard = function () {
    logger.info('check2')
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
        if (canHuData) {
            this.feadback.send(user.username,
                {
                    route: 'onRoom',
                    name: Notifications.checkHu,
                    data: { username: user.username, data: canHuData }
                })
                .thenOk((data) => {
                    // 玩家能够胡庄牌 天胡
                    user.groupCards = canHuData
                    user.handCards = []
                    const huXi = HuXiUtil.getHuXi(canHuData, HuActions.IsZhuangCard)
                    this.noticeAllUserOnWin({ wn: user.username, ...huXi })
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
    logger.info('Fun1')
    this.zhuang.handCards.push(this.zhuang_card)

    // 游戏正式开始 通知每个玩家
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onGameStart,
        data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
    })

    this.checkZhuangCanTi()
}

/**
 * 参见流程图 check3
 */
Room.prototype.checkZhuangCanTi = function () {
    logger.info('check3')

    const hasTiCards = CardUtil.hasTi(this.zhuang.handCards)
    if (hasTiCards) {
        hasTiCards.forEach(group => {
            group.forEach(card => {
                CardUtil.deleteCard(this.zhuang.handCards, card)
            })
            this.zhuang.groupCards.push({ name: Actions.Ti, cards: group })
        })

        this.noticeAllUserOnTi()

        // 参见流程图 check4
        logger.info('check4')
        if (hasTiCards.length > 1) {
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
    logger.info('check5')

    var hasTi = false
    this.users.forEach(user => {
        if (user.username !== this.zhuang.username) {
            // 闲家 看看有没有提
            const hasTiCards = CardUtil.hasTi(user.handCards)
            if (hasTiCards) {
                hasTi = true
                hasTiCards.forEach(group => {
                    group.forEach(card => {
                        CardUtil.deleteCard(user.handCards, card)
                    })
                    user.groupCards.push({ name: Actions.Ti, cards: group })
                })
            }
        }
    })

    if (hasTi) {
        // 通知有人提了
        this.channel.pushMessage({
            route: 'onRoom',
            name: Notifications.onTi,
            data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
        })

        this.timeout = setTimeout(() => { this.nextPlayCard(this.zhuang) }, 2000)
    } else {
        this.nextPlayCard(this.zhuang)
    }
}

Room.prototype.zhuangPlayCard = function () {
    logger.info('庄家出牌')
    this.feadback.send(this.zhuang.username,
        {
            route: 'onRoom',
            name: Notifications.checkNewCard,
            data: { username: this.zhuang.username, data: 'oc' }
        })
        .thenOk((data) => {
            // 庄家出牌
            this.player_card = data
            this.player = this.zhuang
            logger.info('庄家出牌', this.player_card)
            this.player.ucCards.push(this.player_card)
            this.player.upCards.push(this.player_card)
            this.isZhuangFirstOutCard = true
            CardUtil.deleteCard(this.player.handCards, this.player_card)
            this.noticeAllUserOnNewCard(true)
            this.timeout = setTimeout(() => { this.checkXianCanTi2() }, 2000)
        })
        .thenCancel(() => {
            const riffleCards = CardUtil.riffle(this.zhuang.handCards)
            const lastGroup = riffleCards.pop()
            this.player_card = lastGroup.pop()
            this.player = this.zhuang
            logger.info('庄家出牌', this.player_card)
            this.player.ucCards.push(this.player_card)
            this.player.upCards.push(this.player_card)
            this.isZhuangFirstOutCard = true
            CardUtil.deleteCard(this.player.handCards, this.player_card)
            this.noticeAllUserOnNewCard(true)
            this.timeout = setTimeout(() => { this.checkXianCanTi2() }, 2000)
        })
}

/**
 * 参见流程图 check6
 */
Room.prototype.checkXianCanTi2 = function () {
    logger.info('check6')

    var hasTi = false
    this.users.forEach(user => {
        if (user.username !== this.zhuang.username) {
            // 闲家 看看有没有提
            const hasTiCards = CardUtil.hasTi(user.handCards)
            if (hasTiCards) {
                hasTi = true
                hasTiCards.forEach(group => {
                    group.forEach(card => {
                        CardUtil.deleteCard(user.handCards, card)
                    })
                    user.groupCards.push({ name: Actions.Ti, cards: group })
                })
            }
        }
    })

    if (hasTi) {
        // 通知有人提了
        this.channel.pushMessage({
            route: 'onRoom',
            name: Notifications.onTi,
            data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
        })

        this.timeout = setTimeout(() => { this.checkOtherUserCanHuWithPlayerCard2() }, 2000)
    } else {
        this.checkOtherUserCanHuWithPlayerCard2()
    }
}

/**
 * 参见流程图 check7
 */
Room.prototype.checkOtherUserCanHuWithPlayerCard = function () {
    logger.info('check7')
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            this.loopUsers = endUsers.concat(startUsers)
            this.loopUsers.shift()
            break
        }
    }
    this.loopOtherUserCanHuWithPlayerCard()
}
Room.prototype.loopOtherUserCanHuWithPlayerCard = function () {
    const user = this.loopUsers.shift()
    if (user) {
        const canHuData = CardUtil.canHu(user.handCards, user.groupCards, this.player_card)
        if (canHuData) {
            const huXi = HuXiUtil.getHuXi(canHuData, HuActions.IsOtherFlopCard, this.cards.length === 0)
            if (huXi.hx >= this.rule.hx) {
                this.feadback.send(user.username,
                    {
                        route: 'onRoom',
                        name: Notifications.checkHu,
                        data: { username: user.username, data: canHuData }
                    })
                    .thenOk((data) => {
                        user.groupCards = canHuData
                        user.handCards = []
                        this.noticeAllUserOnWin({ wn: user.username, ...huXi })
                    })
                    .thenCancel(() => { this.loopOtherUserCanHuWithPlayerCard() })
            } else {
                // 胡息不够
                this.loopOtherUserCanHuWithPlayerCard()
            }
        } else {
            // 无法胡牌
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
    logger.info('check8')
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            this.loopUsers = endUsers.concat(startUsers)
            this.loopUsers.shift()
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
            // 跑起操作
            canPaoData1.forEach(card => {
                CardUtil.deleteCard(user.handCards, card)
            })
            canPaoData1.push(this.player_card)
            user.groupCards.push({ name: Actions.Pao, cards: canPaoData1 })

            // 有玩家跑操作
            this.channel.pushMessage({
                route: 'onRoom',
                name: Notifications.onPao,
                data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
            })

            this.timeout = setTimeout(() => {
                if (CardUtil.tiPaoCount(user.groupCards) >= 2) {
                    this.nextPlayCard(user) // 让user用户的下家出牌
                } else {
                    this.playerPlayCard(user)
                }
            }, 2000)
        } else {
            const canPaoData2 = CardUtil.canTi2(user.groupCards, this.player_card)
            if (canPaoData2) {
                // 组合牌里能跑 跑起操作
                canPaoData2.name = Actions.Pao
                canPaoData2.cards.push(this.player_card)

                // 有玩家跑操作
                this.channel.pushMessage({
                    route: 'onRoom',
                    name: Notifications.onPao,
                    data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
                })

                this.timeout = setTimeout(() => {
                    if (CardUtil.tiPaoCount(user.groupCards) >= 2) {
                        this.nextPlayCard(user) // 让user用户的下家出牌
                    } else {
                        this.playerPlayCard(user)
                    }
                }, 2000)
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
    logger.info('check9')
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            this.loopUsers = endUsers.concat(startUsers)
            this.loopUsers.shift()
            break
        }
    }
    this.loopOtherUserCanPengWithPlayerCard()
}
Room.prototype.loopOtherUserCanPengWithPlayerCard = function () {
    const user = this.loopUsers.shift()
    if (user) {
        logger.info('检查', user.username, '能否碰这张牌', this.player_card)
        logger.info('不碰的牌', user.upCards)
        if (!CardUtil.hasCard(user.upCards, this.player_card)) {
            const canPengData = CardUtil.canPeng(user.handCards, this.player_card)
            if (canPengData) {
                // 通知玩家是否要碰
                logger.info(user.username, '可以碰这张牌 通知玩家要不要碰')
                this.feadback.send(user.username, {
                    route: 'onRoom',
                    name: Notifications.checkPeng,
                    data: { username: user.username, data: canPengData }
                }).thenOk((data) => {
                    logger.info(user.username, '选择了碰这张牌')
                    canPengData.forEach(card => {
                        CardUtil.deleteCard(user.handCards, card)
                    })
                    canPengData.push(this.player_card)
                    user.groupCards.push({ name: Actions.Peng, cards: canPengData })
                    this.noticeAllUserOnPeng()
                    this.timeout = setTimeout(() => {
                        this.playerPlayCard(user)
                    }, 2000)
                }).thenCancel(() => {
                    logger.info(user.username, '选择了不碰 或者 超时了')
                    user.upCards.push(this.player_card) // 记录的用户不想碰的牌中
                    this.loopOtherUserCanPengWithPlayerCard()
                })
            } else {
                logger.info(user.username, '不可以碰这张牌')
                this.loopOtherUserCanPengWithPlayerCard()
            }
        } else {
            logger.info(user.username, '不能碰这张牌 因为该牌在pass牌中')
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
    logger.info('check10')
    logger.info('检查', this.player.username, '能否吃这张牌', this.player_card)
    logger.info('不吃的牌', this.player.ucCards)
    if (!CardUtil.hasCard(this.player.ucCards, this.player_card)) {
        const canChiData = CardUtil.canChi(this.player.handCards, this.player_card)
        if (canChiData) {
            canChiData.forEach(canChiItem => {
                canChiItem.cards.push(this.player_card)
            })
            // 通知出牌玩家是否要吃
            logger.info(this.player.username, '可以吃牌 通知玩家要不要吃牌')
            this.feadback.send(this.player.username, {
                route: 'onRoom',
                name: Notifications.checkEat,
                data: { username: this.player.username, data: canChiData }
            }).thenOk((data) => {
                logger.info(this.player.username, '选择了吃牌')
                this.player.handCards.push(this.player_card)
                data.forEach(group => {
                    group.cards.forEach(card => {
                        CardUtil.deleteCard(this.player.handCards, card)
                    })
                    this.player.groupCards.push(group)
                })
                if (data.length > 1) {
                    this.noticeAllUserOnBi()
                } else {
                    this.noticeAllUserOnChi()
                }
                this.timeout = setTimeout(() => { this.playerPlayCard(this.player) }, 2000)
            }).thenCancel(() => {
                // 出牌玩家不想吃 或者 超时了
                logger.info(this.player.username, '选择了不吃牌 或者 超时了')
                this.player.ucCards.push(this.player_card) // 记录不吃的牌
                this.checkNextUserCanChiWithPlayerCard()
            })
        } else {
            // 出牌玩家不能吃
            logger.info(this.player.username, '不能吃牌')
            this.checkNextUserCanChiWithPlayerCard()
        }
    } else {
        logger.info(this.player.username, '不能吃牌 因为已经在pass牌中')
        this.checkNextUserCanChiWithPlayerCard()
    }
}

/**
 * 参见流程图 check11
 */
Room.prototype.checkNextUserCanChiWithPlayerCard = function () {
    logger.info('check11 检查下家手里牌 + player_card 是否能吃')

    // 找到下家
    var nextUser
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            var orderUsers = endUsers.concat(startUsers)
            orderUsers.shift()
            if (orderUsers.length > 0) {
                nextUser = orderUsers[0]
            } else {
                nextUser = null
            }
            break
        }
    }

    if (nextUser) {
        logger.info('检查', nextUser.username, '能否吃这张牌', this.player_card)
        logger.info('不吃的牌', nextUser.ucCards)
        if (!CardUtil.hasCard(nextUser.ucCards, this.player_card)) {
            const canChiData = CardUtil.canChi(nextUser.handCards, this.player_card)
            if (canChiData) {
                logger.info(nextUser.username, '可以吃牌 通知用户要不要吃')
                // 通知出牌玩家是否要吃
                canChiData.forEach(canChiItem => {
                    canChiItem.cards.push(this.player_card)
                })
                this.feadback.send(nextUser.username, {
                    route: 'onRoom',
                    name: Notifications.checkEat,
                    data: { username: nextUser.username, data: canChiData }
                }).thenOk((data) => {
                    logger.info(nextUser.username, '选择了吃牌操作')
                    nextUser.handCards.push(this.player_card)
                    data.forEach(group => {
                        group.cards.forEach(card => {
                            CardUtil.deleteCard(nextUser.handCards, card)
                        })
                        nextUser.groupCards.push(group)
                    })
                    if (data.length > 1) {
                        this.noticeAllUserOnBi()
                    } else {
                        this.noticeAllUserOnChi()
                    }
                    this.timeout = setTimeout(() => { this.playerPlayCard(nextUser) }, 2000)
                }).thenCancel(() => {
                    // 下家不想吃 或者 超时了
                    logger.info(nextUser.username, '选择了不吃牌 或者 超时了')
                    nextUser.ucCards.push(this.player_card)
                    this.passCard()
                })
            } else {
                // 下家不能吃
                this.passCard()
            }
        } else {
            logger.info(nextUser.username, '不能吃了 因为该牌在废弃牌中')
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
    logger.info('废牌操作', this.player_card)
    this.player.passCards.push(this.player_card)
    this.player_card = 0

    // 参见流程 check12
    logger.info('check12')
    if (this.cards.length > 0) {
        this.nextPlayCard(this.player)
    } else {
        // todo game over 荒庄
        this.noticeAllUserOnRoundEnd()
    }
}


/**
 *  下家出牌 
 *  参见流程图 check23
 */
Room.prototype.nextPlayCard = function (user) {
    logger.info('check23 下家翻牌')

    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == user.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            var orderUsers = endUsers.concat(startUsers)
            orderUsers.shift()
            if (orderUsers.length > 0) {
                this.player = orderUsers[0]
            } else {
                this.player = user
            }
            break
        }
    }

    this.player_card = this.cards.pop()
    logger.info('翻的牌为', this.player_card)
    this.noticeAllUserOnNewCard(false)
    this.timeout = setTimeout(() => {
        this.checkPlayerUserCanTiWithPlayerCard()
    }, 2000)
}


/**
 * 翻牌玩家是否可以提
 * 参见流程图 check13
 */
Room.prototype.checkPlayerUserCanTiWithPlayerCard = function () {
    logger.info('check13 翻牌玩家是否可以提')
    const canTiData1 = CardUtil.canTi(this.player.handCards, this.player_card)
    if (canTiData1) {
        canTiData1.forEach(card => {
            CardUtil.deleteCard(this.player.handCards, card)
        })
        canTiData1.push(this.player_card)
        this.player_card = 0 // 翻的牌被提起来了
        this.player.groupCards.push({ name: Actions.Ti, cards: canTiData1 })

        this.noticeAllUserOnTi()

        this.timeout = setTimeout(() => {
            this.checkPlayerUserCanHuWithPlayerCard3()
        }, 2000)
    } else {
        const canTiData2 = CardUtil.canTi2(this.player.groupCards, this.player_card)
        if (canTiData2) {
            canTiData2.name = Actions.Ti
            canTiData2.cards.push(this.player_card)
            this.player_card = 0 // 翻的牌被提起来了
            this.noticeAllUserOnTi()

            this.timeout = setTimeout(() => {
                this.checkPlayerUserCanHuWithPlayerCard3()
            }, 2000)
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
    logger.info('check14 翻牌玩家是否可以偎')
    const canWeiData = CardUtil.canWei(this.player.handCards, this.player_card)
    if (canWeiData) {
        canWeiData.forEach(card => {
            CardUtil.deleteCard(this.player.handCards, card)
        })
        canWeiData.push(this.player_card)
        this.player_card = 0 // 翻的牌被偎起来了
        this.player.groupCards.push({ name: Actions.Wei, cards: canWeiData })

        this.noticeAllUserOnWei()

        this.timeout = setTimeout(() => {
            this.checkPlayerUserCanHuWithPlayerCard2()
        }, 2000)
    } else {
        this.checkPlayerUserCanHuWithPlayerCard()
    }
}

/**
 * 翻牌玩家是否可以胡
 * 参见流程图 check15
 */
Room.prototype.checkPlayerUserCanHuWithPlayerCard = function () {
    logger.info('check15 翻牌玩家是否可以胡')
    const canHuData = CardUtil.canHu(this.player.handCards, this.player.groupCards, this.player_card)
    if (canHuData) {
        // 通知翻牌玩家是否要胡
        const huXi = HuXiUtil.getHuXi(canHuData, HuActions.IsMeFlopCard, this.cards.length === 0)
        logger.info('计算胡息', huXi.hx, '胡牌胡息', this.rule.hx)
        if (huXi.hx >= this.rule.hx) {
            this.feadback.send(this.player.username, {
                route: 'onRoom',
                name: Notifications.checkHu,
                data: { username: this.player.username, data: canHuData }
            }).thenOk((data) => {
                this.player.groupCards = canHuData
                this.player.handCards = []
                this.noticeAllUserOnWin({ wn: this.player.username, ...huXi })
            }).thenCancel(() => {
                // 翻牌玩家不想胡 / 超时
                this.checkOtherUserCanHuWithPlayerCard()
            })
        } else {
            // 胡息不够
            this.checkOtherUserCanHuWithPlayerCard()
        }
    } else {
        // 不能胡
        this.checkOtherUserCanHuWithPlayerCard()
    }
}

/**
 * 翻牌玩家是否可以胡
 * 参见流程图 check16
 */
Room.prototype.checkPlayerUserCanHuWithPlayerCard2 = function () {
    logger.info('check16 翻牌玩家是否可以胡')
    const canHuData = CardUtil.canHu(this.player.handCards, this.player.groupCards, this.player_card) // 
    if (canHuData) {
        // 通知翻牌玩家是否要胡
        const huXi = HuXiUtil.getHuXi(canHuData, HuActions.IsMeFlopCard)
        if (huXi.hx >= this.rule.hx) {
            this.feadback.send(this.player.username, {
                route: 'onRoom',
                name: Notifications.checkHu,
                data: { username: this.player.username, data: canHuData }
            }).thenOk((data) => {
                // 翻牌玩家胡牌操作
                this.player.groupCards = canHuData
                this.player.handCards = []
                this.noticeAllUserOnWin({ wn: this.player.username, ...huXi })
            }).thenCancel(() => {
                // 翻牌玩家不想胡 / 超时
                this.playerPlayCard(this.player)
            })
        } else {
            // 胡息不够 不能胡牌
            this.playerPlayCard(this.player)
        }
    } else {
        this.playerPlayCard(this.player)
    }
}

/**
 * 翻牌玩家是否可以胡
 * 参见流程图 check24
 */
Room.prototype.checkPlayerUserCanHuWithPlayerCard3 = function () {
    logger.info('check24 翻牌玩家是否可以胡')
    const canHuData = CardUtil.canHu(this.player.handCards, this.player.groupCards, this.player_card)
    if (canHuData) {
        // 通知翻牌玩家是否要胡
        const huXi = HuXiUtil.getHuXi(canHuData, HuActions.IsMeFlopCard)
        if (huXi.hx >= this.rule.hx) {
            this.feadback.send(this.player.username, {
                route: 'onRoom',
                name: Notifications.checkHu,
                data: { username: this.player.username, data: canHuData }
            }).thenOk((data) => {
                // 翻牌玩家胡牌操作
                this.player.groupCards = canHuData
                this.player.handCards = []
                this.noticeAllUserOnWin({ wn: this.player.username, ...huXi })
            }).thenCancel(() => {
                // 翻牌玩家不想胡 / 超时
                this.checkTiPaoCount()
            })
        } else {
            // 胡息不够 不能胡牌
            this.checkTiPaoCount()
        }
    } else {
        this.checkTiPaoCount()
    }
}

/**
 * 判断提跑数
 * 参见流程图 check22
 */
Room.prototype.checkTiPaoCount = function () {
    if (CardUtil.tiPaoCount(this.player.groupCards) >= 2) {
        this.nextPlayCard(this.player)
    } else {
        this.playerPlayCard(this.player)
    }
}


/**
 * 本人出牌
 * 参见流程图 check17
 */
Room.prototype.playerPlayCard = function (user) {
    logger.info('check17 本人出牌')
    if (CardUtil.hasValidaOutCards(user.handCards)) {
        this.feadback.send(user.username,
            {
                route: 'onRoom',
                name: Notifications.checkNewCard,
                data: { username: user.username, data: 'oc' }
            })
            .thenOk((data) => {
                logger.info('收到出牌', data)
                this.player = user
                this.player_card = data
                this.isZhuangFirstOutCard = false
                logger.info('出的牌为', this.player_card)
                this.player.ucCards.push(this.player_card)
                this.player.upCards.push(this.player_card)
                CardUtil.deleteCard(this.player.handCards, this.player_card)
                this.noticeAllUserOnNewCard(true)
                this.timeout = setTimeout(() => { this.checkOtherUserCanHuWithPlayerCard2() }, 2000);
            })
            .thenCancel(() => {
                logger.info('取消或无反应')
                const riffleCards = CardUtil.riffle(user.handCards)
                const lastGroup = riffleCards.pop()
                this.player = user
                this.player_card = lastGroup.pop()
                this.isZhuangFirstOutCard = false
                logger.info('出的牌为', this.player_card)
                this.player.ucCards.push(this.player_card)
                this.player.upCards.push(this.player_card)
                CardUtil.deleteCard(this.player.handCards, this.player_card)
                this.noticeAllUserOnNewCard(true)
                this.timeout = setTimeout(() => {
                    this.checkOtherUserCanHuWithPlayerCard2()
                }, 2000);
            })
    } else {
        // 玩家无法出牌了 直接下家出牌
        this.nextPlayCard(user)
    }
}

/**
 * 参见流程图 check18
 */
Room.prototype.checkOtherUserCanHuWithPlayerCard2 = function () {
    logger.info('check18 检查其他玩家手里牌 + player_card 是否胡牌', this.player.username)
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            this.loopUsers = endUsers.concat(startUsers)
            this.loopUsers.shift()
            break
        }
    }
    logger.info(this.loopUsers)
    this.loopOtherUserCanHuWithPlayerCard2()
}
Room.prototype.loopOtherUserCanHuWithPlayerCard2 = function () {
    const user = this.loopUsers.shift()
    if (user) {
        const canHuData = CardUtil.canHu(user.handCards, user.groupCards, this.player_card)
        if (canHuData) {
            var huAction
            if (this.isZhuangFirstOutCard) {
                huAction = HuActions.IsZhuangFirstOutCard
            } else {
                huAction = HuActions.IsOtherOutCard
            }
            // {hx: 10, hts: []}
            const huXi = HuXiUtil.getHuXi(canHuData, huAction)
            if (huXi.hx >= this.rule.hx) {
                this.feadback.send(user.username,
                    {
                        route: 'onRoom',
                        name: Notifications.checkHu,
                        data: { username: user.username, data: canHuData }
                    })
                    .thenOk((data) => {
                        // 胡牌
                        user.groupCards = canHuData
                        user.handCards = []
                        this.noticeAllUserOnWin({ wn: user.username, ...huXi })
                    })
                    .thenCancel(() => { this.loopOtherUserCanHuWithPlayerCard2() })
            } else {
                // 胡息小于15 不能胡
                this.loopOtherUserCanHuWithPlayerCard2()
            }
        } else {
            this.loopOtherUserCanHuWithPlayerCard2()
        }
    } else {
        // loop执行完了 没有玩家能胡
        this.checkOtherUserCanPaoWithPlayerCard2()
    }
}

/**
 * 参见流程图 check19
 */
Room.prototype.checkOtherUserCanPaoWithPlayerCard2 = function () {
    logger.info('check19 检查其他玩家手里牌 + player_card 是否能跑')
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            this.loopUsers = endUsers.concat(startUsers)
            this.loopUsers.shift()
            break
        }
    }
    this.loopOtherUserCanPaoWithPlayerCard2()
}
Room.prototype.loopOtherUserCanPaoWithPlayerCard2 = function () {
    const user = this.loopUsers.shift()
    if (user) {
        const canPaoData1 = CardUtil.canTi(user.handCards, this.player_card)
        if (canPaoData1) {
            // 跑起操作
            canPaoData1.forEach(card => {
                CardUtil.deleteCard(user.handCards, card)
            })
            canPaoData1.push(this.player_card)
            user.groupCards.push({ name: Actions.Pao, cards: canPaoData1 })

            this.noticeAllUserOnPao()

            this.timeout = setTimeout(() => {
                if (CardUtil.tiPaoCount(user.groupCards) >= 2) {
                    this.nextPlayCard(user) // 让user用户的下家出牌
                } else {
                    this.playerPlayCard(user)
                }
            }, 2000)
        } else {
            const canPaoData2 = CardUtil.canTi3(user.groupCards, this.player_card)
            if (canPaoData2) {
                // 组合牌里能跑 跑起操作
                canPaoData2.name = Actions.Pao
                canPaoData2.cards.push(this.player_card)

                this.noticeAllUserOnPao()

                this.timeout = setTimeout(() => {
                    if (CardUtil.tiPaoCount(user.groupCards) >= 2) {
                        this.nextPlayCard(user) // 让user用户的下家出牌
                    } else {
                        this.playerPlayCard(user)
                    }
                }, 2000)
            } else {
                // 这个玩家不能跑操作，循环检查下个玩家
                this.loopOtherUserCanPaoWithPlayerCard2()
            }
        }
    } else {
        // loop执行完了，没有玩家能跑，开始检查其他玩家能否碰
        this.checkOtherUserCanPengWithPlayerCard2()
    }
}


/**
 * 参见流程图 check20
 */
Room.prototype.checkOtherUserCanPengWithPlayerCard2 = function () {
    logger.info('check20 检查其他玩家手里牌 + player_card 是否能碰')
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            this.loopUsers = endUsers.concat(startUsers)
            this.loopUsers.shift()
            break
        }
    }
    this.loopOtherUserCanPengWithPlayerCard2()
}
Room.prototype.loopOtherUserCanPengWithPlayerCard2 = function () {
    const user = this.loopUsers.shift()
    if (user) {
        logger.info('检查', user.username, '能否碰这张牌', this.player_card)
        logger.info('不碰的牌', user.upCards)
        if (!CardUtil.hasCard(user.upCards, this.player_card)) {
            const canPengData = CardUtil.canPeng(user.handCards, this.player_card)
            if (canPengData) {
                logger.info(user.username, '可以碰这张牌 通知玩家要不要碰')
                // 通知玩家是否要碰
                this.feadback.send(user.username, {
                    route: 'onRoom',
                    name: Notifications.checkPeng,
                    data: { username: user.username, data: canPengData }
                }).thenOk((data) => {
                    logger.info(user.username, '选择了碰')
                    canPengData.forEach(card => {
                        CardUtil.deleteCard(user.handCards, card)
                    })
                    canPengData.push(this.player_card)
                    user.groupCards.push({ name: Actions.Peng, cards: canPengData })
                    this.noticeAllUserOnPeng()
                    this.timeout = setTimeout(() => {
                        this.playerPlayCard(user)
                    }, 2000)
                }).thenCancel(() => {
                    logger.info(user.username, '选择了不碰 或者 超时了')
                    user.upCards.push(this.player_card)
                    this.loopOtherUserCanPengWithPlayerCard2()
                })
            } else {
                logger.info(user.username, '不可以碰这张牌')
                this.loopOtherUserCanPengWithPlayerCard2()
            }
        } else {
            logger.info(user.username, '不能碰这张牌 因为该牌已经在pass牌中了')
            this.loopOtherUserCanPengWithPlayerCard2()
        }
    } else {
        // loop执行完了，没有其他玩家能碰, 判断出牌玩家能否吃
        this.checkNextUserCanChiWithPlayerCard2()
    }
}

/**
 * 参见流程图 check21
 */
Room.prototype.checkNextUserCanChiWithPlayerCard2 = function () {
    logger.info('check21 检查下家手里牌 + player_card 是否能吃')

    // 找到下家
    var nextUser
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            var orderUsers = endUsers.concat(startUsers)
            orderUsers.shift()
            if (orderUsers.length > 0) {
                nextUser = orderUsers[0]
            } else {
                nextUser = null
            }
            break
        }
    }

    if (nextUser) {
        logger.info('检查', nextUser.username, '能否吃这张牌', this.player_card)
        logger.info('不吃的牌', nextUser.ucCards)
        if (!CardUtil.hasCard(nextUser.ucCards, this.player_card)) {
            const canChiData = CardUtil.canChi(nextUser.handCards, this.player_card)
            if (canChiData) {
                logger.info(nextUser.username, '可以吃这张牌，通知玩家要不要吃')
                canChiData.forEach(canChiItem => {
                    canChiItem.cards.push(this.player_card)
                })
                // 通知出牌玩家是否要吃
                this.feadback.send(nextUser.username, {
                    route: 'onRoom',
                    name: Notifications.checkEat,
                    data: { username: nextUser.username, data: canChiData }
                }).thenOk((data) => {
                    logger.info(nextUser.username, '选择了吃牌')
                    nextUser.handCards.push(this.player_card)
                    data.forEach(group => {
                        group.cards.forEach(card => {
                            CardUtil.deleteCard(nextUser.handCards, card)
                        })
                        nextUser.groupCards.push(group)
                    })
                    if (data.length > 1) {
                        this.noticeAllUserOnBi()
                    } else {
                        this.noticeAllUserOnChi()
                    }
                    this.timeout = setTimeout(() => { this.playerPlayCard(nextUser) }, 2000)
                }).thenCancel(() => {
                    // 下家不想吃 或者 超时了
                    logger.info(nextUser.username, '选择了不吃 或者 超时了')
                    nextUser.ucCards.push(this.player_card)
                    this.passCard()
                })
            } else {
                // 下家不能吃
                logger.info(nextUser.username, '不可以吃这张牌')
                this.passCard()
            }
        } else {
            logger.info(nextUser.username, '不可以吃这张牌 因为已经在pass牌中')
            this.passCard()
        }
    } else {
        // 没有下家 执行下部操作
        this.passCard()
    }
}


/**
 * 通知所有玩家有准备操作
 */
Room.prototype.noticeAllUserOnReady = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onReady,
        data: { users: this.users }
    })
}
/**
 * 通知所有玩家有跑操作
 */
Room.prototype.noticeAllUserOnPao = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onPao,
        data: { users: this.users }
    })
}
/**
 * 通知所有玩家有提操作
 */
Room.prototype.noticeAllUserOnTi = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onTi,
        data: { users: this.users }
    })
}
/**
 * 通知所有玩家有碰操作
 */
Room.prototype.noticeAllUserOnPeng = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onPeng,
        data: { users: this.users }
    })
}
/**
 * 通知所有玩家有吃操作
 */
Room.prototype.noticeAllUserOnChi = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onEat,
        data: { users: this.users }
    })
}
/**
 * 通知所有玩家有比牌操作
 */
Room.prototype.noticeAllUserOnBi = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onBi,
        data: { users: this.users }
    })
}
/**
 * 通知所有玩家有偎操作
 */
Room.prototype.noticeAllUserOnWei = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onWei,
        data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
    })
}
Room.prototype.noticeAllUserOnNewCard = function (isOut) {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onNewCard,
        data: {
            users: this.users,
            pn: this.player.username,
            pc: this.player_card,
            cc: this.cards.length,
            io: isOut
        }
    })
}
Room.prototype.noticeAllUserOnWin = function (winData) {
    this.users.forEach(user => {
        user.isReady = false
    })

    // 看没有人放炮
    var countedTypes = _.countBy(winData.hts, function (c) { return c })
    var hasFangPao = false
    var gameOver = false

    // 看有没有人放炮
    if (countedTypes[3]) {
        hasFangPao = true
    }

    // 计算玩家胡息 TODO
    var winner, loser
    this.users.forEach(user => {
        if (user.username === winData.wn) {
            winner = user
            winner.hx += winData.thx
            if (winner.hx >= 100) {
                gameOver = true
            }
        } else {
            loser = user
            if (hasFangPao) {
                loser.hx -= winData.thx
            }
        }
    })

    if (gameOver) {
        // 一局游戏结束了 开始统计分数了
        // user1 {hx: 100}
        // user2 {hx: 63}
        var winnerHx = Math.round(winner.hx / 10) * 10
        var loserHx = Math.round(loser.hx / 10) * 10
        var winHx = winnerHx - loserHx
        var winScore = winHx * this.rule.xf
        var params = { winner: winner.username, loser: loser.username, score: winScore, rid: this.rule.id}
        axios.post('http://127.0.0.1:3008/update_score', params).catch(error => {})

        this.isGaming = false
        this.checkRelease()
    } else {
        // 一盘结束 游戏继续
        this.channel.pushMessage({
            route: 'onRoom',
            name: Notifications.onWin,
            data: { users: this.users, ...winData }
        })
    }
}
Room.prototype.noticeAllUserOnRoundEnd = function () {
    this.users.forEach(user => {
        user.isReady = false
    })

    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onRoundEnd,
        data: {
            users: this.users,
            zn: this.zhuang.username,
            zc: this.zhuang_card,
            pn: this.player.username,
            pc: this.player_card
        }
    })

    this.isGaming = false
    this.checkRelease()
}

Room.prototype.getStatus = function () {
    return {
        gaming: this.isGaming,
        users: this.users
    }
}

Room.prototype.checkRelease = function () {
    var members = this.channel.getMembers()
    if (!!members && members.length > 1) {
        this.users = []
        members.forEach(username => {
            this.addUser(username)
        })
    } else {
        this.channel.room.feadback.release()
        this.channel.room = null
        this.channel.destroy()
        this.channel = null
        clearTimeout(this.timeout)
        console.log('删除房间')
    }
}

module.exports = Room