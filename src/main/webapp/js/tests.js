define(
    ['qna/qna'],
    function (qna) {
        'use strict';

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
            .setNextStep(stepTwo);


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
            QUnit.start();
            expect( 7 );

            var myQna = new qna.QNA(stepOne);
            QUnit.assert.equal(Object.keys(myQna.config).length, 0, "Config should be empty");
            QUnit.assert.equal(myQna.previousSteps.length, 0, "Previous steps should be empty");
            QUnit.assert.deepEqual(myQna.results, [null], "Results should have single null element");
            myQna.initialize(
                function(myQna) {
                    QUnit.assert.equal(myQna.step.processedTitle, "First step of the Q&A test", "Expected processedTitle to have been set");
                    QUnit.assert.equal(myQna.step.processedIntro, "First step intro", "Expected processedIntro to have been set");
                    QUnit.assert.equal(myQna.step.processedInputs.length, 1, "Expected 1 input variable");
                    QUnit.assert.equal(myQna.step.processedOutputs, undefined, "Expected no output variables");
                }, function () {
                    QUnit.assert.ok(false, "Error returned when initializing the QNA object");
                }
            )
        });

        /*QUnit.test("Creating the QNA Object", function (assert) {

            expect( 1 );
            QUnit.start();

            var myQna = new qna.QNA(qnastart.qnastart);
            myQna.initialize(
                function (qna) {
                    myQna.setConfigValue("ImportOption", "Mojo");
                    QUnit.ok(myQna.hasNext(), "We should have a next step");
                    myQna.next(function (myQna) {

                    })
                },
                function(title, error, critical) {
                    QUnit.ok(false, "The QNA object could not be initialized.")
                }
            );

        });*/
    }
)