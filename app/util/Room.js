const CardUtil = require('./CardUtil')
const Notifications = require('./Notifications')
const Feadback = require('./Feadback')

function Room(channel, config) {
    this.channel = channel
    this.count = config.count
    this.users = []
    this.feadback = new Feadback(channel)
    this.timeout = 0
}

Room.prototype.release = function () {
    console.log('Room release')
    this.channel = null
    clearTimeout(this.timeout)
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
    if (this.users.length < this.count) {
        return
    }

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
        data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username, cc: this.cards.length }
    })

    this.timeout = setTimeout(this.checkAllUserCanHuWith3Ti5Kan.bind(this), 3000)
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
    console.log('check1')
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
    console.log('check2')
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
    console.log('Fun1')
    this.zhuang.handCards.push(this.zhuang_card)

    // 游戏正式开始 通知每个玩家
    this.channel.pushMessage({
        route: 'onNotification',
        name: Notifications.onGameStart,
        data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
    })

    this.timeout = setTimeout(this.checkZhuangCanTi.bind(this), 2000)
}

/**
 * 参见流程图 check3
 */
Room.prototype.checkZhuangCanTi = function () {
    console.log('check3')

    const hasTiCards = CardUtil.hasTi(this.zhuang.handCards)
    if (hasTiCards) {
        hasTiCards.forEach(group => {
            group.forEach(card => {
                CardUtil.deleteCard(this.zhuang.handCards, card)
            })
            this.zhuang.groupCards.push({ name: 'ti', cards: group })
        })

        this.noticeAllUserOnTi()

        // 参见流程图 check4
        console.log('check4')
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
    console.log('check5')

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
                    user.groupCards.push({ name: 'ti', cards: group })
                })
            }
        }
    })

    if (hasTi) {
        // 通知有人提了
        this.channel.pushMessage({
            route: 'onNotification',
            name: Notifications.onTi,
            data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
        })

        this.timeout = setTimeout(() => { this.nextPlayCard(this.zhuang) }, 2000)
    } else {
        this.nextPlayCard(this.zhuang)
    }
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
            // 庄家出牌
            this.player = this.zhuang
            this.player_card = data
            CardUtil.deleteCard(this.player.handCards, this.player_card)
            this.noticeAllUserOnNewCard()
            this.timeout = setTimeout(() => { this.checkXianCanTi2() }, 1000)
        })
        .thenCancel(() => {
            const riffleCards = CardUtil.riffle(this.zhuang.handCards)
            const lastGroup = riffleCards.pop()
            this.player_card = lastGroup.pop()
            this.player = this.zhuang
            CardUtil.deleteCard(this.player.handCards, this.player_card)
            this.noticeAllUserOnNewCard()
            this.timeout = setTimeout(() => { this.checkXianCanTi2() }, 1000)
        })
}

/**
 * 参见流程图 check6
 */
