[![Coverage Status](https://coveralls.io/repos/github/jouke/loopback-auditz/badge.svg?branch=master)](https://coveralls.io/github/jouke/loopback-auditz?branch=master)

LoopBack Auditz
===============

This module is designed for the [Strongloop Loopback](https://github.com/strongloop/loopback) framework. It provides extensive support for Audit Trails in your LoopBack based application.

It consists of a group of functionalities:
* Soft Deletes (based upon the work of [loopback-softdelete-mixin](https://github.com/gausie/loopback-softdelete-mixin)).
* Timestamps of updates/creates (based upon the work of [loopback-ds-timestamp-mixin](https://github.com/clarkbw/loopback-ds-timestamp-mixin)). 
* Registration of the user that created/updated/deleted (thanks to the work of [loopback-component-remote-ctx](https://github.com/snowyu/loopback-component-remote-ctx.js)). *NOT YET IMPLEMENTED*
* History logging in a separate table (a port of [Sofa/Revisionable](https://github.com/jarektkaczyk/revisionable)). *NOT YET IMPLEMENTED*

Install
=======

```bash
  npm install --save loopback-component-remote-ctx loopback-auditz
```

Server Config
=============

Add the `mixins` property to your `server/model-config.json`:

```json
{
  "_meta": {
    "sources": [
      "loopback/common/models",
      "loopback/server/models",
      "../common/models",
      "./models"
    ],
    "mixins": [
      "loopback/common/mixins",
      "../node_modules/loopback-auditz",
      "../common/mixins"
    ]
  }
}
```

Make sure you enable authentication by putting the following in a boot script (ie `server/boot/authentication.js`):

```javascript
'use strict';
module.exports = function enableAuthentication(server) {
  // enable authentication
  server.enableAuth();
};
```

Enable the `loopback-component-remote-ctx` by adding the following in your `server/component-config.json`:

```json
  "loopback-component-remote-ctx": {
    "enabled": true,
    "argName": "remoteCtx",
    "blackList": ["User"]
  }
```

And finally use the loopback token middleware by adding the following line to your `server/server.js`:

```javascript
app.use(loopback.token());
```

Configure
=========

To use with your Models add the `mixins` attribute to the definition object of your model config.

```json
  {
    "name": "Widget",
    "properties": {
      "name": {
        "type": "string",
      },
    },
    "mixins": {
      "Auditz" : true,
    },
  },
```

There are a number of configurable options to the mixin:

```json
  "mixins": {
    "Auditz": {
      "createdAt": "created_at",
      "updatedAt": "updated_at",
      "deletedAt": "deleted_at",
      "createdBy": "created_by",
      "updatedBy": "updated_by",
      "deletedBy": "deleted_by",
      "unknownUser": 0,
      "remoteCtx": "remoteCtx",
      "scrub": true,
      "required": false,
      "validateUpsert": true,
      "silenceWarnings": false
     },
  },
```

### createdAt
This allows you to define an alternative name for the createdAt field

### updatedAt
This allows you to define an alternative name for the updatedAt field

### deletedAt
This allows you to define an alternative name for the deletedAt field

### createdBy
This allows you to define an alternative name for the createdBy field

### updatedBy
This allows you to define an alternative name for the updatedBy field

### deletedBy
This allows you to define an alternative name for the deletedBy field

### unknownUser
This allows you to define which userId should be filled out when no current user can be determined

### remoteCtx
The value you provided in `component-config.json` for `argName` of `loopback-component-remote-ctx`

### scrub
If true, this sets all but the "id" fields to null. If an array, it will only scrub properties with those names.

### required
This defines the requiredness of the createdAt and updatedAt fields. The `deletedAt` field is never required

### validateUpsert
This defines whether or not the validateUpsert property is set for the model

### silenceWarnings
This defines if the warnings should be suppressed or not

Operation Options
=================

Skipping updatedAt updating
---------------------------

By passing in additional options to an update or save operation you can control when this mixin updates the `updatedAt` field.  
The passing true to the option `skipUpdatedAt` will skip updating the `updatedAt` field.

In this example we assume a book object with the id of 2 already exists. Normally running this operation would change the `updatedAt` field to a new value.

```js
Book.updateOrCreate({name: 'New name', id: 2}, {skipUpdatedAt: true}, function(err, book) {
  // book.updatedAt will not have changed
});
```

Retrieving deleted entities
---------------------------

To run queries that include deleted items in the response, add `{ deleted: true }` to the query object (at the same level as `where`, `include` etc).

License
=======
[ISC](LICENSE.md)

Author
======

Jouke Visser <jouke at studio-mv dot nl>