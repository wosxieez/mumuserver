module.exports = function (app) {
	return new Handler(app);
};

var Handler = function (app) {
	this.app = app;
};

var handler = Handler.prototype;

/**
 * Send action to room
 */
handler.sendAction = function (action, session, next) {
	// console.log('---------------------------服务器', this.app.get('serverId'), '---------------------------')
	// console.log('onAction', action)
	this.app.rpc.chat.roomRemote.onAction(session, this.app.get('serverId'), session.get('groupname'), session.get('roomname'),
		session.get('username'), action, function (result) {
			next(null, result)
		})

	// console.log('---------------------------------------------------------------------------')
}

/**
 * push message to group users
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */

handler.pushMessage = function (message, session, next) {
	// console.log('---------------------------服务器', this.app.get('serverId'), '---------------------------')
	// console.log('pushMessage')
	const roomname = session.get('roomname')
	channel = this.app.get('channelService').getChannel(roomname, false)
	if (!!channel) {
		channel.pushMessage({ route: 'onRoom', data: message })
		next(null, { code: 0, data: '发送成功' })
	} else {
		next(null, { code: 500, data: '发送失败, 该房间不存在' })
	}

	// console.log('---------------------------------------------------------------------------')
}