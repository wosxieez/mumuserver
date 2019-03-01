var pomelo = require('pomelo');
var routeUtil = require('./app/util/routeUtil');
/**p
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'chatofpomelo');

app.loadConfig("mysql", app.getBase() + "/config/mysql.json"); // 添加配置

// app configure
app.configure('production|development', function() {
	// route configures
	var dbclient = require("./app/dao/mysql/mysql.js").init(app); // 初始化dbclient
    app.set("dbclient", dbclient);// dbclient 为外部数据库接口，app,get("dbclient") 来使用
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