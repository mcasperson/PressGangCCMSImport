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
    Takes DocBook XML that may be from an existing PressGang build or some other external source and
    processes it so it can be imported and used by PressGang. It also analyses the XML to generate
    the spec metadata.
 */
define(
    ['jquery', 'async/async', 'qna/qnautils', 'constants', 'exports'],
    function (jquery, async, qnautils, constants, exports) {

        var ELEMENTS_THAT_NEED_CDATA = ["userinput", "computeroutput"];

        exports.processDocBook = function(resultCallback, errorCallback, xmlText) {

            var xmlDetails = parseAsXML(xmlText);

            /*
                Define the computation as an async waterfall
             */
            async.waterfall(
                [
                    function(callback) {fixElementsThatNeedCData(xmlDetails, callback)},
                    function(xmlDetails, callback) {removeBoilerplate(xmlDetails, callback)},
                    function(xmlDetails, callback) {findBookInfo(xmlDetails, callback)},
                    function(xmlDetails, callback) {findIndex(xmlDetails, callback)},
                    function(xmlDetails, callback) {fixProgramListingEntries(xmlDetails, callback)}
                ],
                function(error, result) {
                    resultCallback(
                        {
                            xml: qnautils.reencode(qnautils.xmlToString(result.xmlDoc), result.replacements),
                            config: result.config
                        }
                    );
                }
            );

            /*
             Take the sanitised XML and convert it to an actual XML DOM
             */
            function parseAsXML(xmlText, config) {
                var xmlDetails = qnautils.replaceEntitiesInText(xmlText);
                var xmlDoc = qnautils.stringToXML(xmlDetails.xml);

                if (xmlDoc === null) {
                    errorCallback("Invalid XML", "The source material has invalid XML, and can not be imported.", true);
                    return;
                }
                xmlDetails.xmlDoc = xmlDoc;
                xmlDetails.config = {};
                return xmlDetails;
            }

            /**
             * Publican won't respect line breaks in elements like userinput or computeroutput
             * when they are in a <screen> unless their text is wrapped in a CDATA element.
             */
            function fixElementsThatNeedCData(xmlDetails, callback) {
                var replacements = [];
                jquery.each(ELEMENTS_THAT_NEED_CDATA, function(index, value) {
                    var cdataElements = qnautils.xPath("//docbook:" + value, xmlDetails.xmlDoc);
                    var cdataElement = null;
                    while ((cdataElement = cdataElements.iterateNext()) !== null) {
                        var textNodes = qnautils.xPath(".//docbook:text()", cdataElement);
                        var textNode = null;
                        while ((textNode = textNodes.iterateNext()) !== null) {
                            if (textNode.parentNode.nodeType !== Node.CDATA_SECTION_NODE) {
                                replacements.push(textNode);
                            }
                        }
                    }
                });

                jquery.each(replacements, function(index, value) {
                    var cdata = xmlDetails.xmlDoc.createCDATASection(value.textContent);
                    value.parentNode.insertBefore(cdata, value);
                    value.parentNode.removeChild(value);
                });

                callback(null, xmlDetails);
            }

            /*
             Remove any content that is added automatically by the csprocessor. This means you
             can re-import content exported as a book by csprocessor.
             */
            function removeBoilerplate(xmlDetails, callback) {
                var createBugParas = qnautils.xPath("//docbook:para[@role='RoleCreateBugPara']", xmlDetails.xmlDoc);
                var removeElements = [];
                var para;
                while ((para = createBugParas.iterateNext()) !== null) {
                    removeElements.push(para);
                }

                jquery.each(removeElements, function (index, value) {
                    value.parentNode.removeChild(value);
                });

                callback(null, xmlDetails);
            }

            /*
             Find the book info details
             */
            function findBookInfo (xmlDetails, callback) {

                /*
                 Try looking at the root book or article element
                 */
                var root = qnautils.xPath("//docbook:book", xmlDetails.xmlDoc).iterateNext();
                if (root === null) {
                    root = qnautils.xPath("//docbook:article", xmlDetails.xmlDoc).iterateNext();
                }

                if (root) {
                    var rootTitle = qnautils.xPath("./docbook:title", root).iterateNext();
                    var rootSubtitle = qnautils.xPath("./docbook:subtitle", root).iterateNext();

                    if (rootTitle) {
                        xmlDetails.config.ContentSpecTitle = qnautils.reencode(qnautils.replaceWhiteSpace(rootTitle.innerHTML), xmlDetails.replacements);
                    }

                    if (rootSubtitle) {
                        xmlDetails.config.ContentSpecSubtitle = qnautils.reencode(qnautils.replaceWhiteSpace(rootSubtitle.innerHTML), xmlDetails.replacements);
                    }
                }

                /*
                 Look in the info elements for additional metadata
                 */
                var bookinfo = qnautils.xPath("//docbook:bookinfo", xmlDetails.xmlDoc).iterateNext();
                if (bookinfo === null) {
                    bookinfo = qnautils.xPath("//docbook:articleinfo", xmlDetails.xmlDoc).iterateNext();
                }
                if (bookinfo === null) {
                    bookinfo = qnautils.xPath("//docbook:info", xmlDetails.xmlDoc).iterateNext();
                }

                if (bookinfo) {
                    var title = qnautils.xPath("./docbook:title", bookinfo).iterateNext();
                    var subtitle = qnautils.xPath("./docbook:subtitle", bookinfo).iterateNext();
                    var edition = qnautils.xPath("./docbook:edition", bookinfo).iterateNext();
                    var pubsnumber = qnautils.xPath("./docbook:pubsnumber", bookinfo).iterateNext();
                    var productname = qnautils.xPath("./docbook:productname", bookinfo).iterateNext();
                    var productnumber = qnautils.xPath("./docbook:productnumber", bookinfo).iterateNext();

                    if (title) {
                        xmlDetails.config.ContentSpecTitle = qnautils.reencode(qnautils.replaceWhiteSpace(title.innerHTML), xmlDetails.replacements);
                    }

                    if (subtitle) {
                        xmlDetails.config.ContentSpecSubtitle = qnautils.reencode(qnautils.replaceWhiteSpace(subtitle.innerHTML), xmlDetails.replacements);
                    }

                    if (edition) {
                        xmlDetails.config.ContentSpecEdition = qnautils.reencode(qnautils.replaceWhiteSpace(edition.innerHTML), xmlDetails.replacements);
                    }

                    if (pubsnumber) {
                        xmlDetails.config.ContentSpecPubsnumber = qnautils.reencode(qnautils.replaceWhiteSpace(pubsnumber.innerHTML), xmlDetails.replacements);
                    }

                    if (productname) {
                        xmlDetails.config.ContentSpecProduct = qnautils.reencode(qnautils.replaceWhiteSpace(productname.innerHTML), xmlDetails.replacements);
                    }

                    if (productnumber) {
                        if (productnumber.innerHTML.trim().length !== 0) {
                            xmlDetails.config.ContentSpecVersion = qnautils.reencode(qnautils.replaceWhiteSpace(productnumber.innerHTML), xmlDetails.replacements);
                        }
                    }

                    /*
                     Set some defaults if no values could be found
                     */
                    if (xmlDetails.config.ContentSpecProduct === undefined) {
                        xmlDetails.config.ContentSpecProduct = "Product";
                    }

                    if (xmlDetails.config.ContentSpecVersion === undefined) {
                        xmlDetails.config.ContentSpecVersion = "1";
                    }
                }

                callback(null, xmlDetails);
            }

            function findIndex (xmlDetails, callback) {
                var index = qnautils.xPath("//docbook:index", xmlDetails.xmlDoc).iterateNext();
                if (index) {
                    xmlDetails.config.Index = "On";
                }

                callback(null, xmlDetails);
            }

            function fixProgramListingEntries(xmlDetails, callback) {
                var replacements = [];
                var programListings = qnautils.xPath("//docbook:programlisting", xmlDetails.xmlDoc);
                var programListing = null;
                while ((programListing = programListings.iterateNext()) !== null) {
                    if (programListing.hasAttribute("language")) {
                        replacements.push(programListing);
                    }
                }

                jquery.each(replacements, function(index, value) {
                    var lang = value.getAttribute("language");
                    if (lang === "ini") {
                        value.setAttribute("language", "INI Files");
                    } else if (lang === "json") {
                        value.setAttribute("language", "JavaScript");
                    }
                });

                callback(null, xmlDetails);
            }
        }
    }
)