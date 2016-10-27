import { deprecate } from 'util';
import auditz from './auditz';

export default deprecate(
  app => app.loopback.modelBuilder.mixins.define('Auditz', auditz),
  'DEPRECATED: Use mixinSources, see https://github.com/jouke/loopback-auditz'
);

module.exports = exports.default;
