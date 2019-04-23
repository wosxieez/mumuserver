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
    console.log('创建了一个跑胡子Room')
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
    this.ic = 0 // 记录这局中的第几把
    this.hc = 0 // 胡的牌

    this.isZhuangFirstOutCard = false
    this.feadback = new Feadback(channel)
    this.timeout = 0

    // test 1
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
    this.users.push({ username, hx: 0, dn: false, nf: 0, thx: 0, tjs: 0, ae: -1 })
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
    if (this.isGaming) return

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
// 玩家请求退出
//---------------------------------------------------------------------------------------------------------------
Room.prototype.askExit = function (username) {
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username != username) {
            this.users[i].ae = -1
        }
    }
    this.setExit(username, 1)
    if (this.channel) {
        this.channel.pushMessage({
            route: 'onRoom',
            name: Notifications.onAskExit,
            data: { ...this.users, an: username }
        })
    }
}

Room.prototype.setExit = function (username, ae) {
    this.getUser(username).ae = ae

    var agreeExit = true
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].ae != 1) {
            agreeExit = false
        }
    }
    if (agreeExit) {
        this.noticeAllUserOnExit()
    }
}

//---------------------------------------------------------------------------------------------------------------
// 检查游戏是否能开始
//---------------------------------------------------------------------------------------------------------------
Room.prototype.checkGameStart = function () {
    if (this.isGaming) return

    if (this.users.length < this.rule.cc) {
        return
    }

    for (var i = 0; i < this.users.length; i++) {
        if (!this.users[i].isReady) {
            return
        }
    }

    logger.info('game can start')

    this.gameStart()

}

Room.prototype.gameStart = function () {
    logger.info('game start...')
    this.ic++
    this.initRoom()
    this.xiPai()
    this.selectZhuang()
    this.onGaming = true
    this.isGaming = true // 游戏开始
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
    logger.info('init room info')
    clearTimeout(this.timeout)
    this.actionUsers = []
    if (!this.onGaming) { // 一局没有开始的话  初始化下庄
        this.zhuang = null
    }
    this.zhuang_card = 0
    this.isZhuangFirstOutCard = false
    this.player = null
    this.player_card = 0
    this.isOut = false

    this.users.forEach(user => {
        user.handCards = []
        user.groupCards = []
        user.passCards = []
        user.ucCards = [] // 不吃的牌
        user.upCards = [] // 不碰的牌
    })
}

Room.prototype.xiPai = function () {
    logger.info('Xi Pai...')
    this.cards = CardUtil.shufflePoker(CardUtil.generatePoker())
}

Room.prototype.selectZhuang = function () {
    if (this.onGaming) return  // 一局开始了就不选择庄了
    logger.info('Select Zhuang...')
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
    logger.info('Fa Pai...')

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
    logger.info('Fa Zhuang Pai...')
    this.zhuang_card = this.cards.pop()
    this.hc = this.zhuang_card
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

    this.checkZhuangCanHuWithZhuangCard()
}

/**
 * 参见流程图 check2
 */
Room.prototype.checkZhuangCanHuWithZhuangCard = function () {
    logger.info('check2')
    const canHuDatas = CardUtil.canHu(this.zhuang.handCards, this.zhuang.groupCards, this.zhuang_card)
    if (canHuDatas) {
        var maxHuXi = { hx: 0 }
        canHuDatas.forEach(canHuData => {
            const huXi = HuXiUtil.getHuXi(canHuData, HuActions.IsZhuangCard)
            if (huXi.hx > maxHuXi.hx) {
                maxHuXi = huXi
            }
        })
        if (maxHuXi.hx >= this.rule.hx) {
            this.noticeAllUserOnWin({ wn: this.zhuang.username, ...maxHuXi })
        } else {
            this.zhuangStart()
        }
    } else {
        this.zhuangStart()
    }
}

/**
 * 参考流程 Fun1
 */
Room.prototype.zhuangStart = function () {
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
        this.timeout = setTimeout(() => { this.nextPlayCard(this.zhuang) }, 1000)
    } else {
        this.nextPlayCard(this.zhuang)
    }
}

