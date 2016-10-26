[![Coverage Status](https://coveralls.io/repos/github/jouke/loopback-auditz/badge.svg?branch=master)](https://coveralls.io/github/jouke/loopback-auditz?branch=master)

LoopBack Auditz
===============

This module is designed for the [Strongloop Loopback](https://github.com/strongloop/loopback) framework. It provides extensive support for Audit Trails in your LoopBack based application.

It consists of a group of functionalities:
* Soft Deletes (based upon the work of [loopback-softdelete-mixin](https://github.com/gausie/loopback-softdelete-mixin)).
* Timestamps of updates/creates (based upon the work of [loopback-ds-timestamp-mixin](https://github.com/clarkbw/loopback-ds-timestamp-mixin)). 
* Registration of the user that created/updated/deleted (based upon the work of [loopback-component-remote-ctx](https://github.com/snowyu/loopback-component-remote-ctx.js)). *NOT YET IMPLEMENTED*
* History logging in a separate table (a port of [Sofa/Revisionable](https://github.com/jarektkaczyk/revisionable)). *NOT YET IMPLEMENTED*

Install
=======

```bash
  npm install --save loopback-auditz
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

There are a number of configurable options to the mixin. You can specify an alternative property name for `deletedAt`, as well as configuring deletion to "scrub" the entity. If true, this sets all but the "id" fields to null. If an array, it will only scrub properties with those names.

```json
  "mixins": {
    "Auditz": {
      "deletedAt": "deleted_at",
      "scrub": true,
      "createdAt" : "createdOn",
      "updatedAt" : "updatedOn",
      "required" : false,
      "validateUpsert": true,
      "silenceWarnings": false
     },
  },
```

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
[ISC](LICENSE)

Author
======

Jouke Visser <jouke at studio-mv dot nl>