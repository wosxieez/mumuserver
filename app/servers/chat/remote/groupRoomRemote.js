const Actions = require('../../../util/Actions')
const Notifications = require('../../../util/Notifications')
const Room = require('../../../util/Room')

module.exports = function (app) {
	return new GroupRoomRemote(app)
}

var GroupRoomRemote = function (app) {
	this.app = app
	this.channelService = app.get('channelService')
}


//---------------------------------------------------------------------------------------------------------------
// 加入群房间
//---------------------------------------------------------------------------------------------------------------
GroupRoomRemote.prototype.createGroupRoom = function (sid, groupname, username, config, cb) {
	var channel = this.channelService.getChannel(groupname, false)
	if (!!channel) {
		cb({ code: 402, data: '创建群房间失败，群房间已经存在' })
	} else {
		// 当前群不存在 开始创建群
		channel = this.channelService.getChannel(groupname, true)
		channel.room = new Room(channel, config)

		const groupChannel = this.channelService.getChannel(groupname, false)
		if (groupChannel) {
			groupChannel.pushMessage({ route: 'onGroupRoom', name: Notifications.onJoinRoom, data: { groupname, username } })  // 通知其他用户
		}

		channel.room.addUser(username)
		channel.add(username, sid)
		console.log(groupname, '当前前用户', channel.getMembers())
		cb({ code: 0, data: '创建群房间成功' })
	}
}

//---------------------------------------------------------------------------------------------------------------
// 加入群房间
//---------------------------------------------------------------------------------------------------------------
GroupRoomRemote.prototype.joinGroupRoom = function (sid, groupname, username, config, cb) {
	var channel = this.channelService.getChannel(groupname, false)
	if (!!channel) {
		// 用户已经在房间里了
		if (channel.room.hasUser(username)) {
			channel.add(username, sid)
			console.log(groupname, '加入群房间成功, 用户已经在群房间里了', channel.getMembers())
			cb({ code: 0, data: '加入群房间成功, 用户已经在群房间里了' })
			return
		}

		// 看人数有没有满
		if (channel.room.users.length < channel.room.count) {
			const groupChannel = this.channelService.getChannel(groupname, false)
			if (groupChannel) {
				groupChannel.pushMessage({ route: 'onGroupRoom', name: Notifications.onJoinRoom, data: { groupname, username } })  // 通知其他用户
			}
			channel.room.addUser(username)
			channel.add(username, sid)
			console.log(groupname, '当前前用户', channel.getMembers())
			cb({ code: 0, data: '加入群房间成功' })
		}
		else {
			console.log(groupname, '加入失败，群房间人数已满', channel.getMembers())
			cb({ code: 402, data: '加入失败，群房间人数已满' })
		}
	} else {
		console.log(groupname, '加入失败，群房间不存在')
		cb({ code: 402, data: '加入失败，群房间不存在' })
	}
}

GroupRoomRemote.prototype.resumeGroupRoom = function (sid, groupname, username, cb) {
	var channel = this.channelService.getChannel(groupname, false)
	if (!!channel) {
		// 用户已经在房间里了
		if (channel.room.hasUser(username)) {
			channel.room.resume()
			cb({ code: 0, data: '恢复群房间成功' })
			return
		}
	}

	cb({ code: 601, data: '恢复群房间失败' })
}

//---------------------------------------------------------------------------------------------------------------
// 离开房间
//---------------------------------------------------------------------------------------------------------------
GroupRoomRemote.prototype.leaveGroupRoom = function (sid, groupname, username, cb) {
	var channel = this.channelService.getChannel(groupname, false)

	if (!!channel) {
		channel.room.deleteUser(username)
		channel.leave(username, sid)

		// 通过群渠道通知
		const groupChannel = this.channelService.getChannel(groupname, false)
		if (groupChannel) {
			groupChannel.pushMessage({ route: 'onGroupRoom', name: Notifications.onLeaveRoom, data: { groupname, username } })  // 通知其他用户
		}

		if (channel.room.users.length === 0) {
			channel.room.feadback.release()
			channel.room.release()
			channel.room = null
			channel.destroy()
			console.log('删除群房间' + groupname)
		}
	}

	cb({ code: 0, data: '离开群房间成功' })
}

//---------------------------------------------------------------------------------------------------------------
// 收到玩家指令
//---------------------------------------------------------------------------------------------------------------
GroupRoomRemote.prototype.onAction = function (sid, groupname, username, action, cb) {
	var channel = this.channelService.getChannel(groupname, false)
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