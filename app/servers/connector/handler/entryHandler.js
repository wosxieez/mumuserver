module.exports = function (app) {
	return new Handler(app);
};

var Handler = function (app) {
	this.app = app;
};

var handler = Handler.prototype;

/**
 * 创建房间
 *
 * @param {*} msg
 * @param {*} session
 * @param {*} next
 * @returns
 */
handler.createRoom = function (msg, session, next) {
	var self = this;
	var roomname = msg.roomname
	var username = msg.username
	var roominfo = msg.roominfo
	var sessionService = self.app.get('sessionService');

	//duplicate log in
	if (!!sessionService.getByUid(username)) {
		next(null, {
			code: 500,
			error: '重复登录'
		});
		return
	}

	session.bind(username)
	session.set('roomname', roomname)
	session.push('roomname', function (err) {
		if (err) {
			console.error('set roomname for session service failed! error is : %j', err.stack)
		}
	});
	session.set('username', username)
	session.push('username', function (err) {
		if (err) {
			console.error('set username for session service failed! error is : %j', err.stack)
		}
	})
	session.on('closed', onUserLeave.bind(null, self.app));

	//put user into channel
	self.app.rpc.chat.roomRemote.createRoom(session, self.app.get('serverId'), roomname, roominfo, username, function (result) {
		next(null, result)
	})
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
	var self = this;
	var roomname = msg.roomname
	var username = msg.username
	var sessionService = self.app.get('sessionService');

	//duplicate log in
	if (!!sessionService.getByUid(username)) {
		next(null, {
			code: 500,
			error: '重复登录'
		});
		return;
	}

	session.bind(username)
	session.set('roomname', roomname)
	session.push('roomname', function (err) {
		if (err) {
			console.error('set roomname for session service failed! error is : %j', err.stack)
		}
	});
	session.set('username', username)
	session.push('username', function (err) {
		if (err) {
			console.error('set username for session service failed! error is : %j', err.stack)
		}
	})
	session.on('closed', onUserLeave.bind(null, self.app));

	//put user into channel
	self.app.rpc.chat.roomRemote.joinRoom(session, self.app.get('serverId'), roomname, username, function (result) {
		next(null, result)
	})
}

/**
 * User log out handler
 *
 * @param {Object} app current application
 * @param {Object} session current session object
 *
 */
var onUserLeave = function (app, session) {
	if (!session || !session.uid) {
		return;
	}
	app.rpc.chat.roomRemote.leaveRoom(session, app.get('serverId'), session.get('roomname'), session.get('username'), null);
};