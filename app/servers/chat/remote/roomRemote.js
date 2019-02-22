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

		// 初始化房间信息
		roominfo.users = []
		for (var i = 0; i < roominfo.count; i++) {
			roominfo.users.push({ username: null, handCards: [], groupCards: [], passCards: [] })
		}
		roominfo.users[0].username = username

		roominfo.banker_username = null  				// 庄家名称
		roominfo.deal_username = null  					// 发牌者名称
		roominfo.deal_card = -1  						// 当前发的牌
		roominfo.cards = shufflePoker(generatePoker())  // 发牌洗牌

		channel.roominfo = roominfo
		channel.add(username, sid)
		callback({ code: 0, data: '房间创建成功' })
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

			channel.pushMessage({ route: 'onJoinRoom', user: username }) 				// 通知其他用户
			callback({ code: 0, users: channel.getMembers() })

			// 人数满了 开始发牌
			if (channel.getMembers().length === channel.roominfo.count) {
				for (var i = 0; i < 20; i++) {
					for (var j = 0; j < channel.roominfo.users.length; j++) {
						channel.roominfo.users[j].handCards.push(channel.roominfo.cards.pop())
					}
				}

				// 随机选择一个庄=并且给庄家多发一张牌
				channel.roominfo.banker_username = channel.roominfo.users[0].username
				channel.roominfo.users[0].handCards.push(channel.roominfo.cards.pop())      // 庄家多发一张牌

				// 发牌成功通知每个玩家
				channel.pushMessage({ route: 'onNotification', name: Notifications.onNewRound, data: channel.roominfo })
				channel.pushMessage({ route: 'onNotification', name: Notifications.checkSt, data: { username: channel.roominfo.users[0].username, data: '请出牌' } })
			}
		}
		else {
			callback({ code: 402, error: '房间人数已满' })
		}
	} else {
		callback({ code: 401, error: '房间不存在' })
	}
}

RoomRemote.prototype.onAction = function (sid, roomname, username, action, callback) {
	var channel = this.channelService.getChannel(roomname, false)
	if (!!channel) {
		switch (action.name) {
			case Actions.St: // 收到庄家的开始出牌指令
				const card = action.data
				dealPoker(channel, username, card)
				break
			case Actions.Cancel: // 收到玩家无操纵指令
				if (channel.checkUsername === username) {
					clearTimeout(channel.timeout)
					onRoomAutoCheck(channel)
				}
				break
			case Actions.Peng: // 收到玩家碰牌操纵
			if (channel.checkUsername === username) {
				clearTimeout(channel.timeout)
				// 把手中的牌拿出来 跟 桌上的牌组合放到 组合牌中去
				var canPengData = action.data
				canPengData.forEach(card => {
					deleteUserCard(channel, username, card)
					return card
				})
				canPengData.push(channel.roominfo.deal_card)
				getUser(channel, username).groupCards.push(canPengData)

				// 通知所有玩家有碰操纵 并通知玩家继续出牌
				channel.pushMessage({ route: 'onNotification', name: Notifications.onPeng, data: channel.roominfo })
				channel.pushMessage({ route: 'onNotification', name: Notifications.checkSt, data: { username: username, data: '请出牌' } })
			}
			default:
				break
		}
	}
	callback()
}

function getUser(channel, username) {
	var user 
	channel.roominfo.users.some(u => {
		if (u.username === username) {
			user = u
			return true
		}
	})
	return user
}

