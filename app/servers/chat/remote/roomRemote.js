const Actions = require('../../../util/Actions')
const Notifications = require('../../../util/Notifications')
const Room = require('../../../util/Room')

module.exports = function (app) {
	return new RoomRemote(app)
}

var RoomRemote = function (app) {
	this.app = app
	this.channelService = app.get('channelService')
}

//---------------------------------------------------------------------------------------------------------------
// 获取唯一的房间号 room123456
//---------------------------------------------------------------------------------------------------------------
RoomRemote.prototype.getRadom = function (groupname, num, cb) {
	var code = ''
	for (var i = 0; i < num; i++) {
		var radom = Math.floor(Math.random() * 10);
		code += radom;
	}

	var roomname = 'room' + parseInt(code)
	for (key in this.channelService.channels) {
		if (this.channelService.channels[key].name === roomname) {
			this.getRadom(groupname, num, cb)
			return
		}
	}

	cb(roomname)
}

//---------------------------------------------------------------------------------------------------------------
// 创建房间
//---------------------------------------------------------------------------------------------------------------
RoomRemote.prototype.createRoom = function (sid, groupname, roomname, username, rule, cb) {
	var channel = this.channelService.getChannel(roomname, false)
	if (!!channel) {
		// 创建已经存在了 创建房间失败
		console.log(username, roomname, '创建房间失败 房间已经存在')
		cb({ code: 402, data: '创建房间失败 房间已经存在' })
	} else {
		// 房间不存在 开始创建房间
		channel = this.channelService.getChannel(roomname, true)
		channel.room = new Room(channel, rule)
		channel.groupname = groupname
		channel.room.addUser(username)
		channel.add(username, sid)
		this.notificationStatus(groupname)
		console.log(username, roomname, '创建房间成功')
		cb({ code: 0, data: '创建房间成功' })
	}
}

//---------------------------------------------------------------------------------------------------------------
// 加入房间
//---------------------------------------------------------------------------------------------------------------
RoomRemote.prototype.joinRoom = function (sid, groupname, roomname, username, cb) {
	var channel = this.channelService.getChannel(roomname, false)
	if (!!channel) {
		// 用户已经在房间里了
		if (channel.room.hasUser(username)) {
			channel.add(username, sid)
			console.log(username, roomname, '加入房间成功, 用户已经在房间里了')
			cb({ code: 0, data: '加入房间成功' })
			return
		}

		// 看人数有没有满
		if (channel.room.users.length < channel.room.count) {
			channel.room.addUser(username)
			channel.add(username, sid)
			this.notificationStatus(groupname)
			console.log(username, roomname, '加入房间成功')
			cb({ code: 0, data: '加入房间成功' })
		}
		else {
			console.log(username, roomname, '加入失败，房间人数已满')
			cb({ code: 402, data: '加入失败，房间人数已满' })
		}
	} else {
		// 房间不存在 加入房间失败
		console.log(username, roomname, '加入房间失败，房间不存在')
		cb({ code: 403, data: '加入房间失败，房间不存在' })
	}
}

//---------------------------------------------------------------------------------------------------------------
// 恢复房间
//---------------------------------------------------------------------------------------------------------------
RoomRemote.prototype.resumeRoom = function (sid, groupname, roomname, username, cb) {
	var channel = this.channelService.getChannel(roomname, false)
	if (!!channel) {
		// 用户已经在房间里了
		if (channel.room.hasUser(username)) {
			channel.room.resume()
			cb({ code: 0, data: '恢复房间成功' })
			return
		}
	}

	cb({ code: 601, data: '恢复房间失败' })
}

//---------------------------------------------------------------------------------------------------------------
// 离开房间
//---------------------------------------------------------------------------------------------------------------
RoomRemote.prototype.leaveRoom = function (sid, groupname, roomname, username, cb) {
	var channel = this.channelService.getChannel(roomname, false)
	if (!!channel) {
		channel.room.deleteUser(username)
		channel.leave(username, sid)
		console.log(username, roomname, '离开房间成功')
		if (channel.room.users.length === 0) {
			channel.room.feadback.release()
			channel.room.release()
			channel.room = null
			channel.destroy()
			console.log('删除房间' + roomname)
		}
		this.notificationStatus(groupname)
	}
	cb({ code: 0, data: '离开房间成功' })
}

//---------------------------------------------------------------------------------------------------------------
// 收到玩家指令
//---------------------------------------------------------------------------------------------------------------
RoomRemote.prototype.onAction = function (sid, groupname, roomname, username, action, cb) {
	var channel = this.channelService.getChannel(roomname, false)
	console.log('收到指令', username, action)
	if (!!channel) {
		switch (action.name) {
			case Actions.Ready:
				channel.room.setReady(username, action.data)
				channel.room.checkGameStart()
				break
			case Actions.Hu:
			case Actions.NewCard:
			case Actions.Peng:
			case Actions.Chi:
				channel.room.feadback.doOk(username, action.data)
				break
			case Actions.Cancel:
				channel.room.feadback.doCancel(username)
				break
			default:
				break
		}
	}
	// console.log('---------------------------------------------------------------------------')
	cb({ code: 0, data: 'ok' })
}

//---------------------------------------------------------------------------------------------------------------
//  通知状态
//---------------------------------------------------------------------------------------------------------------

RoomRemote.prototype.notificationStatus = function (groupname) {
	const groupChannel = this.channelService.getChannel(groupname, false)
	if (groupChannel) {
		groupChannel.pushMessage({ route: 'onGroup', name: Notifications.onRoomStatus, data: this.getStatus(groupname) })
	}
	console.log('通知状态...')
}

RoomRemote.prototype.getStatus = function (groupname) {
	var status = []
	var channel
	var room
	for (key in this.channelService.channels) {
		channel = this.channelService.channels[key]
		if (channel && channel.groupname === groupname) {
			room = { name: channel.name, rid: channel.room.rule.id, users: [] }
			channel.room.users.forEach(user => {
				room.users.push(user.username)
			})
			status.push(room)
		}
	}
	console.log('获取状态', status)
	return status
}