import _debug from './debug';

const debug = _debug();
const warn = (options, message) => {
  if (!options.silenceWarnings) {
    console.warn(message);
  }
};

export default (Model, bootOptions = {}) => {
  debug('Auditz mixin for Model %s', Model.modelName);

  const options = Object.assign({
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    deletedAt: 'deletedAt',
    createdBy: 'createdBy',
    updatedBy: 'updatedBy',
    deletedBy: 'deletedBy',
    unknownUser: 0,
    remoteCtx: 'remoteCtx',
    scrub: false,
    required: true,
    validateUpsert: false, // default to turning validation off
    silenceWarnings: false,
  }, bootOptions);

  debug('options', options);

  const properties = Model.definition.properties;
  const idName = Model.dataSource.idName(Model.modelName);

  let scrubbed = {};
  if (options.scrub !== false) {
    let propertiesToScrub = options.scrub;
    if (!Array.isArray(propertiesToScrub)) {
      propertiesToScrub = Object.keys(properties)
        .filter(prop => !properties[prop][idName] && prop !== options.deletedAt);
    }
    scrubbed = propertiesToScrub.reduce((obj, prop) => ({ ...obj, [prop]: null }), {});
  }

  if (!options.validateUpsert && Model.settings.validateUpsert) {
    Model.settings.validateUpsert = false;
    warn(options, `${Model.pluralModelName} settings.validateUpsert was overridden to false`);
  }

  if (Model.settings.validateUpsert && options.required) {
    warn(options, `Upserts for ${Model.pluralModelName} will fail when
          validation is turned on and time stamps are required`);
  }

  Model.defineProperty(options.createdAt, {type: Date, required: options.required, defaultFn: 'now'});
  Model.defineProperty(options.updatedAt, {type: Date, required: options.required});
  Model.defineProperty(options.deletedAt, {type: Date, required: false});

  Model.defineProperty(options.createdBy, {type: Number, required: false});
  Model.defineProperty(options.updatedBy, {type: Number, required: false});
  Model.defineProperty(options.deletedBy, {type: Number, required: false});

  Model.observe('before save', (ctx, next) => {
    debug('ctx.options', ctx.options);

    // determine the currently logged in user. Default to options.unknownUser
    let currentUser = options.unknownUser;

    if (ctx.options[options.remoteCtx]) {
      if (ctx.options[options.remoteCtx].req.accessToken) {
        currentUser = ctx.options[options.remoteCtx].req.accessToken.userId;
      }
    }

    // If it's a new instance, set the createdBy to currentUser
    if (ctx.isNewInstance !== undefined) {
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


    if (ctx.options && ctx.options.skipUpdatedAt) { return next(); }
    let keyAt = options.updatedAt;
    let keyBy = options.updatedBy;
    // Since soft deletes replace the actual delete by an update, we set the option
    // 'delete' in the overridden delete functions that perform updates.
    // We now have to determine if we need to set updatedAt/updatedBy or
    // deletedAt/deletedBy
    if (ctx.options && ctx.options.delete) {
      keyAt = options.deletedAt;
      keyBy = options.deletedBy;
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

  Model.destroyAll = function softDestroyAll(where, cb) {
    let query = where || {};
    let callback = cb;
    if (typeof where === 'function') {
      callback = where;
      query = {};
    }
    return Model.updateAll(query, { ...scrubbed }, {delete: true})
      .then(result => (typeof callback === 'function') ? callback(null, result) : result)
      .catch(error => (typeof callback === 'function') ? callback(error) : Promise.reject(error));
  };

  Model.remove = Model.destroyAll;
  Model.deleteAll = Model.destroyAll;

  Model.destroyById = function softDestroyById(id, opt, cb) {
    const callback = (cb === undefined && typeof opt === 'function') ? opt : cb;
    let newOpt = {delete: true};
    if (typeof opt === 'object') {
      newOpt.remoteCtx = opt.remoteCtx;
    }
    return Model.updateAll({ [idName]: id }, { ...scrubbed}, newOpt)
      .then(result => (typeof callback === 'function') ? callback(null, result) : result)
      .catch(error => (typeof callback === 'function') ? callback(error) : Promise.reject(error));
  };

  Model.removeById = Model.destroyById;
  Model.deleteById = Model.destroyById;

  Model.prototype.destroy = function softDestroy(opt, cb) {
    const callback = (cb === undefined && typeof opt === 'function') ? opt : cb;

    return this.updateAttributes({ ...scrubbed }, {delete: true})
      .then(result => (typeof cb === 'function') ? callback(null, result) : result)
      .catch(error => (typeof cb === 'function') ? callback(error) : Promise.reject(error));
  };

  Model.prototype.remove = Model.prototype.destroy;
  Model.prototype.delete = Model.prototype.destroy;

  // Emulate default scope but with more flexibility.
  const queryNonDeleted = {[options.deletedAt]: null};

  const _findOrCreate = Model.findOrCreate;
  Model.findOrCreate = function findOrCreateDeleted(query = {}, ...rest) {
    if (!query.deleted) {
      if (!query.where || Object.keys(query.where).length === 0) {
        query.where = queryNonDeleted;
      } else {
        query.where = { and: [ query.where, queryNonDeleted ] };
      }
    }

    return _findOrCreate.call(Model, query, ...rest);
  };

  const _find = Model.find;
  Model.find = function findDeleted(query = {}, ...rest) {
    if (!query.deleted) {
      if (!query.where || Object.keys(query.where).length === 0) {
        query.where = queryNonDeleted;
      } else {
        query.where = { and: [ query.where, queryNonDeleted ] };
      }
    }

    return _find.call(Model, query, ...rest);
  };

  const _count = Model.count;
  Model.count = function countDeleted(where = {}, ...rest) {
    // Because count only receives a 'where', there's nowhere to ask for the deleted entities.
    let whereNotDeleted;
    if (!where || Object.keys(where).length === 0) {
      whereNotDeleted = queryNonDeleted;
    } else {
      whereNotDeleted = { and: [ where, queryNonDeleted ] };
    }
    return _count.call(Model, whereNotDeleted, ...rest);
  };

  const _update = Model.update;
  Model.update = Model.updateAll = function updateDeleted(where = {}, ...rest) {
    // Because update/updateAll only receives a 'where', there's nowhere to ask for the deleted entities.
    let whereNotDeleted;
    if (!where || Object.keys(where).length === 0) {
      whereNotDeleted = queryNonDeleted;
    } else {
      whereNotDeleted = { and: [ where, queryNonDeleted ] };
    }
    return _update.call(Model, whereNotDeleted, ...rest);
  };
};
