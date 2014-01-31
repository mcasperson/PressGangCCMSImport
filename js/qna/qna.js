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
        CHECKBOX: 3,
        TEXTBOX: 4,
        COMBOBOX: 5,
        LISTBOX: 6
    });


    global.QNAVariable = function (type, intro, name, options, value) {
        this.type = type;
        this.intro = intro;
        this.name = name;
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
        this.variables = variables || null;
    };

    global.QNAStep = function (title, intro, inputs, outputs, processStep, nextStep) {
        this.title = title;
        this.intro = intro;
        this.inputs = inputs;
        this.outputs = outputs;
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

    global.QNA.prototype.initialize = function (successCallback, errorCallback) {
        var result = this.results[this.results.length - 1];
        var step = this.step;
        var config = this.config;
        var me = this;

        // resolve some aspect of the variable
        var resolveDetail = function (variable, resolveFunction, newPropertyName, successCallback) {
            if (variable[resolveFunction]) {
                variable[resolveFunction](
                    function (value) {
                        variable[newPropertyName] = value;
                        successCallback(value);
                    },
                    errorCallback,
                    result,
                    config
                );
            } else {
                successCallback(null);
            }
        };

        // a function to resolve the variable details
        var resolveVariable = function (index, variables, variableSuccessCallback) {
            if (variables === null || index >= variables.length) {
                variableSuccessCallback();
            } else {

                var processNextVariable = function () {
                    resolveVariable(index + 1, variables, variableSuccessCallback);
                };

                var variable = variables[index];
                resolveDetail(
                    variable,
                    'type',
                    'processedType',
                    function () {
                        resolveDetail(
                            variable,
                            'name',
                            'processedName',
                            function () {
                                resolveDetail(
                                    variable,
                                    'options',
                                    'processedOptions',
                                    function () {
                                        resolveDetail(
                                            variable,
                                            'value',
                                            null,
                                            function (value) {
                                                // we do something a little different here. the value is what is shown
                                                // in the ui, and that is bound to the config
                                                config[variable.processedName] = value;

                                                resolveDetail(
                                                    variable,
                                                    'intro',
                                                    'processedIntro',
                                                    function () {
                                                        processNextVariable();
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            }
        };

        resolveDetail(
            step,
            'title',
            'processedTitle',
            function () {
                resolveDetail(
                    step,
                    'intro',
                    'processedIntro',
                    function () {
                        resolveDetail(
                            step,
                            'inputs',
                            'processedInputs',
                            function (inputs) {
                                resolveDetail(
                                    step,
                                    'outputs',
                                    'processedOutputs',
                                    function (outputs) {
                                        // at this point the step has been resolved, so we now need to go through and
                                        // resolve the inputs

                                        var resolveInput = function (index, ioVariables, inputSuccessCallback) {
                                            if (ioVariables === null || index >= ioVariables.length) {
                                                inputSuccessCallback();
                                            } else {
                                                var input = ioVariables[index];
                                                resolveDetail(
                                                    input,
                                                    'intro',
                                                    'processedIntro',
                                                    function () {
                                                        resolveDetail(
                                                            input,
                                                            'variables',
                                                            'processedVariables',
                                                            function (variables) {
                                                                resolveVariable(0, variables, function () {
                                                                    resolveInput(index + 1, ioVariables, inputSuccessCallback);
                                                                });
                                                            }
                                                        );
                                                    }
                                                );
                                            }
                                        };

                                        resolveInput(0, inputs, function () {
                                            resolveInput(0, outputs, function () {
                                                // this function is always async to avoid issues with the $apply()
                                                // function in angular
                                                global.setTimeout(function () {successCallback(me); }, 0);
                                            });
                                        });
                                    }
                                );
                            },
                            errorCallback
                        );
                    },
                    errorCallback
                );
            },
            errorCallback
        );
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

            var gotoNextStep = (function (me) {
                return function (newResults) {
                    me.step.nextStep(
                        (function (me) {
                            return function (nextStep) {
                                if (nextStep) {
                                    callback(new global.QNA(
                                        nextStep,
                                        me.previousSteps.concat([me.step]),
                                        newResults,
                                        me.config,
                                        me.updatedCallback,
                                        errorCallback
                                    ));
                                }
                            };
                        }(me)),
                        function (title, message) {
                            errorCallback(title, message);
                        },
                        newResults[newResults.length],
                        me.config
                    );
                };
            }(this));

            // process the current step and generate a result
            var newResults;
            if (this.step.processStep) {
                this.step.processStep(
                    (function (results) {
                        return function (result) {
                            gotoNextStep(results.concat([result]));
                        };
                    }(this.results)),
                    function (title, message) {
                        errorCallback(title, message);
                        return;
                    },
                    this.results[this.results.length],
                    this.config
                );
            } else {
                gotoNextStep(this.results.concat([this.results[this.results.length]]));
            }
        } else {
            errorCallback("An error occurred.", "There is no current step or no function to call to get the next step.");
        }
    };

    global.QNA.prototype.previous = function (callback, errorCallback) {
        if (this.previousSteps.length > 0) {
            callback(new global.QNA(
                this.previousSteps[this.previousSteps.length - 1],
                this.previousSteps.splice(0, this.previousSteps.length - 1),
                this.results.splice(0, this.results.length - 1),
                this.config
            ));
        }

        return this;
    };
}(this));