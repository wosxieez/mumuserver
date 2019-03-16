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
    this.checkAllUserCanHuWith3Ti5Kan()
}

Room.prototype.initRoom = function () {
    console.log('初始化房间信息')
    this.winner_username = null
    this.zhuang_username = null
    this.zhuang_card = 0
    this.player_username = null
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
    this.zhuang_username = this.users[random].username

    for (var i = 0; i < this.users.length; i++) {
        if (this.users[i].username == this.zhuang_username) {
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
                .thenOk((data) => { }) // 用户确认回掉
                .thenCancel(() => { this.loopAllUserCanHuWithZhuangCard() })  // 用户取消 或 超时回调
        } else {
            this.loopAllUserCanHuWithZhuangCard()
        }
    } else {
        // loop执行完了执行下步操作 庄家操作
        this.zhuangStart()
    }
}

Room.prototype.zhuangStart = function () {
    console.log('庄家操作')
}

module.exports = Room