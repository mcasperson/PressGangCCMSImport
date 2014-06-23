define(
    ['qna/qna', 'qnastart', 'async/async', 'constants'],
    function (qna, qnastart, async, constants) {
        'use strict';

        function applyFuncAndMove(assert, myQna, result, callback) {
            initFunc(myQna);
            if (myQna.hasNext()) {
                moveNext(assert, myQna, result, callback);
            } else {
                callback(null, 'done');
            }
        }

        function moveNext(assert, myQna, result, callback) {
            myQna.next(
                function (myQna) {
                    callback(null, myQna);
                },
                function (title, error, critical) {
                    assert.ok(false, "Error returned when moving to the next QNA object");
                    QUnit.start();
                    callback('failed');
                },
                result
            );
        }

        /*
            Moving between steps in the wizard is a case of initializing the QNA object,
            setting some values (through initFunc), and moving to the next step.
         */
        function initializeAndMove(assert, myQna, initFunc, callback) {
            myQna.initialize(
                function (myQna) {

                    if (myQna.step.enterStep) {
                        var result = myQna.results[myQna.results.length - 1];
                        var config = myQna.config;
                        myQna.step.enterStep(
                            function (move, result) {
                                /*
                                 Undefined means just update the UI
                                 true means move to next step
                                 false means enable the ui
                                 */
                                if (move === undefined) {
                                    // do nothing because we have no ui to update
                                } else {
                                    /*
                                        If move is true, we would move to the next step without any user interaction
                                     */
                                    if (move) {
                                        moveNext(assert, myQna, result, function(err, myQna) {
                                            if (myQna === 'done') {
                                                /*
                                                    If we are done, pass it back to the waterfall
                                                 */
                                                callback(null, myQna);
                                            } else {
                                                /*
                                                    Otherwise we move forward and apply the initFunc to
                                                    the next step that requires input
                                                 */
                                                initializeAndMove(assert, myQna, initFunc, callback);
                                            }
                                        });
                                    } else {
                                        applyFuncAndMove(assert, myQna, result, callback);
                                    }
                                }
                            },
                            function (title, message, critical) {
                                assert.ok(false, "Error returned when moving to the next QNA object");
                                QUnit.start();
                                callback('failed');
                            },
                            result,
                            config
                        );
                    } else {
                        applyFuncAndMove(assert, myQna, result, callback);
                    }
                },
                function (title, error, critical) {
                    assert.ok(false, "Error returned when initializing the QNA object");
                    QUnit.start();
                    callback('failed');
                }
            );
        }

        QUnit.asyncTest("Moving to step 3 and 4", function (assert) {
            expect(5);

            var updateCalled = false;

            var myQna = new qna.QNA(qnastart.qnastart);

            async.waterfall(
                [
                    function(myQna, callback) {
                        // doing an asciidoc import
                        myQna.config[constants.IMPORT_OPTION] = constants.ASCIIDOC_IMPORT_OPTION;
                    },
                    function(myQna, callback) {
                        // doing an asciidoc import
                        myQna.config[constants.IMPORT_OPTION] = constants.ASCIIDOC_IMPORT_OPTION;
                    },
                    function(myQna, callback) {
                        // creating a new content spec
                        myQna.config[constants.CREATE_OR_OVERWRITE_CONFIG_KEY] = constants.CREATE_SPEC;
                    },
                    function(myQna, callback) {
                        // create new topics, images and files
                        myQna.config[constants.CREATE_OR_REUSE_TOPICS] = constants.CREATE_TOPICS;
                        myQna.config[constants.CREATE_OR_REUSE_IMAGES] = constants.CREATE_IMAGES;
                        myQna.config[constants.CREATE_OR_REUSE_FILES] = constants.CREATE_FILES;
                    },
                    function(myQna, callback) {
                        // set the server to import to. This makes no difference, as all REST calls are mocked
                        myQna.config[constants.PRESSGANG_HOST] = "localhost";
                    },
                    function(myQna, callback) {
                        // set config values
                        myQna.config[constants.TOP_LEVEL_CONTAINER] = constants.CHAPTER_TOP_LEVEL_CONTAINER;
                    },
                    function(myQna, callback) {
                        // Importing from a zip file hosted with the import tool
                        myQna.config[constants.INPUT_TYPE] = constants.INPUT_TYPE_ZIPURL;
                    },
                    function(myQna, callback) {
                        // set the url to the file
                        myQna.config[constants.SOURCE_URL] = "asciidoc-test.zip";
                    },
                    function(myQna, callback) {
                        // select the parent include file
                        myQna.config[constants.MAIN_FILE] = "parent-include.adoc";
                    },
                    function(myQna, callback) {
                        // leave all the spec details, like title, subtitle etc, as their default
                        callback(null, myQna);
                    },
                    function(myQna, callback) {
                        // leave all the spec details, like title, subtitle etc, as their default
                        callback(null, myQna);
                    },
                    function(myQna, callback) {
                        // leave the revision log as the default
                        callback(null, myQna);
                    }
                ],
                function(err, result) {
                    assert.ok(result === 'done', "Expected the last step to return 'done'");
                    QUnit.start();
                }
            );
        });
    }
);