var admin = function () {
	var angularApp = angular.module("qna-admin", []);
	angularApp.controller("main", function ($scope) {
		$scope.questionList = [];
		$scope.enableAdminTools = false;
		$scope.disconnect = disconnect;
		$scope.hasSecretKey = function () {
			return hasSecretKey;
		}

		// hacks
		cleanUp = cleanUp.bind(undefined, $scope);
		enableAdminTools = enableAdminTools.bind(undefined, $scope);

		addQuestions = addQuestions.bind(undefined, $scope);
		addQuestion = addQuestion.bind(undefined, $scope);

		$scope.approveQuestion = approveQuestion.bind(undefined, $scope);
		$scope.deleteQuestion = deleteQuestion.bind(undefined, $scope);

		removeConcern = removeConcern.bind(undefined, $scope);

		$scope.createRoom = createRoom.bind(undefined, $scope);
		$scope.deleteRoom = deleteRoom.bind(undefined, $scope);
	});

	// ng hacks
	var cleanUp = function (ngScope) {
		ngScope.questionList = [];
		ngScope.enableAdminTools = false;
		ngScope.$apply();
	}

	var enableAdminTools = function (ngScope) {
		ngScope.enableAdminTools = true;
		ngScope.$apply();
	}

	var addQuestions = function (ngScope, questionList) {
		ngScope.questionList = ngScope.questionList.concat(questionList);
		ngScope.$apply();
	}

	var addQuestion = function (ngScope, question) {
		ngScope.questionList.push(question);
		ngScope.$apply();
	}

	var approveQuestion = function (ngScope, questionId) {
		send(msgType.APPROVE_QN, questionId);
	}

	var deleteQuestion = function (ngScope, questionId) {
		send(msgType.DELETE_QN, questionId);
	}

	var removeConcern = function (ngScope, questionId) {
		var questionList = ngScope.questionList;
		for(var i = 0, size = questionList.length; i < size; ++i) {
			if(questionList[i]._id == questionId) {
				questionList.splice(i, 1);
				ngScope.$apply();
				return;
			}
		}
	}

	var createRoom = function (ngScope) {
		var roomId = ngScope.roomId,
			hasDownvote = ngScope.hasDownvote,
			adminFilter = ngScope.adminFilter,
			roomObj = {
				id: roomId,
				settings: {
					hasDownvote: hasDownvote,
					adminFilter: adminFilter
				}
			};

		send(msgType.CREATE_ROOM, roomObj);
	}

	var deleteRoom = function (ngScope) {
		send(msgType.DELETE_ROOM, ngScope.roomId2);
		ngScope.roomId2 = "";
	}
	// end of hacks

	var secretKeyPattern = /.{6,}/;

	var protocol = 'ws',
		hostname = 'localhost',
		port = '8080',
		url = protocol + '://' + hostname + ':' + port + '/',
		connection = null,
		hasSecretKey = false,
		msgType = {
			UNFILTERED_QN_LIST: 10,
			SEND_UNFILTERED_QN: 11,
			APPROVE_QN: 12,
			DELETE_QN: 13,
			CREATE_ROOM: 14,
			DELETE_ROOM: 15
		};

	var send = function (type, content) {
		if(isConnected()) {
			connection.send(JSON.stringify({
				type: type,
				content: content
			}));
			return true;
		}
		return false;
	}

	var isConnected = function () {
		if(connection == null) {
			return false;
		}

		return connection.readyState == 1;
	};

	var connect = function (secretKey) {
		if(!secretKeyPattern.test(secretKey)) {
			alert("Secret key is at least 6 characters!");
			return;
		}

		disconnect();

		var completeUrl = url + '?key=' + secretKey;

		hasSecretKey = true;
		connection = new WebSocket(completeUrl);
		connection.onopen = onopen;
		connection.onmessage = onmessage;
		connection.onclose = onclose;
		connection.onerror = onerror;
	}

	var disconnect = function () {
		if(connection instanceof WebSocket) {
			connection.close();
		}
		connection = null;
		hasSecretKey = false;
	}

	var onopen = function (event) {
		cleanUp();
		enableAdminTools();
	}

	var onmessage = function (event) {
		var msgObj = JSON.parse(event.data),
			content = msgObj.content;

		// console.log(msgObj);
		switch(msgObj.type) {
			case msgType.UNFILTERED_QN_LIST:
				addQuestions(content);
				break;
			case msgType.SEND_UNFILTERED_QN:
				addQuestion(content);
				break;
			case msgType.APPROVE_QN:
				removeConcern(content);
				break;
			case msgType.DELETE_QN:
				removeConcern(content);
				break;
			case msgType.CREATE_ROOM:
				alert(content);
				break;
			case msgType.DELETE_ROOM:
				alert(content);
				break;
			default:
				// ignore
				break;
		}
	}

	var onclose = function (event) {
		disconnect();
		cleanUp();

		if(event.reason.length > 0) {
			alert(event.reason);
		}
	}

	var onerror = function (event) {
		disconnect();
		cleanUp();
	}

	return {
		connect: connect,
		disconnect: disconnect,
		isConnected: isConnected
	};
}();

document.addEventListener('DOMContentLoaded', function (event) {
	var secretKeyField = document.getElementById('secret-key-field'),
		submitKeyBtn = document.getElementById('submit-key-btn');

	submitKeyBtn.onclick = function (event) {
		admin.connect(secretKeyField.value);
		secretKeyField.value = "";
	}
});