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
			DELETE_QN: 13
		}

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

		console.log(msgObj);
		switch(msgObj.type) {
			case msgType.UNFILTERED_QN_LIST:
				addQuestions(content);
				break;
			case msgType.SEND_UNFILTERED_QN:
				break;
			case msgType.APPROVE_QN:
				break;
			case msgType.DELETE_QN:
				break;
			default:
				// ignore
				break;
		}
	}

	var onclose = function (event) {
		cleanUp();
		disconnect();

		if(event.reason.length > 0) {
			alert(event.reason);
		}
	}

	var onerror = function (event) {
		cleanUp();
		disconnect();
	}

	return {
		connect: connect,
		disconnect: disconnect
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