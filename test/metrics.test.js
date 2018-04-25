'use strict';

var assert = require('proclaim');
var metrics = require('../lib').constructor.metrics;
var sinon = require('sinon');

describe('metrics', function() {
  var xhr;
  var spy;

  beforeEach(function() {
    xhr = sinon.useFakeXMLHttpRequest();

    spy = sinon.spy();
    xhr.onCreate = spy;
  });

  afterEach(function() {
    metrics.options({});

    if (xhr.restore) xhr.restore();
  });

  describe('#increment', function() {
    it('should not enqueue items by default', function() {
      metrics.increment('test', []);

      assert.deepEqual(metrics.queue, []);
    });

    it('should enqueue items when sampleRate is set', function() {
      metrics.options({ sampleRate : 1 });

      metrics.increment('test', []);

      assert.deepEqual(metrics.queue, [ { type: 'counter', metric: 'test', tags: [] } ]);
    });
  });

  describe('#_flush', function() {
    beforeEach(function() {
      metrics.options({ sampleRate: 1 });
    });

    it('should not make a request if queue is empty', function() {
      metrics._flush();

      assert.isFalse(spy.calledOnce);
    });

    it('should make a request if queue has an item', function() {
      metrics.increment('foo', {});

      metrics._flush();

      assert.isTrue(spy.calledOnce);
      var req = spy.getCall(0).args[0];
      assert.strictEqual(req.url, 'https://api.segment.io/v1/m');
      assert.strictEqual(req.requestBody, '{"metrics":[{"type":"counter","metric":"foo","tags":{}}]}');
    });

    it('should make a request if queue has multiple items', function() {
      metrics.increment('test1', { foo: 'bar' });
      metrics.increment('test2', {});

      metrics._flush();

      assert.isTrue(spy.calledOnce);
      var req = spy.getCall(0).args[0];
      assert.strictEqual(req.url, 'https://api.segment.io/v1/m');
      assert.strictEqual(req.requestBody, '{"metrics":[{"type":"counter","metric":"test1","tags":{"foo":"bar"}},{"type":"counter","metric":"test2","tags":{}}]}');
    });

    it('should empty the queue', function() {
      metrics.increment('test1', { foo: 'bar' });

      metrics._flush();

      assert.deepEqual(metrics.queue, []);
    });
  });

  describe('flush timer', function() {
    beforeEach(function() {
      metrics.options({
        sampleRate: 1,
        flushTimer: 1
      });
    });

    it('should flush', function(done) {
      metrics.increment('test1', { foo: 'bar' });

      setTimeout(function() {
        assert.isTrue(spy.calledOnce);
        var req = spy.getCall(0).args[0];
        assert.strictEqual(req.url, 'https://api.segment.io/v1/m');
        assert.strictEqual(req.requestBody, '{"metrics":[{"type":"counter","metric":"test1","tags":{"foo":"bar"}}]}');

        assert.deepEqual(metrics.queue, []);

        done();
      }, 10);
    });
  });

  describe('#options', function() {
    it('should handle empty options correctly', function() {
      metrics.options({});

      assert.equal(metrics.host, 'api.segment.io/v1');
      assert.equal(metrics.sampleRate, 0);
      assert.equal(metrics.flushTimer, 30000);
      assert.deepEqual(metrics.queue, []);
    });

    it('should respect host option', function() {
      metrics.options({ host: 'api.segment.com/v1' });

      assert.equal(metrics.host, 'api.segment.com/v1');
    });

    it('should respect sampleRate option', function() {
      metrics.options({ sampleRate: 0.1 });

      assert.equal(metrics.sampleRate, 0.1);
    });

    it('should respect flushTimer option', function() {
      metrics.options({ flushTimer: 10 * 1000 });

      assert.equal(metrics.flushTimer, 10000);
    });
  });
});