Room.prototype.checkXianCanTi2 = function () {
    console.log('check6')

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
                    user.groupCards.push({ name: 'ti', cards: group })
                })
            }
        }
    })

    if (hasTi) {
        // 通知有人提了
        this.channel.pushMessage({
            route: 'onNotification',
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
    console.log('check7')
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
        if (canHuData && canHuData[0]) {
            this.feadback.send(user.username,
                {
                    route: 'onNotification',
                    name: Notifications.checkHu,
                    data: { username: user.username, data: canHuData }
                })
                .thenOk((data) => {
                    // todo 胡牌操作
                    this.noticeAllUserOnWin()
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
    console.log('check8')
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
            user.groupCards.push({ name: 'pao', cards: canPaoData1 })

            // 有玩家跑操作
            this.channel.pushMessage({
                route: 'onNotification',
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
                canPaoData2.name = 'pao'
                canPaoData2.cards.push(this.player_card)

                // 有玩家跑操作
                this.channel.pushMessage({
                    route: 'onNotification',
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
    console.log('check9')
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
        console.log('检查', user.username, '能否碰这张牌', this.player_card)
        // 判断这张牌 在不在所有玩家的pass牌中，在的话就不能在碰了
        if (!this.isPassedCard(this.player_card)) {
            const canPengData = CardUtil.canPeng(user.handCards, this.player_card)
            if (canPengData) {
                // 通知玩家是否要碰
                console.log(user.username, '可以碰这张牌 通知玩家要不要碰')
                this.feadback.send(user.username, {
                    route: 'onNotification',
                    name: Notifications.checkPeng,
                    data: { username: user.username, data: canPengData }
                }).thenOk((data) => {
                    console.log(user.username, '选择了碰这张牌')
                    canPengData.forEach(card => {
                        CardUtil.deleteCard(user.handCards, card)
                    })
                    canPengData.push(this.player_card)
                    user.groupCards.push({ name: 'peng', cards: canPengData })
                    this.noticeAllUserOnPeng()
                    this.timeout = setTimeout(() => {
                        this.playerPlayCard(user)
                    }, 2000)
                }).thenCancel(() => {
                    console.log(user.username, '选择了不碰 或者 超时了')
                    this.loopOtherUserCanPengWithPlayerCard()
                })
            } else {
                console.log(user.username, '不可以碰这张牌')
                this.loopOtherUserCanPengWithPlayerCard()
            }
        } else {
            console.log(user.username, '不能碰这张牌 因为该牌在pass牌中')
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
    console.log('check10')
    console.log('检查', this.player.username, '能否吃这张牌', this.player_card)

    // 找到上家
    var preUser
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            var orderUsers = endUsers.concat(startUsers)
            orderUsers.shift()
            if (orderUsers.length > 0) {
                preUser = orderUsers.pop()
            } else {
                preUser = null
            }
            break
        }
    }

    var isPreUserPassedCard = false
    if (preUser && CardUtil.hasCard(preUser.passCards, this.player_card)) {
        isPreUserPassedCard = true 
    }

    // 不在自己 跟上家的pass牌中就可以吃
    if (!isPreUserPassedCard && CardUtil.hasCard(this.player.passCards, this.player_card)) {
        const canChiData = CardUtil.canChi(this.player.handCards, this.player_card)
        if (canChiData) {
            // 通知出牌玩家是否要吃
            console.log(this.player.username, '可以吃牌 通知玩家要不要吃牌')
            this.feadback.send(this.player.username, {
                route: 'onNotification',
                name: Notifications.checkEat,
                data: { username: this.player.username, data: canChiData }
            }).thenOk((data) => {
                console.log(this.player.username, '选择了吃牌')
                data.forEach(card => {
                    CardUtil.deleteCard(this.player.handCards, card)
                })
                data.push(this.player_card)
                this.player.groupCards.push({ name: 'chi', cards: data })
                this.noticeAllUserOnChi()
                this.timeout = setTimeout(() => { this.playerPlayCard(this.player) }, 2000)
            }).thenCancel(() => {
                // 出牌玩家不想吃 或者 超时了
                console.log(this.player.username, '选择了不吃牌 或者 超时了')
                this.checkNextUserCanChiWithPlayerCard()
            })
        } else {
            // 出牌玩家不能吃
            console.log(this.player.username, '不能吃牌')
            this.checkNextUserCanChiWithPlayerCard()
        }
    } else {
        console.log(this.player.username, '不能吃牌 因为已经在pass牌中')
        this.checkNextUserCanChiWithPlayerCard()
    }
}

/**
 * 参见流程图 check11
 */
Room.prototype.checkNextUserCanChiWithPlayerCard = function () {
    console.log('check11 检查下家手里牌 + player_card 是否能吃')

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
        console.log('检查', nextUser.username, '能否吃这张牌', this.player_card)
        // 这张牌不在 自己跟上家的pass牌中，才可以吃
        if (!CardUtil.hasCard(nextUser.passCards, this.player_card) &&
            !CardUtil.hasCard(this.player.passCards, this.player_card)) {
            const canChiData = CardUtil.canChi(nextUser.handCards, this.player_card)
            if (canChiData) {
                console.log(nextUser.username, '可以吃牌 通知用户要不要吃')
                // 通知出牌玩家是否要吃
                this.feadback.send(nextUser.username, {
                    route: 'onNotification',
                    name: Notifications.checkEat,
                    data: { username: nextUser.username, data: canChiData }
                }).thenOk((data) => {
                    console.log(nextUser.username, '选择了吃牌操作')
                    data.forEach(card => {
                        CardUtil.deleteCard(nextUser.handCards, card)
                    })
                    data.push(this.player_card)
                    nextUser.groupCards.push({ name: 'chi', cards: data })
                    this.noticeAllUserOnChi()
                    this.timeout = setTimeout(() => { this.playerPlayCard(nextUser) }, 2000)
                }).thenCancel(() => {
                    // 下家不想吃 或者 超时了
                    console.log(nextUser.username, '选择了不吃牌 或者 超时了')
                    this.passCard()
                })
            } else {
                // 下家不能吃
                this.passCard()
            }
        } else {
            console.log(nextUser.username, '不能吃了 因为该牌在废弃牌中')
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
    console.log('废牌操作', this.player_card)
    this.player.passCards.push(this.player_card)
    this.player_card = 0

    // 参见流程 check12
    console.log('check12')
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
    console.log('check23 下家翻牌')

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
    this.noticeAllUserOnNewCard()
    this.timeout = setTimeout(() => {
        this.checkPlayerUserCanTiWithPlayerCard()
    }, 2000)
}


/**
 * 翻牌玩家是否可以提
 * 参见流程图 check13
 */
Room.prototype.checkPlayerUserCanTiWithPlayerCard = function () {
    console.log('check13 翻牌玩家是否可以提')
    const canTiData1 = CardUtil.canTi(this.player.handCards, this.player_card)
    if (canTiData1) {
        canTiData1.forEach(card => {
            CardUtil.deleteCard(this.player.handCards, card)
        })
        canTiData1.push(this.player_card)
        this.player.groupCards.push({ name: 'ti', cards: canTiData1 })

        this.noticeAllUserOnTi()

        this.timeout = setTimeout(() => {
            // 参见流程 check22
            if (CardUtil.tiPaoCount(this.player.groupCards) >= 2) {
                this.nextPlayCard(this.player)
            } else {
                this.playerPlayCard(this.player)
            }
        }, 2000)
    } else {
        const canTiData2 = CardUtil.canTi2(this.player.groupCards, this.player_card)
        if (canTiData2) {
            canTiData2.name = 'ti'
            canTiData2.cards.push(this.player_card)

            this.noticeAllUserOnTi()

            // 参见流程 check22
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
    console.log('check14 翻牌玩家是否可以偎')
    const canWeiData = CardUtil.canWei(this.player.handCards, this.player_card)
    if (canWeiData) {
        canWeiData.forEach(card => {
            CardUtil.deleteCard(this.player.handCards, card)
        })
        canWeiData.push(this.player_card)
        this.player.groupCards.push({ name: 'wei', cards: canWeiData })

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
    console.log('check15 翻牌玩家是否可以胡')
    const canHuData = CardUtil.canHu(this.player.handCards, this.player.groupCards, this.player_card)
    if (canHuData) {
        // 通知翻牌玩家是否要胡
        this.feadback.send(this.player.username, {
            route: 'onNotification',
            name: Notifications.checkHu,
            data: { username: this.player.username, data: canHuData }
        }).thenOk((data) => {
            // todo 翻牌玩家胡牌操作
            this.noticeAllUserOnWin()
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
    console.log('check16 翻牌玩家是否可以胡')
    const canHuData = CardUtil.canHu(this.player.handCards, this.player.groupCards, this.player_card)
    if (canHuData) {
        // 通知翻牌玩家是否要胡
        this.feadback.send(this.player.username, {
            route: 'onNotification',
            name: Notifications.checkHu,
            data: { username: this.player.username, data: canHuData }
        }).thenOk((data) => {
            // todo 翻牌玩家胡牌操作
            this.noticeAllUserOnWin()
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
    console.log('check17 本人出牌')
    this.feadback.send(user.username,
        {
            route: 'onNotification',
            name: Notifications.checkNewCard,
            data: { username: user.username, data: 'oc' }
        })
        .thenOk((data) => {
            console.log('收到出牌', data)
            this.player = user
            this.player_card = data
            CardUtil.deleteCard(this.player.handCards, this.player_card)
            this.noticeAllUserOnNewCard()
            this.timeout = setTimeout(() => { this.checkOtherUserCanHuWithPlayerCard2() }, 2000);
        })
        .thenCancel(() => {
            console.log('取消或无反应')
            const riffleCards = CardUtil.riffle(user.handCards)
            const lastGroup = riffleCards.pop()
            this.player = user
            this.player_card = lastGroup.pop()
            CardUtil.deleteCard(this.player.handCards, this.player_card)
            this.noticeAllUserOnNewCard()
            this.timeout = setTimeout(() => {
                this.checkOtherUserCanHuWithPlayerCard2()
            }, 2000);
        })
}


/**
 * 参见流程图 check18
 */
Room.prototype.checkOtherUserCanHuWithPlayerCard2 = function () {
    console.log('check18 检查其他玩家手里牌 + player_card 是否胡牌', this.player.username)
    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.player.username) {
            var endUsers = this.users.slice(i)
            var startUsers = this.users.slice(0, i)
            this.loopUsers = endUsers.concat(startUsers)
            this.loopUsers.shift()
            break
        }
    }
    console.log(this.loopUsers)
    this.loopOtherUserCanHuWithPlayerCard2()
}
Room.prototype.loopOtherUserCanHuWithPlayerCard2 = function () {
    const user = this.loopUsers.shift()
    if (user) {
        const canHuData = CardUtil.canHu(user.handCards, user.groupCards, this.player_card)
        if (canHuData) {
            this.feadback.send(user.username,
                {
                    route: 'onNotification',
                    name: Notifications.checkHu,
                    data: { username: user.username, data: canHuData }
                })
                .thenOk((data) => {
                    // todo 胡牌操作
                    this.noticeAllUserOnWin()
                })
                .thenCancel(() => { this.loopOtherUserCanHuWithPlayerCard2() })
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
    console.log('check19 检查其他玩家手里牌 + player_card 是否能跑')
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
            user.groupCards.push({ name: 'pao', cards: canPaoData1 })

            this.noticeAllUserOnPao()

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
                canPaoData2.name = 'pao'
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
    console.log('check20 检查其他玩家手里牌 + player_card 是否能碰')
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
        console.log('检查', user.username, '能否碰这张牌', this.player_card)
        if (!this.isPassedCard(this.player_card)) {
            const canPengData = CardUtil.canPeng(user.handCards, this.player_card)
            if (canPengData) {
                console.log(user.username, '可以碰这张牌 通知玩家要不要碰')
                // 通知玩家是否要碰
                this.feadback.send(user.username, {
                    route: 'onNotification',
                    name: Notifications.checkPeng,
                    data: { username: user.username, data: canPengData }
                }).thenOk((data) => {
                    console.log(user.username, '选择了碰')
                    canPengData.forEach(card => {
                        CardUtil.deleteCard(user.handCards, card)
                    })
                    canPengData.push(this.player_card)
                    user.groupCards.push({ name: 'peng', cards: canPengData })
                    this.noticeAllUserOnPeng()
                    this.timeout = setTimeout(() => {
                        this.playerPlayCard(user)
                    }, 2000)
                }).thenCancel(() => {
                    console.log(user.username, '选择了不碰 或者 超时了')
                    this.loopOtherUserCanPengWithPlayerCard2()
                })
            } else {
                console.log(user.username, '不可以碰这张牌')
                this.loopOtherUserCanPengWithPlayerCard2()
            }
        } else {
            console.log(user.username, '不能碰这张牌 因为该牌已经在pass牌中了')
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
    console.log('check21 检查下家手里牌 + player_card 是否能吃')

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
        console.log('检查', nextUser.username, '能否吃这张牌', this.player_card)
        // 这张牌不在 自己跟上家的pass牌中，才可以吃
        if (!CardUtil.hasCard(nextUser.passCards, this.player_card) &&
            !CardUtil.hasCard(this.player.passCards, this.player_card)) {
            const canChiData = CardUtil.canChi(nextUser.handCards, this.player_card)
            if (canChiData) {
                console.log(nextUser.username, '可以吃这张牌，通知玩家要不要吃')
                // 通知出牌玩家是否要吃
                this.feadback.send(nextUser.username, {
                    route: 'onNotification',
                    name: Notifications.checkEat,
                    data: { username: nextUser.username, data: canChiData }
                }).thenOk((data) => {
                    console.log(nextUser.username, '选择了吃牌')
                    data.forEach(card => {
                        CardUtil.deleteCard(nextUser.handCards, card)
                    })
                    data.push(this.player_card)
                    nextUser.groupCards.push({ name: 'chi', cards: data })
                    this.noticeAllUserOnChi()
                    this.timeout = setTimeout(() => { this.playerPlayCard(nextUser) }, 2000)
                }).thenCancel(() => {
                    // 下家不想吃 或者 超时了
                    console.log(nextUser.username, '选择了不吃 或者 超时了')
                    this.passCard()
                })
            } else {
                // 下家不能吃
                console.log(nextUser.username, '不可以吃这张牌')
                this.passCard()
            }
        } else {
            console.log(nextUser.username, '不可以吃这张牌 因为已经在pass牌中')
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
        route: 'onNotification',
        name: Notifications.onReady,
        data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
    })
}
/**
 * 通知所有玩家有跑操作
 */
Room.prototype.noticeAllUserOnPao = function () {
    this.channel.pushMessage({
        route: 'onNotification',
        name: Notifications.onPao,
        data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
    })
}
/**
 * 通知所有玩家有提操作
 */
Room.prototype.noticeAllUserOnTi = function () {
    this.channel.pushMessage({
        route: 'onNotification',
        name: Notifications.onTi,
        data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
    })
}
/**
 * 通知所有玩家有碰操作
 */
Room.prototype.noticeAllUserOnPeng = function () {
    this.channel.pushMessage({
        route: 'onNotification',
        name: Notifications.onPeng,
        data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
    })
}
/**
 * 通知所有玩家有吃操作
 */
Room.prototype.noticeAllUserOnChi = function () {
    this.channel.pushMessage({
        route: 'onNotification',
        name: Notifications.onEat,
        data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
    })
}
/**
 * 通知所有玩家有偎操作
 */
Room.prototype.noticeAllUserOnWei = function () {
    this.channel.pushMessage({
        route: 'onNotification',
        name: Notifications.onWei,
        data: { users: this.users, zc: this.zhuang_card, zn: this.zhuang.username }
    })
}
Room.prototype.noticeAllUserOnNewCard = function () {
    this.channel.pushMessage({
        route: 'onNotification',
        name: Notifications.onNewCard,
        data: {
            users: this.users,
            zn: this.zhuang.username,
            zc: this.zhuang_card,
            pn: this.player.username,
            pc: this.player_card,
            cc: this.cards.length
        }
    })
}
Room.prototype.noticeAllUserOnWin = function () {
    this.users.forEach(user => {
        user.isReady = false
    })

    this.channel.pushMessage({
        route: 'onNotification',
        name: Notifications.onWin,
        data: {
            users: this.users,
            zn: this.zhuang.username,
            zc: this.zhuang_card,
            pn: this.player.username,
            pc: this.player_card
        }
    })
}
Room.prototype.noticeAllUserOnRoundEnd = function () {
    this.users.forEach(user => {
        user.isReady = false
    })

    this.channel.pushMessage({
        route: 'onNotification',
        name: Notifications.onRoundEnd,
        data: {
            users: this.users,
            zn: this.zhuang.username,
            zc: this.zhuang_card,
            pn: this.player.username,
            pc: this.player_card
        }
    })
}

Room.prototype.isPassedCard = function (card) {
    this.users.forEach(user => {
        if (CardUtil.hasCard(user.handCards, card)) {
            return true
        }
    })

    return false
}

module.exports = Room