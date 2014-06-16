define(
    ['qna/qna'],
    function (qna) {
        'use strict';

        /*
            A very simple step where all properties are assigned directly (except for nextStep, which needs
            to be a callback because stepTwo doesn't exist when this step is generated).
         */
        var stepOne = new qna.QNAStep()
            .setTitle("First step of the Q&A test")
            .setIntro("First step intro")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.RADIO_BUTTONS)
                                .setIntro(["Yes", "No", "Maybe"])
                                .setOptions(["Yes", "No", "Maybe"])
                                .setValue("Yes")
                                .setName("FirstStepVariable")
                        ])
                ]
            )
            .setNextStep(function (resultCallback, errorCallback, result, config) {resultCallback(stepTwo)});

        /*
            Everything is a callback in this step. We confirm the values assigned to properties like the title
            to ensure that the callbacks are working as expected.
         */
        var stepTwo = new qna.QNAStep()
            .setTitle(function (resultCallback, errorCallback, result, config) {resultCallback("Second step of the Q&A test")})
            .setIntro(function (resultCallback, errorCallback, result, config) {resultCallback("Second step intro")})
            .setInputs(function (resultCallback, errorCallback, result, config) {
                resultCallback(
                    [
                        new qna.QNAVariables()
                            .setVariables([
                                new qna.QNAVariable()
                                    .setType(qna.InputEnum.TEXTBOX)
                                    .setIntro("TextBox Input")
                                    .setValue("Initial Step 2 TextBox Value")
                                    .setName("SecondStepVariable")
                            ])
                    ]
                )}
            )
            .setNextStep(function (resultCallback, errorCallback, result, config) {resultCallback(stepThree)});

        /*
         This step is informational only. It defined an enterStep function that returns true to indicate
         that the user should be moved to the next step. In real life, this step would do some processing,
         update a progress bar, and move to the next step when it is done
         */
        var stepThree = new qna.QNAStep()
            .setTitle("Third step of the Q&A test")
            .setIntro("Third step intro")
            .setOutputs(
            [
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.PROGRESS)
                            .setIntro("Progress")
                            .setName("UploadProgress")
                            // first value is the progressbar max, second is the current value
                            .setValue([100, 0])
                    ])
            ]
        )
        .setNextStep(function (resultCallback, errorCallback, result, config) {resultCallback(stepFour)})
        .setEnterStep(function (resultCallback, errorCallback, result, config) {
            window.setTimeout(function(){
                // a callback with no parameters signals that some processing has been done and the
                // ui should be updated
                config.UploadProgress = 50;
                resultCallback();

                window.setTimeout(function(){
                    // a callback with the first parameter set to true indicates that the next step
                    // should be loaded and displayed. The second parameter is a result that is
                    // placed on the result stack.
                    resultCallback(true, {result: "StepThreeResult"});
                }, 500);
            }, 500);
        });

        /*
            This step can display the result we calculated in step 3
         */
        var stepFour = new qna.QNAStep()
            .setTitle("Fourth step of the Q&A test")
            .setIntro("Fourth step intro")
            .setOutputs(
            [
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.TEXTBOX)
                            .setIntro("Step Three Output")
                            .setName("StepThreeOutput")
                            // first value is the progressbar max, second is the current value
                            .setValue(function (resultCallback, errorCallback, result, config) {resultCallback(result.result)})
                    ])
            ]
        );

        QUnit.asyncTest("Creating the QNA Object", function (assert) {
            expect(9);

            var myQna = new qna.QNA(stepOne);
            assert.equal(Object.keys(myQna.config).length, 0, "Config should be empty");
            assert.equal(myQna.previousSteps.length, 0, "Previous steps should be empty");
            assert.deepEqual(myQna.results, [null], "Results should have single null element");
            myQna.initialize(
                function(myQna) {
                    assert.equal(myQna.step.processedTitle, "First step of the Q&A test", "Expected processedTitle to have been set");
                    assert.equal(myQna.step.processedIntro, "First step intro", "Expected processedIntro to have been set");
                    assert.equal(myQna.step.processedInputs.length, 1, "Expected 1 input variable");
                    assert.equal(myQna.step.processedOutputs, undefined, "Expected no output variables");
                    assert.equal(myQna.config.FirstStepVariable, "Yes", "Expected variable to default to 'Yes'");
                    assert.ok(myQna.hasNext(), "Expected a next step to be available");
                    QUnit.start();
                }, function (title, error, critical) {
                    assert.ok(false, "Error returned when initializing the QNA object");
                    QUnit.start();
                }
            )
        });

        QUnit.asyncTest("Moving to step 2", function (assert) {
            expect(7);

            var myQna = new qna.QNA(stepOne);
            myQna.initialize(
                function (myQna) {
                    myQna.next(function (myQna) {
                        myQna.initialize(
                            function(myQna) {
                                assert.equal(myQna.step.processedTitle, "Second step of the Q&A test", "Expected processedTitle to have been set");
                                assert.equal(myQna.step.processedIntro, "Second step intro", "Expected processedIntro to have been set");
                                assert.equal(myQna.step.processedInputs.length, 1, "Expected 1 input variable");
                                assert.equal(myQna.step.processedOutputs, undefined, "Expected no output variables");
                                assert.equal(myQna.config.FirstStepVariable, "Yes", "Expected variable to default to 'Yes'");
                                assert.equal(myQna.config.SecondStepVariable, "Initial Step 2 TextBox Value", "Expected variable to default to 'Initial Step 2 TextBox Value'");
                                assert.ok(myQna.hasNext(), "Expected a next step to be available");
                                QUnit.start();
                            }, function (title, error, critical) {
                                assert.ok(false, "Error returned when initializing the QNA object");
                                QUnit.start();
                            }
                        );
                    });
                },
                function(title, error, critical) {
                    assert.ok(false, "Error returned when initializing the QNA object");
                    QUnit.start();
                }
            );

        });

        QUnit.asyncTest("Moving to step 3", function (assert) {
            expect(5);

            var updateCalled = false;

            var myQna = new qna.QNA(stepOne);

            // init step 1
            myQna.initialize(
                function (myQna) {
                    // move to step 2
                    myQna.next(function (myQna) {
                        // init step 2
                        myQna.initialize(
                            function(myQna) {
                                // move to step 3
                                myQna.next(function (myQna) {
                                    // init step 3
                                    myQna.initialize(function (myQna) {
                                        var result = myQna.results[myQna.results.length - 1];
                                        var config = myQna.config;
                                        myQna.step.enterStep(
                                            function (move, result) {
                                                // Undefined means just update the UI true means move to next step
                                                // false means enable the ui
                                                if (move === undefined) {
                                                    if (updateCalled) {
                                                        assert.ok(false, "Only expected one update call");
                                                        QUnit.start();
                                                    } else {
                                                        updateCalled = true;
                                                        assert.ok(true, "Expected an update call");
                                                    }
                                                } else {
                                                    if (move) {
                                                        assert.ok(true, "Expected resultCallback with move === true");
                                                        // move to step 4
                                                        myQna.next(
                                                            function (myQna) {
                                                                // init step 4
                                                                myQna.initialize(
                                                                    function (myQna) {
                                                                        assert.equal(myQna.config.FirstStepVariable, "Yes", "Expected variable to default to 'Yes'");
                                                                        assert.equal(myQna.config.SecondStepVariable, "Initial Step 2 TextBox Value", "Expected variable to default to 'Initial Step 2 TextBox Value'");
                                                                        assert.equal(myQna.config.StepThreeOutput, "StepThreeResult", "Expected variable to default to 'StepThreeResult'");
                                                                        QUnit.start();
                                                                    }, function (title, error, critical) {
                                                                        assert.ok(false, "Error returned when initializing the QNA object");
                                                                        QUnit.start();
                                                                    }
                                                                );
                                                            }, function (title, message, critical) {
                                                                assert.ok(false, "Error returned when calling enterStep");
                                                                QUnit.start();
                                                            }, result);

                                                    } else {
                                                        assert.ok(false, "Did not expect move to be false");
                                                        QUnit.start();
                                                    }
                                                }
                                            },
                                            function (title, message, critical) {
                                                assert.ok(false, "Error returned when calling enterStep");
                                                QUnit.start();
                                            },
                                            result,
                                            config
                                        );
                                    }, function (title, error, critical) {
                                        assert.ok(false, "Error returned when initializing the QNA object");
                                        QUnit.start();
                                    })
                                });
                            }, function (title, error, critical) {
                                assert.ok(false, "Error returned when initializing the QNA object");
                                QUnit.start();
                            }
                        );
                    });
                },
                function(title, error, critical) {
                    assert.ok(false, "Error returned when initializing the QNA object");
                }
            );
        });
    }
)