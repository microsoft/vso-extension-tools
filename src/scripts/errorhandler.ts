import log = require("./logger");

export function httpErr(obj): any {
	let errorAsObj = obj;
	if (typeof errorAsObj === "string") {
		try {
			errorAsObj = JSON.parse(errorAsObj);
		} catch (parseError) {
			throw errorAsObj;
		}
	}
	let statusCode: number = errorAsObj.statusCode;	
	if (statusCode === 401) {
		throw "Received response 401 (Not Authorized). Check that your personal access token is correct and hasn't expired.";
	}
	let errorBodyObj = errorAsObj.body;
	if (errorBodyObj) {
		if (typeof errorBodyObj === "string") {
			try {
				errorBodyObj = JSON.parse(errorBodyObj);
			} catch (parseError) {
				throw errorBodyObj;
			}
		}
	}
	let message = errorBodyObj.message;
	if (message) {
		throw message;
	} else {
		throw errorBodyObj;
	}
}

export function errLog(arg) {
	console.log(arg);
	if (typeof arg === "string") {
		log.error(arg);
	} else if (typeof arg.toString === "function") {
		log.error(arg.toString());
	} else if (typeof arg === "object") {
		try {
			log.error(JSON.parse(arg))
		} catch (e) {
			log.error(arg);
		}
	} else {
		log.error(arg);
	}
	process.exit(-1);
}