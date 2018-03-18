# Sync-Google-Sheet

A simple Node-js library to download Sheet from Google Drive and parse it to JSON.

# Preparation

## Enable the Google Sheet API

Google developers console is at this address:

[https://console.developers.google.com/apis/](https://console.developers.google.com/apis/)

 - From your Google developer account, go to the `Library` menu (left side) and find the Google Sheet API.
 - Activate the API by clicking the `ACTIVATE` button.

## Get a Google secret key

 - From the same Google developers console, go to the `Credentials` menu.
 - Clic the `Create credentials` dropdown button and select `Service account key`
 - select `default` as Service account, and `JSON` as Key type
 - Create and download the key

You get a `.json` file that contain a private key to access documents in your Google drive.

Be carrefull with this secret key, don't commit it in your code.

## Prepare the spreadsheet

### Set the Google Sheet as readable

In the Google sheet you want to export, clic on the `SHARE` button (top-right corner) and check that it's shared
as `Anyone with the link can view`.

### Get its file id

The file id is a 44 characters hash string inside the shareable link.
For instance, consider the spreadsheet at the following address:
`https://docs.google.com/spreadsheets/d/1tDyLD2f_P2n9etVESzx-_CJdiH1VgXL8B9VYmEVA6pQ/edit?usp=sharing`

its file id is: `1tDyLD2f_P2n9etVESzx-_CJdiH1VgXL8B9VYmEVA6pQ`

## Install the library

`npm install sync-google-spreadsheet -save`

# Export

You need to specify two things:
 - `fileId` the file id of the Google sheet you want to download
 - `clientSecretPath` the path to the json file that contain your Google secret key.

```js
var syncSpreadsheet = require('sync-google-sheet');

var params = {
	fileId: '1tDyLD2f_P2n9etVESzx-_CJdiH1VgXL8B9VYmEVA6pQ', 
	clientSecretPath: './keys/google-secret.json',
	metaTableName: 'meta' // optional
};

syncSpreadsheet(params, function onResult(error, result) {
	if (error) return console.error(error);
	console.log(result);
});
```

# Workbook and sheet formats

## Meta table

The workbook should contain one meta table. The meta table define the sheets to export
and how these sheets should be exported. The format of this meta table is as 
follow:

| name          | format        | key   
| ------------- | ------------- | ----- 
| SheetName     | dictionary    | id    


available formats are:
 - `array`
 - `dictionary`
 - `keyvalue`

The `key` column is only used for dictionary tables, to specify which attribute 
should be used for key. If not specified, `id` is used as key name.

## Array and dictionary tables

Column defines one attribute of the objects.
The two first row are used to define the attribute name and type.
The name can be a dot formatted path used to structure the object.


| `name`     | <- property name      
| ---------- | --------------------- 
| **type**   | <- type of the values 
| `value`    | <- value for item 1   
| `value`    | <- value for item 2   
| `value`    | <- value for item 3   


For instance the following table:


| id        | stats.atk   | stats.def  
| --------- | ----------- | ---------- 
| `string`  | `int`       | `int`  
| bouli     | 280         | 430        
| spiky     | 310         | 240        
| mekka     | 120         | 510        

Will result in the following JSON array:

```js
[
    { id: 'bouli', stats: { atk: 280, def: 430 } },
    { id: 'spiky', stats: { atk: 310, def: 240 } },
    { id: 'mekka', stats: { atk: 120, def: 510 } }
]
```

or the following JSON dictionary with `id` used as key:
```js
{
    bouli: { id: 'bouli', stats: { atk: 280, def: 430 } },
    spiky: { id: 'spiky', stats: { atk: 310, def: 240 } },
    mekka: { id: 'mekka', stats: { atk: 120, def: 510 } }
}
```

## Keyvalue tables

The keyvalue table should define 3 columns:
 - key
 - value
 - type


For instance, the following table:

| key             | value       | type            
| --------------- | ----------- | --------------- 
| player.speed    | 1.4         | `float`       
| player.power    | 120         | `int`       
| player.strength | 209         | `int`       
| area            | "tutorial"  | `string`        
| entries         | [3, 5, 6]   | `array.int` 

will produce the following object:

```js
{
    player: {
        speed: 1.4,
        power: 120,
        strength: 209,
    },
    area: 'tutorial',
    entries: [3, 5, 6]
}
```

## Available types

The following types can be defined to parse the spreadsheet:
 - `int` base 10 integer. Default to `0`.
 - `float` floating point number. Default to `0`.
 - `string` default to the empty string.
 - `bool` default to `false`
 - `array` JSON encoded array. default to an empty array.
 - `array.int` JSON encoded array of integer.
 - `array.float` JSON encoded array of number.
 - `array.string` JSON encoded array of string.
 - `array.bool` JSON encoded array of boolean.
 - `json` any valid JSON object. Default to `null`.

If a value doesn't match with the type defined, an error is returned in the callback.

