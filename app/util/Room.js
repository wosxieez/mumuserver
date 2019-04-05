const CardUtil = require('./CardUtil')
const Notifications = require('./Notifications')
const HuXiUtil = require('./HuXiUtil')
const HuActions = require('./HuActions')
const Actions = require('./Actions')
const Feadback = require('./Feadback')
const logger = require('pomelo-logger').getLogger('pomelo', __filename);
const axios = require('axios')
const _ = require('underscore')

function Room(channel, rule) {
    this.channel = channel
    this.rule = rule      //  玩法
    this.onGaming = false // 是否在局中
    this.isGaming = false // 是否正在游戏中
    this.isOut = false
    this.users = []
    this.actionUsers = []
    this.zhuang = null
    this.zhuang_card = 0
    this.player = null
    this.player_card = 0
    this.cards = []

    this.isZhuangFirstOutCard = false
    this.feadback = new Feadback(channel)
    this.timeout = 0
    // var params = { winner: 'wosxieez', loser: 'wosxieez2', score: 100, gid: 2, rid: this.rule.id }
    // axios.post('http://127.0.0.1:3008/update_score', params).catch(error => {})
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
    if (this.isGaming || this.onGaming) {
        return
    }
    // 添加一个新的玩家
    // username 玩家用户名
    // hx       玩家这局的总胡息
    // dn       玩家是否打鸟
    this.users.push({ username, hx: 0, dn: false })
}

//---------------------------------------------------------------------------------------------------------------
// 删除用户从渠道
//---------------------------------------------------------------------------------------------------------------
Room.prototype.deleteUser = function (username) {
    if (this.isGaming || this.onGaming) {
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
Room.prototype.getUser = function (username) {
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username === username) {
            return this.users[i]
        }
    }
    return null
}

//---------------------------------------------------------------------------------------------------------------
// 获取当前正在交互的玩家
//---------------------------------------------------------------------------------------------------------------
Room.prototype.getActionUser = function (username) {
    if (!this.actionUsers) return null
    for (var i = 0; i < this.actionUsers.length; i++) {
        if (this.actionUsers[i].un === username) {
            return this.actionUsers[i]
        }
    }
    return null
}

//---------------------------------------------------------------------------------------------------------------
// 设置玩家准备
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
// 设置打鸟信息
//---------------------------------------------------------------------------------------------------------------
Room.prototype.setDaNiao = function (username, dn) {
    if (this.onGaming || this.isGaming) return

    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username === username) {
            this.users[i].dn = dn
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
    this.onGaming = true
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
        data: this.getStatus()
    })

    this.timeout = setTimeout(this.checkAllUserCanHuWith3Ti5Kan.bind(this), 1500)
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
            console.log('天胡必须胡')
            this.noticeAllUserOnWin()
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
    this.zhuang_card = 0

    // 游戏正式开始 通知每个玩家
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onGameStart,
        data: this.getStatus()
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
            data: this.getStatus()
        })

        // 提是服务器自动提的 所以需要有个延时
        this.timeout = setTimeout(() => { this.nextPlayCard(this.zhuang) }, 1500)
    } else {
        this.nextPlayCard(this.zhuang)
    }
}

