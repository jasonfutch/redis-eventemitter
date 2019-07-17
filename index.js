var redis = require('redis');
var events = require('events');

module.exports = function(options) {
	options = options || {};

	if (!(options.port && options.host) && !options.url) {
		throw new Error('redis-eventemitter needs a url or port+host');
	}

	var pub = options.pub;
	var sub = options.sub;

	if (!options.pub) {
		if (options.auth) options.auth_pass = options.auth;

		pub = redis.createClient(options);
		sub = redis.createClient(options);
	}

	var that = new events.EventEmitter();
	var emit = events.EventEmitter.prototype.emit;
	var removeListener = events.EventEmitter.prototype.removeListener;

	var onerror = function(err) {
		if (!that.listeners('error').length) return;
		emit.apply(that, Array.prototype.concat.apply(['error'], arguments));
	};
	sub.on('error', onerror);
	pub.on('error', onerror);
	sub.on('pmessage', function(pattern, channel, messages) {
		try {
			emit.apply(that, [pattern, channel, messages]);
		}
		catch(err) {
			process.nextTick(emit.bind(that, 'error', err));
		}
	});

	that.on('newListener', function(pattern, listener) {
		if (pattern === 'error') return;

		if (that.listeners(pattern).length) return;
		sub.psubscribe(pattern);
	});
	that.emit = function(channel, message, cb) {
		if (channel in { newListener: 1, error: 1 }) return emit.apply(this, arguments);

		var hasMessage = !!message
		var isMessageAFunction = typeof message === 'function'
		var isCallbackAFunction = typeof cb === 'undefined' || typeof cb === 'function'

		if (!hasMessage) return onerror(new Error('Expected both a channel and a message'))
		if (isMessageAFunction) return onerror(new Error('Expected a message, but was given a function'))
		if (!isCallbackAFunction) return onerror(new Error('Callback is not a function'))

		pub.publish(channel, message, cb);
	};
	that.removeListener = function(pattern, listener) {
		if (pattern in {newListener:1, error:1}) return removeListener.apply(that, arguments);

		removeListener.apply(that, arguments);
		if (that.listeners(pattern).length) return that;
		sub.punsubscribe(pattern);
		return that;
	};
	that.removeAllListeners = function(pattern) {
		that.listeners(pattern).forEach(function(listener) {
			that.removeListener(pattern, listener);
		});
		return that;
	};
	that.close = function() {
		pub.quit();
		pub.unref();
		sub.quit();
		sub.unref();
	};
	that.pub = pub;
	that.sub = sub;

	return that;
};
