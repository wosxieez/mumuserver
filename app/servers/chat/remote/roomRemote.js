const CardUtil = require('../../../util/cardUtil')
const Actions = require('../../../util/Actions')
const Notifications = require('../../../util/Notifications')

module.exports = function (app) {
	return new RoomRemote(app)
}

var RoomRemote = function (app) {
	this.app = app
	this.channelService = app.get('channelService')
}

//---------------------------------------------------------------------------------------------------------------
// 加入房间
//---------------------------------------------------------------------------------------------------------------
RoomRemote.prototype.joinRoom = function (sid, groupname, roomname, username, roominfo, cb) {
	console.log('---------------------------服务器', this.app.get('serverId'), '---------------------------')
	console.log('joinRoom')

	var channel = this.channelService.getChannel(roomname, false)

	if (!!channel) {

		// 群已经存在了 看看群人数有没有满 
		// 人数没有满的话 可以加入
		// 人数如果已经满了的话 则无法加入
		if (channel.roominfo.users.length < channel.roominfo.count) {
			// 通过群渠道通知其他玩家有人加入房间了
			const groupChannel = this.channelService.getChannel(groupname, false)

			if (groupChannel) {
				groupChannel.pushMessage({ route: 'onGroup', name: Notifications.onJoinRoom, data: { roomname, username } })  // 通知其他用户
			}

			addUser(channel, username)
			channel.add(username, sid)
			console.log(sid, username, '已加入房间', roomname)
			console.log(roomname, '当前前用户', channel.getMembers())
			console.log('---------------------------------------------------------------------------')
			cb({ code: 0, data: '加入房间成功' })
		}
		else {
			console.log('---------------------------------------------------------------------------')
			cb({ code: 402, data: '加入失败，房间人数已满' })
		}
	} else {
		// 当前群不存在 开始创建群
		// channel.roominfo = {count: 3, users: [{username: 'wosxieez'}]}
		channel = this.channelService.getChannel(roomname, true)
		channel.roominfo = { count: roominfo.count, users: [] }

		addUser(channel, username)
		channel.add(username, sid)
		console.log(sid, username, '已创建房间', roomname)
		console.log(roomname, '当前前用户', channel.getMembers())
		console.log('---------------------------------------------------------------------------')
		cb({ code: 0, data: '创建房间成功' })
	}
}

//---------------------------------------------------------------------------------------------------------------
// 离开房间
//---------------------------------------------------------------------------------------------------------------
RoomRemote.prototype.leaveRoom = function (sid, groupname, roomname, username, cb) {
	console.log('---------------------------服务器', this.app.get('serverId'), '---------------------------')
	console.log('leaveRoom')

	var channel = this.channelService.getChannel(roomname, false)

	if (!!channel) {
		deleteUser(channel, username)
		channel.leave(username, sid)
		console.log(sid, username, '已离开房间', roomname)
		console.log(roomname, '当前前用户', channel.getMembers())

		// 通过群渠道通知
		const groupChannel = this.channelService.getChannel(groupname, false)
		if (groupChannel) {
			groupChannel.pushMessage({ route: 'onGroup', name: Notifications.onLeaveRoom, data: { roomname, username } })  // 通知其他用户
		}

		if (channel.getMembers().length === 0) {
			clearTimeout(channel.autoCheckTimeoutID)
			clearTimeout(channel.isWatingForNewCardTimeoutID)
			clearTimeout(channel.isWatingForHuTimeoutID)
			console.log('删除房间' + roomname)
			channel.destroy()
		}
	}

	console.log('---------------------------------------------------------------------------')
	cb({ code: 0, data: 'ok' })
}