Room.prototype.zhuangPlayCard = function () {
    logger.info('庄家出牌')
    this.actionUsers = [{ un: this.zhuang.username, nd: { dt: 'oc', ac: -1 } }]
    this.noticeAllUserOnAction()
    this.feadback.send(this.actionUsers)
        .thenOk(() => {
            // 庄家出牌
            if (this.actionUsers[0].nd.ac === 1) {
                this.player_card = this.actionUsers[0].nd.dt
                this.player = this.zhuang
                this.actionUsers = []
                this.feadback.manualCancel()  // 手动取消反馈

                logger.info('庄家出牌', this.player_card)
                this.player.ucCards.push(this.player_card)
                this.player.upCards.push(this.player_card)
                this.isZhuangFirstOutCard = true
                CardUtil.deleteCard(this.player.handCards, this.player_card)
                this.isOut = true
                this.noticeAllUserOnNewCard()
                this.checkXianCanTi2()
            } else {
                // 超时取消
                const riffleCards = CardUtil.riffle(this.zhuang.handCards)
                const lastGroup = riffleCards.pop()
                this.player_card = lastGroup.pop()
                this.player = this.zhuang
                this.actionUsers = []
                this.feadback.manualCancel()  // 手动取消反馈

                logger.info('庄家出牌', this.player_card)
                this.player.ucCards.push(this.player_card)
                this.player.upCards.push(this.player_card)
                this.isZhuangFirstOutCard = true
                CardUtil.deleteCard(this.player.handCards, this.player_card)
                this.isOut = true
                this.noticeAllUserOnNewCard()
                this.checkXianCanTi2()
            }
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
        this.timeout = setTimeout(() => {
            // 通知有人提了
            this.channel.pushMessage({
                route: 'onRoom',
                name: Notifications.onTi,
                data: this.getStatus()
            })
            this.checkOtherUserCanHuWithPlayerCard2()
        }, 1500);
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
                this.actionUsers.push({ un: user.username, hd: { dt: canHuData, ac: -1 } })
            }
        }
        this.loopOtherUserCanHuWithPlayerCard()
    } else {
        if (this.actionUsers.length > 0) {
            this.noticeAllUserOnAction()
            this.feadback.send(this.actionUsers)
                .thenOk(() => {
                    this.checkHuAction(this.actionUsers)
                })
        } else {
            this.checkOtherUserCanPaoWithPlayerCard()
        }
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
            this.timeout = setTimeout(() => {
                // 跑起操作
                canPaoData1.forEach(card => {
                    CardUtil.deleteCard(user.handCards, card)
                })
                canPaoData1.push(this.player_card)
                this.player_card = 0
                user.groupCards.push({ name: Actions.Pao, cards: canPaoData1 })

                // 有玩家跑操作
                this.channel.pushMessage({
                    route: 'onRoom',
                    name: Notifications.onPao,
                    data: this.getStatus()
                })

                if (CardUtil.tiPaoCount(user.groupCards) >= 2) {
                    this.timeout = setTimeout(() => {
                        this.nextPlayCard(user) // 让user用户的下家出牌
                    }, 1500);
                } else {
                    this.playerPlayCard(user)
                }
            }, 1500);
        } else {
            const canPaoData2 = CardUtil.canTi2(user.groupCards, this.player_card)
            if (canPaoData2) {
                // 组合牌里能跑 跑起操作
                this.timeout = setTimeout(() => {
                    canPaoData2.name = Actions.Pao
                    canPaoData2.cards.push(this.player_card)
                    this.player_card = 0

                    // 有玩家跑操作
                    this.channel.pushMessage({
                        route: 'onRoom',
                        name: Notifications.onPao,
                        data: this.getStatus()
                    })

                    if (CardUtil.tiPaoCount(user.groupCards) >= 2) {
                        this.timeout = setTimeout(() => {
                            this.nextPlayCard(user) // 让user用户的下家出牌
                        }, 1500);
                    } else {
                        this.playerPlayCard(user)
                    }
                }, 1500);
            } else {
                // 这个玩家不能跑操作，循环检查下个玩家
                this.loopOtherUserCanPaoWithPlayerCard()
            }
        }
    } else {
        // loop执行完了，没有玩家能跑，开始检查其他玩家能否碰
        for (var i = 0; i < this.users.length; i++) {
            if (this.users[i].username == this.player.username) {
                var endUsers = this.users.slice(i)
                var startUsers = this.users.slice(0, i)
                this.loopUsers = endUsers.concat(startUsers)
                break
            }
        }
        this.actionUsers = []
        this.loopUsers.forEach(user => {
            this.actionUsers.push({ un: user.username })
        })
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
                this.getActionUser(user.username).pd = { dt: canPengData, ac: -1 }
            }
        }
        this.loopOtherUserCanPengWithPlayerCard()
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
    if (!CardUtil.hasCard(this.player.ucCards, this.player_card)) {
        const canChiData = CardUtil.canChi(this.player.handCards, this.player_card)
        if (canChiData) {
            canChiData.forEach(canChiItem => {
                canChiItem.cards.push(this.player_card)
            })
            this.getActionUser(this.player.username).cd = { dt: canChiData, ac: -1 }
        }
    }
    this.checkNextUserCanChiWithPlayerCard()
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
                this.getActionUser(nextUser.username).cd = { dt: canChiData, ac: -1 }
            }
        }
    }

    for (var i = this.actionUsers.length - 1; i >= 0; i--) {
        if (!this.actionUsers[i].pd && !this.actionUsers[i].cd) {
            this.actionUsers.splice(i, 1)
        }
    }

    if (this.actionUsers.length > 0) {
        this.noticeAllUserOnAction()
        this.feadback.send(this.actionUsers)
            .thenOk(() => {
                this.checkPengAction(this.actionUsers)
            })
    } else {
        this.timeout = setTimeout(() => {
            this.passCard()
        }, 1500);
    }
}

