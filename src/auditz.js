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
    let currentUser = options.unknownUser;
    debug('ctx.options', ctx.options);

    if (ctx.options[options.remoteCtx]) {
      // console.log('Received token: ', ctx.options[options.remoteCtx].req);
      if (ctx.options[options.remoteCtx].req.accessToken) {
        currentUser = ctx.options[options.remoteCtx].req.accessToken.userId;
      }
    }

    if (ctx.isNewInstance !== undefined) {
      debug('Setting %s.%s to %s', ctx.Model.modelName, options.createdBy, currentUser);
      ctx.instance[options.createdBy] = currentUser;
    }

    if (ctx.options && ctx.options.skipUpdatedAt) { return next(); }
    if (ctx.instance) {
      debug('%s.%s before save: %s', ctx.Model.modelName, options.updatedAt, ctx.instance.id);
      ctx.instance[options.updatedAt] = new Date();
      ctx.instance[options.updatedBy] = currentUser;
    } else {
      debug('%s.%s before update matching %j',
        ctx.Model.pluralModelName, options.updatedAt, ctx.where);
      ctx.data[options.updatedAt] = new Date();
      ctx.data[options.updatedBy] = currentUser;
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
    return Model.updateAll(query, { ...scrubbed, [options.deletedAt]: new Date() })
      .then(result => (typeof callback === 'function') ? callback(null, result) : result)
      .catch(error => (typeof callback === 'function') ? callback(error) : Promise.reject(error));
  };

  Model.remove = Model.destroyAll;
  Model.deleteAll = Model.destroyAll;

  Model.destroyById = function softDestroyById(id, cb) {
    return Model.updateAll({ [idName]: id }, { ...scrubbed, [options.deletedAt]: new Date()})
      .then(result => (typeof cb === 'function') ? cb(null, result) : result)
      .catch(error => (typeof cb === 'function') ? cb(error) : Promise.reject(error));
  };

  Model.removeById = Model.destroyById;
  Model.deleteById = Model.destroyById;

  Model.prototype.destroy = function softDestroy(opt, cb) {
    const callback = (cb === undefined && typeof opt === 'function') ? opt : cb;

    return this.updateAttributes({ ...scrubbed, [options.deletedAt]: new Date() })
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
