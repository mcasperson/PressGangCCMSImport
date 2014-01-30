(function (global) {
    'use strict';

    /**
     * Defines the kind of inputs that the wizard can ask for
     * @const
     * @enum {number}
     */
    global.InputEnum = Object.freeze({
        SINGLE_FILE: 0,                     // single file selection
        MULTIPLE_FILES: 1,                  // multiple file selection
        RADIO_BUTTONS: 2,
        CHECKBOXES: 3,
        TEXTBOX: 4,
        COMBOBOX: 5,
        LISTBOX: 6
    });


    global.QNAVariable = function (type, intro, name, options, value) {
        this.type = type;
        this.name = name;
        this.intro = intro;
        this.options = options || null;
        this.value = value || null;
    };

    /**
     *
     * @param intro {?String}                           This is the introductory text to be displayed above the options, or an
     *                                                  array of QNAVariable objects used to populate this object with.
     * @param variables {?Array.<QNAVariable>}          If intro is an array of QNAVariable, this is ignored. If intro is a String,
     *                                                  this is an array of QNAVariable objects used to populate this object with
     * @constructor
     */
    global.QNAVariables = function (intro, variables) {
        this.intro = intro || null;
        this.variables = variables || [];
    };

    global.QNAStep = function (title, intro, inputs, processStep, nextStep) {
        this.title = title;
        this.intro = intro;
        this.inputs = inputs;
        this.processStep = processStep;
        this.nextStep = nextStep;
    };

    /**
     * The container that holds:
     *   the global config
     *   the incrementally built result
     *   the details of the current step
     * @constructor
     */
    global.QNA = function (step, previousSteps, results, config) {
        this.step = step;
        this.previousSteps = previousSteps || [];
        this.results = results || [null];
        this.config = config || {};
    };

    global.QNA.prototype.hasNext = function () {
        if (this.step) {
            if (this.step.nextStep) {
                return true;
            }
        }

        return false;
    };

    global.QNA.prototype.hasPrevious = function () {
        return this.previousSteps.length > 0;
    };

    global.QNA.prototype.next = function (callback, errorCallback) {
        if (this.step && this.step.nextStep) {

            var gotoNextStep = function (newResults) {
                this.step.nextStep(
                    newResults[newResults.length],
                    this.config,
                    function (nextStep) {
                        if (nextStep) {
                            callback(new global.QNA(
                                this.container,
                                this.nextStep,
                                this.previousSteps.concat([this.step]),
                                newResults,
                                this.config
                            ));
                        }
                    },
                    function (title, message) {
                        errorCallback(title, message);
                    }
                );
            };


            // process the current step and generate a result
            var newResults;
            if (this.step.processStep) {
                this.step.processStep(
                    this.results[this.results.length],
                    this.config,
                    function (result) {
                        gotoNextStep(this.results.concat([result]));
                    },
                    function (title, message) {
                        errorCallback(title, message);
                        return;
                    }
                );
            } else {
                gotoNextStep(this.results.concat([this.results[this.results.length]]));
            }
        } else {
            errorCallback("An error occurred.", "There is no current step or no function to call to get the next step.");
        }
    };

    global.QNA.prototype.previous = function () {
        if (this.previousSteps.length > 0) {
            return new global.QNA(
                this.previousSteps[this.previousSteps.length - 1],
                this.previousSteps.splice(0, this.previousSteps.length - 1),
                this.results.splice(0, this.results.length - 1),
                this.config
            );
        }

        return this;
    };
}(this));