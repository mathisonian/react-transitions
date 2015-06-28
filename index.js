

var _ = require('lodash');
var ease = require('d3-ease').ease;
var interpolate = require('d3-interpolate').interpolate;


var defaults = {
    DELAY: 0,
    DURATION: 500,
    EASING: 'cubic-in-out'
    // TYPE: 'number'
};

var getMaskedStateName = function(str) {
    return '__transition-' + str; 
};

var expandTransitionProp = function(transitionsProp) {

    var defaultConfig = {
        delay: defaults.DELAY,
        duration: defaults.DURATION,
        ease: ease(defaults.DEFAULT_EASING),
        // type: defaults.TYPE
    };

    var expanded = {};
    if(_.isArray(transitionsProp)) {
        _.each(transitionsProp, function(prop) {
            expanded[prop] = defaultConfig;
        });
    } else {
        _.each(transitionsProp, function(val, key) {
            expanded[key] = _.defaults(val, defaultConfig);
        });
    }

    return expanded;
}

var TransitionsMixin = {

    _transitionQueue: [],
    _transitionsInitialized: false,
    _propState: {},

    _initializeTransitions: function() {

        console.log(this.props.transitions)
        var transitions = this.props.transitions;

        transitions.props = expandTransitionProp(this.props.transitions.props || []);
        transitions.state = expandTransitionProp(this.props.transitions.state || []);

        this.transitions = transitions;

        var initialState = {};
        _.each(this.props.transitions.props, function(val, key) {
            initialState[getMaskedStateName(key)] = this.props[key];
        }, this);


        var self = this;

        this._propState = initialState;

        var props = self.props;
        Object.defineProperty(self, 'props', {
            enumerable: true,
            configurable: false,
            get: function() {
                var p = props;
                _.each(transitions.props, function(val, key) {
                    p[key] = self._propState[getMaskedStateName(key)]
                })
                return p;
            },

            set: function(v) {
                props = v;
            }
        });

        this._transitionsInitialized = true;
    },

    _animationFrameCallback: function() {

        var now = Date.now();

        this._transitionQueue = _.filter(this._transitionQueue, function(transition) {
            return now - transition.initTime < transition.config.duration;
        });

        if(this._transitionQueue.length === 0) {
            return;
        }

        var updates = {};

        _.each(this._transitionQueue, function(transition) {
            var t = now - transition.initTime > transition.config.duration ? 1 : Math.max(0, now - transition.initTime / transition.config.duration);
            var i = transition.config.interpolater;
            updates[transition.path] = i(t);
        }, this);

        // console.log('setstate');
        console.log(this.transitions.tick);
        var transitions = this.transitions;
        console.log(this.props);
        var self = this;

        this._propState = _.extend(this._propState, updates);
        this.transitions.tick.call(this);
        requestAnimationFrame(this._animationFrameCallback);
    },

    _transition: function(path, config) {

        this._transitionQueue.push({
            path: path,
            config: config,
            initTime: Date.now() + config.delay
        });

        if(this._transitionQueue.length === 1) {
            requestAnimationFrame(this._animationFrameCallback);
        }
    },

    componentWillReceiveProps: function(nextProps) {

        var self = this;

        var createTransitions = function() {

            var transitions = self.transitions;
            _.each(transitions.props, function(val, prop) {
                // console.log('creating transition: ' + prop);
                var interpolater = interpolate(self.state[getMaskedStateName(prop)], nextProps[prop]);
                self._transition(getMaskedStateName(prop), _.extend(val, {interpolater: interpolater}));
            });

            _.each(transitions.state, function(val, s) {
                // console.log('creating transition: ' + s);
                var interpolater = interpolate(self.state[s], nextProps[s]);
                self._transition(s, _.extend(val, {interpolater: interpolater}));
            });
        }

        if(!this._transitionsInitialized) {
            // console.log('initializizing');
            this._initializeTransitions();
            createTransitions();
        } else {
            // console.log('creating');
            createTransitions();
        }

        this._willReceiveProps && this._willReceiveProps(nextProps);
    }

};


module.exports = TransitionsMixin;
