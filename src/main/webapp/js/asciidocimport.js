define(
    ['jquery', 'qna/qna', 'docbookimport', 'processxml', 'opal', 'asciidoctor', 'exports'],
    function (jquery, qna, docbookimport, processxml, opal, asciidoctor, exports) {
        'use strict';

        exports.askForAsciidocFile = new qna.QNAStep()
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

                        function fixAsciidoctorConversion(docbook) {
                            return docbook
                                // Fix the ' entity
                                .replace(/&#8217;/g, "&apos;")
                                // Remove <?asciidoc-br?> elements
                                .replace(/<\?asciidoc-br\?>/g, "");
                        }

                        var asciidocOpts = opal.Opal.hash2(['attributes'], {'backend': 'docbook45', 'doctype': 'book'});
                        var docbook = fixAsciidoctorConversion("<book>" + opal.Opal.Asciidoctor.opal$render(e.target.result, asciidocOpts) + "</book>");

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