//---------------------------------------------------------------------------------------------------------------
// 收到玩家指令
//---------------------------------------------------------------------------------------------------------------
RoomRemote.prototype.onAction = function (sid, groupname, roomname, username, action, cb) {
	console.log('---------------------------服务器', this.app.get('serverId'), '---------------------------')
	console.log('onAction')
	var channel = this.channelService.getChannel(roomname, false)

	if (!!channel) {
		switch (action.name) {
			case Actions.Ready: // 准备指令
				getUser(channel, username).isReady = action.data
				channel.pushMessage({ route: 'onNotification', name: Notifications.onReady, data: channel.roominfo })
				checkStart(channel)
				break
			case Actions.Hu: // 收到胡牌指令
				console.log('收到胡牌指令')
				console.log(action.data)

				if (username === channel.isWatingForHuUsername) {
					clearTimeout(channel.isWatingForHuTimeoutID)
					clearTimeout(channel.isWatingForNewCardTimeoutID)
					clearTimeout(channel.autoCheckTimeoutID)
					channel.roominfo.win_username = username
					const winUser = getUser(channel, username)
					winUser.groupCards = action.data[2]
					winUser.handCards = []
					// 通知所有玩家有碰操纵 并通知玩家继续出牌
					channel.pushMessage({ route: 'onNotification', name: Notifications.onWin, data: channel.roominfo })
				}
				break
			case Actions.NewCard: // 收到出牌指令

				if (channel.isWatingForNewCard && username === channel.isWatingForNewCardUsername) {
					clearTimeout(channel.isWatingForNewCardTimeoutID)
					channel.isWatingForNewCard = false
					const card = action.data
					dealPoker(channel, username, card, false)
				}
				break
			case Actions.Cancel: // 收到玩家无操纵指令

				// 无操作指令 会在  是否胡  是否吃/碰 的时候返回
				if (channel.isWatingForHu && username === channel.isWatingForHuUsername) {
					notificationUserCheckHuTimeout(channel, username)
				} else if (channel.checkUsername === username) {
					clearTimeout(channel.autoCheckTimeoutID)
					autoCheckHuPengChi(channel)
				}
				break
			case Actions.Peng: // 收到玩家碰牌操纵

				if (channel.checkUsername === username) {
					clearTimeout(channel.autoCheckTimeoutID)
					// 把手中的牌拿出来 跟 桌上的牌组合放到 组合牌中去
					var canPengData = action.data
					canPengData.forEach(card => {
						deleteCard(getUser(channel, username).handCards, card)
					})
					canPengData.push(channel.roominfo.deal_card)
					getUser(channel, username).groupCards.push({ name: 'peng', cards: canPengData })

					// 通知所有玩家有碰操纵 并通知玩家继续出牌
					channel.pushMessage({ route: 'onNotification', name: Notifications.onPeng, data: channel.roominfo })
					notificationUserCheckNewCard(channel, username)
				}
				break
			case Actions.Chi: // 收到玩家吃牌操纵

				if (channel.checkUsername === username) {
					clearTimeout(channel.autoCheckTimeoutID)
					// 把手中的牌拿出来 跟 桌上的牌组合放到 组合牌中去
					var canChiData = action.data
					canChiData.forEach(card => {
						deleteCard(getUser(channel, username).handCards, card)
					})
					canChiData.push(channel.roominfo.deal_card)
					getUser(channel, username).groupCards.push({ name: 'chi', cards: canChiData })

					// 通知所有玩家有吃操纵 并通知玩家继续出牌
					channel.pushMessage({ route: 'onNotification', name: Notifications.onEat, data: channel.roominfo })
					notificationUserCheckNewCard(channel, username)
				}
				break
			default:
				break
		}
	}

	console.log('---------------------------------------------------------------------------')
	cb({ code: 0, data: 'ok' })
}

//---------------------------------------------------------------------------------------------------------------
// 检查是否都准备好了  开局
//---------------------------------------------------------------------------------------------------------------
function checkStart(channel) {
	if (channel.roominfo.count !== channel.roominfo.users.length) {
		return
	}

	for (var i = 0; i < channel.roominfo.users.length; i++) {
		if (!channel.roominfo.users[i].isReady) {
			return
		}
	}

	startGame(channel)
}

//---------------------------------------------------------------------------------------------------------------
// 游戏开始
//---------------------------------------------------------------------------------------------------------------
function startGame(channel) {
	// 清除定时器
	clearTimeout(channel.autoCheckTimeoutID)
	clearTimeout(channel.isWatingForNewCardTimeoutID)
	clearTimeout(channel.isWatingForHuTimeoutID)

	// 初始化房间信息
	channel.roominfo.win_username = null                    // 赢的玩家
	channel.roominfo.banker_username = null  				// 庄家名称
	channel.roominfo.deal_username = null  					// 发牌者名称
	channel.roominfo.deal_card = 0  						// 当前发的牌
	channel.roominfo.cards = shufflePoker(generatePoker())  // 发牌洗牌

	channel.roominfo.users.forEach(user => {
		user.handCards = []
		user.groupCards = []
		user.passCards = []
		user.hasCheckTi = false
	})

	// 每家发20张牌
	for (var i = 0; i < 20; i++) {
		for (var j = 0; j < channel.roominfo.users.length; j++) {
			channel.roominfo.users[j].handCards.push(channel.roominfo.cards.pop())
		}
	}

	// 随机选择一个庄=并且给庄家多发一张牌
	const banker = channel.roominfo.users[0] // 庄家
	const newcard = channel.roominfo.cards.pop()
	channel.roominfo.banker_username = banker.username
	banker.handCards.push(newcard)      // 庄家多发一张牌
	channel.roominfo.deal_card = newcard // 记录最后一张牌 用于告诉其他玩家 庄家最后一张牌是什么

	// 新的一轮开始了 通知每个玩家
	channel.pushMessage({ route: 'onNotification', name: Notifications.onNewRound, data: channel.roominfo })

	// 看庄家有没有能提的牌
	setTimeout(() => {
		if (checkFirstTi(channel, banker)) {
			setTimeout(() => {
				notificationUserCheckNewCard(channel, banker.username)
			}, 2000)
		} else {
			notificationUserCheckNewCard(channel, banker.username)
		}
	}, 5000);
}

