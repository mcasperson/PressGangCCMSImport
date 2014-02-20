define(
    ['jquery', 'qna/qna', 'qna/qnautils', 'qna/qnazipmodel', 'qnastart', 'specelement', 'fontrule', 'exports'],
    function (jquery, qna, qnautils, qnazipmodel, qnastart, specelement, fontrule, exports) {
        'use strict';

        var mojoURLRE = /^https:\/\/mojo.redhat.com\/docs\/DOC-(\d+)$/;

        exports.askForMojoDoc = new qna.QNAStep()
            .setTitle("Specify the Mojo document to import")
            .setIntro("Specify the Mojo document that contains the content you wish to import. This is the URL to the Mojo document in the format https://mojo.redhat.com/docs/DOC-#####.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Mojo URL")
                                .setName("MojoURL")
                                .setValue("https://mojo.redhat.com/docs/DOC-935113")
                        ])
                ]
            )
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                if (!config.MojoURL) {
                    errorCallback("Please specify a URL", "You need to specify a Mojo URL before continuing.");
                } else {
                    if (window.greaseMonkeyShare === undefined) {
                        errorCallback("User Script Not Installed", "You need to install the PressGang Import user script to import Mojo documents");
                    } else if (!mojoURLRE.test(config.MojoURL.trim())) {
                        errorCallback("URL is not valid", "Please enter a valid Mojo document URL.");
                    } else {
                        resultCallback(null);
                    }
                }
            })
            .setNextStep(function (resultCallback) {
                resultCallback(processHTML);
            });

        var processHTML = new qna.QNAStep()
            .setTitle("Importing Mojo Document")
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                var id = /^.*?(\d+)$/.exec(config.MojoURL);

                window.greaseMonkeyShare.mojoDocId = mojoId;
                window.greaseMonkeyShare.errorCallback = errorCallback;
                window.greaseMonkeyShare.resultCallback = resultCallback;
            });
    }
);