/*
    Takes DocBook XML that may be from an existing PressGang build or some other external source and
    processes it so it can be imported and used by PressGang. It also analyses the XML to generate
    the spec metadata.
 */
define(
    ['jquery', 'monad/monad.min', 'qna/qnautils', 'constants', 'exports'],
    function (jquery, monad, qnautils, constants, exports) {

        var ELEMENTS_THAT_NEED_CDATA = ["userinput", "computeroutput"];

        exports.processDocBook = function(resultCallback, errorCallback, xmlText) {

            var monad = new monad();
            var xmlDetails = parseAsXML(xmlText);
            var result = monad.pass(xmlDetails).to(
                fixElementsThatNeedCData,
                removeBoilerplate,
                findBookInfo,
                findIndex,
                fixProgramListingEntries
            );

            resultCallback(
                {
                    xml: qnautils.reencode(qnautils.xmlToString(xmlDetails.xmlDoc), xmlDetails.replacements),
                    config: xmlDetails.config
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
                return {xmlDoc: xmlDoc, xmlDetails: xmlDetails, config: {}};
            }

            /**
             * Publican won't respect line breaks in elements like userinput or computeroutput
             * when they are in a <screen> unless their text is wrapped in a CDATA element.
             */
            function fixElementsThatNeedCData(xmlDetails) {
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

                return xmlDetails;
            }

            /*
             Remove any content that is added automatically by the csprocessor. This means you
             can re-import content exported as a book by csprocessor.
             */
            function removeBoilerplate(xmlDetails) {
                var createBugParas = qnautils.xPath("//docbook:para[@role='RoleCreateBugPara']", xmlDetails.xmlDoc);
                var removeElements = [];
                var para;
                while ((para = createBugParas.iterateNext()) !== null) {
                    removeElements.push(para);
                }

                jquery.each(removeElements, function (index, value) {
                    value.parentNode.removeChild(value);
                });

                return xmlDetails;
            }

            /*
             Find the book info details
             */
            function findBookInfo (xmlDetails) {

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

                return xmlDetails;
            }

            function findIndex (xmlDetails) {
                var index = qnautils.xPath("//docbook:index", xmlDetails.xmlDoc).iterateNext();
                if (index) {
                    xmlDetails.config.Index = "On";
                }

                return xmlDetails;
            }

            function fixProgramListingEntries(xmlDetails) {
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

                return xmlDetails;
            }
        }
    }
)