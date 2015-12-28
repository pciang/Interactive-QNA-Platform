var assert = require('assert'),
	ObjectID = require('mongodb').ObjectID,
	url = require('url');

module.exports = function (db) {
	var secretKey = "ganteng",
		admins = []; // online admin

	var questionColName = 'questions';

	this.isAdmin = function (ws) {
		var location = url.parse(ws.upgradeReq.url, true);
		return location.query['key'] !== undefined;
	}

	this.verifyKey = function (key) {
		return key == secretKey;
	}

	this.retrieveAll = function (callback) {
		db.open(function (err, db) {
			db.collection(questionColName, function (err, col) {
				col.find({filtered: false}, function (err, cursor) {
					var result = [];
					cursor.each(function (err, document) {
						if(document == null) {
							db.close();
							callback(result);
							return;
						}
						result.push(document);
					});
				});
			});
		});
	}

	this.addAdmin = function (ws) {
		admins.push(ws);
	}

	this.removeAdmin = function (ws) {
		var idx = admins.indexOf(ws);
		admins.splice(idx, 1);
	}

	this.notifyAll = function (callback) {
		admins.forEach(callback);
	}

	this.getNumAdmins = function () {
		return admins.length;
	}
};
