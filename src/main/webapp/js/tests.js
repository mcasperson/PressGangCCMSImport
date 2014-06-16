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
            );

        QUnit.asyncTest("Creating the QNA Object", function (assert) {
            expect(9);
            QUnit.start();

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
                }, function (title, error, critical) {
                    assert.ok(false, "Error returned when initializing the QNA object");
                }
            )
        });

        QUnit.asyncTest("Moving to a new step", function (assert) {
            expect(6);
            QUnit.start();

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
                                assert.equal(myQna.config.SecondStepVariable, "Initial Step 2 TextBox Value", "Expected variable to default to 'Initial Step 2 TextBox Value'");
                                assert.ok(!myQna.hasNext(), "Expected no next step to be available");
                            }, function (title, error, critical) {
                                assert.ok(false, "Error returned when initializing the QNA object");
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