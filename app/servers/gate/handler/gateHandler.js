var dispatcher = require('../../../util/dispatcher');

module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
};

var handler = Handler.prototype;

/**
 * Gate handler that dispatch user to connectors.
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param {Function} next next stemp callback
 *
 */
handler.queryEntry = function(msg, session, next) {
	var username = msg.username;
	if(!username) {
		next(null, {
			code: 500,
			data: 'username  null'
		});
		return;
	}
	// get all connectors
	var connectors = this.app.getServersByType('connector');
	if(!connectors || connectors.length === 0) {
		next(null, {
			code: 500,
			data: 'no connectors'
		});
		return;
	}
	// select connector
	var res = dispatcher.dispatch(username, connectors);
	next(null, {
		code: 0,
		host: res.host,
		port: res.clientPort
	});
};
