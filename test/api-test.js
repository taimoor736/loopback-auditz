var test = require('tap').test;

var path = require('path');
var SIMPLE_APP = path.join(__dirname, 'fixtures', 'simple-app');
var app = require(path.join(SIMPLE_APP, 'server/server.js'));
var request = require('supertest');

app.models.User.create({username: 'creator', password: 'secret', email: 'creator@example.com'}, function() {
  app.start();
});

app.on('started', function() {
  test('loopback auditz remote calls', function(tap) {
    'use strict';
    var accessToken;
    var loggedInUserId;

    // app.models.User.create({username: 'modifier', password: 'secret', email: 'modifier@example.com'});
    // app.models.User.create({username: 'deleter', password: 'secret', email: 'deleter@example.com'});

    tap.test('createdAt', function (t) {

      t.beforeEach(function(done) {
        request(app)
          .post('/api/Users/login')
          .send({username: 'creator', password: 'secret'})
          .end(function(err, res) {
            if (err) {
              console.error(err);
              return done(err);
            }
            var token = res.body;
            accessToken = new Buffer(token.id).toString('base64');
            loggedInUserId = token.userId;
            done();
          })
      });

      t.test('should exist on create', function (tt) {
        request(app)
          .post('/api/Widgets')
          .set({Authorization: 'Bearer '+accessToken})
          .send({name: 'book 1', type: 'fiction'})
          .expect(200)
          .end(function (err, res) {
            var book = res.body;
            tt.error(err);
            tt.type(book.createdAt, 'string');
            tt.equal(book.createdAt.length, 24);
            tt.equal(book.createdBy, loggedInUserId);
            tt.end();
            app.stop();
          });
      });

      t.end();

    });

    tap.end();
  });
});