Room.prototype.zhuangPlayCard = function () {
    logger.info('Zhuang out card...')
    this.actionUsers = [{ un: this.zhuang.username, nd: { dt: 'oc', ac: -1 } }]
    this.noticeAllUserOnAction()
    this.feadback.send(this.actionUsers)
        .thenOk(() => {
            // 庄家出牌
            if (this.actionUsers[0].nd.ac === 1) {
                this.player_card = this.actionUsers[0].nd.dt
                this.hc = this.player_card
                this.player = this.zhuang
                this.actionUsers = []
                this.feadback.manualCancel()  // 手动取消反馈

                logger.info('Zhuang out card', this.player_card)
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
                this.hc = this.player_card
                this.player = this.zhuang
                this.actionUsers = []
                this.feadback.manualCancel()  // 手动取消反馈

                logger.info('Zhuang out card', this.player_card)
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
        }, 1000);
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
        const canHuDatas = CardUtil.canHu(user.handCards, user.groupCards, this.player_card)
        if (canHuDatas) {
            var maxHuData
            var maxHuXi = { hx: 0 }
            canHuDatas.forEach(canHuData => {
                const huXi = HuXiUtil.getHuXi(canHuData, HuActions.IsOtherFlopCard, this.cards.length === 0)
                if (huXi.hx > maxHuXi.hx) {
                    maxHuXi = huXi
                    maxHuData = canHuData
                }
            })
            if (maxHuXi.hx >= this.rule.hx) {
                this.actionUsers.push({ un: user.username, hd: { dt: { hc: maxHuData, hx: maxHuXi }, ac: -1 } })
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
            this.checkAllUserCanPaoWithPlayerCard()
        }
    }
}

/**
 * 参见流程图 check8
 */
Room.prototype.checkAllUserCanPaoWithPlayerCard = function () {
    logger.info('check8')
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            this.loopUsers = endUsers.concat(startUsers)
            break
        }
    }
    this.loopAllUserCanPaoWithPlayerCard()
}
Room.prototype.loopAllUserCanPaoWithPlayerCard = function () {
    const user = this.loopUsers.shift()
    if (user) {
        const canPaoData1 = CardUtil.canPaoHandCards(user.handCards, this.player_card)
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
                    }, 1000);
                } else {
                    this.playerPlayCard(user)
                }
            }, 1000);
        } else {
            const canPaoData2 = CardUtil.canPaoGroupCards(user.groupCards, this.player_card)
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
                        }, 1000);
                    } else {
                        this.playerPlayCard(user)
                    }
                }, 1000);
            } else {
                // 这个玩家不能跑操作，循环检查下个玩家
                this.loopAllUserCanPaoWithPlayerCard()
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
        logger.info('check', user.username, 'can peng', this.player_card)
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
    logger.info('check11')
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
        logger.info('check', nextUser.username, 'can chi', this.player_card)
        if (!CardUtil.hasCard(nextUser.ucCards, this.player_card)) {
            const canChiData = CardUtil.canChi(nextUser.handCards, this.player_card)
            if (canChiData) {
                logger.info(nextUser.username, 'can chi... notice user')
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
        }, 1000);
    }
}

