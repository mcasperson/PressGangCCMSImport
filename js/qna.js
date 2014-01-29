/*
    {
        input: [
            {
                intro: "Some text to appear above the list of inputs",
                variables: [
                    {
                        type: InputEnum.TEXT,
                        name: "First Name",
                        value: function(result, config) {return "Initial Value"}
                    }, {
                        type: InputEnum.MUTUALLY_EXCLUSIVE_OPTION,
                        name: "Database Type",
                        options: function(result, config) {["MySQL", "Postgres", "H2"]}
                        value: function(result, config) {return "MySQL"}
                    }
                ]
            }
        ],
        output: [

        ]
    }
 */

/**
 * Defines the kind of inputs that the wizard can ask for
 */
var InputEnum = Object.freeze({
    SINGLE_FILE: 0,                     // single file selection
    MULTIPLE_FILES: 1,                  // multiple file selection
    MUTUALLY_EXCLUSIVE_OPTION: 2,       // radio buttons
    OPTION: 3,                          // check boxes
    TEXT: 4}                            // text box
);

var QNAStep = function (inputsAndOutputs, processStep, nextStep) {
    this.inputsAndOutputs = inputsAndOutputs;
    this.processStep = processStep;
    this.nextStep = nextStep;
}

/**
 * The container that holds:
 *   the global config
 *   the incrementally built result
 *   the details of the current step
 * @constructor
 */
var QNA = function (container, step, previousSteps, results, config) {
    this.container = container;
    this.step = Object.freeze(step);
    this.previousSteps = Object.freeze(previousSteps) || Object.freeze([]);
    this.results = Object.freeze(results) || Object.freeze([null]);
    this.config = Object.freeze(config) || Object.freeze({});
}

QNA.prototype.render = function() {

    return this;
}

QNA.prototype.hasNext = function() {
    if (this.step) {
        if (this.step.nextStep) {
            return true;
        }
    }

    return false;
}

QNA.prototype.hasPrevious = function() {
    return this.previousSteps.length > 0;
}

QNA.prototype.next = function() {
    if (this.step) {
        var newResults;
        if (this.step.processStep) {
            var result = this.step.processStep(results[results.length], config);
            newResults = results.concat(Object.freeze([result]));
        } else {
            newResults = results.concat(Object.freeze([results[results.length]]));
        }
        if (this.step.nextStep) {
            var nextStep = this.step.nextStep();
            if (nextStep) {
                return new QNA(container, nextStep, previousSteps.concat([step]), newResults, config);
            }
        }
    }

    return this;
}

QNA.prototype.previous = function() {
    if (this.previousSteps.length > 0) {
        return new QNA(
            previousSteps[previousSteps.length - 1],
            previousSteps.splice(0, previousSteps.length - 1),
            results.splice(0, results.length - 1),
            config);
    }

    return this;
}

QNA.prototype.buildConfig = function(elements) {
   var inputs = {};

   return new QNA(container, step, previousStep, results, Object.freeze(jQuery.extend(config, inputs)));
}

QNA.prototype.addToConfig = function(dictionary) {
    return new QNA(container, step, previousStep, results, Object.freeze(jQuery.extend(config, dictionary)));
}