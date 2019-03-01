var roomRemote = require('../remote/roomRemote');

module.exports = function (app) {
	return new Handler(app);
};

var Handler = function (app) {
	this.app = app;
};

var handler = Handler.prototype;

/**
 * Send messages to users
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */

handler.sendAction = function (action, session, next) {
	this.app.rpc.chat.roomRemote.onAction(session, this.app.get('serverId'), session.get('roomname'),
		session.get('username'), action, function () {
			next(null, { code: 0 })
		})
}
