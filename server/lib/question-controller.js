var assert = require('assert'),
	ObjectID = require('mongodb').ObjectID;

module.exports = function (db) {
	var questionColName = 'questions';

	this.approveQuestion = function (questionId, callback) {
		db.open(function (err, db) {
			db.collection(questionColName, function (err, col) {
				col.findAndModify({_id: new ObjectID(questionId)}, [['_id', 'asc']], {$set: {filtered: true}}, function (err, object) {
					db.close();
					callback(object.value);
				})
			});
		});
	}

	this.deleteQuestion = function (questionId, callback) {
		db.open(function (err, db) {
			db.collection(questionColName, function (err, col) {
				col.remove({_id: new ObjectID(questionId)}, {single: true}, function (err, result) {
					db.close();
					callback(result.result.ok == 1);
				});
			});
		});
	}
}