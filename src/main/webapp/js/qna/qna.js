define(['async/async', 'exports'], function (async, exports) {
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
        PRE_HTML: 10,
        DIRECTORY: 11
    });

    exports.QNAVariable = function () {

    };

    /**
     * @param disabled true if the input field should be disabled. This has no effect on output fields, as they are
     * always disabled. Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAVariable.prototype.setDisabled = function (disabled) {
        this.disabled = disabled;
        return this;
    };

    /**
     *
     * @param type The InputEnum that defined what kind of UI element this variable will be displayed as.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAVariable.prototype.setType = function (type) {
        this.type = type;
        return this;
    };

    /**
     *
     * @param intro A string that will be displayed next to the UI element.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAVariable.prototype.setIntro = function (intro) {
        this.intro = intro;
        return this;
    };

    /**
     *
     * @param name A string that defines what variable on the config object (i.e. object[name]) the
     * UI element will read and write to.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAVariable.prototype.setName = function (name) {
        this.name = name;
        return this;
    };

    /**
     *
     * @param options A string[] that defines the values the UI element can take. It is only used for
     * UI elements like radio button and checkboxes.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAVariable.prototype.setOptions = function (options) {
        this.options = options;
        return this;
    };

    /**
     *
     * @param value Sets the initial value of the variable.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAVariable.prototype.setValue = function (value) {
        this.value = value;
        return this;
    };

    /**
     * A collection of QNAVariable objects, with some additional info.
     * @constructor
     */
    exports.QNAVariables = function () {

    };

    /**
     *
     * @param intro A string that will be displayed above a collection of UI inputs.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAVariables.prototype.setIntro = function (intro) {
        this.intro = intro;
        return this;
    };

    /**
     *
     * @param variables A QNAVariable[] that defines the collection of variables this object is parent to.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAVariables.prototype.setVariables = function (variables) {
        this.variables = variables;
        return this;
    };

    /**
     * An individual step in the wizard
     * @constructor
     */
    exports.QNAStep = function () {
        this.showNext = true;
        this.showPrevious = true;
        this.showRestart = false;
    };

    /**
     * @param titlePrefix A string that will be displayed as part of the page title.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAStep.prototype.setTitlePrefix = function(titlePrefix) {
        this.titlePrefix = titlePrefix;
        return this;
    };

    exports.QNAStep.prototype.setTitlePrefixPercentage = function (titlePrefix) {
        this.titlePrefix = titlePrefix.toFixed(2) + "% ";
        return this;
    };

    /**
     *
     * @param title A string that will be displayed as the title for the wizard step.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAStep.prototype.setTitle = function (title) {
        this.title = title;
        return this;
    };

    /**
     *
     * @param intro A string that will be displayed as introductory text for this wizard step.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAStep.prototype.setIntro = function (intro) {
        this.intro = intro;
        return this;
    };

    /**
     *
     * @param inputs A QNAVariables[] collection that will de displayed as input UI elements.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAStep.prototype.setInputs = function (inputs) {
        this.inputs = inputs;
        return this;
    };

    /**
     *
     * @param outputs A QNAVariables[] collection that will be displayed as output UI elements. All
     * UI elements as part of this collection are disabled.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAStep.prototype.setOutputs = function (outputs) {
        this.outputs = outputs;
        return this;
    };

    /**
     *
     * @param processStep A function of signature function (resultCallback, errorCallback, result, config)
     * called when the user moves off this step to the next one.
     * The resultCallback should be called with the result that was calculated in this step. The result should
     * be an independent object, as they are pushed and poped from a stack as the user moves forward and
     * backwards through the wizard to undo changes.
     * i.e. resultCallback(JSON.stringify(myResult)).
     * If you pass an object to the resultCallback, and modify that object in subsequent steps, push and popping
     * that object from the stack won't actually undo any changes.
     * i.e. resultCallback(myResult)
     *      myResult is pushed to stack
     *      myResult.field = newValue
     *      user moves back in wizard, myResult is poped
     *      myResult.field still === newValue
     * @returns {exports}
     */
    exports.QNAStep.prototype.setProcessStep = function (processStep) {
        this.processStep = processStep;
        return this;
    };

    /**
     *
     * @param nextStep the QNAStep that will be displayed when the user progresses off this step.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAStep.prototype.setNextStep = function (nextStep) {
        this.nextStep = nextStep;
        return this;
    };

    /**
     *
     * @param enterStep A function of signature function (resultCallback, errorCallback, result, config) called when
     * the user first enters this step.
     * Calling resultCallback() results in the UI being updated to reflect the current values in the config object. This
     * is useful when performing long running operations and providing feedback to the user.
     * Calling resultCallback(true) results in the user being moved to the next wizard step. This is useful when this
     * step was only used to provide updates on a long running operation.
     * Calling resultCallback(false) means the UI elements are enabled and the user can interact with the step as usual.
     * @returns {exports}
     */
    exports.QNAStep.prototype.setEnterStep = function (enterStep) {
        this.enterStep = enterStep;
        return this;
    };

    /**
     *
     * @param backStep Sets the QNAStep that will be displayed when the user moves back through the wizard. This is
     * useful if moving back should place the user at some step beyond the last one.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAStep.prototype.setBackStep = function (backStep) {
        this.backStep = backStep;
        return this;
    };

    /**
     *
     * @param showPrevious true if the button to move back in the wizard should be shown, and false otherwise. Useful
     * when the user has reached the end of the wizard and it does not make sence to go back to a previous step.
     * Can also be a string that sets the name of the previous button.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAStep.prototype.setShowPrevious = function (showPrevious) {
        this.showPrevious = showPrevious;
        return this;
    };

    /**
     *
     * @param showNext true if the button to move forward in the wizard should be shown, and false otherwise. Useful
     * when displaying a readonly step that the user will be moved from automatically after some long running process
     * has finished.
     * Can also be a string that sets the name of the next button.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
    exports.QNAStep.prototype.setShowNext = function (showNext) {
        this.showNext = showNext;
        return this;
    };

    /**
     * Used by the UI to get the name of the next button
     * @returns {*}
     */
    exports.QNAStep.prototype.getShowNextName = function () {
        return typeof this.processedShowNext === "string" ?
            this.processedShowNext : "Next";
    };

    /**
     * Used by the UI to get the name of the previous button
     * @returns {*}
     */
    exports.QNAStep.prototype.getShowPreviousName = function () {
        return typeof this.processedShowPrevious === "string" ?
            this.processedShowPrevious : "Previous";
    };

    /**
     * Used by the UI to get the name of the restart button
     * @returns {*}
     */
    exports.QNAStep.prototype.getShowRestartName = function () {
        return typeof this.processedShowRestart === "string" ?
            this.processedShowRestart : "Restart";
    };

    /**
     *
     * @param showRestart true if the restart button is to be shown, and false otherwise. Can also be a string
     * that sets the name of the restart button.
     * Can also be a function of signature function (resultCallback, errorCallback, result, config).
     * @returns {exports}
     */
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

    /**
     * Calls any functions assigned to properties in QNAVariables and QNAVariable objects. If the app appears to
     * hang after calling this, it is probably because a function assigned to a property doesn't call the
     * resultcallback function passed to it.
     * @param successCallback
     * @param errorCallback
     */
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
        var resolveVariable = function (variables, variableSuccessCallback) {
            if (variables === null) {
                variableSuccessCallback();
                return;
            } else {

                async.each(
                    variables,
                    function(variable, callback) {
                        /*
                         Resolving the value requires the processedName to be resolved, so we do this all in a series.
                         */
                        async.series(
                            [
                                function(callback) {resolveDetail(variable, 'type', 'processedType', function(value) {callback(null);})},
                                function(callback) {resolveDetail(variable, 'name', 'processedName', function(value) {callback(null);})},
                                function(callback) {resolveDetail(variable, 'options', 'processedOptions', function(value) {callback(null);})},
                                function(callback) {resolveDetail(variable, 'disabled', 'processedDisabled', function(value) {callback(null);})},
                                function(callback) {resolveDetail(variable, 'intro', 'processedIntro', function(value) {callback(null);})},
                                function(callback) {resolveDetail(variable, 'value', 'null', function(value) {
                                    if (value !== undefined) {
                                        // we do something a little different here. the value is what is shown
                                        // in the ui, and that is bound to the config
                                        config[variable.processedName] = value;
                                    }
                                    callback(null);
                                })}
                            ],
                            function(err, data) {
                                callback(null);
                            }
                        );
                    }, function(error, data) {
                        variableSuccessCallback();
                    }
                );
            }
        };

        /*
            We can resolve these details in parallel because they don't depend on each other
         */
        async.parallel(
            {
                title: function(callback) {
                    resolveDetail(step, 'title', 'processedTitle', function (value) {
                        callback(null);
                    })
                },
                intro: function (callback) {
                    resolveDetail(step, 'intro', 'processedIntro', function (value) {
                        callback(null);
                    })
                },
                showNext: function (callback) {
                    resolveDetail(step, 'showNext', 'processedShowNext', function (value) {
                        callback(null);
                    })
                },
                showPrevious: function (callback) {
                    resolveDetail(step, 'showPrevious', 'processedShowPrevious', function (value) {
                        callback(null);
                    })
                },
                showRestart: function (callback) {
                    resolveDetail(step, 'showRestart', 'processedShowRestart', function (value) {
                        callback(null);
                    })
                },
                outputs: function (callback) {
                    resolveDetail(step, 'outputs', 'processedOutputs', function (value) {
                        callback(null, value);
                    })
                },
                inputs: function (callback) {
                    resolveDetail(step, 'inputs', 'processedInputs', function (value) {
                        callback(null, value);
                    })
                }
            },
            function(err, data) {
                // at this point the step has been resolved, so we now need to go through and
                // resolve the inputs

                var resolveInput = function (index, ioVariables, inputSuccessCallback) {
                    // it is possible that no inputs or outputs are defined, so just
                    // skip them if they are undefined
                    if (!ioVariables) {
                        inputSuccessCallback();
                        return;
                    }

                    async.each (
                        ioVariables,
                        function(input, callback) {
                            async.parallel(
                                [
                                    function(callback) {resolveDetail(input, 'intro', 'processedIntro', function(){callback(null)})},
                                    function(callback) {resolveDetail(input, 'variables', 'processedVariables', function(variables){
                                        resolveVariable(variables, function () {
                                            callback(null);
                                        });
                                    })}
                                ],
                                function(err, data) {
                                    callback(null);
                                }
                            );
                        }, function (err, data) {
                            inputSuccessCallback();
                        }
                    )
                };

                async.parallel(
                    [
                        function(callback) {resolveInput(0, data.inputs, function(value) {callback(null);})},
                        function(callback) {resolveInput(0, data.outputs, function(value) {callback(null);})},
                    ],
                    function(error, data2) {
                        // this function is always async to avoid issues with the $apply()
                        // function in angular
                        setTimeout(function () {successCallback(me); }, 0);
                    }
                );
            }
        );
    };

    /**
     *
     * @returns {boolean} true if the current step has a next step to move to, and false otherwise
     */
    exports.QNA.prototype.hasNext = function () {
        if (this.step) {
            if (this.step.nextStep) {
                return true;
            }
        }

        return false;
    };

    /**
     *
     * @returns {boolean} true if the current step has a previous step to move back to, and false otherwise
     */
    exports.QNA.prototype.hasPrevious = function () {
        return this.previousSteps.length > 0;
    };

    /**
     * Moves to the next step. QNAStep objects can prevent this by assigning a function to their nextStep property,
     * and calling the errorCallback instead of the resultCallback.
     * @param callback
     * @param errorCallback
     */
    exports.QNA.prototype.next = function (callback, errorCallback, enterResult) {
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
                /*
                    If there is a function assigned to processStep, pass it the result of the
                    enterStep function, and add the result of processStep to the results stack.
                 */

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
                    this.config,
                    enterResult
                );
            } else {
                /*
                    If there is no function assigned to processStep, append the result of the enterStep function,
                    or reuse the last result if enterStep did not return anything.

                    This allows us to accommodate steps that only use the enterStep function to do some processing
                    and return the result.
                 */

                if (enterResult !== undefined) {
                    gotoNextStep(this.results.concat([enterResult]));
                } else {
                    gotoNextStep(this.results.concat([this.results[this.results.length - 1]]));
                }
            }
        } else {
            errorCallback("An error occurred.", "There is no current step or no function to call to get the next step.");
        }
    };

    /**
     * Moves to the next step. QNAStep objects can prevent this by assigning a function to their backStep property,
     * and calling the errorCallback instead of the resultCallback.
     * @param callback
     * @param errorCallback
     */
    exports.QNA.prototype.previous = function (callback, errorCallback) {
        if (this.previousSteps.length > 0) {

            var gotoPreviousStep = (function (me) {
                return function (previousStep) {

                    if (previousStep !== undefined && previousStep !== null) {
                        /*
                            Attempt to roll back the previous steps looking
                            for the step that was suggested.
                         */
                        var previousStepsClone = me.previousSteps.slice(0);
                        var popCount = 0;
                        while (previousStepsClone.length !== 0 && previousStepsClone[previousStepsClone.length - 1] !== previousStep) {
                            previousStepsClone.pop();
                            ++popCount;
                        }

                        if (previousStepsClone.length !== 0 && previousStepsClone[previousStepsClone.length - 1] === previousStep) {
                            callback(new exports.QNA(
                                previousStepsClone[previousStepsClone.length - 1],
                                previousStepsClone.splice(0, previousStepsClone.length - 1),
                                me.results.splice(0, me.results.length - 1 - popCount),   /* Take off as many results as we took off previous steps */
                                me.config
                            ));
                        }
                    }  else {
                        callback(new exports.QNA(
                            me.previousSteps[me.previousSteps.length - 1],
                            me.previousSteps.splice(0, me.previousSteps.length - 1),
                            me.results.splice(0, me.results.length - 1),
                            me.config
                        ));
                    }
                };
            }(this));

            // process the current step and generate a result
            var newResults;
            if (this.step.backStep) {
                this.step.backStep(
                    (function () {
                        return function (previousStep) {
                            gotoPreviousStep(previousStep);
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