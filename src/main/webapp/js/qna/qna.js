define(['exports'], function (exports) {
    'use strict';

    /**
     * Defines the kind of inputs that the wizard can ask for
     * @const
     * @enum {number}
     */
    exports.InputEnum = Object.freeze({
        SINGLE_FILE: 0,                     // single file selection
        MULTIPLE_FILES: 1,                  // multiple file selection
        RADIO_BUTTONS: 2,
        CHECKBOX: 3,
        TEXTBOX: 4,
        COMBOBOX: 5,
        LISTBOX: 6,
        PROGRESS: 7,
        PLAIN_TEXT: 8,
        HTML: 9,
        PRE_HTML: 10
    });

    exports.QNAVariable = function () {

    };

    exports.QNAVariable.prototype.setType = function (type) {
        this.type = type;
        return this;
    };

    exports.QNAVariable.prototype.setIntro = function (intro) {
        this.intro = intro;
        return this;
    };

    exports.QNAVariable.prototype.setName = function (name) {
        this.name = name;
        return this;
    };

    exports.QNAVariable.prototype.setOptions = function (options) {
        this.options = options;
        return this;
    };

    exports.QNAVariable.prototype.setValue = function (value) {
        this.value = value;
        return this;
    };

    exports.QNAVariables = function () {

    };

    exports.QNAVariables.prototype.setIntro = function (intro) {
        this.intro = intro;
        return this;
    };

    exports.QNAVariables.prototype.setVariables = function (variables) {
        this.variables = variables;
        return this;
    };

    exports.QNAStep = function () {
        this.showNext = true;
        this.showPrevious = true;
        this.showRestart = false;
    };

    exports.QNAStep.prototype.setTitlePrefix = function(titlePrefix) {
        this.titlePrefix = titlePrefix;
        return this;
    };

    exports.QNAStep.prototype.setTitle = function (title) {
        this.title = title;
        return this;
    };

    exports.QNAStep.prototype.setIntro = function (intro) {
        this.intro = intro;
        return this;
    };

    exports.QNAStep.prototype.setInputs = function (inputs) {
        this.inputs = inputs;
        return this;
    };

    exports.QNAStep.prototype.setOutputs = function (outputs) {
        this.outputs = outputs;
        return this;
    };

    exports.QNAStep.prototype.setProcessStep = function (processStep) {
        this.processStep = processStep;
        return this;
    };

    exports.QNAStep.prototype.setNextStep = function (nextStep) {
        this.nextStep = nextStep;
        return this;
    };

    exports.QNAStep.prototype.setEnterStep = function (enterStep) {
        this.enterStep = enterStep;
        return this;
    };

    exports.QNAStep.prototype.setBackStep = function (backStep) {
        this.backStep = backStep;
        return this;
    };

    exports.QNAStep.prototype.setShowPrevious = function (showPrevious) {
        this.showPrevious = showPrevious;
        return this;
    };

    exports.QNAStep.prototype.setShowNext = function (showNext) {
        this.showNext = showNext;
        return this;
    };

    exports.QNAStep.prototype.getShowNextName = function () {
        return typeof this.processedShowNext === "string" ?
            this.processedShowNext : "Next";
    };

    exports.QNAStep.prototype.getShowPreviousName = function () {
        return typeof this.processedShowPrevious === "string" ?
            this.processedShowPrevious : "Previous";
    };

    exports.QNAStep.prototype.getShowRestartName = function () {
        return typeof this.showRestartProcessed === "string" ?
            this.showRestartProcessed : "Restart";
    };

    exports.QNAStep.prototype.setShowRestart = function (showRestart) {
        this.showRestart = showRestart;
        return this;
    };

    /**
     * The container that holds:
     *   the global config
     *   the incrementally built result
     *   the details of the current step
     * @constructor
     */
    exports.QNA = function (step, previousSteps, results, config) {
        this.step = step;
        this.previousSteps = previousSteps || [];
        this.results = results || [null];
        this.config = config || {};
    };

    exports.QNA.prototype.initialize = function (successCallback, errorCallback) {
        var result = this.results[this.results.length - 1];
        var step = this.step;
        var config = this.config;
        var me = this;

        // resolve some aspect of the variable
        var resolveDetail = function (variable, resolveFunction, newPropertyName, successCallback) {
            if (variable[resolveFunction] !== undefined && variable[resolveFunction] !== null) {
                if (variable[resolveFunction] instanceof Function) {
                    variable[resolveFunction](
                        function (value) {
                            if (newPropertyName) {
                                variable[newPropertyName] = value;
                            }
                            successCallback(value);
                        },
                        errorCallback,
                        result,
                        config
                    );
                } else {
                    // just copy plain values
                    variable[newPropertyName] = variable[resolveFunction];
                    successCallback(variable[resolveFunction]);
                }
            } else {
                successCallback(undefined);
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
                                                if (value !== undefined) {
                                                    // we do something a little different here. the value is what is shown
                                                    // in the ui, and that is bound to the config
                                                    config[variable.processedName] = value;
                                                }

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
                            'showNext',
                            'processedShowNext',
                            function () {
                                resolveDetail(
                                    step,
                                    'showPrevious',
                                    'processedShowPrevious',
                                    function () {
                                        resolveDetail(
                                            step,
                                            'showRestart',
                                            'processedShowRestart',
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
                                                                    // it is possible that no inputs or outputs are defined, so just
                                                                    // skip them if they are undefined
                                                                    if (ioVariables === undefined) {
                                                                        inputSuccessCallback();
                                                                        return;
                                                                    }

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
                                                                        setTimeout(function () {successCallback(me); }, 0);
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

    exports.QNA.prototype.hasNext = function () {
        if (this.step) {
            if (this.step.nextStep) {
                return true;
            }
        }

        return false;
    };

    exports.QNA.prototype.hasPrevious = function () {
        return this.previousSteps.length > 0;
    };

    exports.QNA.prototype.next = function (callback, errorCallback) {
        if (this.step && this.step.nextStep) {

            var gotoNextStep = (function (me) {
                return function (newResults) {
                    me.step.nextStep(
                        (function (me) {
                            return function (nextStep) {
                                if (nextStep) {
                                    callback(new exports.QNA(
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
                        newResults[newResults.length - 1],
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
                            if (result !== undefined) {
                                gotoNextStep(results.concat([result]));
                            } else {
                                // reuse the same last result
                                gotoNextStep(results.concat([results[results.length - 1]]));
                            }
                        };
                    }(this.results)),
                    function (title, message) {
                        errorCallback(title, message);
                        return;
                    },
                    this.results[this.results.length - 1],
                    this.config
                );
            } else {
                gotoNextStep(this.results.concat([this.results[this.results.length - 1]]));
            }
        } else {
            errorCallback("An error occurred.", "There is no current step or no function to call to get the next step.");
        }
    };

    exports.QNA.prototype.previous = function (callback, errorCallback) {
        if (this.previousSteps.length > 0) {

            var gotoPreviousStep = (function (me) {
                return function () {
                    callback(new exports.QNA(
                        me.previousSteps[me.previousSteps.length - 1],
                        me.previousSteps.splice(0, me.previousSteps.length - 1),
                        me.results.splice(0, me.results.length - 1),
                        me.config
                    ));
                };
            }(this));

            // process the current step and generate a result
            var newResults;
            if (this.step.backStep) {
                this.step.backStep(
                    (function () {
                        return function () {
                            gotoPreviousStep();
                        };
                    }(this.results)),
                    function (title, message) {
                        errorCallback(title, message);
                        return;
                    },
                    this.results[this.results.length - 1],
                    this.config
                );
            } else {
                gotoPreviousStep();
            }
        }

        return this;
    };
});