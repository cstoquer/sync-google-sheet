var fs     = require('fs');
var google = require('googleapis').google;
var XLSX   = require('xlsx');

var EMPTY_COLUMN_REGEX = /__EMPTY.*/;

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function formatError(message, column, row, data) {
	return new Error(message + ' [column= ' + column + ' row= ' + row + ' ] data=' + JSON.stringify(data));
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function checkInteger(value) {
	return value % 1 === 0;
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
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

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function convertCell(column, type, row, data) {
	switch (type) {
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
	}
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function unflatten(obj) {
    var result = {};

    for (var key in obj) {
        // key can be a path "a.b.c"
        var path = key.split('.');
        var pointer = result;
        var last = path.pop();

        for (var i = 0; i < path.length; i++) {
            var next = path[i];
            if (!pointer[next]) pointer[next] = {};
            pointer = pointer[next];
        }

        pointer[last] = obj[key];
    }

    return result;
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function convertSpreadsheetToArray(sheetName, header, typeMap, data) {
    var result = [];

	for (var i = 0; i < data.length; i++) {
		var row = {};
		for (var j = 0; j < header.length; j++) {
			var k = header[j];
			row[k] = convertCell(sheetName + ':' + k, typeMap[k], i, data[i][k]);
		}
		result.push(unflatten(row));
    }

	return result;
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function convertSpreadsheetToKeyValue(sheetName, data) {
	var result = {};

	for (var i = 0; i < data.length; i++) {
		var keyvalue = data[i];
		result[keyvalue.key] = convertCell(sheetName, keyvalue.type, i, keyvalue.value);
	}

	return unflatten(result);
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
function convertArrayToDictionary(array, keyName) {
    var result = {};

	for (var i = 0; i < array.length; i++) {
		var elem = array[i];
		result[elem[keyName]] = elem;
    }

    return result;
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
/**
 * Convert the spreadsheets from the workbook as defined in the meta spreadshheet
 * @param {Object} workbook - Workbook object returned by XLSX
 * @param {string} [metaTableName = 'meta'] - Name of the meta data spreadsheet
 */
function convertWorkbookToJson(workbook, metaTableName) {
    var result = {};

    // get metadata table
    var metaSheet = workbook.Sheets[metaTableName || 'meta'];
    var meta = XLSX.utils.sheet_to_json(metaSheet, { raw: true, blankrows: false });

    // iterate on all spreadsheets defined in meta
	for (var keys = Object.keys(meta), i = 0; i < keys.length; i++) {
		var def   = meta[i];
		var name  = def.name;
		var sheet = workbook.Sheets[name];
		var data  = XLSX.utils.sheet_to_json(sheet, { raw: true, blankrows: false });

		if (data.length === 0) {
			throw new Error('sheetName=' + name + ' does not exist or empty');
		}

		// remove columns with empty title
		var header = Object.keys(data[0]).filter(function (k) {
			return !EMPTY_COLUMN_REGEX.test(k);
		});

        // There are 3 types of spreadsheets: array, dictionary and keyvalue
		switch (def.format) {
			case 'array':
				var typeMap = data.shift();
                result[name] = convertSpreadsheetToArray(name, header, typeMap, data);
				break;

			case 'dictionary':
				var typeMap = data.shift();
                var content = convertSpreadsheetToArray(name, header, typeMap, data);
                result[name] = convertArrayToDictionary(content, def.key || 'id');
				break;

            case 'keyvalue':
                result[name] = convertSpreadsheetToKeyValue(name, data);
				break;
		}
	}

	return result;
}

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
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

//▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
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
