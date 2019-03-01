var genericPool = require('generic-pool');

var thisApp

const factory = {
	create: function () {
		var mysqlConfig = thisApp.get('mysql')
		var mysql = require('mysql')
		var client = mysql.createConnection({
			host: mysqlConfig.host,
			user: mysqlConfig.user,
			password: mysqlConfig.password,
			database: mysqlConfig.database
		})
		client.connect()
		return client
	},
	destroy: function (client) {
		client.end()
	}
};

const opts = {
	max: 10, // maximum size of the pool
	min: 2 // minimum size of the pool
};

var createMysqlPool = function(app) {
	thisApp = app
	return genericPool.createPool(factory, opts)
}

module.exports.createMysqlPool = createMysqlPool
