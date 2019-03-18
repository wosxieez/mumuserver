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
// 加入房间
//---------------------------------------------------------------------------------------------------------------
RoomRemote.prototype.joinRoom = function (sid, groupname, roomname, username, config, cb) {
	var channel = this.channelService.getChannel(roomname, false)
	if (!!channel) {
		const oldMember = channel.getMember(username)
		if (!!oldMember) {
			cb({ code: 0, data: '加入房间成功' })
			return
		}

		if (channel.getMembers().length < config.count) {
			const groupChannel = this.channelService.getChannel(groupname, false)
			if (groupChannel) {
				groupChannel.pushMessage({ route: 'onGroup', name: Notifications.onJoinRoom, data: { roomname, username } })  // 通知其他用户
			}
			channel.room.addUser(username)
			channel.add(username, sid)
			console.log(roomname, '当前前用户', channel.getMembers())
			cb({ code: 0, data: '加入房间成功' })
		}
		else {
			cb({ code: 402, data: '加入失败，房间人数已满' })
		}
	} else {
		// 当前群不存在 开始创建群
		channel = this.channelService.getChannel(roomname, true)
		channel.room = new Room(channel, config)

		const groupChannel = this.channelService.getChannel(groupname, false)
		if (groupChannel) {
			groupChannel.pushMessage({ route: 'onGroup', name: Notifications.onJoinRoom, data: { roomname, username } })  // 通知其他用户
		}

		channel.room.addUser(username)
		channel.add(username, sid)
		console.log(roomname, '当前前用户', channel.getMembers())
		cb({ code: 0, data: '创建房间成功' })
	}
}

//---------------------------------------------------------------------------------------------------------------
// 离开房间
//---------------------------------------------------------------------------------------------------------------
RoomRemote.prototype.leaveRoom = function (sid, groupname, roomname, username, cb) {
	var channel = this.channelService.getChannel(roomname, false)

	if (!!channel) {
		channel.leave(username, sid)

		// 通过群渠道通知
		const groupChannel = this.channelService.getChannel(groupname, false)
		if (groupChannel) {
			groupChannel.pushMessage({ route: 'onGroup', name: Notifications.onLeaveRoom, data: { roomname, username } })  // 通知其他用户
		}

		if (channel.getMembers().length === 0) {
			channel.room.feadback.release()
			channel.room.release()
			channel.room = null
			channel.destroy()
			console.log('删除房间' + roomname)
		}
	}

	cb({ code: 0, data: 'ok' })
}

//---------------------------------------------------------------------------------------------------------------
// 收到玩家指令
//---------------------------------------------------------------------------------------------------------------
RoomRemote.prototype.onAction = function (sid, groupname, roomname, username, action, cb) {
	var channel = this.channelService.getChannel(roomname, false)
	console.log('收到指令', action)
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