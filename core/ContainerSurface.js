
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * @license MPL 2.0
 * @copyright Famous Industries, Inc. 2014
 */

/* Modified work copyright © 2015 David Valdman */

/* Documentation in progress. May be outdated. */

define(function(require, exports, module) {
    var Surface = require('samsara/core/Surface');
    var Context = require('samsara/core/Context');
    var EventHandler = require('samsara/core/EventHandler');
    var dirtyQueue = require('samsara/core/queues/dirtyQueue');
    var preTickQueue = require('samsara/core/queues/preTickQueue');
    var Transform = require('samsara/core/Transform');

    var layoutSpec = {
        transform : Transform.identity,
        opacity : 1,
        origin : null,
        align : null,
        nextSizeTransform : Transform.identity
    };

    /**
     * ContainerSurface is an object designed to contain surfaces and
     *   set properties to be applied to all of them at once.
     *   This extends the Surface class.
     *   A container surface will enforce these properties on the
     *   surfaces it contains:
     *
     *   size (clips contained surfaces to its own width and height);
     *
     *   origin;
     *
     *   its own opacity and transform, which will be automatically
     *   applied to  all Surfaces contained directly and indirectly.
     *
     * @class ContainerSurface
     * @extends Surface
     * @constructor
     * @param {Array.Number} [options.size] [width, height] in pixels
     * @param {Array.string} [options.classes] CSS classes to set on all inner content
     * @param {Array} [options.properties] string dictionary of HTML attributes to set on target div
     * @param {string} [options.content] inner (HTML) content of surface (should not be used)
     */
    function ContainerSurface(options) {
        Surface.call(this, options);

        this._container = document.createElement('div');
        this._container.classList.add('samsara-container');

        this.context = new Context(this._container);
        this.setContent(this._container);

        this.size.on('resize', function(){
            var size = _getElementSize(this._container);
            this.context.setSize(size);
            this.emit('resize', size);
        }.bind(this));

        preTickQueue.push(function(){
            this.context._layout.trigger('start', layoutSpec);
            dirtyQueue.push(function(){
                this.context._layout.trigger('end', layoutSpec);
            }.bind(this));
        }.bind(this));
    }

    ContainerSurface.prototype = Object.create(Surface.prototype);
    ContainerSurface.prototype.constructor = ContainerSurface;
    ContainerSurface.prototype.elementType = 'div';
    ContainerSurface.prototype.elementClass = 'samsara-surface';

    function _getElementSize(element) {
        return [element.clientWidth, element.clientHeight];
    }

    ContainerSurface.prototype.setPerspective = function setPerspective(){
        Context.prototype.setPerspective.apply(this.context, arguments);
    };

    /**
     * Add renderables to this object's render tree
     *
     * @method add
     *
     * @param {Object} obj renderable object
     * @return {RenderNode} RenderNode wrapping this object, if not already a RenderNode
     */
    ContainerSurface.prototype.add = function add() {
        return Context.prototype.add.apply(this.context, arguments);
    };

    /**
     * Place the document element this component manages into the document.
     *
     * @private
     * @method deploy
     * @param {Node} target document parent of this container
     */
    ContainerSurface.prototype.deploy = function deploy() {
        return Surface.prototype.deploy.apply(this, arguments);
    };

    /**
     * Apply changes from this component to the corresponding document element.
     * This includes changes to classes, styles, size, content, opacity, origin,
     * and matrix transforms.
     *
     * @private
     * @method commit
     * @param {Spec} spec commit context
     */
    ContainerSurface.prototype.commit = function commit(spec, allocator) {
        Surface.prototype.commit.apply(this, arguments);
        Context.prototype.commit.apply(this.context);
    };

    module.exports = ContainerSurface;
});
