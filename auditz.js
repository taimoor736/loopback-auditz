'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _defineProperty2 = require('babel-runtime/helpers/defineProperty');

var _defineProperty3 = _interopRequireDefault(_defineProperty2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _extends3 = require('babel-runtime/helpers/extends');

var _extends4 = _interopRequireDefault(_extends3);

var _debug2 = require('./debug');

var _debug3 = _interopRequireDefault(_debug2);

var _utils = require('loopback/lib/utils');

var _utils2 = _interopRequireDefault(_utils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = (0, _debug3.default)();
var warn = function warn(options) {
  for (var _len = arguments.length, rest = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    rest[_key - 1] = arguments[_key];
  }

  if (!options.silenceWarnings) {
    var _console;

    (_console = console).warn.apply(_console, rest);
  }
};

exports.default = function (Model) {
  var bootOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  debug('Auditz mixin for Model %s', Model.modelName);
  var app = void 0;

  var options = (0, _extends4.default)({
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    deletedAt: 'deletedAt',
    createdBy: 'createdBy',
    updatedBy: 'updatedBy',
    deletedBy: 'deletedBy',
    softDelete: true,
    unknownUser: 0,
    remoteCtx: 'remoteCtx',
    scrub: false,
    required: true,
    validateUpsert: false, // default to turning validation off
    silenceWarnings: false,
    revisions: {
      name: 'revisions',
      idType: 'Number',
      dataSource: 'db',
      autoUpdate: true
    }
  }, bootOptions);

  options.revisionsModelName = (0, _typeof3.default)(options.revisions) === 'object' && options.revisions.name ? options.revisions.name : 'revisions';
  debug('options', options);

  var properties = Model.definition.properties;
  var idName = Model.dataSource.idName(Model.modelName);

  var scrubbed = {};
  if (options.softDelete) {
    if (options.scrub !== false) {
      var propertiesToScrub = options.scrub;
      if (!Array.isArray(propertiesToScrub)) {
        propertiesToScrub = (0, _keys2.default)(properties).filter(function (prop) {
          return !properties[prop][idName] && prop !== options.deletedAt && prop !== options.deletedBy;
        });
      }
      scrubbed = propertiesToScrub.reduce(function (obj, prop) {
        return (0, _extends4.default)({}, obj, (0, _defineProperty3.default)({}, prop, null));
      }, {});
    }
  }

  if (!options.validateUpsert && Model.settings.validateUpsert) {
    Model.settings.validateUpsert = false;
    warn(options, Model.pluralModelName + ' settings.validateUpsert was overridden to false');
  }

  if (Model.settings.validateUpsert && options.required) {
    warn(options, 'Upserts for ' + Model.pluralModelName + ' will fail when\n          validation is turned on and time stamps are required');
  }

  Model.settings.validateUpsert = options.validateUpsert;

  if (options.createdAt !== false) {
    if (typeof properties[options.createdAt] === 'undefined') {
      Model.defineProperty(options.createdAt, { type: Date, required: options.required, defaultFn: 'now' });
    }
  }

  if (options.updatedAt !== false) {
    if (typeof properties[options.updatedAt] === 'undefined') {
      Model.defineProperty(options.updatedAt, { type: Date, required: options.required });
    }
  }

  if (options.createdBy !== false) {
    if (typeof properties[options.createdBy] === 'undefined') {
      Model.defineProperty(options.createdBy, { type: Number, required: false });
    }
  }

  if (options.updatedBy !== false) {
    if (typeof properties[options.updatedBy] === 'undefined') {
      Model.defineProperty(options.updatedBy, { type: Number, required: false });
    }
  }

  if (options.softDelete) {
    if (typeof properties[options.deletedAt] === 'undefined') {
      Model.defineProperty(options.deletedAt, { type: Date, required: false });
    }
    if (typeof properties[options.deletedBy] === 'undefined') {
      Model.defineProperty(options.deletedBy, { type: Number, required: false });
    }
  }

  Model.observe('after save', function (ctx, next) {
    if (!options.revisions) {
      return next();
    }
    debug('ctx.options', ctx.options);

    // determine the currently logged in user. Default to options.unknownUser
    var currentUser = options.unknownUser;

    if (ctx.options[options.remoteCtx]) {
      if (ctx.options[options.remoteCtx].req.accessToken) {
        currentUser = ctx.options[options.remoteCtx].req.accessToken.userId;
      }
    }

    Model.getApp(function (err, a) {
      if (err) {
        return next(err);
      }
      app = a;
      var ipForwarded = '';
      var ip = '127.0.0.1';
      if (ctx.options.remoteCtx) {
        ipForwarded = ctx.options.remoteCtx.req.headers['x-forwarded-for'];
        ip = ctx.options.remoteCtx.req.connection.remoteAddress;
      }
      // If it's a new instance, set the createdBy to currentUser
      if (ctx.isNewInstance) {
        app.models[options.revisionsModelName].create({
          action: 'create',
          table_name: Model.modelName,
          row_id: ctx.instance.id,
          old: null,
          new: ctx.instance,
          user: currentUser,
          ip: ip,
          ip_forwarded: ipForwarded
        }, next);
      } else {
        if (ctx.options && ctx.options.delete) {
          if (ctx.options.oldInstance) {
            app.models[options.revisionsModelName].create({
              action: 'delete',
              table_name: Model.modelName,
              row_id: ctx.options.oldInstance.id,
              old: ctx.options.oldInstance,
              new: null,
              user: currentUser,
              ip: ip,
              ip_forwarded: ipForwarded
            }, next);
          } else if (ctx.options.oldInstances) {
            var entries = ctx.options.oldInstances.map(function (inst) {
              return {
                action: 'delete',
                table_name: Model.modelName,
                row_id: inst.id,
                old: inst,
                new: null,
                user: currentUser,
                ip: ip,
                ip_forwarded: ipForwarded
              };
            });
            app.models[options.revisionsModelName].create(entries, next);
          } else {
            debug('Cannot register delete without old instance! Options: %j', ctx.options);
            return next();
          }
        } else {
          if (ctx.options.oldInstance && ctx.instance) {
            var inst = ctx.instance;
            app.models[options.revisionsModelName].create({
              action: 'update',
              table_name: Model.modelName,
              row_id: inst.id,
              old: ctx.options.oldInstance,
              new: inst,
              user: currentUser,
              ip: ip,
              ip_forwarded: ipForwarded
            }, next);
          } else if (ctx.options.oldInstances) {
            var updatedIds = ctx.options.oldInstances.map(function (inst) {
              return inst.id;
            });
            var newInst = {};
            var query = { where: (0, _defineProperty3.default)({}, idName, { inq: updatedIds }) };
            app.models[Model.modelName].find(query, function (error, newInstances) {
              if (error) {
                return next(error);
              }
              newInstances.forEach(function (inst) {
                newInst[inst[idName]] = inst;
              });
              var entries = ctx.options.oldInstances.map(function (inst) {
                return {
                  action: 'update',
                  table_name: Model.modelName,
                  row_id: inst.id,
                  old: inst,
                  new: newInst[inst.id],
                  user: currentUser,
                  ip: ip,
                  ip_forwarded: ipForwarded
                };
              });
              app.models[options.revisionsModelName].create(entries, next);
            });
          } else {
            debug('Cannot register update without old and new instance. Options: %j', ctx.options);
            debug('instance: %j', ctx.instance);
            debug('data: %j', ctx.data);
            return next();
          }
        }
      }
    });
  });

  function getOldInstance(ctx, cb) {
    if (options.revisions) {
      if (typeof ctx.isNewInstance === 'undefined' || !ctx.isNewInstance) {
        var id = ctx.instance ? ctx.instance.id : null;
        if (!id) {
          id = ctx.data ? ctx.data.id : null;
        }
        if (!id && ctx.where) {
          id = ctx.where.id;
        }
        if (!id && ctx.options.remoteCtx) {
          id = ctx.options.remoteCtx.req && ctx.options.remoteCtx.req.args ? ctx.options.remoteCtx.req.args.id : null;
        }
        if (id) {
          Model.findById(id, { deleted: true }, function (err, oldInstance) {
            if (err) {
              cb(err);
            } else {
              cb(null, oldInstance);
            }
          });
        } else {
          var query = { where: ctx.where } || {};
          Model.find(query, function (err, oldInstances) {
            if (err) {
              cb(err);
            } else {
              if (oldInstances.length > 1) {
                return cb(null, oldInstances);
              } else if (oldInstances.length === 0) {
                return cb();
              }
              cb(null, oldInstances[0]);
            }
          });
        }
      } else {
        cb();
      }
    } else {
      cb();
    }
  }

  Model.observe('before save', function (ctx, next) {
    var softDelete = ctx.options.delete;

    getOldInstance(ctx, function (err, result) {
      if (err) {
        console.error(err);
        return next(err);
      }

      if (Array.isArray(result)) {
        ctx.options.oldInstances = result;
      } else {
        ctx.options.oldInstance = result;
      }
      // determine the currently logged in user. Default to options.unknownUser
      var currentUser = options.unknownUser;

      if (ctx.options[options.remoteCtx]) {
        if (ctx.options[options.remoteCtx].req.accessToken) {
          currentUser = ctx.options[options.remoteCtx].req.accessToken.userId;
        }
      }

      // If it's a new instance, set the createdBy to currentUser
      if (ctx.isNewInstance) {
        debug('Setting %s.%s to %s', ctx.Model.modelName, options.createdBy, currentUser);
        ctx.instance[options.createdBy] = currentUser;
      } else {
        // if the createdBy and createdAt are sent along in the data to save, remove the keys
        // as we don't want to let the user overwrite it
        if (ctx.instance) {
          delete ctx.instance[options.createdBy];
          delete ctx.instance[options.createdAt];
        } else {
          delete ctx.data[options.createdBy];
          delete ctx.data[options.createdAt];
        }
      }

      if (ctx.options && ctx.options.skipUpdatedAt) {
        return next();
      }
      var keyAt = options.updatedAt;
      var keyBy = options.updatedBy;
      if (options.softDelete) {
        // Since soft deletes replace the actual delete by an update, we set the option
        // 'delete' in the overridden delete functions that perform updates.
        // We now have to determine if we need to set updatedAt/updatedBy or
        // deletedAt/deletedBy
        if (softDelete) {
          keyAt = options.deletedAt;
          keyBy = options.deletedBy;
        }
      }
      if (ctx.instance) {
        ctx.instance[keyAt] = new Date();
        ctx.instance[keyBy] = currentUser;
      } else {
        ctx.data[keyAt] = new Date();
        ctx.data[keyBy] = currentUser;
      }
      return next();
    });
  });

  if (options.softDelete) {
    Model.destroyAll = function softDestroyAll(where, cb) {
      var query = where || {};
      var callback = cb || _utils2.default.createPromiseCallback();
      if (typeof where === 'function') {
        callback = where;
        query = {};
      }
      Model.updateAll(query, (0, _extends4.default)({}, scrubbed), { delete: true }).then(function (result) {
        return callback(null, result);
      }).catch(function (error) {
        return callback(error);
      });
      return callback.promise;
    };

    Model.remove = Model.destroyAll;
    Model.deleteAll = Model.destroyAll;

    Model.destroyById = function softDestroyById(id, opt, cb) {
      var callback = cb === undefined && typeof opt === 'function' ? opt : cb;
      callback = callback || _utils2.default.createPromiseCallback();
      var newOpt = { delete: true };
      if ((typeof opt === 'undefined' ? 'undefined' : (0, _typeof3.default)(opt)) === 'object') {
        newOpt.remoteCtx = opt.remoteCtx;
      }

      Model.updateAll((0, _defineProperty3.default)({}, idName, id), (0, _extends4.default)({}, scrubbed), newOpt).then(function (result) {
        return callback(null, result);
      }).catch(function (error) {
        return callback(error);
      });
      return callback.promise;
    };

    Model.removeById = Model.destroyById;
    Model.deleteById = Model.destroyById;

    Model.prototype.destroy = function softDestroy(opt, cb) {
      var callback = cb === undefined && typeof opt === 'function' ? opt : cb;
      callback = callback || _utils2.default.createPromiseCallback();
      this.updateAttributes((0, _extends4.default)({}, scrubbed), { delete: true }).then(function (result) {
        return callback(null, result);
      }).catch(function (error) {
        return callback(error);
      });
      return callback.promise;
    };

    Model.prototype.remove = Model.prototype.destroy;
    Model.prototype.delete = Model.prototype.destroy;

    // Emulate default scope but with more flexibility.
    var queryNonDeleted = (0, _defineProperty3.default)({}, options.deletedAt, null);

    var _findOrCreate = Model.findOrCreate;
    Model.findOrCreate = function findOrCreateDeleted() {
      var query = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      if (!query.deleted) {
        if (!query.where || (0, _keys2.default)(query.where).length === 0) {
          query.where = queryNonDeleted;
        } else {
          query.where = { and: [query.where, queryNonDeleted] };
        }
      }

      for (var _len2 = arguments.length, rest = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        rest[_key2 - 1] = arguments[_key2];
      }

      return _findOrCreate.call.apply(_findOrCreate, [Model, query].concat(rest));
    };

    var _find = Model.find;
    Model.find = function findDeleted() {
      var query = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      if (!query.deleted) {
        if (!query.where || (0, _keys2.default)(query.where).length === 0) {
          query.where = queryNonDeleted;
        } else {
          query.where = { and: [query.where, queryNonDeleted] };
        }
      }

      for (var _len3 = arguments.length, rest = Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        rest[_key3 - 1] = arguments[_key3];
      }

      return _find.call.apply(_find, [Model, query].concat(rest));
    };

    var _count = Model.count;
    Model.count = function countDeleted() {
      var where = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      // Because count only receives a 'where', there's nowhere to ask for the deleted entities.
      var whereNotDeleted = void 0;
      if (!where || (0, _keys2.default)(where).length === 0) {
        whereNotDeleted = queryNonDeleted;
      } else {
        whereNotDeleted = { and: [where, queryNonDeleted] };
      }

      for (var _len4 = arguments.length, rest = Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
        rest[_key4 - 1] = arguments[_key4];
      }

      return _count.call.apply(_count, [Model, whereNotDeleted].concat(rest));
    };

    var _update = Model.update;
    Model.update = Model.updateAll = function updateDeleted() {
      var where = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      // Because update/updateAll only receives a 'where', there's nowhere to ask for the deleted entities.
      var whereNotDeleted = void 0;
      if (!where || (0, _keys2.default)(where).length === 0) {
        whereNotDeleted = queryNonDeleted;
      } else {
        whereNotDeleted = { and: [where, queryNonDeleted] };
      }

      for (var _len5 = arguments.length, rest = Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
        rest[_key5 - 1] = arguments[_key5];
      }

      return _update.call.apply(_update, [Model, whereNotDeleted].concat(rest));
    };
  }

  function _setupRevisionsModel(opts) {
    var autoUpdate = opts.revisions === true || (0, _typeof3.default)(opts.revisions) === 'object' && opts.revisions.autoUpdate;
    var dsName = (0, _typeof3.default)(opts.revisions) === 'object' && opts.revisions.dataSource ? opts.revisions.dataSource : 'db';
    var rowIdType = (0, _typeof3.default)(opts.revisions) === 'object' && opts.revisions.idType ? opts.revisions.idType : 'Number';

    var revisionsDef = require('./models/revision.json');
    var settings = {};
    for (var s in revisionsDef) {
      if (s !== 'name' && s !== 'properties') {
        settings[s] = revisionsDef[s];
      }
    }

    revisionsDef.properties.row_id.type = rowIdType;
    var revisionsModel = app.dataSources[dsName].createModel(options.revisionsModelName, revisionsDef.properties, settings);
    var revisions = require('./models/revision')(revisionsModel, opts);

    app.model(revisions);

    if (autoUpdate) {
      // create or update the revisions table
      app.dataSources[dsName].autoupdate([options.revisionsModelName], function (error) {
        if (error) {
          console.error(error);
        }
      });
    }
  }

  if (options.revisions) {
    Model.getApp(function (err, a) {
      if (err) {
        return console.error(err);
      }
      app = a;
      if (!app.models[options.revisionsModelName]) {
        _setupRevisionsModel(options);
      }
    });
  }
};

module.exports = exports['default'];
//# sourceMappingURL=auditz.js.map
