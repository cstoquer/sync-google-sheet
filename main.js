var fs     = require('fs');
var google = require('googleapis').google;
var XLSX   = require('xlsx');

var EMPTY_COLUMN_REGEX = /__EMPTY.*/;

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function crawl(pointer, path, value) {
	if (!Number.isFinite(path)) {
		var keys = path.split('.');
		path = keys.pop();

		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			if (!pointer[key]) pointer[key] = {};
			pointer = pointer[key];
		}
	}

	if (value !== undefined) pointer[path] = value;
	return pointer[path];
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function unflatten(obj) {
	var result = {};

	for (var key in obj) {
		crawl(result, key, obj[key]);
	}

	return result;
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function formatError(message, column, row, data) {
	return new Error(message + ' [column= ' + column + ' row= ' + row + ' ] data=' + JSON.stringify(data));
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function checkInteger(value) {
	return value % 1 === 0;
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
/**
 * @param {string} data - stringified JSON array
 */
function parseArrayAndCheck(column, type, row, data, check) {
	if (!data) return [];

	var result;

	try {
		result = JSON.parse(data);
	} catch (e) {
		throw formatError('Unable to parse JSON array', column, row, data);
	}

	if (!Array.isArray(result)) {
		throw formatError('Data is not of type array', column, row, data);
	}

	if (type || check) {
		for (var i = 0; i < result.length; i++) {
			var value = result[i];
			if (type  && typeof value !== type) throw formatError('Not an array of ' + type, column, row, data);
			if (check && check(value) !== true) throw formatError('Array data type is invalid', column, row, data);
		};
	}

	return result;
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function convertCell(sheets, column, type, row, data) {
	type = type.split(':');
	switch (type[0]) {
		// basic types
		case 'string':  return data || '';
		case 'float':   return parseFloat(data || 0);
		case 'int':
			var int = parseInt(data || 0, 10);
			if (isNaN(int)) throw formatError('Data is not of type integer', column, row, data);
			return int;
		
		case 'bool':
			data = data || false;
			if (!data) return data;
			if (typeof data === 'boolean') return data;
			if (data !== 'TRUE' && data !== 'FALSE') throw formatError('Data is not of type boolean', column, row, data);
			return data === 'TRUE';
		
		// arrays
		case 'array':        return parseArrayAndCheck(column, null,      row, data);
		case 'array.int':    return parseArrayAndCheck(column, 'number',  row, data, checkInteger);
		case 'array.float':  return parseArrayAndCheck(column, 'number',  row, data);
		case 'array.string': return parseArrayAndCheck(column, 'string',  row, data);
		case 'array.bool':   return parseArrayAndCheck(column, 'boolean', row, data);
		
		// json
		case 'json':
			if (!data) return null;
			var result;
			try {
				result = JSON.parse(data);
			} catch (e) {
				throw formatError('Unable to parse JSON', column, row, data);
			}
			return result;

		// references
		case 'ref':
			var sheetId = type[1];
			// TODO: if no sheetId defined in type, it could be defined in values
			var sheet = sheets[sheetId];
			if (!sheet) throw formatError('Sheet='+sheetId+' is not available', column, row, data);
			return crawl(sheet, data);

		case 'array.ref':
			var sheetId = type[1];
			// TODO: if no sheetId defined in type, it could be defined in values
			var sheet = sheets[sheetId];
			if (!sheet) throw formatError('Sheet='+sheetId+' is not available', column, row, data);

			var array = parseArrayAndCheck(column, 'string', row, data);
			for (var i = 0; i < array.length; i++) {
				array[i] = crawl(sheet, array[i]);
			}
			return array;
	}
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function convertSpreadsheetToArray(sheets, sheetId, header, data) {
	var typeMap = data.shift();
	var result = [];

	for (var i = 0; i < data.length; i++) {
		var row = {};
		for (var j = 0; j < header.length; j++) {
			var k = header[j];
			row[k] = convertCell(sheets, sheetId + ':' + k, typeMap[k], i, data[i][k]);
		}
		result.push(unflatten(row));
	}

	return result;
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function convertSpreadsheetToMap(sheets, sheetId, header, data, keyName, isDictionary, removeKey) {

	function convertArrayToMap(array, keyNames, keyIndex) {
		var keyName = keyNames[keyIndex];
		var result = {};
		
		for (var i = 0; i < array.length; i++) {
			var elem = array[i];
			var key = elem[keyName];
			if (!result[key]) result[key] = [];
			result[key].push(elem);
			if (removeKey) delete elem[keyName];
		}

		if (++keyIndex < keyNames.length) {
			for (var id in result) {
				result[id] = convertArrayToMap(result[id], keyNames, keyIndex);
			}
		} else if (isDictionary) {
			for (var id in result) {
				result[id] = result[id][0];
			}
		}

		return result;
	}

	var array = convertSpreadsheetToArray(sheets, sheetId, header, data);
	return convertArrayToMap(array, keyName.split(':'), 0);
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function convertSpreadsheetToKeyValue(sheets, sheetId, header, data) {
	var result = {};

	for (var i = 0; i < data.length; i++) {
		var keyvalue = data[i];
		result[keyvalue.key] = convertCell(sheets, sheetId, keyvalue.type, i, keyvalue.value);
	}

	return unflatten(result);
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
var CONVERTER_BY_TYPE = {
	'array':       convertSpreadsheetToArray,
	'keyvalue':    convertSpreadsheetToKeyValue,
	'dictionary':  function (s, i, h, d, k) { return convertSpreadsheetToMap(s, i, h, d, k, true,  false); },
	'dictionary*': function (s, i, h, d, k) { return convertSpreadsheetToMap(s, i, h, d, k, true,  true); },
	'mappedlist':  function (s, i, h, d, k) { return convertSpreadsheetToMap(s, i, h, d, k, false, false); },
	'mappedlist*': function (s, i, h, d, k) { return convertSpreadsheetToMap(s, i, h, d, k, false, true); }
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
/**
 * Convert the spreadsheets from the workbook as defined in the meta spreadshheet
 * @param {Object} workbook - Workbook object returned by XLSX
 * @param {string} [metaTableName = 'meta'] - Name of the meta data spreadsheet
 */
function convertWorkbookToJson(workbook, metaTableName) {
	var sheets = {};

	// get metadata table
	var metaSheet = workbook.Sheets[metaTableName || 'meta'];
	var meta = XLSX.utils.sheet_to_json(metaSheet, { raw: true, blankrows: false });
	sheets[metaTableName] = meta;

	// iterate on all spreadsheets defined in meta
	for (var keys = Object.keys(meta), i = 0; i < keys.length; i++) {
		var def   = meta[i];
		var name  = def.name;
		var sheet = workbook.Sheets[name];
		var data  = XLSX.utils.sheet_to_json(sheet, { raw: true, blankrows: false });

		if (data.length === 0) {
			throw new Error('sheetId=' + name + ' does not exist or empty');
		}

		// remove columns with empty title
		var header = Object.keys(data[0]).filter(function (k) {
			return !EMPTY_COLUMN_REGEX.test(k);
		});

		var convert = CONVERTER_BY_TYPE[def.format];
		if (!convert) throw new Error('Incorrect format "' + def.format + '" set for sheet ' + name);
		var keyName = def.key || 'id';
		sheets[name] = convert(sheets, name, header, data, keyName);
	}

	return sheets;
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
/**
 * @param {string} fileId - the ID of the file on Google Drive
 * @param {string} clientSecretPath - path to the JSON file that contain the Google secret key
 * @param {Function} cb - callback
 */
function downloadGoogleDriveFile(fileId, clientSecretPath, cb) {
	var SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
	var MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; // xlsx

	fs.readFile(clientSecretPath, 'utf8', function (error, data) {
		if (error) return cb(error);

		var secretKey = JSON.parse(data);

		// create JWT (Service Tokens) instance for authentification
		var jwtClient = new google.auth.JWT(
			secretKey.client_email,
			null,
			secretKey.private_key,
			[SCOPE], // an array of auth scopes
			null
		);

		jwtClient.authorize(function onAuthorised(error) {
			if (error) return cb(error);

			// Exports a Google Drive file to the requested MIME type and returns the exported content.
			// Note that the exported content is limited to 10MB.
			var drive = google.drive({ version: 'v3', auth: jwtClient });
			drive.files.export({ fileId: fileId, mimeType: MIME_TYPE }, { responseType: 'arraybuffer' }, cb);
		});
	});
};

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
/**
 * 
 * @param {Object} params - parameter object
 * @param {string} params.fileId - the ID of the file on Google Drive
 * @param {string} params.clientSecretPath - path to the JSON file that contain the Google secret key
 * @param {string} [params.metaTableName = 'meta'] - name of the sheet to use as meta table
 * @param {Function} cb - callback
 */
module.exports = function syncSpreadsheet(params, cb) {
	downloadGoogleDriveFile(params.fileId, params.clientSecretPath, function (error, response) {
		if (error) return console.error('Could not download the spreadsheet. Check the file ID and its sharing properties.');

		var workbook = XLSX.read(response.data, { type: 'buffer' });
		var result;

		try {
			result = convertWorkbookToJson(workbook, params.metaTableName);
		} catch (error) {
			return cb(error);
		}

		cb(null, result);
	});
};
