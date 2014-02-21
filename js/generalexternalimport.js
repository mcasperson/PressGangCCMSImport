/*
    Importing non-publican books requires the user to define some DocBook metadata. This module
    presents that step to the user.
 */
define(
    ['jquery', 'qna/qna', 'opendocumentimport', 'mojoimport', 'exports'],
    function(jquery, qna, opendocumentimport, mojoimport, exports) {
        'use strict';

        exports.generateSpacing = function (outlineLevel) {
            var prefix = "";
            for (var i = 0; i < (outlineLevel - 1) * 2; ++i) {
                prefix += " ";
            }
            return prefix;
        };

        exports.addTopicToSpec = function (content, title) {
            var xmlString = "";
            jquery.each(content, function(index, value){
                xmlString += value + "\n";
            });

            var xml = jquery.parseXML("<section><title>" + title + "</title>" + xmlString + "</section>");

            var topic = new specelement.TopicGraphNode(topicGraph);
            topic.setXml(xml, xml);
            topic.setSpecLine(resultObject.contentSpec.length - 1);
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
                                .setOptions(["RedHat", "JBoss", "Fedora", "OpenShift"])
                        ])
                ]
            )
            .setProcessStep(function (resultCallback, errorCallback, result, config) {
                if (!config.ContentSpecTitle) {
                    errorCallback("Please enter a title.");
                } else if (!config.ContentSpecProduct) {
                    errorCallback("Please enter a product.");
                } else if (!config.ContentSpecVersion) {
                    errorCallback("Please enter a version.");
                } else if (!config.ContentSpecCopyrightHolder) {
                    errorCallback("Please enter a copyright holder.");
                } else {
                    var contentSpec = [];
                    contentSpec.push("Title = " + config.ContentSpecTitle);

                    if (config.ContentSpecSubtitle !== undefined &&
                        config.ContentSpecSubtitle !== null &&
                        config.ContentSpecSubtitle.trim().length !== 0) {
                        contentSpec.push("Subtitle = " + config.ContentSpecProduct);
                    }

                    contentSpec.push("Product = " + config.ContentSpecProduct);
                    contentSpec.push("Version = " + config.ContentSpecVersion);
                    contentSpec.push("Copyright Holder = " + config.ContentSpecCopyrightHolder);
                    contentSpec.push("Brand = " + config.ContentSpecBrand);
                    contentSpec.push("# Imported from " + config.OdtFile.name);
                    resultCallback(JSON.stringify({contentSpec: contentSpec}));
                }
            })
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                if (config.ImportOption === "OpenDocument") {
                    resultCallback(opendocumentimport.askForOpenDocumentFile);
                } else if (config.ImportOption === "Mojo") {
                    resultCallback(mojoimport.askForMojoDoc);
                }
            });
    }
);