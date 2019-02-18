module.exports = function (app) {
	return new RoomRemote(app)
}

var RoomRemote = function (app) {
	this.app = app
	this.channelService = app.get('channelService')
}

/**
 * 创建房间
 *
 * @param {*} sid
 * @param {*} roomname
 * @param {*} roominfo
 * @param {*} username
 * @param {*} callback
 */
RoomRemote.prototype.createRoom = function (sid, roomname, roominfo, username, callback) {
	var channel = this.channelService.getChannel(roomname, false)
	if (!!channel) {
		callback({ code: 400, error: '房间已经存在' })
	} else {
		channel = this.channelService.getChannel(roomname, true)
		console.log('创建房间' + roomname)

		// 生成房间的用户
		roominfo.users = []
		for (var i = 0; i < roominfo.count; i++) {
			roominfo.users.push({ username: null, cards: []})
		}
		roominfo.users[0].username = username

		// 生成房间的牌
		roominfo.cards = shufflePoker(generatePoker())

		console.log(roominfo.cards)

		channel.roominfo = roominfo
		channel.add(username, sid)
		callback({ code: 0, users: channel.getMembers() })
	}
}

/**
 * 加入房间
 *
 * @param {*} sid
 * @param {*} roomname
 * @param {*} username
 * @param {*} callback
 */
RoomRemote.prototype.joinRoom = function (sid, roomname, username, callback) {
	var channel = this.channelService.getChannel(roomname, false)
	if (!!channel) {
		if (channel.getMembers().length < channel.roominfo.count) {
			channel.add(username, sid)
			channel.roominfo.users.some(user => {
				if (!user.username) {
					user.username = username
					return true
				}
			})

			channel.pushMessage({ route: 'onJoinRoom', user: username }) // 通知其他用户
			callback({ code: 0, users: channel.getMembers() })

			if (channel.getMembers().length === channel.roominfo.count) {
				// 开始发牌
				for (var i = 0; i < 20; i++) {
					for (var j = 0; j < channel.roominfo.users.length; j++) {
						channel.roominfo.users[j].cards.push(channel.roominfo.cards.pop())
					}
				}
				
				// 发牌成功通知每个玩家
				channel.pushMessage({route: 'onNotification', name: CMD.Notifications.onNewRound, value: channel.roominfo})
			}
		}
		else {
			callback({ code: 402, error: '房间人数已满' })
		}
	} else {
		callback({ code: 401, error: '房间不存在' })
	}
}

RoomRemote.prototype.onCMD = function (cmd, callback) {
	switch (cmd.name) {
		case CMD.Actions.St: //  状态
			console.log(cmd.username)
			break
		default:
			break
	}
	callback()
}

/**
 * Kick user out chat channel.
 *
 * @param {String} uid unique id for user
 * @param {String} sid server id
 * @param {String} name channel name
 *
 */
RoomRemote.prototype.leaveRoom = function (sid, roomname, username, callback) {
	var channel = this.channelService.getChannel(roomname, false);
	// leave channel
	if (!!channel) {
		channel.leave(username, sid)
		channel.roominfo.users.some(user => {
			if (user.username === username) {
				user.username = null
				return true
			}
		})

		if (channel.getMembers().length === 0) {
			console.log('删除房间' + roomname)
			channel.destroy()
		} else {
			var param = {
				route: 'onLeaveRoom',
				user: username
			}
			channel.pushMessage(param)
		}
	}
	callback();
}


/**
 * 生成牌
 *
 * @returns
 */
function generatePoker() {
	var cardValue = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20']
	var allCards = []
	let card
	for (var j = 0; j < cardValue.length; j++) {
		card = cardValue[j]
		allCards.push(card)
		allCards.push(card)
		allCards.push(card)
		allCards.push(card)
	}
	return allCards
}

// 洗牌
function shufflePoker(arr) {
	if (!arr) {
		throw '错误，请传入正确数组';
	}
	var newArr = arr.slice(0);
	for (var i = newArr.length - 1; i >= 0; i--) {
		var randomIndex = Math.floor(Math.random() * (i + 1))
		var itemAtIndex = newArr[randomIndex]
		newArr[randomIndex] = newArr[i]
		newArr[i] = itemAtIndex
	}

	return newArr
}


function dealPoker(users, cards) {

}

var CMD = {}

CMD.Actions = {
	St: 'st',         // 状态
	Ti: "ti",         // 提
	Pao: "pao",       // 跑
	Wei: "wei",       // 偎
	Peng: "peng",     // 碰
	Hu: "hu",         // 胡牌
	Chi: "chi",       // 吃牌
	Cancel: "cancel", // 取消 
	Idle: "idle"      // 无操作
}

CMD.Notifications = {
	onJoinRoom: 1,    // 新玩家加入通知
	onNewRound: 2,    // 开局通知
	onDisCard: 3,    //等待玩家出牌
	onCard: 4,    // 玩家出的牌
	onEat: 5,    // 玩家吃牌
	onPeng: 11,    // 玩家碰牌
	onWei: 6,    // 玩家偎牌
	onWin: 7,    // 玩家胡牌
	onTi: 8,    // 玩家提牌
	onPao: 9,    // 玩家跑牌
	onNewCard: 10   // 新底牌
}