//---------------------------------------------------------------------------------------------------------------
// 检查玩家第一次提牌
//---------------------------------------------------------------------------------------------------------------
function checkFirstTi(channel, user) {
	if (!user) return false
	if (!user.hasCheckTi) {
		user.hasCheckTi = true

		const hasTiCards = CardUtil.hasTi(user.handCards)
		if (!!hasTiCards) {
			hasTiCards.forEach(group => {
				group.forEach(card => {
					deleteCard(user.handCards, card)
				})
				user.groupCards.push({ name: 'ti', cards: group })
			})

			// 通知有人提了
			channel.pushMessage({ route: 'onNotification', name: Notifications.onTi, data: channel.roominfo })

			return true
		} else {
			return false
		}
	} else {
		return false
	}
}

//---------------------------------------------------------------------------------------------------------------
// 发牌操作
//---------------------------------------------------------------------------------------------------------------
function dealPoker(channel, username, card, isPopCard) {
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
	channel.dealCard = parseInt(card)
	channel.nextUser = channel.checkUsers[1] // 下一个出牌玩家

	channel.roominfo.deal_username = dealUser.username
	deleteCard(dealUser.handCards, card) // 从手中删除要出的牌
	channel.roominfo.deal_card = parseInt(card)  // 把出的牌放到桌上

	channel.pushMessage({ route: 'onNotification', name: Notifications.onNewCard, data: channel.roominfo })

	// 如果不是翻开的牌，是自己出的牌，那么后续检查将不会检查自己
	if (!isPopCard) {
		channel.checkUsers.shift()
	}

	// 2s后 检查有没有玩家能 提/跑 / 偎
	setTimeout(autoCheckTiWei.bind(this, channel), 2000)
}


//---------------------------------------------------------------------------------------------------------------
// 自动检查 提 / 跑 /  偎
//---------------------------------------------------------------------------------------------------------------
function autoCheckTiWei(channel) {
	var canTiUser = null
	channel.checkUsers.some(user => {
		// 看手中的牌能不能 提 / 跑
		var canTiCards = CardUtil.canTi(user.handCards, channel.roominfo.deal_card)
		if (canTiCards) {
			canTiUser = user
			canTiCards.forEach(card => {
				deleteCard(canTiUser.handCards, card)
			})
			canTiCards.push(channel.roominfo.deal_card)
			console.log('发现手中牌能 提/跑', canTiCards)
			const isTi = user.username === channel.roominfo.deal_username
			canTiUser.groupCards.push({ name: isTi ? 'ti' : 'pao', cards: canTiCards })
			channel.pushMessage({ route: 'onNotification', name: isTi ? Notifications.onTi : Notifications.onPao, data: channel.roominfo })
			return true // 跳出循环
		}

		// 看组合牌中能不能 提 / 跑
		var canTiGroup = CardUtil.canTi2(user.groupCards, channel.roominfo.deal_card)
		if (canTiGroup) {
			canTiUser = user
			console.log('发现组合牌能 提/跑', canTiGroup)
			canTiGroup.cards.push(channel.roominfo.deal_card)
			const isTi = user.username === channel.roominfo.deal_username
			canTiGroup.name = isTi ? 'ti' : 'pao'
			channel.pushMessage({ route: 'onNotification', name: isTi ? Notifications.onTi : Notifications.onPao, data: channel.roominfo })
			return true // 跳出循环
		}

		// 自己的牌 有 偎 的必须 偎
		if (channel.roominfo.deal_username === user.username) {
			// 看手里牌中能不能 偎
			var canWeiCards = CardUtil.canWei(user.handCards, channel.roominfo.deal_card)
			if (canWeiCards) {
				canTiUser = user
				canWeiCards.forEach(card => {
					deleteCard(canTiUser.handCards, card)
				})
				canWeiCards.push(channel.roominfo.deal_card)
				console.log('发现手中牌能 偎', canWeiCards)
				canTiUser.groupCards.push({ name: 'wei', cards: canWeiCards })
				channel.pushMessage({ route: 'onNotification', name: Notifications.onWei, data: channel.roominfo })
				return true // 跳出循环
			}
		}
	})

	if (canTiUser) {
		// 在提/跑/偎 之后需要判断下能不能胡
		const canHuData = CardUtil.canHu(canTiUser.handCards, canTiUser.groupCards, 0)
		console.log('能否胡', canHuData)
		if (canHuData && canHuData[0]) {
			notificationUserCheckHu(channel, canTiUser.username, canHuData)
		} else {
			notificationUserCheckNewCard(channel, canTiUser.username)
		}
	} else {
		autoCheckHuPengChi(channel)
	}
}

