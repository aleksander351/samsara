/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * @license MPL 2.0
 * @copyright Famous Industries, Inc. 2014
 */

/* Modified work copyright © 2015 David Valdman */

define(function(require, exports, module) {
    var tickQueue = require('samsara/core/queues/tickQueue');

    /**
     * A collection of timing utilities meant to translate the familiar setInterval, setTimeout
     *  timers to use Samsara's internal clock, which is backed by a requestAnimationFrame loop.
     *  It also includes other helpful methods for debouncing.
     *
     * @class Timer
     * @static
     */
    var Timer = {};

    var getTime = (window.performance)
        ? function() { return window.performance.now(); }
        : Date.now;

    function _addTimerFunction(fn) {
        tickQueue.push(fn);
        return fn;
    }

    function _clearTimerFunction(fn){
        var index = tickQueue.indexOf(fn);
        if (index === -1) return;
        tickQueue.splice(index, 1);
    }

    /**
     * Wraps a function to be invoked after a certain amount of time.
     *  After a set duration has passed, it executes the function.
     *
     * @method setTimeout
     * @param handler {Function}    Function to be run after a specified duration
     * @param duration {Number}     Time to delay execution (in milliseconds)
     * @return {Function}
     */
    Timer.setTimeout = function setTimeout(handler, duration) {
        var t = getTime();
        var callback = function() {
            var t2 = getTime();
            if (t2 - t >= duration) {
                handler.apply(this, arguments);
                Timer.clear(handler);
            }
        };
        return _addTimerFunction(callback);
    };

    /**
     * Wraps a function to be invoked at repeated intervals.
     *
     * @method setInterval
     *
     * @param handler {Function}    Function to be run at specified intervals
     * @param interval {Number}     Time interval (in milliseconds)
     * @return {Function}
     */
    Timer.setInterval = function setInterval(handler, duration) {
        var t = getTime();
        var callback = function() {
            var t2 = getTime();
            if (t2 - t >= duration) {
                handler.apply(this, arguments);
                t = getTime();
            }
        };
        return _addTimerFunction(callback);
    };

    /**
     * Wraps a function to be invoked after a specified number of Engine ticks.
     *
     * @method after
     * @param handler {Function}    Function to be executed
     * @param numTicks {Number}     Number of frames to delay execution
     * @return {Function}
     */
    Timer.after = function after(handler, numTicks) {
        if (numTicks === undefined) return undefined;
        var callback = function() {
            numTicks--;
            if (numTicks <= 0) { //in case numTicks is fraction or negative
                handler.apply(this, arguments);
                Timer.clear(handler);
            }
        };
        return _addTimerFunction(callback);
    };

    /**
     * Wraps a function to be invoked every specified number of Engine ticks.
     *
     * @method every
     * @param handler {Function}    Function to be executed
     * @param numTicks {Number}     Number of frames per execution
     * @return {Function}
     */
    Timer.every = function every(handler, numTicks) {
        numTicks = numTicks || 1;
        var initial = numTicks;
        var callback = function() {
            numTicks--;
            if (numTicks <= 0) {
                handler.apply(this, arguments);
                numTicks = initial;
            }
        };
        return _addTimerFunction(callback);
    };

    /**
     * Cancel a timer.
     *
     * @method clear
     * @param handler {Function} Handler
     */
    Timer.clear = function clear(handler) {
        _clearTimerFunction(handler);
    };

    /**
     * Debounces a function for specified duration.
     *
     * @method debounce
     * @param handler {Function}  Handler
     * @param duration {Number}   Duration
     * @return {function}
     */
    Timer.debounce = function debounce(handler, duration) {
        var timeout;
        return function() {
            var args = arguments;

            var fn = function() {
                timeout = null;
                handler.apply(this, args);
            }.bind(this);

            Timer.clear(timeout);
            timeout = Timer.setTimeout(fn, duration);
        };
    };

    /**
     * Debounces a function for a specified number of Engine frames.
     *
     * @method frameDebounce
     * @param handler {Function}  Handler
     * @param numFrames {Number}  Number of frames
     * @return {function}
     */
    Timer.frameDebounce = function frameDebounce(handler, numFrames){
        var timeout;
        return function() {
            var args = arguments;

            var fn = function() {
                timeout = null;
                handler.apply(this, args);
            }.bind(this);

            if (timeout) Timer.clear(timeout);
            timeout = Timer.after(fn, numFrames);
        };
    };

    module.exports = Timer;
});
