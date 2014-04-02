/*
    Importing non-publican books requires the user to define some DocBook metadata. This module
    presents that step to the user.
 */
define(
    ['jquery', 'qna/qna', 'qnastart', 'qna/qnautils', 'specelement', 'opendocumentimport', 'mojoimport', 'exports'],
    function(jquery, qna, qnastart, qnautils, specelement, opendocumentimport, mojoimport, exports) {
        'use strict';

        exports.generateSpacing = function (outlineLevel) {
            var prefix = "";
            for (var i = 0; i < (outlineLevel - 1) * 2; ++i) {
                prefix += " ";
            }
            return prefix;
        };

        exports.addTopicToSpec = function (topicGraph, content, title, line) {
            var xmlString = "";
            jquery.each(content, function(index, value){
                xmlString += value + "\n";
            });

            /*
             It is possible that the source xml has some entities that are assumed to be available
             in DocBook but which have not actually been defined (i.e. nbsp). So we strip out the entities
             before trying to parse.
             */
            var fixedXML = "<section><title>" + title + "</title>" + xmlString + "</section>";
            var replacements = qnautils.replaceEntitiesInText(fixedXML);

            var xml = null;
            try {
                xml = jquery.parseXML(replacements.xml);
            } catch (error) {
                console.log(replacements.xml);
                console.log(error);
                throw error;
            }

            var topic = new specelement.TopicGraphNode(topicGraph);
            topic.setXmlReplacements(replacements);
            topic.setSpecLine(line);
            topic.setTitle(title);

            /*
             Empty the array to indicate that we have processed the contents
             */
            content.length = 0;
        };

        /*
            Get content spec details
         */
        exports.getSpecDetails = new qna.QNAStep()
            .setTitle("Enter content specification details")
            .setIntro("Enter the basic details of the content specification")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Title")
                                .setName("ContentSpecTitle")
                                .setValue("Title"),
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Subtitle")
                                .setName("ContentSpecSubtitle")
                                .setValue("Subtitle"),
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Product")
                                .setName("ContentSpecProduct")
                                .setValue("Product"),
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Version")
                                .setName("ContentSpecVersion")
                                .setValue("1"),
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.TEXTBOX)
                                .setIntro("Copyright Holder")
                                .setName("ContentSpecCopyrightHolder")
                                .setValue("Red Hat"),
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.COMBOBOX)
                                .setIntro("Brand")
                                .setName("ContentSpecBrand")
                                .setValue("RedHat")
                                .setOptions(["RedHat", "JBoss", "Fedora", "OpenShift"]),
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.COMBOBOX)
                                .setIntro("Locale")
                                .setName("ImportLang")
                                .setValue("en-US")
                                .setOptions(function (resultCallback) {
                                    resultCallback(qnastart.loadLocales());
                                })
                        ])
                ]
            )
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                if (config.ImportOption === "OpenDocument") {
                    resultCallback(opendocumentimport.askForOpenDocumentFile);
                } else if (config.ImportOption === "Mojo") {
                    resultCallback(mojoimport.askForMojoDoc);
                }
            });
    }
);