//---------------------------------------------------------------------------------------------------------------
// 自动检查胡/碰/吃
//---------------------------------------------------------------------------------------------------------------
function autoCheckHuPengChi(channel) {
	console.log('自动检查处理')
	clearTimeout(channel.autoCheckTimeoutID)
	if (!channel.checkStatus) {
		channel.checkStatus = '检查胡'
		channel.checkUsernames = []
		for (var i = 0; i < channel.checkUsers.length; i++) {
			channel.checkUsernames.push(channel.checkUsers[i].username)
		}
	}

	switch (channel.checkStatus) {
		case '检查胡':
			console.log('正在检查胡', channel.checkStatus, channel.checkUsernames)
			if (channel.checkUsernames.length > 0) {
				// 如果还没有检查完的用户 继续检查
				channel.checkUsername = channel.checkUsernames.shift()
				const currentUser = getUser(channel, channel.checkUsername)
				if (currentUser) {
					autoCheckHuPengChi(channel)
					return
				}
				const canHuData = CardUtil.canHu(currentUser.handCards, currentUser.groupCards, channel.dealCard)
				if (canHuData && canHuData[0]) {
					// 通知玩家是否胡
					channel.pushMessage({
						route: 'onNotification', name: Notifications.checkHu,
						data: { username: channel.checkUsername, data: canHuData }
					})

					// 加一个超时操作
					channel.autoCheckTimeoutID = setTimeout(() => {
						autoCheckHuPengChi(channel)
					}, 15000)
				} else {
					autoCheckHuPengChi(channel)
				}
			} else {
				// 碰已经检查完了 开始检查 吃
				channel.checkStatus = '检查碰'
				channel.checkUsernames = []
				for (var i = 0; i < channel.checkUsers.length; i++) {
					channel.checkUsernames.push(channel.checkUsers[i].username)
				}
				autoCheckHuPengChi(channel)
			}
			break;
		case '检查碰':
			console.log('正在检查碰', channel.checkStatus, channel.checkUsernames)
			if (channel.checkUsernames.length > 0) {
				// 如果还没有检查完的用户 继续检查
				channel.checkUsername = channel.checkUsernames.shift()
				const currentUser = getUser(channel, channel.checkUsername)
				if (currentUser) {
					autoCheckHuPengChi(channel)
					return
				}
				const canPengData = CardUtil.canPeng(currentUser.handCards, channel.dealCard)
				if (!!canPengData) { // 如果能碰就去通知玩家
					channel.pushMessage({
						route: 'onNotification', name: Notifications.checkPeng,
						data: { username: channel.checkUsername, group: canPengData }
					})

					// 加一个超时操纵
					channel.autoCheckTimeoutID = setTimeout(() => {
						autoCheckHuPengChi(channel)
					}, 15000)
				} else {
					autoCheckHuPengChi(channel)
				}
			} else {
				// 碰已经检查完了 开始检查 吃
				channel.checkStatus = '检查吃'
				channel.checkUsernames = []
				for (var i = 0; i < channel.checkUsers.length; i++) {
					channel.checkUsernames.push(channel.checkUsers[i].username)
				}
				autoCheckHuPengChi(channel)
			}
			break;
		case '检查吃':
			console.log('正在检查吃', channel.checkStatus, channel.checkUsernames)
			if (channel.checkUsernames.length > 0) {
				// 如果还没有检查完的用户 继续检查
				channel.checkUsername = channel.checkUsernames.shift()
				const currentUser = getUser(channel, channel.checkUsername)
				if (currentUser) {
					autoCheckHuPengChi(channel)
					return
				}
				const canChiData = CardUtil.canChi(currentUser.handCards, channel.dealCard)
				if (!!canChiData && canChiData.length > 0) {
					channel.pushMessage({
						route: 'onNotification', name: Notifications.checkEat,
						data: { username: channel.checkUsername, groups: canChiData }
					})

					// 加一个超时操纵
					channel.autoCheckTimeoutID = setTimeout(() => {
						autoCheckHuPengChi(channel)
					}, 15000)
				} else {
					autoCheckHuPengChi(channel)
				}
			} else {
				console.log('吃已经检查完了 看来没玩家要这张牌了')
				channel.dealUser.passCards.push(channel.dealCard)
				if (channel.roominfo.cards.length > 0) {
					// 发牌给下家了 看下家有没有起手提
					if (checkFirstTi(channel, channel.nextUser)) {
						setTimeout(prepareDealPoker.bind(null, channel), 2000)
					} else {
						prepareDealPoker(channel)
					}
				} else {
					// todo Game Over
					gameOver(channel)
				}
			}
			break;
		default:
			break;
	}
}

