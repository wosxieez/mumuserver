const CardUtil = require('../../../util/cardUtil')

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
	console.log(sid, roomname, roominfo, username, callback)
	var channel = this.channelService.getChannel(roomname, false)
	if (!!channel) {
		callback({ code: 400, error: '房间已经存在' })
	} else {
		channel = this.channelService.getChannel(roomname, true)
		console.log('创建房间' + roomname)

		// 初始化房间信息
		roominfo.users = []
		for (var i = 0; i < roominfo.count; i++) {
			roominfo.users.push({ username: null, handCards: [], groupCards: [], passCards: [], hasCheckTi: false })
		}
		roominfo.users[0].username = username

		roominfo.win_username = null                    // 赢的玩家
		roominfo.banker_username = null  				// 庄家名称
		roominfo.deal_username = null  					// 发牌者名称
		roominfo.deal_card = 0  						// 当前发的牌
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

			channel.pushMessage({ route: 'onNotification', name: Notifications.onJoinRoom, data: username })  // 通知其他用户
			callback({ code: 0, users: channel.getMembers() })

			// 人数满了 开始发牌
			if (channel.getMembers().length === channel.roominfo.count) {

				//------------------------------------------------------------------------------------------
				//	正式代码
				//------------------------------------------------------------------------------------------
				for (var i = 0; i < 20; i++) {
					for (var j = 0; j < channel.roominfo.users.length; j++) {
						channel.roominfo.users[j].handCards.push(channel.roominfo.cards.pop())
					}
				}
				//------------------------------------------------------------------------------------------

				//------------------------------------------------------------------------------------------
				//	测试代码
				//------------------------------------------------------------------------------------------
				channel.roominfo.users[1].handCards = [12, 13, 14, 15, 16]
				channel.roominfo.users[2].handCards = [12, 13, 14, 15, 16]
				channel.roominfo.cards.push(8)
				channel.roominfo.cards.push(13)
				channel.roominfo.users[0].groupCards = [{ name: 'chi', cards: [2, 3, 4] },
				{ name: 'chi', cards: [4, 5, 6] },
				{ name: 'chi', cards: [17, 18, 19] },
				{ name: 'chi', cards: [1, 2, 3] },
				{ name: 'chi', cards: [4, 5, 6] }]
				channel.roominfo.users[0].handCards = [8, 8, 8, 11, 11]

				// channel.roominfo.cards.push(1)
				// channel.roominfo.cards.push(1)
				// channel.roominfo.cards.push(1)
				// channel.roominfo.cards.push(2)
				// channel.roominfo.cards.push(2)
				// channel.roominfo.cards.push(2)
				// channel.roominfo.cards.push(3)
				// channel.roominfo.cards.push(3)
				// channel.roominfo.cards.push(3)
				// for (var j = 0; j < channel.roominfo.users.length; j++) {
				// 	channel.roominfo.users[j].groupCards = [{ name: 'peng', cards: [1, 1, 1] },
				// 	{ name: 'peng', cards: [12, 12, 12] },
				// 	{ name: 'peng', cards: [11, 11, 11] },
				// 	{ name: 'ti', cards: [13, 13, 13, 13]},
				// 	{ name: 'pao', cards: [12, 12, 12, 12] }]
				// 	channel.roominfo.users[j].handCards = [5, 6, 7, 8, 9, 10, 1, 1, 2, 2, 3, 3, 4, 4]
				// }
				//------------------------------------------------------------------------------------------

				// 随机选择一个庄=并且给庄家多发一张牌
				const banker = channel.roominfo.users[0] // 庄家
				const newcard = channel.roominfo.cards.pop()
				channel.roominfo.banker_username = banker.username
				banker.handCards.push(newcard)      // 庄家多发一张牌
				channel.roominfo.deal_card = newcard // 记录最后一张牌 用于告诉其他玩家 庄家最后一张牌是什么

				// 新的一轮开始了 通知每个玩家
				channel.pushMessage({ route: 'onNotification', name: Notifications.onNewRound, data: channel.roominfo })

				// 看庄家有没有能提的牌
				if (!banker.hasCheckTi) {
					banker.hasCheckTi = true // 起手提只检查一次
					const hasTiCards = CardUtil.hasTi(banker.handCards)
					if (!!hasTiCards) {
						console.log('发现庄稼可以提', hasTiCards)
						hasTiCards.forEach(group => {
							group.forEach(card => {
								deleteCard(banker.handCards, card)
							})
							banker.groupCards.push({ name: 'ti', cards: group })
							return group
						})

						// 通知有人提了
						channel.pushMessage({ route: 'onNotification', name: Notifications.onTi, data: channel.roominfo })

						setTimeout(() => {
							notificationUserCheckNewCard(channel, banker.username)
						}, 2000)
					} else {
						setTimeout(() => {
							notificationUserCheckNewCard(channel, banker.username)
						}, 2000)
					}
				} else {
					setTimeout(() => {
						notificationUserCheckNewCard(channel, banker.username)
					}, 500)
				}
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
					dealPoker(channel, username, card)
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
						deleteUserCard(channel, username, card)
						return card
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
					var canChiData = action.data[0]
					canChiData.forEach(card => {
						deleteUserCard(channel, username, card)
						return card
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
	callback()
}

/**
 * 通知玩家胡
 *
 * @param {*} channel
 * @param {*} username
 */
function notificationUserCheckHu(channel, username, canHuData) {
	channel.isWatingForHu = true
	channel.isWatingForHuUsername = username
	channel.pushMessage({ route: 'onNotification', name: Notifications.checkHu, data: { username: username, data: canHuData } })
	channel.isWatingForHuTimeoutID = setTimeout(notificationUserCheckHuTimeout.bind(null, channel, username), 5000)
}

function notificationUserCheckHuTimeout(channel, username) {
	// 胡牌超时了
	channel.isWatingForHu = false
	clearTimeout(channel.isWatingForHuTimeoutID)
	notificationUserCheckNewCard(channel, username)
}


/**
 * 通知玩家出牌
 *
 * @param {*} channel
 * @param {*} username
 */
function notificationUserCheckNewCard(channel, username) {
	channel.isWatingForNewCard = true
	channel.isWatingForNewCardUsername = username
	channel.pushMessage({ route: 'onNotification', name: Notifications.checkNewCard, data: { username: username, data: '请出牌' } })
	channel.isWatingForNewCardTimeoutID = setTimeout(notificationUserCheckNewCardTimeout.bind(null, channel, username), 5000)
}

function notificationUserCheckNewCardTimeout(channel, username) {
	// 出牌超时了
	channel.isWatingForNewCard = false
	clearTimeout(channel.isWatingForNewCardTimeoutID)
	const user = getUser(channel, username)
	const card = user.handCards[0]
	dealPoker(channel, username, card)
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

function deleteCard(cards, card) {
	for (var i = 0; i < cards.length; i++) {
		if (cards[i] == card) {
			cards.splice(i, 1)
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

		channel.pushMessage({ route: 'onNotification', name: Notifications.onLevelRoom, data: username })

		if (channel.getMembers().length === 0) {
			clearTimeout(channel.autoCheckTimeoutID)
			clearTimeout(channel.isWatingForNewCardTimeoutID)
			clearTimeout(channel.isWatingForHuTimeoutID)
			console.log('删除房间' + roomname)
			channel.destroy()
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

function prepareDealPoker(channel) {
	const nextCard = channel.roominfo.cards.pop()
	channel.nextUser.handCards.push(nextCard) // 发牌给下个玩家
	dealPoker(channel, channel.nextUser.username, nextCard)
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
	channel.dealCard = parseInt(card)
	channel.nextUser = channel.checkUsers[1] // 下一个出牌玩家

	channel.roominfo.deal_username = dealUser.username
	deleteCard(dealUser.handCards, card) // 从手中删除要出的牌
	channel.roominfo.deal_card = parseInt(card)  // 把出的牌放到桌上

	channel.pushMessage({ route: 'onNotification', name: Notifications.onNewCard, data: channel.roominfo })

	// 2s后 检查有没有玩家能 提/跑 / 偎
	setTimeout(autoCheckTiWei.bind(this, channel), 3000)
}


/**
 * 自动检查 提 / 跑 /  偎
 *
 * @param {*} channel
 */
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

/**
 * 自动检查胡/碰/吃
 *
 * @param {*} channel
 */
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
					}, 5000)
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
				channel.pushMessage({
					route: 'onNotification', name: Notifications.checkPeng,
					data: { username: channel.checkUsername, card: channel.roominfo.deal_card }
				})

				// 加一个超时操纵
				channel.autoCheckTimeoutID = setTimeout(() => {
					autoCheckHuPengChi(channel)
				}, 5000)
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
				channel.pushMessage({
					route: 'onNotification', name: Notifications.checkEat,
					data: { username: channel.checkUsername, card: channel.roominfo.deal_card }
				})

				// 加一个超时操纵
				channel.autoCheckTimeoutID = setTimeout(() => {
					autoCheckHuPengChi(channel)
				}, 5000)
			} else {
				console.log('吃已经检查完了 看来没玩家要这张牌了')
				channel.dealUser.passCards.push(channel.dealCard)
				if (channel.roominfo.cards.length > 0) {
					// 发牌给下家了 看下家有没有起手提
					if (!channel.nextUser.hasCheckTi) {
						console.log('发牌给下家了 看下家有没有起手提')
						channel.nextUser.hasCheckTi = true
						const hasTiCards = CardUtil.hasTi(channel.nextUser.handCards)
						if (!!hasTiCards) {
							console.log('发现下家可以提', hasTiCards)
							hasTiCards.forEach(group => {
								group.forEach(card => {
									deleteCard(channel.nextUser.handCards, card)
								})
								channel.nextUser.groupCards.push({ name: 'ti', cards: group })
								return group
							})

							// 通知有人提了
							console.log('通知玩家提', hasTiCards)
							channel.pushMessage({ route: 'onNotification', name: Notifications.onTi, data: channel.roominfo })

							setTimeout(prepareDealPoker.bind(null, channel), 2000)
						} else {
							console.log('发现下家不可以提', hasTiCards)
							prepareDealPoker(channel)
						}
					} else {
						console.log('下家已经起手提过了，不检查起手提了')
						prepareDealPoker(channel)
					}
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
	NewCard: 'newCard',         // 出牌
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
	onLevelRoom: 101, // 玩家离开通知
	onNewRound: 2,    // 开局通知
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
	checkEat: 13,     // 检查吃
	checkNewCard: 14, // 检查出牌
	checkHu: 15       // 检查胡
}