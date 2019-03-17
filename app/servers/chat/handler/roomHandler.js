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
	this.app.rpc.chat.room2Remote.onAction(session, this.app.get('serverId'), session.get('groupname'), session.get('roomname'),
		session.get('username'), action, function (result) {
			next(null, result)
		})

	// console.log('---------------------------------------------------------------------------')
}

handler.getRoomsUsers = function (msg, session, next) {
	// console.log('---------------------------服务器', this.app.get('serverId'), '---------------------------')
	// console.log('getRoomsUsers')

	var data = {}
	const roomnames = msg.roomnames
	roomnames.forEach(roomname => {
		var channel = channel = this.app.get('channelService').getChannel(roomname, false)
		if (!!channel) {
			data[roomname] = channel.getMembers()
		} else {
			data[roomname] = []
		}
	})
	next(null, {code: 0, data})

	// console.log('---------------------------------------------------------------------------')
}