function deleteUserCard(channel, username, card) {
	const user = getUser(channel, username)
	for (var i = 0; i < user.handCards.length; i++) {
		if (user.handCards[i] === card) {
			user.handCards.splice(i, 1)
			break
		}
	}
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

// 生成牌
function generatePoker() {
	var cardValue = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
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

// 开始发牌 处理发牌逻辑
function dealPoker(channel, username, card) {
	// 玩家起了一张牌 设置好参数 让服务器自动对这轮进行判断
	console.log('发牌操作', username, card)

	var dealUser
	channel.checkUsers = []
	channel.checkStatus = null
	channel.checkUsername = null 
	for (var i = 0; i < channel.roominfo.users.length; i++) {
		if (channel.roominfo.users[i].username == username) {
			dealUser = channel.roominfo.users[i]
			var endUsers = channel.roominfo.users.slice(i)
			var startUsers = channel.roominfo.users.slice(0, i)
			channel.checkUsers = endUsers.concat(startUsers)
			channel.checkUsers.forEach(item => {
				console.log(item.username)
			})
			break
		}
	}
	channel.dealUser = dealUser // 当前出牌玩家
	channel.dealCard = card
	channel.nextUser = channel.checkUsers[1] // 下一个出牌玩家

	console.log('一轮玩家', channel.checkUsers)
	console.log('下个玩家', channel.nextUser)

	channel.roominfo.deal_username = dealUser.username
	for (var j = 0; j < dealUser.handCards.length; j++) {
		if (dealUser.handCards[j] == card) {
			dealUser.handCards.splice(j, 1) // 删除出的牌
		}
	}
	channel.roominfo.deal_card = card  // 把出的牌放到桌上

	channel.pushMessage({ route: 'onNotification', name: Notifications.onPoker, data: channel.roominfo })

	onRoomAutoCheck(channel)
}

function onRoomAutoCheck(channel) {
	console.log('自动检查处理')

	clearTimeout(channel.timeout)

	if (!channel.checkStatus) {
		channel.checkStatus = '检查碰'
		channel.checkUsernames = []
		for (var i = 0; i < channel.checkUsers.length; i++) {
			channel.checkUsernames.push(channel.checkUsers[i].username)
		}
	}

	switch (channel.checkStatus) {
		case '检查碰':
			console.log('正在检查碰', channel.checkStatus, channel.checkUsernames)
			if (channel.checkUsernames.length > 0) {
				// 如果还没有检查完的用户 继续检查
				channel.checkUsername = channel.checkUsernames.shift()
				channel.pushMessage({
					route: 'onNotification', name: Notifications.checkPeng,
					data: { username: channel.checkUsername, card: channel.roominfo.deal_card }
				})

				// 加一个超时操纵
				channel.timeout = setTimeout(() => {
					onRoomAutoCheck(channel)
				}, 5000)
			} else {
				// 碰已经检查完了 开始检查 吃
				channel.checkStatus = '检查吃'
				channel.checkUsernames = []
				for (var i = 0; i < channel.checkUsers.length; i++) {
					channel.checkUsernames.push(channel.checkUsers[i].username)
				}
				onRoomAutoCheck(channel)
			}
			break;
		case '检查吃':
		console.log('正在检查吃', channel.checkStatus, channel.checkUsernames)
			if (channel.checkUsernames.length > 0) {
				// 如果还没有检查完的用户 继续检查
				channel.checkUsername = channel.checkUsernames.shift()
				channel.pushMessage({
					route: 'onNotification', name: Notifications.checkEat,
					data: { username: channel.checkUsername, card: channel.roominfo.deal_card }
				})

				// 加一个超时操纵
				channel.timeout = setTimeout(() => {
					onRoomAutoCheck(channel)
				}, 5000)
			} else {
				// 吃已经检查完了 看来没玩家要这张牌了
				channel.dealUser.passCards.push(channel.dealCard)
				if (channel.roominfo.cards.length > 0) {
					const nextCard = channel.roominfo.cards.pop() 
					channel.nextUser.handCards.push(nextCard) // 发牌给下个玩家
					dealPoker(channel, channel.nextUser.username, nextCard)
				} else {
					// todo Game Over
					console.log('game over')
				}
			}
			break;
		default:
			break;
	}
}

var Actions = {
	St: 'st',         // 出牌
	Ti: "ti",         // 提
	Pao: "pao",       // 跑
	Wei: "wei",       // 偎
	Peng: "peng",     // 碰
	Hu: "hu",         // 胡牌
	Chi: "chi",       // 吃牌
	Cancel: "cancel", // 取消 
	Idle: "idle"      // 无操作
}

var Notifications = {
	onJoinRoom: 1,    // 新玩家加入通知
	onNewRound: 2,    // 开局通知
	onPoker: 99,      // 发牌操纵
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
	checkEat: 13,      // 检查吃
	checkSt: 14       // 检查出牌
}