function prepareDealPoker(channel) {
	const nextCard = channel.roominfo.cards.pop()
	channel.nextUser.handCards.push(nextCard) // 发牌给下个玩家
	dealPoker(channel, channel.nextUser.username, nextCard, true)
}

//---------------------------------------------------------------------------------------------------------------
// 一局游戏结束
//---------------------------------------------------------------------------------------------------------------
function gameOver(channel) {
	console.log('game over')

	// 初始玩家状态
	for (var i = 0; i < channel.roominfo.users.length; i++) {
		channel.roominfo.users[i].isReady = false
	}

	channel.pushMessage({
		route: 'onNotification', name: Notifications.onRoundEnd, data: channel.roominfo
	})
}

//---------------------------------------------------------------------------------------------------------------
// 通知玩家出牌
//---------------------------------------------------------------------------------------------------------------
function notificationUserCheckNewCard(channel, username) {
	channel.isWatingForNewCard = true
	channel.isWatingForNewCardUsername = username
	channel.pushMessage({ route: 'onNotification', name: Notifications.checkNewCard, data: { username: username, data: '请出牌' } })
	channel.isWatingForNewCardTimeoutID = setTimeout(notificationUserCheckNewCardTimeout.bind(null, channel, username), 15000)
}

function notificationUserCheckNewCardTimeout(channel, username) {
	// 出牌超时了
	channel.isWatingForNewCard = false
	clearTimeout(channel.isWatingForNewCardTimeoutID)
	const user = getUser(channel, username)
	const card = user.handCards[0]
	dealPoker(channel, username, card, false)
}

//---------------------------------------------------------------------------------------------------------------
// 通知玩家胡
//---------------------------------------------------------------------------------------------------------------
function notificationUserCheckHu(channel, username, canHuData) {
	channel.isWatingForHu = true
	channel.isWatingForHuUsername = username
	channel.pushMessage({ route: 'onNotification', name: Notifications.checkHu, data: { username: username, data: canHuData } })
	channel.isWatingForHuTimeoutID = setTimeout(notificationUserCheckHuTimeout.bind(null, channel, username), 15000)
}

function notificationUserCheckHuTimeout(channel, username) {
	// 胡牌超时了
	channel.isWatingForHu = false
	clearTimeout(channel.isWatingForHuTimeoutID)
	notificationUserCheckNewCard(channel, username)
}

//---------------------------------------------------------------------------------------------------------------
// 获取用户
//---------------------------------------------------------------------------------------------------------------
function getUser(channel, username) {
	for (var i = 0; i < channel.roominfo.users.length; i++) {
		if (channel.roominfo.users[i].username === username) {
			return channel.roominfo.users[i]
		}
	}
}

//---------------------------------------------------------------------------------------------------------------
// 添加用户
//---------------------------------------------------------------------------------------------------------------
function addUser(channel, username) {
	channel.roominfo.users.push({ username })
}

//---------------------------------------------------------------------------------------------------------------
// 删除用户
//---------------------------------------------------------------------------------------------------------------
function deleteUser(channel, username) {
	for (var i = 0; i < channel.roominfo.users.length; i++) {
		if (channel.roominfo.users[i].username === username) {
			channel.roominfo.users.splice(i, 1)
			return
		}
	}
}

//---------------------------------------------------------------------------------------------------------------
// 删除牌
//---------------------------------------------------------------------------------------------------------------
function deleteCard(cards, card) {
	for (var i = 0; i < cards.length; i++) {
		if (cards[i] == card) {
			cards.splice(i, 1)
			break
		}
	}
}

//---------------------------------------------------------------------------------------------------------------
// 生成牌
//---------------------------------------------------------------------------------------------------------------
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

//---------------------------------------------------------------------------------------------------------------
// 洗牌
//---------------------------------------------------------------------------------------------------------------
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