Room.prototype.checkPengAction = function (aus) {
    // 检查碰响应的玩家
    console.log('检查碰响应的玩家', aus)
    for (var i = 0; i < aus.length; i++) {
        if (aus[i].pd) {
            if (aus[i].pd.ac === 1) {
                // 玩家碰操作
                var user = this.getUser(aus[i].un)
                aus[i].pd.dt.forEach(card => {
                    CardUtil.deleteCard(user.handCards, card)
                })
                aus[i].pd.dt.push(this.player_card)
                this.player_card = 0
                user.groupCards.push({ name: Actions.Peng, cards: aus[i].pd.dt })
                this.actionUsers = []
                this.feadback.manualCancel()
                this.noticeAllUserOnPeng()
                this.playerPlayCard(user)
                return
            } else if (aus[i].pd.ac === 0) {
                // 玩家不碰操作 继续判断下家
                var user = this.getUser(aus[i].un)
                user.upCards.push(this.player_card)
                continue
            } else {
                // 玩家没有响应 继续等待
                return
            }
        } else {

        }
    }

    this.checkChiAction(aus)
}

Room.prototype.checkChiAction = function (aus) {
    // 检查吃响应的玩家
    console.log('检查吃响应的玩家', aus)
    for (var i = 0; i < aus.length; i++) {
        if (aus[i].cd) {
            if (aus[i].cd.ac === 1) {
                // 玩家吃
                var user = this.getUser(aus[i].un)
                user.handCards.push(this.player_card)
                this.player_card = 0
                var data = aus[i].cd.dt
                data.forEach(group => {
                    group.cards.forEach(card => {
                        CardUtil.deleteCard(user.handCards, card)
                    })
                    user.groupCards.push(group)
                })
                this.actionUsers = []
                this.feadback.manualCancel()
                if (data.length > 1) {
                    this.noticeAllUserOnBi()
                } else {
                    this.noticeAllUserOnChi()
                }
                this.playerPlayCard(user)
                return
            } else if (aus[i].cd.ac === 0) {
                // 玩家不吃操作
                var user = this.getUser(aus[i].un)
                user.ucCards.push(this.player_card)
                continue
            } else {
                // 玩家没有响应 继续等待
                return
            }
        }
    }

    this.actionUsers = []
    this.feadback.manualCancel()

    // 没人选择吃碰
    this.passCard()
}

Room.prototype.checkHuAction = function (aus) {
    // 检查碰响应的玩家
    console.log('检查胡响应的玩家', aus)
    for (var i = 0; i < aus.length; i++) {
        if (aus[i].hd) {
            if (aus[i].hd.ac === 1) {
                // 玩家胡操作
                var user = this.getUser(aus[i].un)
                user.groupCards = aus[i].hd.dt
                user.handCards = []
                this.actionUsers = []
                this.feadback.manualCancel()
                this.noticeAllUserOnWin()
                return
            } else if (aus[i].hd.ac === 0) {
                // 玩家不胡操作 继续判断下家
                continue
            } else {
                // 玩家没有响应 继续等待
                return
            }
        } else {

        }
    }

    this.actionUsers = []
    this.feadback.manualCancel()

    this.checkOtherUserCanPaoWithPlayerCard()
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
    this.nextPlayCard(this.player)
}


