[![Install with NPM](https://nodei.co/npm/sync-google-sheet.png?downloads=true&stars=true)](https://nodei.co/npm/sync-google-sheet/)

# Sync-Google-Sheet

A simple Node-js library to download Sheet from Google Drive and parse it to structured JSON.

# Preparation

## Enable the Google Sheet API

Google developers console is at this address:

[https://console.developers.google.com/apis/](https://console.developers.google.com/apis/)

 - From your Google developer account, go to the `Library` menu (left side) and find the Google Sheet API.
 - Activate the API by clicking the `ACTIVATE` button.

## Get a Google access Key

The library needs one of the following access keys to download the spreadsheet document:
- Service Account Key: a JSON file.
- API Key: Simplier to create and use, but less secure.
### Service Account Key

 - From the same Google developers console, go to the `Credentials` menu.
 - Clic the `Create credentials` dropdown button and select `Service account key`
 - select `default` as Service account, and `JSON` as Key type
 - Create and download the key

You get a `.json` file that contain a private key to access documents in your Google drive.

*(Be carrefull with this secret key, don't commit it in your code!)*

### API Key

- From the developer console, go to the `Credentials` menu.
- Clic the `Create credentials` dropdown button and select `API key`

Copy and paste the provided string as the `apiKey` parameter. See the ["Usage"](#usage) section below

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

# Usage

You need to specify two things:
 - `fileId` the file id of the Google sheet you want to download
 - An access key:
   - either: `clientSecretPath` the path to the json file that contain your Google secret key.
   - or: `apiKey` the API key string

```js
var syncSpreadsheet = require('sync-google-sheet');

var params = {
    fileId: '1tDyLD2f_P2n9etVESzx-_CJdiH1VgXL8B9VYmEVA6pQ',
    clientSecretPath: './keys/google-secret.json',
    // apiKey: 'XXxxXxXXX_XXxxxXXXxxxXXXXxxXXxxxXXXX',
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

| name          | format        | key   | headerLine
| ------------- | ------------- | ----- | -----------
| SheetName     | dictionary    | id    | line number


available formats are:
 - `array`
 - `dictionary`
 - `dictionary*`
 - `mappedList`
 - `mappedList*`
 - `keyvalue`
 - `arrayvalue`
 - `mappedvalue`

The `key` column is only used for `dictionary` and `mappedlist` tables, to specify which attribute
should be used for key. If not specified, `id` is used as key name.
Keys can be chained (colon separated) to obtain a recursively structured object.

`headerLine` is optional, set it if your title line is not the first one (e.g. `2`).

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


| id        | stats.atk   | stats.def  | isBoss
| --------- | ----------- | ---------- | -----------
| `string`  | `int`       | `int`      | `bool`
| bouli     | 280         | 430        | TRUE
| spiky     | 310         | 240        | FALSE
| mekka     | 120         | 510        |

Will result in the following JSON array:

```js
[
    { id: 'bouli', stats: { atk: 280, def: 430 }, isBoss: true },
    { id: 'spiky', stats: { atk: 310, def: 240 }, isBoss: false },
    { id: 'mekka', stats: { atk: 120, def: 510 } }
]
```

or the following JSON dictionary with `id` used as key:
```js
{
    bouli: { id: 'bouli', stats: { atk: 280, def: 430 }, isBoss: true },
    spiky: { id: 'spiky', stats: { atk: 310, def: 240 }, isBoss: false },
    mekka: { id: 'mekka', stats: { atk: 120, def: 510 } }
}
```

If you want the key to not be included in the dictionary entries,
set the sheet type to `dictionary*` (with an asterisk `*`) in the meta table.

On the same example, the result would become:
```js
{
    bouli: { stats: { atk: 280, def: 430 }, isBoss: true },
    spiky: { stats: { atk: 310, def: 240 }, isBoss: false },
    mekka: { stats: { atk: 120, def: 510 } }
}
```

## Mapped List

A mapped list is a dictionary that maps to an array of items.


Consider the following table where `id` is used as key.

| id    | x     | y     | width | height
| ----- | ----- | ----- | ----- | ------
| `int`	| `int` | `int` | `int` | `int`
| 1     | 0     | 0     | 15    | 20
| 1     | 15    | 2     | 12    | 14
| 1     | 17    | 1     | 8     | 6
| 2     | 2     | 13    | 10    | 14
| 3     | 0     | 0     | 11    | 7
| 3     | 5     | 3     | 9     | 5
| 3     | 4     | 8     | 4     | 4
| 3     | 8     | 5     | 7     | 7
| 4     | 0     | 0     | 16    | 11
| 4     | 7     | 2     | 20    | 22

The items that share the same key will be grouped in an array:

```js
{
    "1": [
        { x: 0,  y: 0, width: 15, height: 20 },
        { x: 15, y: 2, width: 12, height: 14 },
        { x: 17, y: 1, width: 8,  height: 6 }
    ],
    "2": [
        { x: 2, y: 13, width: 10, height: 14 }
    ],
    "3": [
        { x: 0, y: 0, width: 11, height: 7 },
        { x: 5, y: 3, width: 9,  height: 5 },
        { x: 4, y: 8, width: 4,  height: 4 },
        { x: 8, y: 5, width: 7,  height: 7 }
    ],
    "4": [
        { x: 0, y: 0, width: 16, height: 11 },
        { x: 7, y: 2, width: 20, height: 22 }
    ]
}
```

## Keyvalue tables

The keyvalue table should define 3 columns:
 - key
 - type
 - value


For instance, the following table:

| key             | type            | value
| --------------- | --------------- | -----------
| player.speed    | `float`         | 1.4
| player.power    | `int`           | 120
| player.strength | `int`           | 209
| area            | `string`        | "tutorial"
| entries         | `array.int`     | [3, 5, 6]

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

You can define several values column with an identifier.
Each value column will be extracted as a separate object.

| key             | type            | value:en    | value:fr    | value:ja
| --------------- | --------------- | ----------- | ----------- | -------------
| cookie          | string          | Cookie      | Biscuit     | クッキー
| key             | string          | Key         | Clé         | 鍵
| gem             | string          | Gem         | Diamant     | 宝石

Will produce the following dictionary:

```js
{
    en: { cookie: "Cookie", key: "Key", gem: "Gem" },
    fr: { cookie: "Biscuit", key: "Clé", gem: "Diamant" },
    ja: { cookie: "クッキー", key: "鍵", gem: "宝石" }
}
```

## Recursively structured table and chained keys

To structure `dictionary` or `mappedlist` to more that one depth level, you can chain
the keys in the meta table by appending them together with a colon character `:`

For instance, given the following table:

| world                  | map                  | id    | name
| ---------------------- | -------------------- | ----- | ------------
| `string`               | `string`             | `int` | `string`
| Clearwater Harbor      | The Flour Tower      | 1     | Leoril
| Clearwater Harbor      | Valenstrong Mansion  | 1     | Viccoril
| Clearwater Harbor      | Shipwreck Edge       | 1     | Panneak
| Clearwater Harbor      | Shipwreck Edge       | 2     | Jamcoril
| Clearwater Harbor      | The Smelt Belt       | 1     | Yenqarim
| Clearwater Harbor      | The Smelt Belt       | 2     | Dorxiron
| Clearwater Harbor      | The Smelt Belt       | 3     | Alydove
| Crewth Piers           | Valor Brewery        | 1     | Wolgwynn
| Crewth Piers           | Valor Brewery        | 2     | Oldove
| Crewth Piers           | Valor Brewery        | 3     | Safrila
| Crewth Piers           | Riddlecloud          | 1     | Colynn
| Crewth Piers           | Riddlecloud          | 2     | Kyslynn
| Crewth Piers           | Narrow Bridge        | 1     | Deltheris
| Crewth Piers           | Dawnton Castle       | 1     | Aroborin
| Crewth Piers           | Dawnton Castle       | 2     | Sarovar
| Rainbow Ridge Orchard  | Ert Grotto           | 1     | Dorfinas
| Rainbow Ridge Orchard  | Rivershire Rampart   | 1     | Brennoa
| Rainbow Ridge Orchard  | Rivershire Rampart   | 3     | Alyyra


By chaining the keys `world:map:id` in the meta table, we obtain the following structured
JSON object:

```js
{
    "Clearwater Harbor": {
        "The Flour Tower":     {
            "1": { name: "Leoril"}
        },
        "Valenstrong Mansion": {
            "1": { name: "Viccoril" }
        },
        "Shipwreck Edge":      {
            "1": { name: "Panneak" },
            "2": { name: "Jamcoril" }
        },
        "The Smelt Belt": {
            "1": { name: "Yenqarim" },
            "2": { name: "Dorxiron" },
            "3": { name: "Alydove" }
        }
    },
    "Crewth Piers": {
        "Valor Brewery":  {
            "1": { name: "Wolgwynn" },
            "2": { name: "Oldove" },
            "3": { name: "Safrila" }
        },
        "Riddlecloud":    {
            "1": { name: "Colynn" },
            "2": { name: "Kyslynn" }
        },
        "Narrow Bridge":  {
            "1": { name: "Deltheris"}
        },
        "Dawnton Castle": {
            "1": { name: "Aroborin" },
            "2": { name: "Sarovar" }
        }
    },
    "Rainbow Ridge Orchard": {
        "Ert Grotto": {
            "1": { name: "Dorfinas" }
        },
        "Rivershire Rampart": {
            "1": { name: "Brennoa" },
            "3": { name: "Alyyra" }
        }
    }
}
```

## Array value

The `arrayvalue` format is for exporting a single column to an array.

| value
| -------
| `string`
| sword
| shield
| ring


```js
["sword", "shield", "ring"]
```

## Mapped value

Mapped value let you extract arrays of values, grouped by a key. The value column needs to be named `value`.

For instance, extrating the following table:

| id       | value
| -------- | -----------
| `string` | `int`
| star     | 9
| star     | 12
| star     | 20
| luna     | 3
| luna     | 7

Produces the following JSON object:

```js
{
    "star": [9, 12, 20],
    "luna": [3, 7]
}
```

# Available types

The following types can be defined to tell the script how to parse the values in the spreadsheet.
If no type is specified, the column (or row when spreadsheet is defined as `keyvalue`) is ignored.
If a value doesn't match with the type defined, an error is returned in the callback.

## Basic types

 - `int` Base 10 integer. Default to `0`.
 - `float` Floating point number. Default to `0`.
 - `string` Text string. Default to the empty string.
 - `bool` Boolean value. Note that these values are displayed as `TRUE` or `FALSE` in Google Sheet. If the value is not defined (i.e. empty cell) the attribute is optimized out and removed completely.

## Arrays

 - `array` JSON encoded array. default to an empty array.
 - `array.int` JSON encoded array of integer.
 - `array.float` JSON encoded array of number.
 - `array.string` JSON encoded array of string.
 - `array.bool` JSON encoded array of boolean.

 ## Wildcard symbols

For some of the basic types (`int`, `float` and `string`), the following wildcard symbols are available:
 - `?` if the cell is empty, don't add the attribute (no default value)
 - `+` allow the value to be an array of this type.
 - `*` allow the value to be empty or an array.

## JSON Data

 - `json` string that can be parsed as a valid JSON object. If the value is not defined, the attribute gets optimized out.


## Reference types

Reference type let you point data from another sheet that has been extracted
(i.e. the sheet needs to be defined in the meta table before where it is referenced).
You define which sheet (and optionaly wich attribute) to point in the type field itself.
Empty cell are optimized out and attribute removed completely.

 - `ref:<sheet.path>` single reference
 - `array.ref:<sheet.path>` array of references.

Consider the following table, in which one field is a reference to the `zone` sheet
we previously extracted:


| name            | zones       | bgm
| --------------- | ----------- | ---------------
| `string`        | `ref:zone`  | `string`
| tuto            |             | wild
| plain           | 1           | wild
| cave            | 2           | underground
| mountain        | 3           | wild
| volcano         | 4           | fire


Produce the following JSON object:

```js
{
    tuto: { name: "tuto", bgm: "wild" },
    plain: {
        name: "plain",
        zones: [
            { x: 0,  y: 0, width: 15, height: 20 },
            { x: 15, y: 2, width: 12, height: 14 },
            { x: 17, y: 1, width: 8,  height: 6 }
        ],
        bgm: "wild"
    },
    cave: {
        name: "cave",
        zones: [
            { x: 2, y: 13, width: 10, height: 14 }
        ],
        bgm: "underground"
    },
    mountain: {
        name: "mountain",
        zones: [
            { x: 0, y: 0, width: 11, height: 7 },
            { x: 5, y: 3, width: 9,  height: 5 },
            { x: 4, y: 8, width: 4,  height: 4 },
            { x: 8, y: 5, width: 7,  height: 7 }
        ],
        bgm: "wild"
    },
    volcano: {
        name: "volcano",
        zones: [
            { x: 0, y: 0, width: 16, height: 11 },
            { x: 7, y: 2, width: 20, height: 22 }
        ],
        bgm: "fire"
    }
}
```

# Acknowledgements

This tool is based on [grille-downloader](https://github.com/wasedaigo/grille-downloader) and [grille-xlsx](https://github.com/wasedaigo/grille-xlsx) from Daigo Sato.