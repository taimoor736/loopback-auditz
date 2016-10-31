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

var revisions = app.models.revisions;

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
            if (err) {
              console.error(err);
            }
            var books = res.body;
            if (books.length === 0) {
              return done();
            }
            books.forEach(function(book) {
              request(app)
                .delete('/api/Widgets/'+book.id)
                .set({Authorization: 'Bearer '+deleterToken})
                .end(function() {
                  revisions.destroyAll(function() {
                    done();
                  });
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
            revisions.find({order: 'id ASC'}, function(err, revs) {
              tt.error(err);
              tt.equal(revs.length, 1);
              var rev = revs[0];
              tt.equal(rev.action, 'create');
              tt.equal(rev.table_name, 'Widget');
              tt.equal(rev.row_id, book.id);
              tt.equal(rev.old, null);
              tt.deepEqual(rev.new, book);
              tt.equal(rev.user, '' + creatorUserId);
              tt.equal(rev.ip, '::ffff:127.0.0.1');
              tt.assert(rev.ip_forwarded == null);
              tt.notEqual(rev.created_at, null);
              tt.end();
            });
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
                tt.error(err);
                var savedBook = res.body;
                revisions.find({order: 'id ASC'}, function(err, revs) {
                  tt.error(err);
                  // restore the old book.name value for comparison
                  book.name = 'book 1';
                  tt.equal(revs.length, 2);
                  tt.equal(revs[0].action, 'create');
                  tt.equal(revs[0].table_name, 'Widget');
                  tt.equal(revs[0].row_id, book.id);
                  tt.deepEqual(revs[0].old, null);
                  tt.deepEqual(revs[0].new, book);
                  tt.equal(revs[0].user, '' + creatorUserId);
                  tt.equal(revs[0].ip, '::ffff:127.0.0.1');
                  tt.assert(revs[0].ip_forwarded == null);
                  tt.notEqual(revs[0].created_at, null);
                  tt.equal(revs[1].action, 'update');
                  tt.equal(revs[1].table_name, 'Widget');
                  tt.equal(revs[1].row_id, savedBook.id);
                  tt.deepEqual(revs[1].old, book);
                  tt.deepEqual(revs[1].new, savedBook);
                  tt.equal(revs[1].user, '' + modifierUserId);
                  tt.equal(revs[1].ip, '::ffff:127.0.0.1');
                  tt.assert(revs[1].ip_forwarded == null);
                  tt.notEqual(revs[1].created_at, null);
                  tt.end();
                });
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
                // restore the old book.name value for comparison
                book.name = 'book 1';
                tt.error(err);
                revisions.find({order: 'id ASC'}, function(err, revs) {
                  tt.error(err);
                  tt.equal(revs.length, 2);
                  tt.equal(revs[0].action, 'create');
                  tt.equal(revs[0].table_name, 'Widget');
                  tt.equal(revs[0].row_id, book.id);
                  tt.deepEqual(revs[0].old, null);
                  tt.deepEqual(revs[0].new, book);
                  tt.equal(revs[0].user, '' + creatorUserId);
                  tt.equal(revs[0].ip, '::ffff:127.0.0.1');
                  tt.assert(revs[0].ip_forwarded == null);
                  tt.notEqual(revs[0].created_at, null);
                  tt.equal(revs[1].action, 'update');
                  tt.equal(revs[1].table_name, 'Widget');
                  tt.equal(revs[1].row_id, savedBook.id);
                  tt.deepEqual(revs[1].old, book);
                  tt.deepEqual(revs[1].new, savedBook);
                  tt.equal(revs[1].user, '' + modifierUserId);
                  tt.equal(revs[1].ip, '::ffff:127.0.0.1');
                  tt.assert(revs[1].ip_forwarded == null);
                  tt.notEqual(revs[1].created_at, null);
                  tt.end();
                });
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
                revisions.find({order: 'id ASC'}, function(err, revs) {
                  tt.error(err);
                  // restore the old book.name value for comparison
                  book.name = 'book 1';
                  tt.equal(revs.length, 2);
                  tt.equal(revs[0].action, 'create');
                  tt.equal(revs[0].table_name, 'Widget');
                  tt.equal(revs[0].row_id, book.id);
                  tt.deepEqual(revs[0].old, null);
                  tt.deepEqual(revs[0].new, book);
                  tt.equal(revs[0].user, '' + creatorUserId);
                  tt.equal(revs[0].ip, '::ffff:127.0.0.1');
                  tt.assert(revs[0].ip_forwarded == null);
                  tt.notEqual(revs[0].created_at, null);
                  tt.equal(revs[1].action, 'update');
                  tt.equal(revs[1].table_name, 'Widget');
                  tt.equal(revs[1].row_id, savedBook.id);
                  tt.deepEqual(revs[1].old, book);
                  tt.deepEqual(revs[1].new, savedBook);
                  tt.equal(revs[1].user, '' + modifierUserId);
                  tt.equal(revs[1].ip, '::ffff:127.0.0.1');
                  tt.assert(revs[1].ip_forwarded == null);
                  tt.notEqual(revs[1].created_at, null);
                  tt.end();
                });
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
                revisions.find({order: 'id ASC'}, function(err, revs) {
                  tt.error(err);
                  // restore the old book.name value for comparison
                  book.name = 'book 1';
                  tt.equal(revs.length, 2);
                  tt.equal(revs[0].action, 'create');
                  tt.equal(revs[0].table_name, 'Widget');
                  tt.equal(revs[0].row_id, book.id);
                  tt.deepEqual(revs[0].old, null);
                  tt.deepEqual(revs[0].new, book);
                  tt.equal(revs[0].user, '' + creatorUserId);
                  tt.equal(revs[0].ip, '::ffff:127.0.0.1');
                  tt.assert(revs[0].ip_forwarded == null);
                  tt.notEqual(revs[0].created_at, null);
                  tt.equal(revs[1].action, 'update');
                  tt.equal(revs[1].table_name, 'Widget');
                  tt.equal(revs[1].row_id, savedBook.id);
                  tt.deepEqual(revs[1].old, book);
                  tt.deepEqual(revs[1].new, savedBook);
                  tt.equal(revs[1].user, '' + modifierUserId);
                  tt.equal(revs[1].ip, '::ffff:127.0.0.1');
                  tt.assert(revs[1].ip_forwarded == null);
                  tt.notEqual(revs[1].created_at, null);
                  tt.end();
                });
              });
          });
      });

      t.test('Add a delete entry on DELETE by id', function(tt) {
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
                request(app)
                  .delete('/api/Widgets/'+book.id)
                  .set({Authorization: 'Bearer '+deleterToken})
                  .send(book)
                  // .expect(200)
                  .end(function (err, res) {
                    tt.error(err);
                    revisions.find({order: 'id ASC'}, function(err, revs) {
                      tt.error(err);
                      // restore the old book.name value for comparison
                      book.name = 'book 1';
                      tt.equal(revs.length, 3);
                      tt.equal(revs[0].action, 'create');
                      tt.equal(revs[0].table_name, 'Widget');
                      tt.equal(revs[0].row_id, book.id);
                      tt.deepEqual(revs[0].old, null);
                      tt.deepEqual(revs[0].new, book);
                      tt.equal(revs[0].user, '' + creatorUserId);
                      tt.equal(revs[0].ip, '::ffff:127.0.0.1');
                      tt.assert(revs[0].ip_forwarded == null);
                      tt.notEqual(revs[0].created_at, null);
                      tt.equal(revs[1].action, 'update');
                      tt.equal(revs[1].table_name, 'Widget');
                      tt.equal(revs[1].row_id, savedBook.id);
                      tt.deepEqual(revs[1].old, book);
                      tt.deepEqual(revs[1].new, savedBook);
                      tt.equal(revs[1].user, '' + modifierUserId);
                      tt.equal(revs[1].ip, '::ffff:127.0.0.1');
                      tt.assert(revs[1].ip_forwarded == null);
                      tt.notEqual(revs[1].created_at, null);
                      tt.equal(revs[2].action, 'delete');
                      tt.equal(revs[2].table_name, 'Widget');
                      tt.equal(revs[2].row_id, savedBook.id);
                      tt.deepEqual(revs[2].old, savedBook);
                      tt.deepEqual(revs[2].new, null);
                      tt.equal(revs[2].user, '' + deleterUserId);
                      tt.equal(revs[2].ip, '::ffff:127.0.0.1');
                      tt.assert(revs[2].ip_forwarded == null);
                      tt.notEqual(revs[2].created_at, null);
                      tt.end();
                    });
                  });
              });
          });
      });

      t.test('Add a multiple delete entries on destroyAll', function(tt) {
        revisions.destroyAll(function() {
          request(app)
            .patch('/api/Widgets')
            .set({Authorization: 'Bearer '+creatorToken})
            .send([{name: 'book 1', type: 'fiction'},{name: 'book 2', type: 'non-fiction'},{name: 'book 3', type: 'fiction'}])
            .expect(200)
            .end(function (err, res) {
              var books = res.body;
              tt.error(err);
              tt.equal(books.length, 3);
              books[0].name = 'book inf';
              request(app)
                .patch('/api/Widgets/'+books[0].id)
                .set({Authorization: 'Bearer '+modifierToken})
                .send(books[0])
                .expect(200)
                .end(function (err, res) {
                  var savedBook = res.body;
                  tt.error(err);
                  app.models.Widget.destroyAll(function(err, result) {
                    tt.error(err);
                    tt.equal(result.count, 3);
                    revisions.find({order: 'id ASC'}, function(err, revs) {
                      tt.error(err);
                      // restore the old book.name value for comparison
                      books[0].name = 'book 1';
                      tt.equal(revs.length, 7);

                      tt.equal(revs[0].action, 'create');
                      tt.equal(revs[0].table_name, 'Widget');
                      tt.equal(revs[0].row_id, books[0].id);
                      tt.deepEqual(revs[0].old, null);
                      tt.deepEqual(revs[0].new, books[0]);
                      tt.equal(revs[0].user, '' + creatorUserId);
                      tt.equal(revs[0].ip, '::ffff:127.0.0.1');
                      tt.assert(revs[0].ip_forwarded == null);
                      tt.notEqual(revs[0].created_at, null);
                      tt.equal(revs[1].action, 'create');
                      tt.equal(revs[1].table_name, 'Widget');
                      tt.equal(revs[1].row_id, books[1].id);
                      tt.deepEqual(revs[1].old, null);
                      tt.deepEqual(revs[1].new, books[1]);
                      tt.equal(revs[1].user, '' + creatorUserId);
                      tt.equal(revs[1].ip, '::ffff:127.0.0.1');
                      tt.assert(revs[1].ip_forwarded == null);
                      tt.notEqual(revs[1].created_at, null);
                      tt.equal(revs[2].action, 'create');
                      tt.equal(revs[2].table_name, 'Widget');
                      tt.equal(revs[2].row_id, books[2].id);
                      tt.deepEqual(revs[2].old, null);
                      tt.deepEqual(revs[2].new, books[2]);
                      tt.equal(revs[2].user, '' + creatorUserId);
                      tt.equal(revs[2].ip, '::ffff:127.0.0.1');
                      tt.assert(revs[2].ip_forwarded == null);
                      tt.notEqual(revs[2].created_at, null);

                      tt.equal(revs[3].action, 'update');
                      tt.equal(revs[3].table_name, 'Widget');
                      tt.equal(revs[3].row_id, savedBook.id);
                      tt.deepEqual(revs[3].old, books[0]);
                      tt.deepEqual(revs[3].new, savedBook);
                      tt.equal(revs[3].user, '' + modifierUserId);
                      tt.equal(revs[3].ip, '::ffff:127.0.0.1');
                      tt.assert(revs[3].ip_forwarded == null);
                      tt.notEqual(revs[3].created_at, null);

                      tt.equal(revs[4].action, 'delete');
                      tt.equal(revs[4].table_name, 'Widget');
                      tt.equal(revs[4].row_id, savedBook.id);
                      tt.deepEqual(revs[4].old, savedBook);
                      tt.deepEqual(revs[4].new, null);
                      tt.equal(revs[4].user, '0');
                      tt.equal(revs[4].ip, '127.0.0.1');
                      tt.equal(revs[4].ip_forwarded, '');
                      tt.notEqual(revs[4].created_at, null);
                      tt.equal(revs[5].action, 'delete');
                      tt.equal(revs[5].table_name, 'Widget');
                      tt.equal(revs[5].row_id, books[1].id);
                      tt.deepEqual(revs[5].old, books[1]);
                      tt.deepEqual(revs[5].new, null);
                      tt.equal(revs[5].user, '0');
                      tt.equal(revs[5].ip, '127.0.0.1');
                      tt.equal(revs[5].ip_forwarded, '');
                      tt.notEqual(revs[5].created_at, null);
                      tt.equal(revs[6].action, 'delete');
                      tt.equal(revs[6].table_name, 'Widget');
                      tt.equal(revs[6].row_id, books[2].id);
                      tt.deepEqual(revs[6].old, books[2]);
                      tt.deepEqual(revs[6].new, null);
                      tt.equal(revs[6].user, '0');
                      tt.equal(revs[6].ip, '127.0.0.1');
                      tt.equal(revs[6].ip_forwarded, '');
                      tt.notEqual(revs[6].created_at, null);
                      tt.end();
                    });
                  });
                });
            });
        });
      });


      t.end();

    });

    tap.end();
  });
});