/**
 *  下家出牌 
 *  参见流程图 check23
 */
Room.prototype.nextPlayCard = function (user) {
    logger.info('check23 下家翻牌')

    if (this.cards.length === 0) {
        this.noticeAllUserOnRoundEnd()
        return
    }

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
    this.isOut = false
    this.noticeAllUserOnNewCard()
    this.checkPlayerUserCanTiWithPlayerCard()
}


/**
 * 翻牌玩家是否可以提
 * 参见流程图 check13
 */
Room.prototype.checkPlayerUserCanTiWithPlayerCard = function () {
    logger.info('check13 翻牌玩家是否可以提')
    const canTiData1 = CardUtil.canTi(this.player.handCards, this.player_card)
    if (canTiData1) {
        // 如果能提 做个延时处理
        this.timeout = setTimeout(() => {
            canTiData1.forEach(card => {
                CardUtil.deleteCard(this.player.handCards, card)
            })
            canTiData1.push(this.player_card)
            this.player_card = 0 // 翻的牌被提起来了
            this.player.groupCards.push({ name: Actions.Ti, cards: canTiData1 })
            this.noticeAllUserOnTi()
            this.checkPlayerUserCanHuWithPlayerCard3()
        }, 1500);
    } else {
        const canTiData2 = CardUtil.canTi2(this.player.groupCards, this.player_card)
        if (canTiData2) {
            this.timeout = setTimeout(() => {
                canTiData2.name = Actions.Ti
                canTiData2.cards.push(this.player_card)
                this.player_card = 0 // 翻的牌被提起来了
                this.noticeAllUserOnTi()
                this.checkPlayerUserCanHuWithPlayerCard3()
            }, 1500);
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
        this.timeout = setTimeout(() => {
            canWeiData.forEach(card => {
                CardUtil.deleteCard(this.player.handCards, card)
            })
            canWeiData.push(this.player_card)
            this.player_card = 0 // 翻的牌被偎起来了
            this.player.groupCards.push({ name: Actions.Wei, cards: canWeiData })
            this.noticeAllUserOnWei()
            this.checkPlayerUserCanHuWithPlayerCard2()
        }, 1500);
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
    this.actionUsers = []
    const canHuData = CardUtil.canHu(this.player.handCards, this.player.groupCards, this.player_card)
    if (canHuData) {
        // 通知翻牌玩家是否要胡
        const huXi = HuXiUtil.getHuXi(canHuData, HuActions.IsMeFlopCard, this.cards.length === 0)
        logger.info('计算胡息', huXi.hx, '胡牌胡息', this.rule.hx)
        if (huXi.hx >= this.rule.hx) {
            this.actionUsers.push({ un: this.player.username, hd: { dt: '', ac: -1 } })
        }
    }
    this.checkOtherUserCanHuWithPlayerCard()
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
            this.actionUsers = [{ un: this.player.username, hd: { dt: canHuData, ac: -1 } }]
            this.noticeAllUserOnAction()
            this.feadback.send(this.actionUsers)
                .thenOk(() => {
                    if (this.actionUsers[0].hd.ac === 1) {
                        // 翻牌玩家胡
                        this.player.groupCards = this.actionUsers[0].hd.td
                        this.player.handCards = []
                        this.actionUsers = []
                        this.feadback.manualCancel()
                        this.noticeAllUserOnWin({ wn: this.player.username, ...huXi })
                    } else {
                        // 不胡
                        this.actionUsers = []
                        this.feadback.manualCancel()
                        this.playerPlayCard(this.player)
                    }
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
            this.actionUsers = [{ un: this.player.username, hd: { dt: canHuData, ac: -1 } }]
            this.noticeAllUserOnAction()
            this.feadback.send(this.actionUsers)
                .thenOk(() => {
                    if (this.actionUsers[0].hd.ac === 1) {
                        // 翻牌玩家胡
                        this.player.groupCards = this.actionUsers[0].hd.td
                        this.player.handCards = []
                        this.actionUsers = []
                        this.feadback.manualCancel()
                        this.noticeAllUserOnWin({ wn: this.player.username, ...huXi })
                    } else {
                        // 不胡
                        this.actionUsers = []
                        this.feadback.manualCancel()
                        this.checkTiPaoCount()
                    }
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
        this.actionUsers = [{ un: user.username, nd: { dt: '', ac: -1 } }]
        this.noticeAllUserOnAction()
        this.feadback.send(this.actionUsers)
            .thenOk(() => {
                if (this.actionUsers[0].nd.ac === 1) {
                    logger.info('收到出牌', this.actionUsers[0].nd.dt)
                    this.player = user
                    this.player_card = this.actionUsers[0].nd.dt
                    this.isZhuangFirstOutCard = false
                    this.player.ucCards.push(this.player_card)
                    this.player.upCards.push(this.player_card)
                    CardUtil.deleteCard(this.player.handCards, this.player_card)
                    this.isOut = true
                    this.actionUsers = []
                    this.feadback.manualCancel()
                    this.noticeAllUserOnNewCard()
                    this.checkOtherUserCanHuWithPlayerCard2()
                } else {
                    // 不出牌 不可能的
                    // 超时了
                    logger.info('取消或无反应')
                    const riffleCards = CardUtil.riffle(user.handCards)
                    const lastGroup = riffleCards.pop()
                    this.player = user
                    this.player_card = lastGroup.pop()
                    this.isZhuangFirstOutCard = false
                    logger.info('默认出的牌为', this.player_card)
                    this.player.ucCards.push(this.player_card)
                    this.player.upCards.push(this.player_card)
                    CardUtil.deleteCard(this.player.handCards, this.player_card)
                    this.isOut = true
                    this.actionUsers = []
                    this.noticeAllUserOnNewCard()
                    this.checkOtherUserCanHuWithPlayerCard2()
                }
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
                this.actionUsers = [{ un: user.username, hd: { dt: canHuData, ac: -1 } }]
                this.noticeAllUserOnAction()
                this.feadback.send(this.actionUsers)
                    .thenOk(() => {
                        if (this.actionUsers[0].hd.ac === 1) {
                            user.groupCards = canHuData
                            user.handCards = []
                            this.actionUsers = []
                            this.feadback.manualCancel()
                            this.noticeAllUserOnWin({ wn: user.username, ...huXi })
                        } else {
                            this.actionUsers = []
                            this.feadback.manualCancel()
                            this.loopOtherUserCanHuWithPlayerCard2()
                        }
                    })
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
            this.timeout = setTimeout(() => {
                canPaoData1.forEach(card => {
                    CardUtil.deleteCard(user.handCards, card)
                })
                canPaoData1.push(this.player_card)
                this.player_card = 0
                user.groupCards.push({ name: Actions.Pao, cards: canPaoData1 })
                this.noticeAllUserOnPao()
                if (CardUtil.tiPaoCount(user.groupCards) >= 2) {
                    this.timeout = setTimeout(() => {
                        this.nextPlayCard(user) // 让user用户的下家出牌
                    }, 1500);
                } else {
                    this.playerPlayCard(user)
                }
            }, 1500);
        } else {
            const canPaoData2 = CardUtil.canTi3(user.groupCards, this.player_card)
            if (canPaoData2) {
                // 组合牌里能跑 跑起操作
                canPaoData2.name = Actions.Pao
                canPaoData2.cards.push(this.player_card)
                this.player_card = 0
                this.noticeAllUserOnPao()

                this.timeout = setTimeout(() => {
                    if (CardUtil.tiPaoCount(user.groupCards) >= 2) {
                        this.timeout = setTimeout(() => {
                            this.nextPlayCard(user) // 让user用户的下家出牌
                        }, 1500);
                    } else {
                        this.playerPlayCard(user)
                    }
                }, 1500)
            } else {
                // 这个玩家不能跑操作，循环检查下个玩家
                this.loopOtherUserCanPaoWithPlayerCard2()
            }
        }
    } else {
        // loop执行完了，没有玩家能跑，开始检查其他玩家能否碰 吃
        for (var i = 0; i < this.users.length; i++) {
            if (this.users[i].username == this.player.username) {
                var endUsers = this.users.slice(i)
                var startUsers = this.users.slice(0, i)
                this.loopUsers = endUsers.concat(startUsers)
                this.loopUsers.shift() // 本人出牌就不检查自己了
                break
            }
        }
        this.actionUsers = []
        this.loopUsers.forEach(user => {
            this.actionUsers.push({ un: user.username })
        })

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
                this.getActionUser(user.username).pd = { dt: canPengData, ac: -1 }
            }
        }
        this.loopOtherUserCanPengWithPlayerCard2()
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
                this.getActionUser(nextUser.username).cd = { dt: canChiData, ac: -1 }
            }
        }
    }

    for (var i = this.actionUsers.length - 1; i >= 0; i--) {
        if (!this.actionUsers[i].pd && !this.actionUsers[i].cd) {
            this.actionUsers.splice(i, 1)
        }
    }

    if (this.actionUsers.length > 0) {
        this.noticeAllUserOnAction()
        this.feadback.send(this.actionUsers)
            .thenOk(() => {
                this.checkPengAction2(this.actionUsers)
            })
    } else {
        this.timeout = setTimeout(() => {
            this.passCard()
        }, 1500);
    }
}


Room.prototype.checkPengAction2 = function (aus) {
    // 检查碰响应的玩家
    console.log('检查碰响应的玩家', aus)
    for (var i = 0; i < aus.length; i++) {
        if (aus[i].pd) {
            if (aus[i].pd.ac === 1) {
                // 玩家碰操作
                var user = this.getUser(aus[i].un)
                aus[i].pd.dt.forEach(card => {
                    CardUtil.deleteCard(user.handCards, card)
                })
                aus[i].pd.dt.push(this.player_card)
                this.player_card = 0
                user.groupCards.push({ name: Actions.Peng, cards: aus[i].pd.dt })
                this.actionUsers = []
                this.feadback.manualCancel()
                this.noticeAllUserOnPeng()
                this.playerPlayCard(user)
                return
            } else if (aus[i].pd.ac === 0) {
                // 玩家不碰操作 继续判断下家
                var user = this.getUser(aus[i].un)
                user.upCards.push(this.player_card)
                continue
            } else {
                // 玩家没有响应 继续等待
                return
            }
        } else {

        }
    }

    this.checkChiAction2(aus)
}

Room.prototype.checkChiAction2 = function (aus) {
    // 检查吃响应的玩家
    console.log('检查吃响应的玩家', aus)
    for (var i = 0; i < aus.length; i++) {
        if (aus[i].cd) {
            if (aus[i].cd.ac === 1) {
                // 玩家吃
                var user = this.getUser(aus[i].un)
                user.handCards.push(this.player_card)
                this.player_card = 0
                var data = aus[i].cd.dt
                data.forEach(group => {
                    group.cards.forEach(card => {
                        CardUtil.deleteCard(user.handCards, card)
                    })
                    user.groupCards.push(group)
                })
                this.actionUsers = []
                this.feadback.manualCancel()
                if (data.length > 1) {
                    this.noticeAllUserOnBi()
                } else {
                    this.noticeAllUserOnChi()
                }
                this.playerPlayCard(user)
                return
            } else if (aus[i].cd.ac === 0) {
                // 玩家不吃操作
                var user = this.getUser(aus[i].un)
                user.ucCards.push(this.player_card)
                continue
            } else {
                // 玩家没有响应 继续等待
                return
            }
        }
    }

    this.actionUsers = []
    this.feadback.manualCancel()

    // 没人选择吃碰
    this.passCard()
}

/**
 * 通知所有玩家有准备操作
 */
Room.prototype.noticeAllUserOnReady = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onReady,
        data: this.getStatus()
    })
}
/**
 * 通知所有玩家有跑操作
 */
