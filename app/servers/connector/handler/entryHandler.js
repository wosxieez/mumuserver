module.exports = function (app) {
	return new Handler(app);
};

var Handler = function (app) {
	this.app = app;
	this.sessionService = this.app.get('sessionService')
};

var handler = Handler.prototype;


/**
 * 登录接口
 *
 * @param {*} msg
 * @param {*} session
 * @param {*} next
 */
handler.joinGroup = function (msg, session, next) {
	// 设置session
	const username = msg.username   // 用户名
	const groupname = 'group' + msg.groupid // 群名
	const sid = this.app.get('serverId')

	// 判断是否重复登录
	if (!!this.sessionService.getByUid(username)) {
		next(null, { code: 500, error: '重复加入' })
		console('用户重复加入')
		return
	}

	session.bind(username)
	session.on('closed', onSessionClosed.bind(null, this.app))
	session.set('username', username)
	session.push('username', function (err) {
		if (err) {
			console.error('set username for session service failed! error is : %j', err.stack)
		}
	})
	session.set('groupname', groupname)
	session.push('groupname', function (err) {
		if (err) {
			console.error('set groupname for session service failed! error is : %j', err.stack)
		}
	})

	this.app.rpc.chat.groupRemote.joinGroup(session, sid, groupname, username, function (result) {
		next(null, result)
	})
}

handler.leaveGroup = function (msg, session, next) {
	next(null, { code: 0, data: '离开成功' })
	setTimeout(() => {
		this.sessionService.kick(session.uid, '主动断开')
	}, 200)
}

/**
 *	加入房间
 *
 * @param {*} msg
 * @param {*} session
 * @param {*} next
 * @returns
 */
handler.joinRoom = function (msg, session, next) {
	const username = session.get('username')
	const sid = this.app.get('serverId')
	const roomname = 'room' + msg.id

	session.set('roomname', roomname)
	session.push('roomname', function (err) {
		if (err) {
			console.error('set roomname for session service failed! error is : %j', err.stack)
		}
	});

	this.app.rpc.chat.roomRemote.joinRoom(session, sid, roomname, username, msg, function (result) {
		next(null, result)
	})
}

handler.leaveRoom = function (msg, session, next) {
	const username = session.get('username')
	const roomname = session.get('roomname')
	const sid = this.app.get('serverId')

	session.set('roomname', null)
	session.push('roomname', function (err) {
		if (err) {
			console.error('set roomname for session service failed! error is : %j', err.stack)
		}
	})

	this.app.rpc.chat.roomRemote.leaveRoom(session, sid, roomname, username, function (result) {
		next(null, result)
	})
}

function onSessionClosed(app, session) {
	if (!session || !session.uid) {
		return;
	}

	const username = session.get('username')
	const sid = app.get('serverId')

	const roomname = session.get('roomname')
	if (roomname) {
		app.rpc.chat.roomRemote.leaveRoom(session, sid, roomname, username, function (result) { })
	}
	const groupname = session.get('groupname')
	if (groupname) {
		app.rpc.chat.groupRemote.leaveGroup(session, sid, groupname, username, function (result) { })
	}

	console.log(username, '已断开连接')
}