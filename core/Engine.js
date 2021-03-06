/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * @license MPL 2.0
 * @copyright Famous Industries, Inc. 2014
 */

/* Modified work copyright © 2015 David Valdman */

define(function(require, exports, module) {
    var Context = require('./Context');
    var Transform = require('./Transform');
    var EventHandler = require('./EventHandler');
    var ResizeStream = require('samsara/streams/ResizeStream');
    var preTickQueue = require('./queues/preTickQueue');
    var dirtyQueue = require('./queues/dirtyQueue');
    var postTickQueue = require('./queues/postTickQueue');
    var State = require('samsara/core/SUE');
    var tickQueue = require('./queues/tickQueue');
    var Stream = require('samsara/streams/Stream');
    var RootNode = require('./nodes/RootNode');

    var contexts = [];
    var roots = [];
    var rafId = 0;
    var eventForwarders = {};
    var listenOnTick = false;
    var size = new ResizeStream;
    var layout = new EventHandler();
    var eventHandler = new EventHandler();

    var layoutSpec = {
        transform : Transform.identity,
        opacity : 1,
        origin : null,
        align : null,
        nextSizeTransform : Transform.identity
    };

    /**
     * Engine is a singleton object that is required to run a Samsara application.
     *   It is the "heartbeat" of the application, managing the batching of streams
     *   and the commiting of all RootNodes.
     *
     *   It also listens and can respond to DOM events on the HTML <body> tag.
     *
     * @class Engine
     * @static
     * @uses EventHandler
     */
    var Engine = {};

    EventHandler.setInputHandler(Engine, eventHandler);
    EventHandler.setOutputHandler(Engine, eventHandler);

    //TODO: add this only for full-screen apps
    //document.body.classList.add('samsara-root');

    /**
     * Updates by a single frame of the application by looping through all function queues.
     *  This is repeatedly called within a requestAnimationFrame loop until the application
     *  is receiving no layout changes. At this point the requestAnimationFrame will be
     *  canceled until the next change.
     *
     * @private
     * @method step
     */
    Engine.step = function step() {
        // browser events and their handlers happen before rendering begins
        while (preTickQueue.length) (preTickQueue.shift())();

        // tick signals base event flow coming in
        State.set(State.STATES.UPDATE);

        if (listenOnTick) eventHandler.emit('tick');
        
        for (var i = 0; i < tickQueue.length; i++) tickQueue[i]();

        // post tick is for resolving larger components from their incoming signals
        while (postTickQueue.length) (postTickQueue.shift())();

        State.set(State.STATES.END);

        for (var i = 0; i < contexts.length; i++)
            contexts[i].commit();

        for (var i = 0; i < roots.length; i++)
            roots[i].commit();

        while (dirtyQueue.length) (dirtyQueue.shift())();

        State.set(State.STATES.START);
    };

    /**
     * A ResizeStream representing the document's <body> size.
     *
     * @property size
     */
    Engine.size = size;

    /**
     * Creates a new Root Node from which a scene graph can be constructed.
     *  Use this to modify preexisting elements in 2D space.
     *
     * @method createRoot
     * @return {RootNode}
     */
    Engine.createRoot = function createRoot(){
        var root = new RootNode();
        Engine.registerRoot(root);
        return root;
    };

    /**
     * Hook up listeners to a RootNode and add to an internal array for commiting.
     *
     * @method registerRoot
     * @private
     */
    Engine.registerRoot = function registerRoot(root){
        root._size.subscribe(size);
        root._layout.subscribe(layout);
        roots.push(root);
    };

    /**
     * Remove listeners to RootNode and remove from internal commit array.
     *
     * @method deregisterRoot
     * @private
     */
    Engine.deregisterRoot = function deregisterRoot(root){
        var i = roots.indexOf(root);
        if (i < 0) return;
        root._size.unsubscribe(size);
        root._layout.unsubscribe(layout);
        roots.splice(i, 1);
    };

    /**
     * Creates a new Context from which a scene graph can be constructed.
     *
     * @method createContext
     * @param [DOMelement] {Node}   Pre-existing element in the document
     * @return {Context}
     */
    Engine.createContext = function createContext(DOMelement) {
        var context = new Context(DOMelement);
        Engine.registerContext(context);
        if (!DOMelement) document.body.appendChild(context.container);
        return context;
    };

    /**
     * Registers an existing Context to be updated by the run loop.
     *
     * @static
     * @method registerContext
     * @param context {Context}     Context to register
     */
    Engine.registerContext = function registerContext(context) {
        context._size.subscribe(size);
        context._layout.subscribe(layout);
        contexts.push(context);
    };

    /**
     * Removes a Context from the run loop.
     *  Note: this does not do any cleanup.
     *
     * @method deregisterContext
     * @param context {Context}     Context to deregister
     */
    Engine.deregisterContext = function deregisterContext(context) {
        var i = contexts.indexOf(context);
        if (i < 0) return;
        context._size.unsubscribe(size);
        context._layout.unsubscribe(layout);
        contexts.splice(i, 1);
    };

    /**
     * Adds a handler to an event on the DOM <body>, e.g., "click".
     *
     * @method on
     * @param type {string}         DOM event name
     * @param handler {function}    Handler
     */
    Engine.on = function on(type, handler){
        if (type === 'tick') listenOnTick = true;
        if (!(type in eventForwarders)) {
            eventForwarders[type] = eventHandler.emit.bind(eventHandler, type);
            document.addEventListener(type, eventForwarders[type]);
        }
        eventHandler.on(type, handler);
    };

    /**
     * Removes a previously added handler.
     *
     * @method off
     */
    Engine.off = function off(type, handler){
        if (type === 'tick') listenOnTick = false;
        if (!(type in eventForwarders)) {
            document.removeEventListener(type, eventForwarders[type]);
        }
        eventHandler.off(type, handler);
    };

    /**
     * Initiates the Engine's heartbeat.
     *
     * @method start
     */
    Engine.start = start;

    function loop() {
        Engine.step();
        rafId = window.requestAnimationFrame(loop);
    }

    function start(){
        handleResize();
        preTickQueue.push(function start(){
            layout.emit('start', layoutSpec);
            dirtyQueue.push(function(){
                layout.emit('end', layoutSpec);
            });
        });

        loop();
    }

    function handleResize() {
        var windowSize = [window.innerWidth, window.innerHeight];
        size.emit('resize', windowSize);
        eventHandler.emit('resize', windowSize);

        dirtyQueue.push(function engineResizeClean(){
            size.emit('resize', windowSize);
        });
    }

    window.addEventListener('resize', handleResize, false);
    window.addEventListener('touchmove', function(event) {
        event.preventDefault();
    }, true);

    module.exports = Engine;
});
