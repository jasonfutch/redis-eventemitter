var redis = require('./index');
var assert = require('assert');

var testsMissing = 0;
var expectCall = function(name, f) {
	testsMissing++;
	console.log(`Expect ${name} to be called. Outstanding tests: ${testsMissing}`)
	var count = 1;
	return function() {
		testsMissing--;
		console.log(`${name} was called. Outstanding tests: ${testsMissing}`)
		assert(count-- >= 0);
		f.apply(null, arguments);
	};
};
var hub = redis({
	url: 'redis://localhost:6379/cache/0'
});

/* Standard tests */
hub.on('testSimple', expectCall('testSimple', function(channel, msg) {
	assert(channel == 'testSimple');
	assert(msg === 'ok');
}));
hub.on('*:testGlobBefore', expectCall('testGlobBefore', function(channel, msg) {
	assert(channel === 'foo:testGlobBefore');
}));
hub.on('testGlobAfter:*', expectCall('testGlobAfter', function(channel, msg) {
	assert(channel === 'testGlobAfter:foo');
}));
hub.once('testOnce', expectCall('testOnce', function() { }));
hub.on('testJson', expectCall('testJson', function(channel, json) {
	assert(JSON.parse(json).msg === 'ok');
}));
hub.on('testTwoListeners', expectCall('testTwoListeners', function() { }));
hub.on('testTwoListeners', expectCall('testTwoListeners', function() { }));


/* Test callback */
hub.on('testCallbackAndArgs', expectCall('testCallbackAndArgs', function(channel, msg) {
	assert(channel === 'testCallbackAndArgs');
	assert(msg === 'testArg');
}));


/* Test errors*/
var testNoMessage = expectCall('testNoMessage', function () { })
var testCallbackInsteadOfArgs = expectCall('testCallbackInsteadOfArgs', function () { })
var testCallbackNotAFunction = expectCall('testCallbackNotAFunction', function () { })
hub.on('error', err => {
	if (err.message === 'Expected both a channel and a message') return testNoMessage()
	if (err.message === 'Expected a message, but was given a function') return testCallbackInsteadOfArgs()
	if (err.message === 'Callback is not a function') return testCallbackNotAFunction()
})

// Wait a second before emitting as there's a small race condition where the listener might not have been registered yet
setTimeout(() => {
	hub.emit('testSimple', 'ok');
	hub.emit('foo:testGlobBefore', 'ok');
	hub.emit('testGlobAfter:foo', 'ok');
	hub.emit('testOnce', 'ok');
	hub.emit('testOnce', 'ok');
	hub.emit('testJson', JSON.stringify({ msg: 'ok' }));
	hub.emit('testTwoListeners', 'ok');
	hub.emit('testCallbackAndArgs', 'testArg', expectCall('testCallbackAndArgs', function () { }));
	hub.emit('testNoMessage')
	hub.emit('testCallbackInsteadOfArgs', function () { })
	hub.emit('testCallbackNotAFunction', 'foo', 'bar')
}, 1000)

setTimeout(function() {
	assert(!testsMissing);
	hub.close();
}, 2000);

setTimeout(function() {
	// Check to see if .close() works
	process.exit(1);
}, 5000).unref();
