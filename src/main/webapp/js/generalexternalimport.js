/*
 Copyright 2011-2014 Red Hat

 This file is part of PresGang CCMS.

 PresGang CCMS is free software: you can redistribute it and/or modify
 it under the terms of the GNU Lesser General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 PresGang CCMS is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public License
 along with PresGang CCMS.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
    Importing non-publican books requires the user to define some DocBook metadata. This module
    presents that step to the user.
 */
define(
    ['jquery', 'qna/qna', 'qnastart', 'qna/qnautils', 'specelement', 'opendocumentimport', 'mojoconvert', 'exports'],
    function(jquery, qna, qnastart, qnautils, specelement, opendocumentimport, mojoconvert, exports) {
        'use strict';

        exports.generateSpacing = function (outlineLevel) {
            var prefix = "";
            for (var i = 0; i < (outlineLevel - 1) * 2; ++i) {
                prefix += " ";
            }
            return prefix;
        };

        exports.buildOpeningElement = function (container, title) {
            if (container === null || container === undefined || (container.toLowerCase() !== "chapter" && container.toLowerCase() !== "section")) {
                throw "container can only be a chapter or section";
            }

            return "<" +  container.toLowerCase() + ">\n<title>" + qnastart.escapeSpecTitle(title) + "</title>\n";
        };

        exports.buildOClosingElement = function (container) {
            if (container === null || container === undefined || (container.toLowerCase() !== "chapter" && container.toLowerCase() !== "section")) {
                throw "container can only be a chapter or section";
            }

            return "</" +  container.toLowerCase() + ">";
        };

        exports.buildTopicXML = function (content, title) {
            var xmlString = "";
            jquery.each(content, function(index, value){
                xmlString += value + "\n";
            });

            return "<section>\n<title>" + qnastart.escapeSpecTitle(title) + "</title>\n" + xmlString + "\n</section>\n";

        };

        exports.buildOpenContainerTopicWithInitialText = function (container, content, title) {

            if (container === null || container === undefined || (container.toLowerCase() !== "chapter" && container.toLowerCase() !== "section")) {
                throw "container can only be a chapter or section";
            }

            var xmlString = "";
            jquery.each(content, function(index, value){
                xmlString += value + "\n";
            });

            return "<" + container.toLowerCase() + ">\n<title>" + qnastart.escapeSpecTitle(title) + "</title>\n" + xmlString + "\n";
        };

        exports.buildClosedContainerTopicWithInitialText = function (container, content, title) {

            if (container === null || container === undefined || (container.toLowerCase() !== "chapter" && container.toLowerCase() !== "section")) {
                throw "container can only be a chapter or section";
            }

            var xmlString = "";
            jquery.each(content, function(index, value){
                xmlString += value + "\n";
            });

            return "<" + container.toLowerCase() + ">\n<title>" + qnastart.escapeSpecTitle(title) + "</title>\n" + xmlString + "\n</" + container.toLowerCase() + ">\n";
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
                resultCallback(getSpecDetails);
            });

        var getSpecDetails = new qna.QNAStep()
            .setTitle("Wrap formatted text in <emphasis> elements?")
            .setIntro("DocBook does not directly define how content should be presented. \
                However, the source material may contain formatted content like bold, underlined or italicized text. \
                This text can be optionally wrapped in the DocBook <emphasis> element as a way of indicating that it has some significance.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.CHECKBOX)
                                .setIntro("Wrap formatted text in <emphasis>")
                                .setName("WrapFormattedText")
                                .setValue(false)
                        ])
                ]
            )
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                resultCallback(getTopicLevelContainer);
            });

        var getTopicLevelContainer = new qna.QNAStep()
            .setTitle("Do you want a book or article?")
            .setIntro("The content specification can either be a book or an article.")
            .setInputs(
                [
                    new qna.QNAVariables()
                        .setVariables([
                            new qna.QNAVariable()
                                .setType(qna.InputEnum.RADIO_BUTTONS)
                                .setIntro(["Book", "Article"])
                                .setOptions(["Chapter", "Section"])
                                .setValue("Chapter")
                                .setName("TopLevelContainer")
                        ])
                ]
            )
            .setNextStep(function (resultCallback, errorCallback, result, config) {
                if (config.ImportOption === "OpenDocument") {
                    resultCallback(opendocumentimport.askForOpenDocumentFile);
                } else if (config.ImportOption === "Mojo") {
                    resultCallback(mojoconvert.askForMojoDoc);
                }
            });
    }
);