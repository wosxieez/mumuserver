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
    console.log('创建了一个跑得快Room')
    this.channel = channel
    this.rule = rule      //  玩法
    this.onGaming = false // 是否在局中
    this.isGaming = false // 是否正在游戏中
    this.users = []
    this.actionUsers = []
    this.player = null
    this.player_cards = []
    this.cards = []
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
/**
 *  check1
 */
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

/**
 * check2
 */
Room.prototype.gameStart = function () {
    logger.info('game start...')

    this.onGaming = true
    this.isGaming = true // 游戏开始

    this.initRoom()
    this.xiPai()
    this.faPai()

    this.channel.pushMessage({
        route: 'onRoom',
        name: Notifications.onGameStart,
        data: this.getStatus()
    })

    this.playerPlayCard(this.users[0])
}


/**
 * check3
 */
Room.prototype.initRoom = function () {
    logger.info('init room info')
    clearTimeout(this.timeout)
    this.actionUsers = []
    this.player = null
    this.player_cards = []
    this.users.forEach(user => {
        user.handCards = []
        user.groupCards = []
        user.passCards = []
        user.ucCards = [] // 不吃的牌
        user.upCards = [] // 不碰的牌
    })
}


/**
 *  check4
 */
Room.prototype.xiPai = function () {
    logger.info('Xi Pai...')
    this.cards = CardUtil.shufflePoker(CardUtil.generatePDKPoker())
}


/**
 * check5
 */
Room.prototype.faPai = function () {
    logger.info('Fa Pai...')

    // 删除多余的牌
    const more = (3 - this.users.length) * 16
    for (var m = 0; m < more; m++) {
        this.cards.pop()
    }

    console.log('发牌了...', this.cards)

    for (var i = 0; i < 16; i++) {
        for (var j = 0; j < this.users.length; j++) {
            this.users[j].handCards.push(this.cards.pop())
        }
    }
}

/**
 * check6
 */
Room.prototype.playerPlayCard = function (user) {
    logger.info('check6 player play card')
    if (CardUtil.hasValidaOutCards(user.handCards)) {
        this.actionUsers = [{ un: user.username, nd: { dt: '', ac: -1 } }]
        this.noticeAllUserOnAction()
        this.feadback.send(this.actionUsers)
            .thenOk(() => {
                if (this.actionUsers[0].nd.ac === 1) {
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
        pn: this.player ? this.player.username : null,
        pc: this.player_cards,
        us: this.users,
        aus: this.actionUsers,
        cc: this.cards.length,
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