Room.prototype.noticeAllUserOnPao = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onPao,
        data: this.getStatus()
    })
}
/**
 * 通知所有玩家有提操作
 */
Room.prototype.noticeAllUserOnTi = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onTi,
        data: this.getStatus()
    })
}
/**
 * 通知所有玩家有碰操作
 */
Room.prototype.noticeAllUserOnPeng = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onPeng,
        data: this.getStatus()
    })
}
/**
 * 通知所有玩家有吃操作
 */
Room.prototype.noticeAllUserOnChi = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onEat,
        data: this.getStatus()
    })
}
/**
 * 通知所有玩家有比牌操作
 */
Room.prototype.noticeAllUserOnBi = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onBi,
        data: this.getStatus()
    })
}
/**
 * 通知所有玩家有偎操作
 */
Room.prototype.noticeAllUserOnWei = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onWei,
        data: this.getStatus()
    })
}
Room.prototype.noticeAllUserOnNewCard = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onNewCard,
        data: this.getStatus()
    })
}
Room.prototype.noticeAllUserOnAction = function () {
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onAction,
        data: this.getStatus()
    })
}
Room.prototype.noticeAllUserOnWin = function (winData) {
    this.users.forEach(user => {
        user.isReady = false
    })
    this.isGaming = false

    // console.log(winData)

    // 看没有人放炮
    // var countedTypes = _.countBy(winData.hts, function (c) { return c })
    // var hasFangPao = false
    // var gameOver = false

    // // 看有没有人放炮
    // if (countedTypes[3]) {
    //     hasFangPao = true
    // }

    // 计算玩家胡息 TODO
    // var winner, loser
    // this.users.forEach(user => {
    //     if (user.username === winData.wn) {
    //         winner = user
    //         winner.hx += winData.thx
    //         if (winner.hx >= 100) {
    //             gameOver = true
    //         }
    //     } else {
    //         loser = user
    //         if (hasFangPao) {
    //             loser.hx -= winData.thx
    //         }
    //     }
    // })

    // if (gameOver) {
    //     // 一局游戏结束了 开始统计分数了
    //     // user1 {hx: 100}
    //     // user2 {hx: 63}
    //     var winnerHx = Math.round(winner.hx / 10) * 10
    //     var loserHx = loser ? Math.round(loser.hx / 10) * 10 : 0
    //     var winHx = winnerHx - loserHx
    //     var winScore = winHx * this.rule.xf

    //     // var params = { winner: winner.username, loser: loser.username, score: winScore, rid: this.rule.id}
    //     // axios.post('http://127.0.0.1:3008/update_score', params).catch(error => {})
    // } 

    // 一盘结束 游戏继续
    this.onGaming = false
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onGameOver,
        data: { ...this.getStatus(), ...winData }
    })

    this.forceRelease()
}

Room.prototype.noticeAllUserOnRoundEnd = function () {
    this.users.forEach(user => {
        user.isReady = false
    })
    this.isGaming = false


    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onRoundEnd,
        data: this.getStatus()
    })

}

Room.prototype.getStatus = function () {
    var status = {
        og: this.onGaming,
        ig: this.isGaming,
        zn: this.zhuang ? this.zhuang.username : null,
        zc: this.zhuang_card,
        pn: this.player ? this.player.username : null,
        pc: this.player_card,
        us: this.users,
        aus: this.actionUsers,
        cc: this.cards.length,
        io: this.isOut
    }
    // console.log(status)
    return status
}

Room.prototype.forceRelease = function () {
    this.channel.room.feadback.release()
    this.channel.room = null
    this.channel.destroy()
    this.channel = null
    clearTimeout(this.timeout)
    console.log('删除房间')
}

module.exports = Room