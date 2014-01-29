(function () {
    'use strict';

    /**
     * Defines the kind of inputs that the wizard can ask for
     * @const
     * @enum {number}
     */
    var InputEnum = Object.freeze({
        SINGLE_FILE: 0,                     // single file selection
        MULTIPLE_FILES: 1,                  // multiple file selection
        MUTUALLY_EXCLUSIVE_OPTION: 2,       // radio buttons
        OPTION: 3,                          // check boxes
        TEXT: 4                             // text box
    });

    /**
     *
     * @param type {!number} The type of input being requested, as defined in InputEnum
     * @param name {!string} The name of the value as it appears in the QNA config file
     * @param options {?Array.<string>} The available options. Only use if type == MUTUALLY_EXCLUSIVE_OPTION
     * @param value {function(?Object, !Object) A function that takes two parameters: the last computed value (or null
     *              no computed value is available) and the configuration options entered to this point.
     * @constructor
     */
    var QNAVariable = function (type, name, options, value) {
        this.type = type;
        this.name = name;
        this.options = options instanceof Array ? options : null;
        this.value = value || null;

        Object.freeze(this);
    };

    /**
     *
     * @param {(String|Array.<QNAVariable>)=} intro     This is the introductory text to be displayed above the options, or an
     *                                                  array of QNAVariable objects used to populate this object with.
     * @param {Array.<QNAVariable>=} variables          If intro is an array of QNAVariable, this is ignored. If intro is a String,
     *                                                  this is an array of QNAVariable objects used to populate this object with
     * @constructor
     */
    var QNAVariables = function (intro, variables) {
        this.intro = intro || null;
        this.variables = intro instanceof Array ? intro : variables || [];


        Object.freeze(this);
    };

    QNAVariables.prototype.addVariable = function (variable) {
        if (variable instanceof QNAVariable) {
            return new QNAVariables(this.intro, this.variables.concat([variable]));
        }

        return this;
    };

    var QNAStep = function (inputsAndOutputs, processStep, nextStep) {
        this.inputsAndOutputs = inputsAndOutputs;
        this.processStep = processStep;
        this.nextStep = nextStep;

        Object.freeze(this);
    };

    /**
     * The container that holds:
     *   the global config
     *   the incrementally built result
     *   the details of the current step
     * @constructor
     */
    var QNA = function (container, step, previousSteps, results, config) {
        this.container = container;
        this.step = step;
        this.previousSteps = Object.freeze(previousSteps) || Object.freeze([]);
        this.results = Object.freeze(results) || Object.freeze([null]);
        this.config = Object.freeze(config) || Object.freeze({});

        Object.freeze(this);
    };

    QNA.prototype.render = function () {

        return this;
    };

    QNA.prototype.hasNext = function () {
        if (this.step) {
            if (this.step.nextStep) {
                return true;
            }
        }

        return false;
    };

    QNA.prototype.hasPrevious = function () {
        return this.previousSteps.length > 0;
    };

    QNA.prototype.next = function () {
        if (this.step) {
            var newResults;
            if (this.step.processStep) {
                var result = this.step.processStep(this.results[this.results.length], this.config);
                newResults = this.results.concat(Object.freeze([result]));
            } else {
                newResults = this.results.concat(Object.freeze([this.results[this.results.length]]));
            }
            if (this.step.nextStep) {
                var nextStep = this.step.nextStep();
                if (nextStep) {
                    return new QNA(
                        this.container,
                        this.nextStep,
                        this.previousSteps.concat([this.step]),
                        newResults,
                        this.config
                    );
                }
            }
        }

        return this;
    };

    QNA.prototype.previous = function () {
        if (this.previousSteps.length > 0) {
            return new QNA(
                this.previousSteps[this.previousSteps.length - 1],
                this.previousSteps.splice(0, this.previousSteps.length - 1),
                this.results.splice(0, this.results.length - 1),
                this.config
            );
        }

        return this;
    };

    QNA.prototype.buildConfig = function (elements) {
        var inputs = {};

        return new QNA(
            this.container,
            this.step,
            this.previousSteps,
            this.results,
            Object.freeze(jQuery.extend(this.config, inputs))
        );
    };

    QNA.prototype.addToConfig = function (dictionary) {
        return new QNA(
            this.container,
            this.step,
            this.previousSteps,
            this.results,
            Object.freeze(jQuery.extend(this.config, dictionary))
        );
    };
}());