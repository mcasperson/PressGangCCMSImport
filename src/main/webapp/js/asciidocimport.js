define(
    ['jquery', 'qna/qna', 'docbookimport', 'processxml', /*'opal', 'asciidoctor',*/ 'constants', 'exports'],
    function (jquery, qna, docbookimport, processxml, /*opal, asciidoctor,*/ constants, exports) {
        'use strict';

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
                resultCallback(askForAsciidocFile);
            });

        var askForAsciidocFile = new qna.QNAStep()
            .setTitle("Select the Asciidoc file to import")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.SINGLE_FILE)
                                .setIntro("Asciidoc File")
                                .setName("InputSource")
                        ])
                ]
            )
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                if (!config.InputSource) {
                    errorCallback("Please select a file", "You need to select a file before continuing.");
                } else {
                    var reader = new FileReader();
                    reader.onload = (function(e) {

                        var doctype = config[constants.TOP_LEVEL_CONTAINER] === constants.CHAPTER_TOP_LEVEL_CONTAINER ?
                            'book' : 'article';
                        var asciidocOpts = Opal.hash2(['attributes'], {'attributes': ['backend=docbook45', 'doctype=' + doctype]});
                        var docbook = "<" + doctype + ">" + Opal.Asciidoctor.opal$render(e.target.result, asciidocOpts) + "</" + doctype + ">";

                        processxml.processXMLAndExtractEntities(
                            function (result) {
                                resultCallback(JSON.stringify(result));
                            },
                            errorCallback,
                            docbook,
                            config
                        );
                    });
                    reader.readAsText(config.InputSource);
                }
            })
            .setNextStep(function (resultCallback) {
                resultCallback(docbookimport.askForRevisionMessage);
            })


    }
)