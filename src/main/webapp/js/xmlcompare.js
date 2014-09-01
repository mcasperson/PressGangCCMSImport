/*
 Copyright 2011-2014 Red Hat, Inc

 This file is part of PressGang CCMS.

 PressGang CCMS is free software: you can redistribute it and/or modify
 it under the terms of the GNU Lesser General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 PressGang CCMS is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public License
 along with PressGang CCMS.  If not, see <http://www.gnu.org/licenses/>.
 */

define(
    ['jquery', 'qna/qnautils', 'constants', 'exports'],
    function (jquery, qnautils, constants, exports) {
        'use strict';

        // docbook elements whose contents have to match exactly
        var VERBATIM_ELEMENTS = ["date", "screen", "programlisting", "literallayout", "synopsis", "address", "computeroutput"];

        var INJECTION_RE = /^\s*Inject\s*:\s*T?\d+\s*$/;

        var APOS_CHARACTERS = ["'", "’"];
        var QUOTE_CHARACTERS = ["“", "”", "\""];

        /*
         Remove any non-injection comments
         */
        function normalizeComments(xml) {
            var comments = qnautils.xPath("//docbook:comment()", xml);
            var commentsCollection = [];
            var comment;
            while ((comment = comments.iterateNext()) !== null) {
                if (!/^Inject[A-Za-z]*\s*:\s*T?\d+/.test(comment.nodeValue.trim())) {
                    commentsCollection.push(comment);
                }
            }

            jquery.each(commentsCollection, function (index, value) {
                value.parentNode.removeChild(value);
            });

            return xml;
        }

        /*
         Take every xref that points to a topic (and not just a place in a topic), and replace it
         with a injection placeholder. This is done on topics to be imported.
         */
        function normalizeXrefs(xml, topicAndContainerIDs) {
            jquery.each(['xref', 'link'], function (index, linkElement) {
                var xrefs = qnautils.xPath("//docbook:" + linkElement, xml);
                var xref;
                var xrefReplacements = [];
                while ((xref = xrefs.iterateNext()) !== null) {
                    if (xref.hasAttribute("linkend")) {
                        var linkend = xref.getAttribute("linkend");
                        if (topicAndContainerIDs.indexOf(linkend) !== -1) {
                            var xrefReplacement = qnautils.getOwnerDoc(xml).createComment("InjectPlaceholder: 0");
                            var replacement = {original: xref, replacement: [xrefReplacement]};
                            xrefReplacements.push(replacement);
                        }
                    }
                }

                jquery.each(xrefReplacements, function (index, value) {
                    for (var replacementIndex = 0; replacementIndex < value.replacement.length; ++replacementIndex) {
                        if (replacementIndex === value.replacement.length - 1) {
                            value.original.parentNode.replaceChild(value.replacement[replacementIndex], value.original);
                        } else {
                            value.original.parentNode.insertBefore(value.replacement[replacementIndex], value.original);
                        }
                    }
                });
            });

            return xml;
        }

        /*
         Convert characters like " and entities like &quot; to a common marker
         for comparasion
         */
        function normalizeXMLEntityCharacters(xml, replacements) {
            var textNodes = qnautils.xPath(".//text()", xml);
            var text;
            var textNodesCollection = [];
            while ((text = textNodes.iterateNext()) !== null) {
                textNodesCollection.push(text);
            }

            jquery.each(textNodesCollection, function (index, value) {

                /*
                 First return any entities that we consider equivalent.
                 */
                jquery.each(replacements, function (index, replacementValue) {
                    /*
                        We need to check the replacements for the entity or the character, because entities like &#8216;
                        will have been transformed to the plain character.
                     */
                    if (replacementValue.entity === "&quot;" || QUOTE_CHARACTERS.indexOf(replacementValue.entity) !== -1) {
                        value.nodeValue = value.nodeValue.replace(new RegExp(qnautils.escapeRegExp(replacementValue.placeholder), "g"), "#quot#");
                    }

                    if (replacementValue.entity === "&apos;" || APOS_CHARACTERS.indexOf(replacementValue.entity) !== -1) {
                        value.nodeValue = value.nodeValue.replace(new RegExp(qnautils.escapeRegExp(replacementValue.placeholder), "g"), "#apos#");
                    }
                });

                /*
                 Then replace equivalent characters/entities with a common marker.
                 */
                value.nodeValue = value.nodeValue
                    /*
                     Start by returning all entities to their character state
                     */
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, '\'');

                /*
                 Now encode back. Note that we don't want to use any characters that will be
                 further encoded when the xml is converted to a string. This is just for
                 equality testing.
                 */
                jquery.each(APOS_CHARACTERS, function(index, aposChar) {
                    value.nodeValue = value.nodeValue.replace(new RegExp(aposChar, "g"), "#apos#");
                });

                jquery.each(QUOTE_CHARACTERS, function(index, quotChar) {
                    value.nodeValue = value.nodeValue.replace(new RegExp(quotChar, "g"), "#quot#");
                });
            });

            return xml;
        }

        /*
         Normalize injections. We do this against a XML DOM because it is more
         robust than doing regexes on strings.
         */
        function normalizeInjections(xml) {
            var comments = qnautils.xPath("//comment()", xml);
            var comment;
            var commentReplacements = [];
            while ((comment = comments.iterateNext()) !== null) {
                if (INJECTION_RE.test(comment.textContent)) {
                    var commentReplacement = qnautils.getOwnerDoc(xml).createComment("InjectPlaceholder: 0");
                    commentReplacements.push({original: comment, replacement: commentReplacement});
                }
            }

            jquery.each(commentReplacements, function (index, value) {
                value.original.parentNode.replaceChild(value.replacement, value.original);
            });

            return xml;
        }

        /*
         This function takes the xml and strips out ignored whitespace. This allows us to compare
         two xml documents that may have been formatted differently.

         This is a bit of a hack. Technically, all white space is significant unless otherwise
         specified by the DTD. We assume here that all whitespace is insignificant.

         This will cause issues if a topic already exists in the database that has only whitespace
         changes.

         To fix this we run a second check against the content of any elements where whitespace is
         significant.
         */
        function removeWhiteSpace(xml) {
            xml = xml.replace(/\n/gm, " ");                     // replace all existing line breaks
            xml = xml.replace(/\t/gm, " ");                     // replace all existing tabs
            xml = xml.replace(/>/gm, ">\n");                    // break after a the end of an element
            xml = xml.replace(/</gm, "\n<");                    // break before the start of an element
            xml = xml.replace(/^\s+/gm, "");                  // remove leading whitespace
            xml = xml.replace(/\s+$/gm, "");                  // remove trailing whitespace
            xml = xml.replace(/(\S+)([ ]{2,})/gm, "$1 ");       // remove double spaces within text
            return xml;
        }


        /*
         Order the attributes in nodes in a consistent way
         */
        function reorderAttributes(xml) {

            if (xml.attributes !== undefined) {
                var attributes = {};
                jquery.each(xml.attributes, function (index, attr) {
                    attributes[attr.name] = attr.value;
                });

                while (xml.attributes.length !== 0) {
                    xml.removeAttribute(xml.attributes[0].name);
                }

                var attributeKeys = qnautils.keys(attributes);

                jquery.each(attributeKeys, function (index, attrName) {
                    /*
                     Don't add some common attributes. These are either added
                     by csprocessor when it build a book, by the xml
                     serialization process, or are not considered important
                     when comparing XML files for equality.
                     */
                    if (attrName.indexOf("xmlns") !== 0 &&
                        attrName.indexOf("version") !== 0 &&
                        attrName.indexOf("remap") !== 0) {
                        xml.setAttribute(attrName, attributes[attrName]);
                    }
                });
            }

            var allElements = qnautils.xPath(".//docbook:*", xml);
            var elements = [];
            var elementIter;
            while ((elementIter = allElements.iterateNext()) !== null) {
                elements.push(elementIter);
            }

            jquery.each(elements, function (index, element) {
                reorderAttributes(element);
            });
        }

        function normalizeXmlString(xml, xmlEntityReplacements, topic, format) {
            var xmlString = qnautils.xmlToString(xml);
            xmlString = removeWhiteSpace(xmlString);
            xmlString = qnautils.reencode(xmlString, xmlEntityReplacements);
            xmlString = exports.removeRedundantXmlnsAttribute(xmlString);
            xmlString = exports.fixDocumentNode(topic, xmlString, format);
            return xmlString;
        }

        /*
         Replace the top level element with another
         */
        function setDocumentNodeToName (xmlText, newElementName) {
            var match = /\s*<\s*[^\s>]+(.*?)>([\s\S]*)<\s*\/[^\s]+\s*>/.exec(xmlText);
            if (match !== null) {
                return "<" + newElementName + match[1] + ">" + match[2] + "</" + newElementName + ">";
            } else {
                return xmlText;
            }
        }

        exports.removeRedundantXmlnsAttribute  = function(xmlString) {
            return xmlString.replace(/(<\s*[A-Za-z0-9]+)\s+(xmlns\s*=\s*("|')http:\/\/docbook.org\/ns\/docbook("|'))(.*?>)/g, "$1$5");
        }

        exports.fixDocumentNode = function(topic, xmlText, format) {
            if (topic.infoTopic) {
                if (format === constants.DOCBOOK_50 ) {
                    return setDocumentNodeToName(xmlText, "info");
                } else if (format === constants.DOCBOOK_45) {
                    return setDocumentNodeToName(xmlText, "sectioninfo");
                }
            }

            return setDocumentNodeToName(xmlText, "section");
        }

        /**
         * Take the XML from a topic being imported and compare it to the XML of a topic in the database. If the two are
         * equivilent, return true. Otherwise return false.
         *
         * Note that "equivilent" means that the two xml documents are effectivly the same. There are many differences
         * that are tollerated (spacing, attribute order etc) between two equivilent xml documents.
         *
         * @param topic  The topic being processed
         * @param format The format of the topic
         * @param topicOrContainerIDs A list of topic or container ids
         * @param xmlDoc1 The cloned xml of the topic being imported. This process is destructive, so send a copy with xml.clone(true) to this function.
         * @param xmlDoc1Entities The entities that were replaced to convert the xml to a document.
         * @param xmlDoc2 The cloned xml of the topic in the database.
         * @param xmlDoc2Entities The entities that were replaced to convert the xml to a document.
         */
        exports.compareXml = function(topic, format, topicOrContainerIDs, xmlDoc1, xmlDoc1Entities, xmlDoc2, xmlDoc2Entities) {
            normalizeComments(xmlDoc1);
            normalizeInjections(xmlDoc1);
            normalizeXrefs(xmlDoc1, topicOrContainerIDs);
            reorderAttributes(xmlDoc1);
            normalizeXMLEntityCharacters(xmlDoc1, xmlDoc1Entities);
            var xmlDoc1XmlString = normalizeXmlString(xmlDoc1, xmlDoc1Entities, topic, format);

            normalizeComments(xmlDoc2);
            normalizeInjections(xmlDoc2);
            reorderAttributes(xmlDoc2);
            normalizeXMLEntityCharacters(xmlDoc2, xmlDoc2Entities);
            var xmlDoc2XmlString = normalizeXmlString(xmlDoc2, xmlDoc2Entities, topic, format);

            if (xmlDoc1XmlString === xmlDoc2XmlString) {

                /*
                 This is the second level of checking. If we reach this point we know the
                 two XML file have the same structure and content ignoring any whitespace.
                 Now we make sure that any elements where whitespace is signifiant also
                 match.
                 */
                var verbatimMatch = true;
                jquery.each(VERBATIM_ELEMENTS, function (index, elementName) {
                    var originalNodes = qnautils.xPath(".//docbook:" + elementName, xmlDoc1);
                    var matchingNodes = qnautils.xPath(".//docbook:" + elementName, xmlDoc2);

                    var originalNode;
                    var matchingNode;
                    while ((originalNode = originalNodes.iterateNext()) !== null) {
                        matchingNode = matchingNodes.iterateNext();

                        if (matchingNode === null) {
                            throw "There was a mismatch between verbatim elements in similar topics!";
                        }

                        var reencodedOriginal = qnautils.reencode(qnautils.xmlToString(originalNode), xmlDoc1Entities);
                        var reencodedMatch = qnautils.reencode(qnautils.xmlToString(matchingNode), xmlDoc2Entities);

                        // the original

                        if (reencodedOriginal !== reencodedMatch) {
                            verbatimMatch = false;
                            return false;
                        }
                    }

                    if ((matchingNode = matchingNodes.iterateNext()) !== null) {
                        throw "There was a mismatch between verbatim elements in similar topics!";
                    }
                });

                return verbatimMatch;
            } else {
                return false;
            }
        }

        /**
         * Take the XML from a topic being imported and compare it to the XML of a topic in the database. If the two are
         * equivilent, return true. Otherwise return false.
         *
         * Note that "equivilent" means the same as the compareXml() function, with the exception that injections
         * need to be the same.
         *
         * @param topic  The topic being processed
         * @param format The format of the topic
         * @param topicOrContainerIDs A list of topic or container ids
         * @param xmlDoc1 The cloned xml of the topic being imported. This process is destructive, so send a copy with xml.clone(true) to this function.
         * @param xmlDoc1Entities The entities that were replaced to convert the xml to a document.
         * @param xmlDoc2 The cloned xml of the topic in the database.
         * @param xmlDoc2Entities The entities that were replaced to convert the xml to a document.
         */
        exports.compareStrictXml = function(topic, format, xmlDoc1, xmlDoc1Entities, xmlDoc2, xmlDoc2Entities) {
            normalizeComments(xmlDoc1);
            reorderAttributes(xmlDoc1);
            normalizeXMLEntityCharacters(xmlDoc1, xmlDoc1Entities);
            var xmlDoc1XmlString = normalizeXmlString(xmlDoc1, xmlDoc1Entities, topic, format);

            normalizeComments(xmlDoc2);
            reorderAttributes(xmlDoc2);
            normalizeXMLEntityCharacters(xmlDoc2, xmlDoc2Entities);
            var xmlDoc2XmlString = normalizeXmlString(xmlDoc2, xmlDoc2Entities, topic, format);

            if (xmlDoc1XmlString === xmlDoc2XmlString) {

                /*
                 This is the second level of checking. If we reach this point we know the
                 two XML file have the same structure and content ignoring any whitespace.
                 Now we make sure that any elements where whitespace is signifiant also
                 match.
                 */
                var verbatimMatch = true;
                jquery.each(VERBATIM_ELEMENTS, function (index, elementName) {
                    var originalNodes = qnautils.xPath(".//docbook:" + elementName, xmlDoc1);
                    var matchingNodes = qnautils.xPath(".//docbook:" + elementName, xmlDoc2);

                    var originalNode;
                    var matchingNode;
                    while ((originalNode = originalNodes.iterateNext()) !== null) {
                        matchingNode = matchingNodes.iterateNext();

                        if (matchingNode === null) {
                            throw "There was a mismatch between verbatim elements in similar topics!";
                        }

                        var reencodedOriginal = qnautils.reencode(qnautils.xmlToString(originalNode), xmlDoc1Entities);
                        var reencodedMatch = qnautils.reencode(qnautils.xmlToString(matchingNode), xmlDoc2Entities);

                        // the original

                        if (reencodedOriginal !== reencodedMatch) {
                            verbatimMatch = false;
                            return false;
                        }
                    }

                    if ((matchingNode = matchingNodes.iterateNext()) !== null) {
                        throw "There was a mismatch between verbatim elements in similar topics!";
                    }
                });

                return verbatimMatch;
            } else {
                return false;
            }
        }
    }
)