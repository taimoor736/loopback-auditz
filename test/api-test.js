var test = require('tap').test;

var path = require('path');
var SIMPLE_APP = path.join(__dirname, 'fixtures', 'simple-app');
var app = require(path.join(SIMPLE_APP, 'server/server.js'));
var request = require('supertest');

app.models.User.create([
  {username: 'creator', password: 'secret', email: 'creator@example.com'},
  {username: 'modifier', password: 'secret', email: 'modifier@example.com'},
  {username: 'deleter', password: 'secret', email: 'deleter@example.com'}
], function() {
  app.start();
});

app.on('started', function() {
  test('loopback auditz remote calls', function(tap) {
    'use strict';
    var creatorToken, modifierToken, deleterToken;
    var creatorUserId, modifierUserId, deleterUserId;

    tap.tearDown(function() {
      app.stop();
    });

    tap.test('create/update/delete', function (t) {

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
            creatorToken = new Buffer(token.id).toString('base64');
            creatorUserId = token.userId;
            request(app)
              .post('/api/Users/login')
              .send({username: 'modifier', password: 'secret'})
              .end(function(err, res) {
                if (err) {
                  console.error(err);
                  return done(err);
                }
                var token = res.body;
                modifierToken = new Buffer(token.id).toString('base64');
                modifierUserId = token.userId;
                request(app)
                  .post('/api/Users/login')
                  .send({username: 'deleter', password: 'secret'})
                  .end(function(err, res) {
                    if (err) {
                      console.error(err);
                      return done(err);
                    }
                    var token = res.body;
                    deleterToken = new Buffer(token.id).toString('base64');
                    deleterUserId = token.userId;
                    done();
                  })
              })
          })
      });

      t.afterEach(function(done) {
        request(app)
          .get('/api/Widgets')
          .end(function(err, res) {
            var books = res.body;
            if (books.length === 0) {
              return done();
            }
            books.forEach(function(book) {
              request(app)
                .delete('/api/Widgets/'+book.id)
                .set({Authorization: 'Bearer '+deleterToken})
                .end(function() {
                  done();
                });
            });
          });
      });

      t.test('should set createdAt/createdBy on POST', function (tt) {
        request(app)
          .post('/api/Widgets')
          .set({Authorization: 'Bearer '+creatorToken})
          .send({name: 'book 1', type: 'fiction'})
          .expect(200)
          .end(function (err, res) {
            var book = res.body;
            tt.error(err);
            tt.type(book.createdAt, 'string');
            tt.equal(book.createdAt.length, 24);
            tt.equal(book.createdBy, creatorUserId);
            tt.end();
          });
      });

      t.test('should not change createdAt/createdBy on PUT', function(tt) {
        request(app)
          .post('/api/Widgets')
          .set({Authorization: 'Bearer '+creatorToken})
          .send({name: 'book 1', type: 'fiction'})
          .expect(200)
          .end(function (err, res) {
            var book = res.body;
            tt.error(err);
            tt.type(book.createdAt, 'string');
            tt.equal(book.createdBy, creatorUserId);
            book.name = 'book inf';
            request(app)
              .put('/api/Widgets')
              .set({Authorization: 'Bearer '+modifierToken})
              .send(book)
              .expect(200)
              .end(function (err, res) {
                var savedBook = res.body;
                tt.error(err);
                tt.equal(book.createdAt, savedBook.createdAt);
                tt.equal(book.createdBy, savedBook.createdBy);
                tt.equal(savedBook.updatedBy, modifierUserId);
                tt.type(savedBook.updatedAt, 'string');
                tt.equal(savedBook.updatedAt.length, 24);
                tt.end();
              });
          });
      });


      t.test('should not change createdAt/createdBy on PUT by id', function(tt) {
        request(app)
          .post('/api/Widgets')
          .set({Authorization: 'Bearer '+creatorToken})
          .send({name: 'book 1', type: 'fiction'})
          .expect(200)
          .end(function (err, res) {
            var book = res.body;
            tt.error(err);
            tt.type(book.createdAt, 'string');
            tt.equal(book.createdBy, creatorUserId);
            book.name = 'book inf';
            request(app)
              .put('/api/Widgets/'+book.id)
              .set({Authorization: 'Bearer '+modifierToken})
              .send(book)
              .expect(200)
              .end(function (err, res) {
                var savedBook = res.body;
                tt.error(err);
                tt.equal(book.createdAt, savedBook.createdAt);
                tt.equal(book.createdBy, savedBook.createdBy);
                tt.equal(savedBook.updatedBy, modifierUserId);
                tt.type(savedBook.updatedAt, 'string');
                tt.equal(savedBook.updatedAt.length, 24);
                tt.end();
              });
          });
      });

      t.test('should not change createdAt/createdBy on PATCH', function(tt) {
        request(app)
          .patch('/api/Widgets')
          .set({Authorization: 'Bearer '+creatorToken})
          .send({name: 'book 1', type: 'fiction'})
          .expect(200)
          .end(function (err, res) {
            var book = res.body;
            tt.error(err);
            tt.type(book.createdAt, 'string');
            tt.equal(book.createdBy, creatorUserId);
            book.name = 'book inf';
            request(app)
              .patch('/api/Widgets')
              .set({Authorization: 'Bearer '+modifierToken})
              .send(book)
              .expect(200)
              .end(function (err, res) {
                var savedBook = res.body;
                tt.error(err);
                tt.equal(book.createdAt, savedBook.createdAt);
                tt.equal(book.createdBy, savedBook.createdBy);
                tt.equal(savedBook.updatedBy, modifierUserId);
                tt.type(savedBook.updatedAt, 'string');
                tt.equal(savedBook.updatedAt.length, 24);
                tt.end();
              });
          });
      });

      t.test('should not change createdAt/createdBy on PATCH by id', function(tt) {
        request(app)
          .patch('/api/Widgets')
          .set({Authorization: 'Bearer '+creatorToken})
          .send({name: 'book 1', type: 'fiction'})
          .expect(200)
          .end(function (err, res) {
            var book = res.body;
            tt.error(err);
            tt.type(book.createdAt, 'string');
            tt.equal(book.createdBy, creatorUserId);
            book.name = 'book inf';
            request(app)
              .patch('/api/Widgets/'+book.id)
              .set({Authorization: 'Bearer '+modifierToken})
              .send(book)
              .expect(200)
              .end(function (err, res) {
                var savedBook = res.body;
                tt.error(err);
                tt.equal(book.createdAt, savedBook.createdAt);
                tt.equal(book.createdBy, savedBook.createdBy);
                tt.equal(savedBook.updatedBy, modifierUserId);
                tt.type(savedBook.updatedAt, 'string');
                tt.equal(savedBook.updatedAt.length, 24);
                tt.end();
              });
          });
      });

      t.test('should not retrieve deleted entries on GET all', function (tt) {
        request(app)
          .get('/api/Widgets')
          .end(function (err, res) {
            tt.error(err);
            var books = res.body;
            tt.type(books, 'object');
            tt.equal(books.length, 0);
            tt.end();
          });
      });

      t.test('should retrieve deleted entries on GET all with deleted flag', function (tt) {
        request(app)
          .get('/api/Widgets?filter[deleted]=true')
          .end(function (err, res) {
            tt.error(err);
            var books = res.body;
            tt.type(books, 'object');
            tt.equal(books.length, 5);
            books.forEach(function(b) {
              tt.equal(b.createdBy, creatorUserId, b.id+' has the right creator');
              if (b.id === 1) {
                tt.equal(b.updatedBy, creatorUserId, b.id+' has the right updater');
              } else {
                tt.equal(b.updatedBy, modifierUserId, b.id+' has the right updater');
              }
              tt.equal(b.deletedBy, deleterUserId, b.id+' has the right deleter');
            });
            tt.end();
          });
      });

      t.end();

    });

    tap.end();
  });
});