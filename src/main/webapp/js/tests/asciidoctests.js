define(
    ['qna/qna', 'qnastart', 'constants'],
    function (qna, qnastart, constants) {
        'use strict';

        QUnit.asyncTest("Moving to step 3 and 4", function (assert) {
            expect(5);

            var updateCalled = false;

            var myQna = new qna.QNA(qnastart.qnastart);

            // init step 1
            myQna.initialize(
                function (myQna) {
                    // doing an asciidoc import
                    myQna.config[constants.IMPORT_OPTION] = constants.ASCIIDOC_IMPORT_OPTION;

                    // move to next step
                    myQna.next(function (myQna) {
                        // creating a new content spec
                        myQna.config[constants.CREATE_OR_OVERWRITE_CONFIG_KEY] = constants.CREATE_SPEC;

                        // move to next step
                        myQna.initialize(
                            function(myQna) {
                                // create new topics, images and files
                                myQna[constants.CREATE_OR_REUSE_TOPICS] = constants.CREATE_TOPICS;
                                myQna[constants.CREATE_OR_REUSE_IMAGES] = constants.CREATE_IMAGES;
                                myQna[constants.CREATE_OR_REUSE_FILES] = constants.CREATE_FILES;

                                // move to next step
                                myQna.next(function (myQna) {
                                    // set the server to import to. This makes no difference, as all REST calls
                                    // are mocked
                                    myQna[constants.PRESSGANG_HOST] = "localhost";

                                    // move to next step
                                    myQna.initialize(function (myQna) {
                                        // set config values

                                        // move to next step

                                    }, function (title, error, critical) {
                                        assert.ok(false, "Error returned when initializing the QNA object");
                                        QUnit.start();
                                    })
                                });
                            },
                            function (title, error, critical) {
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
);