Room.prototype.checkPengAction = function (aus) {
    // 检查碰响应的玩家
    console.log('check peng response:', aus)
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
    console.log('check chi response:', aus)
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
    console.log('check hu response:', aus)
    for (var i = 0; i < aus.length; i++) {
        if (aus[i].hd) {
            if (aus[i].hd.ac === 1) {
                // 玩家胡操作
                // aus[i] {un: 'wosxieez', hd: {dt: {hc: hdCards, hx: {hx: 15, thx: 30, hts: [1, 2, 3]}, ac: 1}}
                var user = this.getUser(aus[i].un)
                user.groupCards = aus[i].hd.dt.hc
                user.handCards = []
                this.actionUsers = []
                this.feadback.manualCancel()
                this.noticeAllUserOnWin({ wn: aus[i].un, ...aus[i].hd.dt.hx })
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

    this.checkAllUserCanPaoWithPlayerCard()
}

/**
 * 废牌操作
 */
Room.prototype.passCard = function () {
    logger.info('Pass card', this.player_card)
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
    logger.info('check23 Next user play card')

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
    this.hc = this.player_card
    logger.info('play card:', this.player_card)
    this.isOut = false
    this.noticeAllUserOnNewCard()
    this.checkPlayerUserCanTiWithPlayerCard()
}


/**
 * 翻牌玩家是否可以提
 * 参见流程图 check13
 */
Room.prototype.checkPlayerUserCanTiWithPlayerCard = function () {
    logger.info('check13 player can ti play card ?')
    const canTiData1 = CardUtil.canTiHandCards(this.player.handCards, this.player_card)
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
        }, 1000);
    } else {
        const canTiData2 = CardUtil.canTiGroupCards(this.player.groupCards, this.player_card)
        // 组合牌能提
        if (canTiData2) {
            this.timeout = setTimeout(() => {
                canTiData2.name = Actions.Ti
                canTiData2.cards.push(this.player_card)
                this.player_card = 0 // 翻的牌被提起来起来了
                this.noticeAllUserOnTi()
                this.checkPlayerUserCanHuWithPlayerCard3()
            }, 1000);
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
    logger.info('check14 player can wei play card ?')
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
        }, 1000);
    } else {
        this.checkPlayerUserCanHuWithPlayerCard()
    }
}

/**
 * 翻牌玩家是否可以胡
 * 参见流程图 check15
 */
Room.prototype.checkPlayerUserCanHuWithPlayerCard = function () {
    logger.info('check15 player can hu play card ?')
    this.actionUsers = []
    const canHuDatas = CardUtil.canHu(this.player.handCards, this.player.groupCards, this.player_card)
    if (canHuDatas) {
        var maxHuXi = { hx: 0 }
        var maxHuData
        canHuDatas.forEach(canHuData => {
            const huXi = HuXiUtil.getHuXi(canHuData, HuActions.IsMeFlopCard, this.cards.length === 0)
            if (huXi.hx > maxHuXi.hx) {
                maxHuXi = huXi
                maxHuData = canHuData
            }
        })
        if (maxHuXi.hx >= this.rule.hx) {
            this.actionUsers.push({ un: this.player.username, hd: { dt: { hc: maxHuData, hx: maxHuXi }, ac: -1 } })
        }
    }
    this.checkOtherUserCanHuWithPlayerCard()
}

/**
 * 翻牌玩家是否可以胡
 * 参见流程图 check16
 */
