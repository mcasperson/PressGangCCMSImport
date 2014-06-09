define(
    ['jquery', 'qna/qna', 'qnastart', 'qna/qnautils', 'docbookimport', 'processasciidoc', 'processxml', /*'opal', 'asciidoctor',*/ 'constants', 'exports'],
    function (jquery, qna, qnastart, qnautils, docbookimport, processasciidoc, processxml, /*opal, asciidoctor,*/ constants, exports) {
        'use strict';

        // This will be the object that we query for files. It could be a zip or directory
        var inputModel;

        exports.getTopicLevelContainer = new qna.QNAStep()
            .setTitle("Do you want a book or article?")
            .setIntro("The content specification can either be a book or an article.")
            .setInputs(
            [
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Book", "Article"])
                            .setOptions([constants.CHAPTER_TOP_LEVEL_CONTAINER, constants.SECTION_TOP_LEVEL_CONTAINER])
                            .setValue(constants.CHAPTER_TOP_LEVEL_CONTAINER)
                            .setName(constants.TOP_LEVEL_CONTAINER)
                    ])
            ]
        )
        .setNextStep(function (resultCallback, errorCallback, result, config) {
                if (qnautils.isInputDirSupported()) {
                    resultCallback(askForZipOrDir);
                } else {
                    resultCallback(askForAsciidocZipFile);
                }
        });

         var askForZipOrDir = new qna.QNAStep()
            .setTitle("Select the source of the content to import")
            .setIntro("You can import from a ZIP file or from a local directory.")
            .setInputs([
                new qna.QNAVariables()

                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.RADIO_BUTTONS)
                            .setIntro(["Zip File", "Directory"])
                            .setOptions(["Zip", "Dir"])
                            .setValue("Dir")
                            .setName("InputType")
                    ])
            ])
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(config.InputType === "Zip" ? askForAsciidocZipFile : askForAsciidocDir);
            })
            .setEnterStep(function(resultCallback, errorCallback, result, config) {
                if (!qnautils.isInputDirSupported()) {
                    config.InputType = "Zip";
                    resultCallback(true);
                } else {
                    resultCallback(false);
                }
            });

        /*
         Get the ZIP file
         */
        var askForAsciidocZipFile = new qna.QNAStep()
            .setTitle("Select the ZIP file to import")
            .setIntro("Select the ZIP file that contains the Asciidoc content that you wish to import into PressGang CCMS.")
            .setInputs(
            [
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.SINGLE_FILE)
                            .setIntro("Asciidoc ZIP File")
                            .setName("InputSource")
                            .setOptions("application/zip")
                    ])
            ]
        )
        .setProcessStep(function (resultCallback, errorCallback, result, config) {
            if (!config.InputSource) {
                errorCallback("Please select a file", "You need to select a ZIP file before continuing.");
            } else if (config.InputSource.name.lastIndexOf(".zip") !== config.InputSource.name.length - 4) {
                errorCallback("Please select a file", "You need to select a ZIP file before continuing.");
            } else {
                resultCallback();
            }
        })
        .setNextStep(function (resultCallback) {
            resultCallback(askForMainXML);
        })
        .setEnterStep(function(resultCallback, errorCallback, result, config){
            inputModel = qnastart.zipModel;
            inputModel.clearCache();
            config.InputSource = undefined;
            resultCallback(false);
        });

        var askForAsciidocDir = new qna.QNAStep()
            .setTitle("Select the directory to import")
            .setIntro("Select the directory that contains the Asciidoc content that you wish to import into PressGang CCMS.")
            .setInputs(
            [
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.DIRECTORY)
                            .setIntro("Asciidoc Directory")
                            .setName("InputSource")
                    ])
            ]
        )
        .setProcessStep(function (resultCallback, errorCallback, result, config) {
            if (!config.InputSource) {
                errorCallback("Please select a directory", "You need to select a directory before continuing.");
            } else {
                resultCallback();
            }
        })
        .setNextStep(function (resultCallback) {
            resultCallback(askForMainXML);
        })
        .setEnterStep(function(resultCallback, errorCallback, result, config){
            inputModel = qnastart.dirModel;
            inputModel.clearCache();
            config.InputSource = undefined;
            resultCallback(false);
        })
        .setBackStep(function(resultCallback, errorCallback, result, config) {
            config.InputSource = undefined;
            resultCallback(exports.askForZipOrDir);
        });

        /*
         STEP 2 - Get the main XML file
         */
        var askForMainXML = new qna.QNAStep()
            .setTitle("Select the main Asciidoc file")
            .setIntro("Select the main Asciidoc file from the selected location.")
            .setInputs([
                new qna.QNAVariables()
                    .setVariables([
                        new qna.QNAVariable()
                            .setType(qna.InputEnum.LISTBOX)
                            .setName("MainFile")
                            .setOptions(function (resultCallback, errorCallback, result, config) {
                                inputModel.getCachedEntries(config.InputSource, function (entries) {
                                    var retValue = [];

                                    jquery.each(entries, function (index, value) {
                                        retValue.push(qnautils.getFileName(value));
                                    });

                                    resultCallback(retValue);
                                });
                            })
                    ])
            ])
            .setProcessStep(function(resultCallback, errorCallback, result, config) {
                if (config.MainFile === null || config.MainFile === undefined || config.MainFile.trim().length === 0 ) {
                    errorCallback("Select a XML file", "Please select the main XML file before continuing");
                } else {
                    /*
                     Process the xml and extract the entities
                     */
                    processasciidoc.processAsciidocImports(
                        function(asciidocText) {
                            var doctype = config[constants.TOP_LEVEL_CONTAINER] === constants.CHAPTER_TOP_LEVEL_CONTAINER ? 'book' : 'article';
                            var asciidocOpts = Opal.hash2(['attributes'], {'attributes': ['backend=docbook45', 'doctype=' + doctype]});
                            var docbook = "<" + doctype + ">" + Opal.Asciidoctor.opal$render(asciidocText, asciidocOpts) + "</" + doctype + ">";

                            processxml.processXMLAndExtractEntities(
                                function (result) {
                                    resultCallback(JSON.stringify(result));
                                },
                                errorCallback,
                                docbook,
                                config
                            );
                        },
                        errorCallback,
                        config
                    )

                }
            })
            .setNextStep(function (resultCallback) {
                resultCallback(docbookimport.askForRevisionMessage);
            });



    }
)