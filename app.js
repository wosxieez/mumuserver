var pomelo = require('pomelo');
var routeUtil = require('./app/util/routeUtil');
/**p
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'chatofpomelo');


// app configure
app.configure('production|development', function() {
	// route configures
	app.route('chat', routeUtil.chat);
	app.set('connectorConfig', {
		connector: pomelo.connectors.hybridconnector,
		transports: ['websocket', 'polling'],
		heartbeats: true,
		closeTimeout: 60 * 1000,
		heartbeatTimeout: 60 * 1000,
		heartbeatInterval: 25 * 1000
	});
	// filter configures
	app.filter(pomelo.timeout());
});

// start app
app.start();

process.on('uncaughtException', function(err) {
	console.error(' Caught exception: ' + err.stack);
});