Room.prototype.checkPlayerUserCanHuWithPlayerCard2 = function () {
    logger.info('check16 player can hu play card?')
    const canHuDatas = CardUtil.canHu(this.player.handCards, this.player.groupCards, this.player_card) // 
    if (canHuDatas) {
        var maxHuXi = { hx: 0 }
        var maxHuData
        canHuDatas.forEach(canHuData => {
            const huXi = HuXiUtil.getHuXi(canHuData, HuActions.IsMeFlopCard, this.cards.length === 0)
            if (huXi.hx > maxHuXi.hx) {
                maxHuXi = huXi
                maxHuData = canHuData
            }
        })
        if (maxHuXi.hx >= this.rule.hx) {
            this.actionUsers = [{ un: this.player.username, hd: { dt: { hc: maxHuData, hx: maxHuXi }, ac: -1 } }]
            this.noticeAllUserOnAction()
            this.feadback.send(this.actionUsers)
                .thenOk(() => {
                    if (this.actionUsers[0].hd.ac === 1) {
                        // 翻牌玩家胡
                        this.player.groupCards = this.actionUsers[0].hd.dt.hc
                        this.player.handCards = []
                        this.actionUsers = []
                        this.feadback.manualCancel()
                        this.noticeAllUserOnWin({ wn: this.player.username, ...maxHuXi })
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
    logger.info('check24 player can hu play card ?')
    const canHuDatas = CardUtil.canHu(this.player.handCards, this.player.groupCards, this.player_card)
    if (canHuDatas) {
        var maxHuData
        var maxHuXi = { hx: 0 }
        canHuDatas.forEach(canHuData => {
            const huXi = HuXiUtil.getHuXi(canHuData, HuActions.IsMeFlopCard, this.cards.length === 0)
            if (huXi.hx > maxHuXi.hx) {
                maxHuXi = huXi
                maxHuData = canHuData
            }
        })
        if (maxHuXi.hx >= this.rule.hx) {
            this.actionUsers = [{ un: this.player.username, hd: { dt: { hc: maxHuData, hx: maxHuXi }, ac: -1 } }]
            this.noticeAllUserOnAction()
            this.feadback.send(this.actionUsers)
                .thenOk(() => {
                    if (this.actionUsers[0].hd.ac === 1) {
                        // 翻牌玩家胡
                        this.player.groupCards = this.actionUsers[0].hd.dt.hc
                        this.player.handCards = []
                        this.actionUsers = []
                        this.feadback.manualCancel()
                        this.noticeAllUserOnWin({ wn: this.player.username, ...maxHuXi })
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
        this.timeout = setTimeout(() => {
            this.nextPlayCard(this.player)
        }, 1000);
    } else {
        this.playerPlayCard(this.player)
    }
}


/**
 * 本人出牌
 * 参见流程图 check17
 */
Room.prototype.playerPlayCard = function (user) {
    logger.info('check17 Mine out card...')
    if (CardUtil.hasValidaOutCards(user.handCards)) {
        this.actionUsers = [{ un: user.username, nd: { dt: '', ac: -1 } }]
        this.noticeAllUserOnAction()
        this.feadback.send(this.actionUsers)
            .thenOk(() => {
                if (this.actionUsers[0].nd.ac === 1) {
                    logger.info('Mine out card', this.actionUsers[0].nd.dt)
                    this.player = user
                    this.player_card = this.actionUsers[0].nd.dt
                    this.hc = this.player_card
                    this.isZhuangFirstOutCard = false
                    this.player.ucCards.push(this.player_card)
                    this.player.upCards.push(this.player_card)
                    CardUtil.deleteCard(this.player.handCards, this.player_card)
                    this.isOut = true
                    this.actionUsers = []
                    this.feadback.manualCancel()
                    this.noticeAllUserOnNewCard()
                    this.checkOtherUserCanHuWithPlayerCard2()
                } else if (this.actionUsers[0].nd.ac === 0) {
                    // 超时了
                    const riffleCards = CardUtil.riffle(user.handCards)
                    const lastGroup = riffleCards.pop()
                    this.player = user
                    this.player_card = lastGroup.pop()
                    this.hc = this.player_card
                    this.isZhuangFirstOutCard = false
                    logger.info('Mine out card', this.player_card)
                    this.player.ucCards.push(this.player_card)
                    this.player.upCards.push(this.player_card)
                    CardUtil.deleteCard(this.player.handCards, this.player_card)
                    this.isOut = true
                    this.actionUsers = []
                    this.feadback.manualCancel()
                    this.noticeAllUserOnNewCard()
                    this.checkOtherUserCanHuWithPlayerCard2()
                } else {
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
    logger.info('check18')
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            this.loopUsers = endUsers.concat(startUsers)
            this.loopUsers.shift()
            break
        }
    }
    this.loopOtherUserCanHuWithPlayerCard2()
}
Room.prototype.loopOtherUserCanHuWithPlayerCard2 = function () {
    const user = this.loopUsers.shift()
    if (user) {
        const canHuDatas = CardUtil.canHu2(user.handCards, user.groupCards, this.player_card)
        if (canHuDatas) {
            var huAction
            if (this.isZhuangFirstOutCard) {
                huAction = HuActions.IsZhuangFirstOutCard
            } else {
                huAction = HuActions.IsOtherOutCard
            }
            var maxHuData
            var maxHuXi = { hx: 0 }
            canHuDatas.forEach(canHuData => {
                const huXi = HuXiUtil.getHuXi(canHuData, huAction)
                if (huXi.hx > maxHuXi.hx) {
                    maxHuXi = huXi
                    maxHuData = canHuData
                }
            })
            if (maxHuXi.hx >= this.rule.hx) {
                // 地胡 放炮胡 必须胡
                user.groupCards = maxHuData
                user.handCards = []
                this.noticeAllUserOnWin({ wn: user.username, ...maxHuXi })
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
    logger.info('check19')
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
        const canPaoData1 = CardUtil.canPaoHandCards(user.handCards, this.player_card)
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
                    }, 1000);
                } else {
                    this.playerPlayCard(user)
                }
            }, 1000);
        } else {
            const canPaoData2 = CardUtil.canPaoGroupCardsWithoutPeng(user.groupCards, this.player_card)
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
                        }, 1000);
                    } else {
                        this.playerPlayCard(user)
                    }
                }, 1000)
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
    logger.info('check20')
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
        logger.info('check', user.username, 'can peng', this.player_card)
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
    logger.info('check21')

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
        logger.info('check', nextUser.username, 'can chi', this.player_card)
        if (!CardUtil.hasCard(nextUser.ucCards, this.player_card)) {
            const canChiData = CardUtil.canChi(nextUser.handCards, this.player_card)
            if (canChiData) {
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
        }, 1000);
    }
}


Room.prototype.checkPengAction2 = function (aus) {
    // 检查碰响应的玩家
    console.log('check peng response:', aus)
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
    console.log('check chi response:', aus)
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
Room.prototype.noticeAllUserOnWin = function (wd) {
    // wd = {wn: 'wosxieez', hx: 15, thx: 30, hts: [2, 3, 4]}
    console.log('game win...', wd)
    this.isGaming = false
    this.zhuang = this.getUser(wd.wn) // 赢的玩家为庄
    // 看没有人放炮
    var countedTypes = _.countBy(wd.hts, function (c) { return c })
    var hasFangPao = false
    if (countedTypes[3]) {
        hasFangPao = true
    }
    // 计算玩家胡息 TODO
    var winner, loser
    this.users.forEach(user => {
        if (!!this.channel.getMember(user.username)) {
            user.isReady = false
        } else {
            // 一盘结束了 如果玩家不在线了，默认玩家准备就绪
            user.isReady = true
        }
        if (user.username === wd.wn) {
            winner = user
            if (hasFangPao) {
                winner.hx = wd.thx / 2
                winner.thx += winner.hx
            } else {
                winner.hx = wd.thx
                winner.thx += winner.hx
            }
            if (winner.thx >= 100) {
                this.onGaming = false
            }
        } else {
            // TODO
            loser = user
            if (hasFangPao) {
                loser.hx = -wd.thx / 2
                loser.thx += loser.hx
            }
        }
    })

    if (this.onGaming) { // 一局还在进行中
        // 发送一局结束的通知
        this.channel.pushMessage({
            route: 'onRoom',
            name: Notifications.onWin,
            data: { ...this.getStatus(), hn: wd.wn, hts: wd.hts, cs: this.cards }
        })

        if (this.rule.id === 0) {
            // 娱乐房一盘就结束游戏
            // this.onGaming = false
            // this.forceRelease()
        }
    } else {
        // user1 {thx: 100, hx: 30}
        // user2 {thx: 63,  hx: -30}
        // 一局结束了

        var winnerScore = Math.round(winner.thx / 10) * 10 * this.rule.xf
        var loserScore = 0
        if (loser) {
            if (loser.thx >= 0) {
                loserScore = Math.round(loser.thx / 10) * 10 * this.rule.xf
            } else {
                loserScore = -Math.round(-loser.thx / 10) * 10 * this.rule.xf
            }
        }
        var winnerNiaoScore = 0, loserNiaoScore = 0
        if (winner.dn) {
            winner.nf = this.rule.nf // 鸟分
            winnerNiaoScore = winner.nf
        }
        if (loser && loser.dn) {
            loser.nf = -this.rule.nf // 鸟分
            loserNiaoScore = loser.nf
        }
        var winScore = winnerScore + winnerNiaoScore - loserScore - loserNiaoScore
        if (winner) {
            winner.tjs = winScore
        }
        if (loser) {
            loser.tjs = -winScore
        }
        var params = {
            winner: winner.username,
            loser: loser ? loser.username : 'NULL USER',
            score: winScore, rid: this.rule.id,
            gid: this.channel.groupname.substr(5),
            rn: this.channel.name
        }


        if (this.rule.id === 0) {
            console.log('win...', winnerScore, winnerNiaoScore, loserScore, loserNiaoScore)
            axios.post('http://hefeixiaomu.com:3008/update_gold', params).catch(error => { })
        } else {
            console.log('win...', winnerScore, winnerNiaoScore, loserScore, loserNiaoScore)
            axios.post('http://hefeixiaomu.com:3008/update_score', params).catch(error => { })
        }

        // 发送一局结束的通知
        this.channel.pushMessage({
            route: 'onRoom',
            name: Notifications.onGameOver,
            data: { ...this.getStatus(), hn: wd.wn, hts: wd.hts, cs: this.cards }
        })
        this.forceRelease()
    }
}


Room.prototype.noticeAllUserOnExit = function () {
    console.log('ask for exit success')
    this.isGaming = false
    this.onGaming = false
    this.actionUsers = []

    // 计算玩家胡息 TODO
    var winner, loser
    var maxThx = -1000
    this.users.forEach(user => {
        if (user.thx >= maxThx) {
            winner = user
            maxThx = Math.max(maxThx, user.thx)
        }
    })
    this.users.forEach(user => {
        if (user.username !== winner.username) {
            loser = user
        }
    })
    // user1 {thx: 100}
    // user2 {thx: 63}
    // 一局结束了

    var winnerScore = Math.round(winner.thx / 10) * 10 * this.rule.xf
    var loserScore = 0
    if (loser) {
        if (loser.thx >= 0) {
            loserScore = Math.round(loser.thx / 10) * 10 * this.rule.xf
        } else {
            loserScore = -Math.round(-loser.thx / 10) * 10 * this.rule.xf
        }
    }
    var winnerNiaoScore = 0, loserNiaoScore = 0
    if (winner.dn) {
        winner.nf = this.rule.nf // 鸟分
        winnerNiaoScore = winner.nf
    }
    if (loser && loser.dn) {
        loser.nf = -this.rule.nf // 鸟分
        loserNiaoScore = loser.nf
    }
    var winScore = winnerScore + winnerNiaoScore - loserScore - loserNiaoScore
    if (winner) {
        winner.tjs = winScore
    }
    if (loser) {
        loser.tjs = -winScore
    }
    var params = {
        winner: winner.username,
        loser: loser ? loser.username : 'NULL USER',
        score: winScore, rid: this.rule.id,
        gid: this.channel.groupname.substr(5),
        rn: this.channel.name
    }

    if (this.rule.id === 0) {
        // 娱乐局不统计分数
        console.log('win...', winnerScore, winnerNiaoScore, loserScore, loserNiaoScore)
        axios.post('http://hefeixiaomu.com:3008/update_gold', params).catch(error => { })
    } else {
        console.log('win...', winnerScore, winnerNiaoScore, loserScore, loserNiaoScore)
        axios.post('http://hefeixiaomu.com:3008/update_score', params).catch(error => { })
    }

    // 发送一局结束的通知
    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onGameOver,
        data: { ...this.getStatus() }
    })
    this.forceRelease()
}

Room.prototype.noticeAllUserOnRoundEnd = function () {
    this.isGaming = false
    this.users.forEach(user => {
        if (!!this.channel.getMember(user.username)) {
            user.isReady = false
        } else {
            // 一盘结束了 如果玩家不在线了，默认玩家准备就绪
            user.isReady = true
        }
        if (user.username === this.zhuang.username) {
            user.hx = -10
            user.thx += user.hx
        } else {
            user.hx = 0
        }
    })

    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onRoundEnd,
        data: this.getStatus()
    })

    if (this.rule.id === 0) {
        // 娱乐房一盘就结束游戏
        // this.onGaming = false
        // this.forceRelease()
    }
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
        io: this.isOut,
        ic: this.ic,
        hc: this.hc
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
    console.log('room deleted')
}

module.exports = Room