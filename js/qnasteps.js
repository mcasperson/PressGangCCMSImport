(function (global) {
    'use strict';

    /*
        A step in the QNA system is a hierarchy of objects.

        The QNAStep represents one entire step in the wizard.
          Each QNAStep holds zero or more QNAVariables. QNAVariables are collections of QNAVariable objects.
            Each QNAVariables holds one or more QNAVariable objects. A QNAVariable is a UI element that the user is expected to supply a value for.

        You will note that each level in the hierarchy and each value for the objects in the hierarchy are calculated
        via callbacks. If each step in the wizard is known, these callbacks can just return static values. If the
        steps require some kind of processing in order to determine the correct values shown to the user, these callbacks
        can perform any kind of async operation (querying a server, reading a file etc) that they need to.
     */

    var REVISION_HISTORY_TAG_ID = 598;
    var AUTHOR_GROUP_TAG_ID = 664;
    var ABSTRACT_TAG_ID = 692;

    // a zip model to be shared
    var zip = new global.QNAZipModel();

    function loadSetting(file, setting) {
        var retValue;
        var lines = file.split("\n");
        global.jQuery.each(lines, function (index, value) {
            var keyValue = value.split(":");
            if (keyValue.length === 2) {
                if (new RegExp(global.escapeRegExp(setting.trim())).test(keyValue[0].trim())) {
                    retValue = keyValue[1].trim();
                    return false;
                }
            }
        });
        return retValue;
    }

    function xmlToString(xmlDoc) {
        return (new global.XMLSerializer()).serializeToString(xmlDoc);
    }

    function reencode(xmlString, replacements) {
        var reversed = replacements.reverse();
        global.jQuery.each(reversed, function (index, value) {
            xmlString = xmlString.replace(new RegExp(global.escapeRegExp(value.placeholder), "g"), value.entity);
        });
        return xmlString;
    }

    function replaceSpecialChars(text) {
        return text.replace(/"/g, "\\\"")
            .replace(/\t/g, "\\t")
            .replace(/\n/g, "\\n");
    }

    function replaceWhiteSpace(text) {
        text = text.replace(/\n/g, " ");
        text = text.replace(/\s+/g, " ");
        return text;
    }

    function createImage(zipfile, image, config, successCallback, errorCallback) {

        zip.getByteArrayFromFileName(
            zipfile,
            image,
            function (arrayBuffer) {

                var byteArray = [];
                var view = new global.Uint8Array(arrayBuffer);
                for (var i = 0; i < view.length; ++i) {
                    byteArray.push(view[i]);
                }

                var postBody = {
                    description: image,
                    languageImages_OTM: {
                        items: [
                            {
                                item: {
                                    imageData: byteArray,
                                    locale: "en-US",
                                    filename: image,
                                    configuredParameters: [
                                        "locale",
                                        "imageData",
                                        "filename"
                                    ]
                                },
                                state: 1
                            }
                        ]
                    },
                    configuredParameters: [
                        "description",
                        "languageImages"
                    ]
                };

                global.jQuery.ajax({
                    type: 'POST',
                    url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/image/createormatch/json?message=Initial+Image+Creation&flag=2&userId=89',
                    data: JSON.stringify(postBody),
                    contentType: "application/json",
                    dataType: "json",
                    success: function (data) {
                        successCallback(data.image.id, data.matchedExistingImage);
                    },
                    error: function () {
                        errorCallback("Connection Error", "An error occurred while uploading an image.");
                    }
                });
            },
            errorCallback
        );
    }

    function createContentSpec(spec, config, successCallback, errorCallback) {

        var postBody = {
            text: spec,
            configuredParameters: [
                "text"
            ]
        };

        global.jQuery.ajax({
            type: 'POST',
            url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/contentspec/create/json+text?message=Initial+Topic+Creation&flag=2&userId=89',
            data: JSON.stringify(postBody),
            contentType: "application/json",
            dataType: "json",
            success: function (data) {
                successCallback(data.id);
            },
            error: function () {
                errorCallback("Connection Error", "An error occurred while uploading the content spec.");
            }
        });
    }

    function updateContentSpec(id, spec, config, successCallback, errorCallback) {
        var postBody = {
            id: id,
            text: "ID = " + id + "\n" + spec,
            configuredParameters: [
                "text"
            ]
        };

        global.jQuery.ajax({
            type: 'POST',
            url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/contentspec/update/json+text/?message=Initial+Topic+Creation&flag=2&userId=89',
            data: JSON.stringify(postBody),
            contentType: "application/json",
            dataType: "json",
            success: function (data) {
                successCallback(data.id);
            },
            error: function () {
                errorCallback("Connection Error", "An error occurred while uploading the content spec.");
            }
        });
    }

    function setDocumentNodeToSection (xmlText) {
        if (xmlText.indexOf("<chapter>") === 0) {
            xmlText = xmlText.replace(/^<chapter>/, "<section>");
            xmlText = xmlText.replace(/<\/chapter>$/, "</section>");
        } else if (xmlText.indexOf("<appendix>") === 0) {
            xmlText = xmlText.replace(/^<appendix>/, "<section>");
            xmlText = xmlText.replace(/<\/appendix>$/, "</section>");
        } else if (xmlText.indexOf("<part>") === 0) {
            xmlText = xmlText.replace(/^<part>/, "<section>");
            xmlText = xmlText.replace(/<\/part>$/, "</section>");
        }

        return xmlText;
    }

    function createTopic(xml, replacements, title, tags, config, successCallback, errorCallback) {

        var fixedXML =  setDocumentNodeToSection(reencode(xmlToString(xml), replacements).trim());

        var postBody = {
            xml: fixedXML,
            locale: "en-US",
            configuredParameters: [
                "xml",
                "locale"
            ]
        };

        if (title) {
            postBody.title = title;
            postBody.description = title;
            postBody.configuredParameters.push("title");
            postBody.configuredParameters.push("description");
        }

        if (tags) {
            postBody.tags = {
                items: []
            };
            postBody.configuredParameters.push("tags");

            global.jQuery.each(tags, function (index, value) {
                postBody.tags.items.push({
                   item: {
                       id: value
                   },
                   state: 1
                });
            });
        }

        global.jQuery.ajax({
            type: 'POST',
            url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/topic/createormatch/json?message=Initial+Topic+Creation&flag=2&userId=89',
            data: JSON.stringify(postBody),
            contentType: "application/json",
            dataType: "json",
            success: function (data) {
                successCallback(data);
            },
            error: function () {
                errorCallback("Connection Error", "An error occurred while uploading the topic.");
            }
        });
    }

    function getSimilarTopics(xml, config, successCallback, errorCallback) {
        global.jQuery.ajax({
            type: 'POST',
            url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/minhashsimilar/get/json?threshold=0.6&expand=%7B%22branches%22%3A%5B%7B%22trunk%22%3A%7B%22name%22%3A%20%22topics%22%7D%7D%5D%7D',
            data: xml,
            contentType: "application/xml",
            dataType: "json",
            success: function (data) {
                successCallback(data);
            },
            error: function () {
                errorCallback("Connection Error", "An error occurred while getting similar topics.");
            }
        });
    }

    function updateTopic(id, xml, replacements, title, config, successCallback, errorCallback) {

        var postBody = {
            id: id,
            xml: setDocumentNodeToSection(reencode(xmlToString(xml), replacements)),
            locale: "en-US",
            configuredParameters: [
                "xml",
                "locale"
            ]
        };

        if (title) {
            postBody.title = title;
            postBody.description = title;
            postBody.configuredParameters.push("title");
            postBody.configuredParameters.push("description");
        }

        global.jQuery.ajax({
            type: 'POST',
            url: 'http://' + config.PressGangHost + ':8080/pressgang-ccms/rest/1/topic/update/json',
            data: JSON.stringify(postBody),
            contentType: "application/json",
            dataType: "json",
            success: function (data) {
                successCallback(data.id);
            },
            error: function () {
                errorCallback("Connection Error", "An error occurred while uploading a topic.");
            }
        });
    }

    /*
        STEP 1 - Get the ZIP file
     */
    global.QNAStart = new global.QNAStep()
        .setTitle("Select the ZIP file to import")
        .setIntro("Select the ZIP file that contains the valid Publican book that you wish to import into PressGang CCMS.")
        .setInputs(
            [
                new global.QNAVariables()
                    .setVariables([
                        new global.QNAVariable()
                            .setType(global.InputEnum.SINGLE_FILE)
                            .setIntro("Publican ZIP File")
                            .setName("ZipFile")
                    ])
            ]
        )
        .setProcessStep(function (resultCallback, errorCallback, result, config) {
            if (!config.ZipFile) {
                errorCallback("Please select a file", "You need to select a file before continuing.");
            } else {
                zip.getCachedEntries(config.ZipFile, function (entries) {

                    var foundPublicanCfg = false;
                    global.angular.forEach(entries, function (value, key) {
                        if (value.filename === "publican.cfg") {
                            foundPublicanCfg = true;
                            return false;
                        }
                    });

                    if (!foundPublicanCfg) {
                        errorCallback("Error", "The ZIP file did not contain a publican.cfg file.");
                    } else {
                        resultCallback(null);
                    }
                }, function (message) {
                    errorCallback("Error", "Could not process the ZIP file!");
                });
            }
        })
        .setNextStep(function (resultCallback) {
            resultCallback(askForMainXML);
        });

    /*
     STEP 2 - Get the main XML file
     */
    var askForMainXML = new global.QNAStep()
        .setTitle("Select the main XML file")
        .setIntro("Select the main XML file from the ZIP archive. Publican conventions mean the file should be named after the book title in the Book_Info.xml file. " +
                "This import tool will attempt to read the Book_Info.xml file to find the book title, and from that select the main XML file. " +
                "You only need to make a manual selection if the import tool could not find the main XML file, or if you want to override the default selection.")
        .setInputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.LISTBOX)
                        .setName("MainXMLFile")
                        .setOptions(function (resultCallback, errorCallback, result, config) {
                            zip.getCachedEntries(config.ZipFile, function (entries) {
                                var retValue = [];

                                global.angular.forEach(entries, function (value, key) {
                                    if (/^.*?\.xml$/.test(value.filename)) {
                                        retValue.push(value.filename);
                                    }
                                });

                                resultCallback(retValue);
                            });
                        })
                        .setValue(function (resultCallback, errorCallback, result, config) {
                            zip.getCachedEntries(config.ZipFile, function (entries) {
                                global.angular.forEach(entries, function (value, key) {
                                    if (/^en-US\/Book_Info\.xml$/.test(value.filename)) {
                                        zip.getTextFromFile(value, function (textFile) {
                                            var match = /<title>(.*?)<\/title>/.exec(textFile);
                                            if (match) {
                                                var assumedMainXMLFile = "en-US/" + match[1].replace(/ /g, "_") + ".xml";

                                                global.angular.forEach(entries, function (value, key) {
                                                    if (value.filename === assumedMainXMLFile) {
                                                        resultCallback(assumedMainXMLFile);
                                                        return;
                                                    }
                                                });
                                            }
                                        });

                                        return false;
                                    }
                                });
                            });

                            resultCallback(null);
                        })
                ])
        ])
        .setNextStep(function (resultCallback) {
            resultCallback(askToCreateNewSpecOrOverwriteExistingOne);
        });

    /*
        Step 3 - Ask about creating a new spec or overwriting an old one
     */
    var askToCreateNewSpecOrOverwriteExistingOne = new global.QNAStep()
        .setTitle("Create or overwrite a content spec?")
        .setIntro("This wizard can create a new content specification, or overwrite the contents of an existing one. " +
                "You will usually want to create a new content specification, but if you are reimporting a book and want to overwrite the previously imported content spec, " +
                "select the overwrite option.")
        .setInputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.RADIO_BUTTONS)
                        .setIntro(["Create a new content spec", "Overwrite an existing content spec"])
                        .setName("CreateOrOverwrite")
                        .setOptions(["CREATE", "OVERWRITE"])
                        .setValue("CREATE")
                ])
        ])
        .setNextStep(function (resultCallback, errorCallback, result, config) {
            resultCallback(config.CreateOrOverwrite === "CREATE" ? specifyTheServer : getExistingContentSpecID);
        });

    var getExistingContentSpecID = new global.QNAStep()
        .setTitle("Specify the ID of the content specification to overwrite")
        .setInputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.TEXTBOX)
                        .setIntro("Existing content specification ID")
                        .setName("ExistingContentSpecID")
                ])
        ])
        .setProcessStep(function (resultCallback, errorCallback, result, config) {
            if (!/\d+/.test(config.ExistingContentSpecID)) {
                errorCallback("Invalid Content Specification ID", "You need to enter a valid content specification id. The ID is a sequence of numbers, like 12321.");
            } else {
                resultCallback(null);
            }
        })
        .setNextStep(function (resultCallback) {
            resultCallback(specifyTheServer);
        });

    /*
        Step 4 - ask which server this is being uploaded to
     */
    var specifyTheServer = new global.QNAStep()
        .setTitle("Select the server to import in to")
        .setIntro("You can create the imported content specification on either the production or test PressGang servers. " +
            "Using the test server is recommended for the first import to check the results before adding the content to the production server.")
        .setInputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.RADIO_BUTTONS)
                        .setIntro(["Production Server", "Test Server"])
                        .setOptions(["skynet.usersys.redhat.com", "skynet-dev.usersys.redhat.com"])
                        .setValue("skynet-dev.usersys.redhat.com")
                        .setName("PressGangHost")
                ])
        ])
        .setNextStep(function (resultCallback) {
            resultCallback(processZipFile);
        });

    /*
        Step 5 - Process the zip file
     */
    var processZipFile = new global.QNAStep()
        .setTitle("Importing Publican Book")
        .setOutputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Resolving xi:includes")
                        .setName("ResolvedXIIncludes"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Finding entities in XML")
                        .setName("FoundEntities"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Finding entity definitions")
                        .setName("FoundEntityDefinitions"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Removing XML preamble")
                        .setName("RemovedXMLPreamble"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Parse as XML")
                        .setName("ParsedAsXML"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Finding book info")
                        .setName("FoundBookInfo"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Finding revision history")
                        .setName("FoundRevisionHistory"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Finding author group")
                        .setName("FoundAuthorGroup"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Finding abstract")
                        .setName("FoundAbstract"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Finding and uploading images")
                        .setName("FoundImages"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Resolving book structure")
                        .setName("ResolvedBookStructure"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Match existing topics - Takes a while")
                        .setName("MatchedExistingTopics"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Resolving xref graphs")
                        .setName("ResolvedXRefGraphs"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Uploading Topics")
                        .setName("UploadedTopics"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Fixing XRefs")
                        .setName("FixXRefs"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Updating Content Spec")
                        .setName("UpdatedContentSpec"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.CHECKBOX)
                        .setIntro("Uploading content specification")
                        .setName("UploadedContentSpecification"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Topics Created / Topics Reused")
                        .setName("NewTopicsCreated"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Images Created / Images Reused")
                        .setName("NewImagesCreated"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PROGRESS)
                        .setIntro("Progress")
                        .setName("UploadProgress")
                        // gotta set this first up because of https://github.com/angular-ui/bootstrap/issues/1547
                        .setValue([17, 0])
                ])
        ])
        .setEnterStep(function (resultCallback, errorCallback, result, config) {

            /**
             * A collection of entity definitions
             * @type {Array}
             */

            var replacements = [];

            /*
                Initialize some config values
             */
            config.UploadedTopicCount = 0;
            config.MatchedTopicCount = 0;
            config.UploadedImageCount = 0;
            config.MatchedImageCount = 0;

            /*
             Resolve xi:includes
             */
            var resolveXiIncludes = function () {
                var xiIncludeRe = /<\s*xi:include\s+xmlns:xi\s*=\s*("|')http:\/\/www\.w3\.org\/2001\/XInclude("|')\s+href\s*=\s*("|')(.*?\.xml)("|')\s*\/\s*>/;
                var commonContent = /^Common_Content/;

                var resolveXIInclude = function (xmlText, filename, callback) {
                    var match = xiIncludeRe.exec(xmlText);
                    if (match) {
                        var relativePath = "";
                        var lastIndexOf;
                        if ((lastIndexOf = filename.lastIndexOf("/")) !== -1) {
                            relativePath = filename.substring(0, lastIndexOf);
                        }

                        if (commonContent.test(match[4])) {
                            resolveXIInclude(xmlText.replace(match[0], ""), filename, callback);
                        } else {
                            var referencedXMLFilename = relativePath + "/" + match[4];
                            zip.getTextFromFileName(
                                config.ZipFile,
                                referencedXMLFilename,
                                function (referencedXmlText) {
                                    resolveXIInclude(referencedXmlText, referencedXMLFilename, function (fixedReferencedXmlText) {
                                        resolveXIInclude(xmlText.replace(match[0], fixedReferencedXmlText), filename, callback);
                                    });
                                },
                                function (error) {
                                    errorCallback(error);
                                }
                            );
                        }
                    } else {
                        callback(xmlText);
                    }
                };

                zip.getTextFromFileName(config.ZipFile, config.MainXMLFile, function (xmlText) {
                    resolveXIInclude(xmlText, config.MainXMLFile, function (xmlText) {
                        config.UploadProgress[1] = 1;
                        config.ResolvedXIIncludes = true;
                        resultCallback();

                        replaceEntities(xmlText);
                    });
                });
            };

            /*
             Replace entities with markers so we can process the XML without worrying about resolving entities
             */
            var replaceEntitiesInText = function (xmlText) {
                var retValue = [];

                var entityRe = /&.*?;/;

                var match;
                while (match = entityRe.exec(xmlText)) {
                    var randomReplacement;
                    while (xmlText.indexOf(randomReplacement = "#" + Math.floor((Math.random() * 1000000000) + 1) + "#") !== -1) {

                    }

                    retValue.push({placeholder: randomReplacement, entity: match[0]});

                    xmlText = xmlText.replace(new RegExp(global.escapeRegExp(match[0]), "g"), randomReplacement);
                }

                return {xml: xmlText, replacements: retValue};
            };

            var replaceEntities = function (xmlText) {
                var fixedXMLResult = replaceEntitiesInText(xmlText);
                replacements = fixedXMLResult.replacements;
                xmlText = fixedXMLResult.xml;

                config.UploadProgress[1] = 2;
                config.FoundEntities = true;
                resultCallback();

                findEntities(xmlText);
            };

            /*
             Find any entity definitions in the xml or ent files. Note that older publican books reference invalid
             entity files, so we just do a brute force search.
             */
            var findEntities = function (xmlText) {
                var entities = [];

                var relativePath = "";
                var lastIndexOf;
                if ((lastIndexOf = config.MainXMLFile.lastIndexOf("/")) !== -1) {
                    relativePath = config.MainXMLFile.substring(0, lastIndexOf);
                }

                zip.getCachedEntries(config.ZipFile, function (entries) {

                    var processTextFile = function (index) {
                        if (index >= entries.length) {
                            config.UploadProgress[1] = 3;
                            config.FoundEntityDefinitions = true;
                            resultCallback();

                            removeXmlPreamble(xmlText, entities);
                        } else {
                            var value = entries[index];
                            if (value.filename.indexOf(relativePath) === 0) {
                                zip.getTextFromFile(value, function (fileText) {
                                    var entityDefDoubleQuoteRE = /<!ENTITY\s+[^\s]+\s+".*?"\s*>/g;
                                    var entityDefSingleQuoteRE = /<!ENTITY\s+[^\s]+\s+'.*?'\s*>/g;
                                    var match;
                                    while (match = entityDefDoubleQuoteRE.exec(fileText)) {
                                        if (entities.indexOf(match[0]) === -1) {
                                            entities.push(match[0]);
                                        }
                                    }

                                    while (match = entityDefSingleQuoteRE.exec(fileText)) {
                                        if (entities.indexOf(match[0]) === -1) {
                                            entities.push(match[0]);
                                        }
                                    }

                                    processTextFile(index + 1);
                                });
                            } else {
                                processTextFile(index + 1);
                            }
                        }
                    };

                    processTextFile(0);
                });
            };

            /*
             Strip out any XML preabmle that might have been pulled in with the
             xi:inject resolution. Once this step is done we have plain xml
             with no entities, dtds or anything else that make life hard when
             trying to parse XML.
             */
            var removeXmlPreamble = function (xmlText, entities) {
                xmlText = xmlText.replace(/<\?xml.*?>/g, "");
                xmlText = xmlText.replace(/<!DOCTYPE[\s\S]*?\[[\s\S]*?\]>/g, "");

                config.UploadProgress[1] = 4;
                config.RemovedXMLPreamble = true;
                resultCallback();

                parseAsXML(xmlText, entities);
            };

            /*
             Take the sanitised XML and convert it to an actual XML DOM
             */
            var parseAsXML = function (xmlText, entities) {
                var xmlDoc = global.jQuery.parseXML(xmlText);
                config.UploadProgress[1] = 5;
                config.ParsedAsXML = true;
                resultCallback();

                findBookInfo(xmlDoc, entities);
            };

            /*
                Find the book info details
             */
            var findBookInfo = function (xmlDoc, entities) {
                // the content spec
                var contentSpec = [];

                var bookinfo = xmlDoc.evaluate("/*/bookinfo", xmlDoc, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                if (bookinfo) {
                    var title = xmlDoc.evaluate("title", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var subtitle = xmlDoc.evaluate("subtitle", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var edition = xmlDoc.evaluate("edition", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var pubsnumber = xmlDoc.evaluate("pubsnumber", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var productname = xmlDoc.evaluate("productname", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var productnumber = xmlDoc.evaluate("productnumber", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();

                    if (title) {
                        contentSpec.push("Title = " + reencode(replaceWhiteSpace(title.innerHTML), replacements));
                    }

                    if (subtitle) {
                        contentSpec.push("Subtitle = " + reencode(replaceWhiteSpace(subtitle.innerHTML), replacements));
                    }

                    if (edition) {
                        contentSpec.push("Edition = " + reencode(replaceWhiteSpace(edition.innerHTML), replacements));
                    }

                    if (pubsnumber) {
                        contentSpec.push("Pubsnumber = " + reencode(replaceWhiteSpace(pubsnumber.innerHTML), replacements));
                    }

                    if (productname) {
                        contentSpec.push("Product = " + reencode(replaceWhiteSpace(productname.innerHTML), replacements));
                    }

                    if (productnumber) {
                        contentSpec.push("Version = " + reencode(replaceWhiteSpace(productnumber.innerHTML), replacements));
                    }

                    contentSpec.push("DTD = Docbook 4.5");
                    contentSpec.push("Copyright Holder = Red Hat");

                    if (xmlDoc.documentElement.nodeName === "book") {
                        contentSpec.push("Type = Book");
                    } else if (xmlDoc.documentElement.nodeName === "article") {
                        contentSpec.push("Type = Article");
                    }

                    if (entities.length !== 0) {
                        contentSpec.push("Entities = [");
                        global.jQuery.each(entities, function(index, value){
                            contentSpec.push(value);
                        });

                        contentSpec.push("]");
                    }

                    zip.getTextFromFileName(
                        config.ZipFile,
                        "publican.cfg",
                        function (text) {
                            var brand = loadSetting(text, "brand");
                            contentSpec.push("Brand = " + brand);
                            contentSpec.push("publican.cfg = [");
                            contentSpec.push(text);
                            contentSpec.push("]");

                            config.UploadProgress[1] = 6;
                            config.FoundBookInfo = true;
                            resultCallback();

                            extractRevisionHistory(xmlDoc, contentSpec);
                        },
                        errorCallback
                    );
                } else {
                    errorCallback("Invalid content", "The <bookinfo> element could not be found");
                }

            };

            var extractRevisionHistory = function (xmlDoc, contentSpec) {
                var revHistory = xmlDoc.evaluate("//revhistory", xmlDoc, null, global.XPathResult.ANY_TYPE, null).iterateNext();

                var done = function (xmlDoc, contentSpec) {
                    config.UploadProgress[1] = 7;
                    config.FoundRevisionHistory = true;
                    resultCallback();
                    extractAuthorGroup(xmlDoc, contentSpec);
                };

                if (revHistory) {
                    createTopic(
                        revHistory,
                        replacements,
                        "Revision History",
                        [REVISION_HISTORY_TAG_ID],
                        config,
                        function (data) {
                            config.RevisionHistoryTopicID = data.topic.id;
                            config.UploadedTopicCount += 1;
                            if (data.matchedExistingTopic) {
                                config.MatchedTopicCount += 1;
                            }

                            config.NewTopicsCreated = (config.UploadedTopicCount -config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                            contentSpec.push("Revision History = [" + data.topic.id + "]");

                            done(xmlDoc, contentSpec);
                        },
                        errorCallback
                    );
                } else {
                    done(xmlDoc, contentSpec);
                }
            };

            var extractAuthorGroup = function (xmlDoc, contentSpec) {
                var authorGroup = xmlDoc.evaluate("//authorgroup", xmlDoc, null, global.XPathResult.ANY_TYPE, null).iterateNext();

                var done = function (xmlDoc, contentSpec) {
                    config.UploadProgress[1] = 8;
                    config.FoundAuthorGroup = true;
                    resultCallback();

                    extractAbstract(xmlDoc, contentSpec);
                };

                if (authorGroup) {
                    createTopic(
                        authorGroup,
                        replacements,
                        "Author Group",
                        [AUTHOR_GROUP_TAG_ID],
                        config,
                        function (data) {
                            config.AuthorGroupTopicID = data.topic.id;
                            config.UploadedTopicCount += 1;
                            if (data.matchedExistingTopic) {
                                config.MatchedTopicCount += 1;
                            }

                            config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                            contentSpec.push("Author Group = [" + data.topic.id + "]");

                            done(xmlDoc, contentSpec);
                        },
                        errorCallback
                    );
                } else {
                    done(xmlDoc, contentSpec);
                }
            };

            var extractAbstract = function (xmlDoc, contentSpec) {
                var abstractContent = xmlDoc.evaluate("//bookinfo/abstract", xmlDoc, null, global.XPathResult.ANY_TYPE, null).iterateNext();

                var done = function (xmlDoc, contentSpec) {
                    config.UploadProgress[1] = 9;
                    config.FoundAbstract = true;
                    resultCallback();

                    //uploadImages(xmlDoc, contentSpec);
                    resolveBookStructure(xmlDoc, contentSpec);
                };

                if (abstractContent) {
                    createTopic(
                        abstractContent,
                        replacements,
                        "Abstract",
                        [ABSTRACT_TAG_ID],
                        config,
                        function (data) {
                            config.AbstractID = data.topic.id;
                            config.UploadedTopicCount += 1;
                            if (data.matchedExistingTopic) {
                                config.MatchedTopicCount += 1;
                            }

                            config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                            contentSpec.push("Abstract = [" + data.topic.id + "]");

                            done(xmlDoc, contentSpec);
                        },
                        errorCallback
                    );
                } else {
                    done(xmlDoc, contentSpec);
                }
            };

            var uploadImages = function (xmlDoc, contentSpec) {
                var images = xmlDoc.evaluate("//@fileref", xmlDoc, null, global.XPathResult.ANY_TYPE, null);
                var uploadedImages = {};

                var processImages = function (image) {
                    if (image) {

                        var nodeValue = image.nodeValue;

                        // remove the local directory prefix
                        var fixedNodeValue = nodeValue.replace(/^\.\//, "");

                        if (fixedNodeValue.indexOf("images") === 0) {

                            // find the absolute path
                            var pathPrefix = config.MainXMLFile.substring(0, config.MainXMLFile.lastIndexOf("/"));
                            var filename = pathPrefix + "/" + fixedNodeValue;

                            if (!uploadedImages[nodeValue]) {

                                zip.hasFileName(
                                    config.ZipFile,
                                    filename,
                                    function (result) {
                                        if (result) {
                                            createImage(
                                                config.ZipFile,
                                                filename,
                                                config,
                                                function (imageId, matchedExisting) {
                                                    config.UploadedImageCount += 1;
                                                    if (matchedExisting) {
                                                        config.MatchedImageCount += 1;
                                                    }

                                                    config.NewImagesCreated = (config.UploadedImageCount - config.MatchedImageCount) + " / " + config.MatchedImageCount;
                                                    resultCallback();

                                                    uploadedImages[nodeValue] = imageId;

                                                    processImages(images.iterateNext());
                                                },
                                                errorCallback
                                            );
                                        } else {
                                            processImages(images.iterateNext());
                                        }
                                    },
                                    errorCallback
                                );
                            }  else {
                                processImages(images.iterateNext());
                            }
                        } else {
                            processImages(images.iterateNext());
                        }
                    } else {
                        var filerefs = xmlDoc.evaluate("//@fileref", xmlDoc, null, global.XPathResult.ANY_TYPE, null);
                        var updatedRefs = [];
                        var fileref;
                        while (fileref = filerefs.iterateNext()) {
                            if (uploadedImages[fileref.nodeValue]) {
                                updatedRefs.push({node: fileref, newImageRef: "images/" + uploadedImages[fileref.nodeValue]});
                            }
                        }

                        global.jQuery.each(updatedRefs, function(index, value){
                            value.node.nodeValue = value.newImageRef;
                        });

                        config.UploadProgress[1] = 10;
                        config.FoundImages = true;
                        resultCallback();

                        resolveBookStructure(xmlDoc, contentSpec);
                    }
                };

                processImages(images.iterateNext());
            };

            var resolveBookStructure = function(xmlDoc, contentSpec) {
                // the graph that holds the topics
                var topicGraph = new global.TopicGraph();

                // These docbook elements represent containers or topics. Anything else is added as the XML of a topic.
                var sectionTypes = ["part", "chapter", "appendix", "section"];

                // a collection of all the topics we will e uploading
                var topics = [];

                var removeIdAttribute = function (xml) {
                    if (xml.hasAttribute("id")) {
                        xml.removeAttribute("id");
                    }
                    return xml;
                };

                var processXml = function (parentXML, containerId, depth) {
                    // loop over the containers under the root element
                    global.jQuery.each(parentXML.childNodes, function (index, value) {
                        if (sectionTypes.indexOf(value.nodeName) !== -1) {
                            // take a copy of this container
                            var clone = value.cloneNode(true);

                            // find the title
                            var title = xmlDoc.evaluate("/title", clone, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                            if (title) {
                                var titleText = reencode(replaceWhiteSpace(title.innerHTML), replacements);

                                // strip away any child containers
                                var removeChildren = [];
                                global.jQuery.each(clone.childNodes, function (index, containerChild) {
                                    if (sectionTypes.indexOf(containerChild.nodeName) !== -1 ||
                                        containerChild.nodeName === "revhistory") {
                                        removeChildren.push(containerChild);
                                    }
                                });
                                global.jQuery.each(removeChildren, function (index, containerChild) {
                                    clone.removeChild(containerChild);
                                });

                                // the id attribute assigned to this container
                                var id = xmlDoc.evaluate("/@id", clone, null, global.XPathResult.ANY_TYPE, null).iterateNext();

                                // what we have left is the contents of a initial text topic
                                var contentSpecLine = "";
                                for (var i = 0; i < depth * 2; ++i) {
                                    contentSpecLine += " ";
                                }

                                // if there were no child container elements to be removed, it
                                // means this element stands alone. It is either a topic,
                                // or a container that has only initial text
                                if (removeChildren.length === 0) {
                                    if (value.nodeName === "section") {
                                        contentSpec.push(contentSpecLine + titleText);
                                    } else {
                                        contentSpec.push(
                                            contentSpecLine +
                                                value.nodeName.substring(0, 1).toUpperCase() +
                                                value.nodeName.substring(1, value.nodeName.length) +
                                                ": " + titleText);
                                    }

                                    var standaloneContainerTopic = new global.TopicGraphNode(topicGraph)
                                        .setXml(removeIdAttribute(clone), xmlDoc)
                                        .setSpecLine(contentSpec.length - 1)
                                        .setTitle(titleText);

                                    if (id) {

                                        if (topicGraph.hasXMLId(id.nodeValue)) {
                                            throw "The XML id attribute " + id.nodeValue + " has been duplicated. The source book is not valid";
                                        }

                                        standaloneContainerTopic.addXmlId(id.nodeValue);
                                    }

                                    /*
                                        Because of a limitation in the content specs, we can't link
                                        to a container. This is a workaround to link to the first
                                        topic under a container.
                                     */
                                    if (containerId !== undefined && containerId !== null) {

                                        if (topicGraph.hasXMLId(id.nodeValue)) {
                                            throw "The XML id attribute " + id.nodeValue + " has been duplicated. The source book is not valid";
                                        }

                                        standaloneContainerTopic.addXmlId(containerId.nodeValue);
                                    }

                                    topics.push(standaloneContainerTopic);
                                } else {
                                    contentSpec.push(
                                        contentSpecLine +
                                            value.nodeName.substring(0, 1).toUpperCase() +
                                            value.nodeName.substring(1, value.nodeName.length) +
                                            ": " + titleText);

                                    // if this container has front matter content, create a topic
                                    // to represent it
                                    if (clone.childNodes.length !== 0) {
                                        var initialTextTopic = new global.TopicGraphNode(topicGraph)
                                            .setXml(removeIdAttribute(clone), xmlDoc)
                                            .setSpecLine(contentSpec.length - 1)
                                            .setTitle(titleText);

                                        if (id) {
                                            if (topicGraph.hasXMLId(id.nodeValue)) {
                                                throw "The XML id attribute " + id.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            initialTextTopic.addXmlId(id.nodeValue);
                                        }

                                        if (containerId !== undefined && containerId !== null) {
                                            if (topicGraph.hasXMLId(id.nodeValue)) {
                                                throw "The XML id attribute " + id.nodeValue + " has been duplicated. The source book is not valid";
                                            }

                                            initialTextTopic.addXmlId(containerId.nodeValue);
                                        }

                                        // consume this id
                                        id = undefined;

                                        topics.push(initialTextTopic);
                                    }

                                    processXml(value, id, depth + 1);
                                }
                            }
                        }
                    });
                };

                processXml(xmlDoc.documentElement, null, 0);

                config.UploadProgress[1] = 11;
                config.ResolvedBookStructure = true;
                resultCallback();

                matchExistingTopics(xmlDoc, contentSpec, topics, topicGraph);
            };

            /*
                Resolve the topics either to existing topics in the database, or to new topics
             */
            var matchExistingTopics = function (xmlDoc, contentSpec, topics, topicGraph) {

                /*
                    Take every xref that points to a topic (and not just a place in a topic), and replace it
                    with a injection placeholder. This is done on topics to be imported.
                 */
                var normalizeXrefs = function (xml, topicAndContainerIDs) {
                    var xrefs = xmlDoc.evaluate("//xref", xml, null, global.XPathResult.ANY_TYPE, null);
                    var xref;
                    var xrefReplacements = [];
                    while (xref = xrefs.iterateNext()) {
                        if (xref.hasAttribute("linkend")) {
                            var linkend = xref.getAttribute("linkend");
                            if (topicAndContainerIDs.indexOf(linkend) !== -1) {
                                var xrefReplacement = xmlDoc.createComment("InjectPlaceholder: 0");
                                xrefReplacements.push({original: xref, replacement: xrefReplacement});
                            }
                        }
                    }

                    global.jQuery.each(xrefReplacements, function (index, value) {
                        value.original.parentNode.replaceChild(value.replacement, value.original);
                    });

                    return xml;
                };

                /*
                    Take every injection and replace it with a placeholder. This is done on existing topics
                    from PressGang.
                 */
                var normalizeInjections = function (xml, xmlDoc) {
                    var comments = xmlDoc.evaluate("//comment()", xml, null, global.XPathResult.ANY_TYPE, null);
                    var comment;
                    var commentReplacements = [];
                    while (comment = comments.iterateNext()) {
                        if (/^\s*Inject\s*:\s*\d+\s*$/.test(comment.textContent)) {
                            var commentReplacement = xmlDoc.createComment("InjectPlaceholder: 0");
                            commentReplacements.push({original: comment, replacement: commentReplacement});
                        }
                    }

                    global.jQuery.each(commentReplacements, function (index, value) {
                        value.original.parentNode.replaceChild(value.replacement, value.original);
                    });

                    return xml;
                };

                /*
                    Remove all whitespace
                 */
                var removeWhiteSpace = function (xml) {
                    return xml.replace(/\n/g, "")
                        .replace(/\s/g, "");
                };

                var topicOrContainerIDs = topicGraph.getAllTopicOrContainerIDs();

                /*
                    Step 1: find any potential matches already in the PressGang server
                */
                function getPossibleMatches(index, callback) {
                    if (index >= topics.length) {
                        callback();
                    } else {
                        var topic = topics[index];
                        getSimilarTopics(
                            xmlToString(topic.xml),
                            config,
                            function (data) {
                                /*
                                    We start by comparing the topic we are trying to import to the close match in the
                                    database. To do this we normalize whitespace, injections and xrefs. If the two
                                    topics then match we have a potential candidate to reuse.
                                 */
                                var topicXMLCopy = topic.xml.cloneNode(true);
                                normalizeXrefs(normalizeInjections(topicXMLCopy, xmlDoc), topicOrContainerIDs);

                                var topicXMLCompare = xmlToString(topicXMLCopy);
                                topicXMLCompare = removeWhiteSpace(topicXMLCompare);
                                topicXMLCompare = reencode(topicXMLCompare, replacements);
                                topicXMLCompare = setDocumentNodeToSection(topicXMLCompare);

                                /*
                                    topicXMLCompare now has injection placeholders that will match the injection
                                    points in existing topics, has any entities put back, has whitespace removed
                                    and the main element is a section.

                                    We are now ready to compare it directly to topics pulled from PressGang and
                                    normalized.
                                 */

                                global.jQuery.each(data.items, function(index, matchingTopic) {
                                    /*
                                        Strip out the entities which can cause issues with the XML Parsing
                                     */
                                    var replacedTextResult = replaceEntitiesInText(matchingTopic.item.xml);
                                    /*
                                        Parse to XML
                                     */
                                    var matchingTopicXMLCopy = global.jQuery.parseXML(replacedTextResult.xml);
                                    /*
                                        Normalize injections. We do this against a XML DOM because it is more
                                        robust than doing regexes on strings.
                                     */
                                    normalizeInjections(matchingTopicXMLCopy, matchingTopicXMLCopy);
                                    /*
                                        Convert back to a string
                                     */
                                    var matchingTopicXMLCompare = xmlToString(matchingTopicXMLCopy);
                                    /*
                                        Strip whitespace
                                     */
                                    matchingTopicXMLCompare = removeWhiteSpace(matchingTopicXMLCompare);
                                    /*
                                        Restore entities
                                     */
                                    matchingTopicXMLCompare = reencode(matchingTopicXMLCompare, replacedTextResult.replacements);

                                    if (matchingTopicXMLCompare === topicXMLCompare) {
                                        topic.addPGId(matchingTopic.item.id, matchingTopic.item.xml);
                                    }
                                });

                                getPossibleMatches(index + 1, callback);
                            },
                            errorCallback
                        );
                    }
                }

                getPossibleMatches(0, function() {
                    populateOutgoingLinks();
                });

                /*
                    Step 2: Populate outgoing links
                */
                function populateOutgoingLinks() {
                    global.jQuery.each(topics, function (index, topic) {

                        // a collection of xrefs that will be replaced by injections.
                        // topic.xrefs is a collection of all xrefs, but some of these
                        // might point to positions inside a topic, and as such is not
                        // a candidate for being replaced with an injection
                        var outgoingXrefs = [];

                        global.jQuery.each(topic.xrefs, function (index, xref) {
                            if (topicOrContainerIDs.indexOf(xref) !== -1) {
                                outgoingXrefs.push(xref);
                            }
                        });

                        /*
                            We are only interested in mapping the relationships between topics
                            that have matching topics in PressGang.
                         */
                        if (topic.pgIds) {
                            global.jQuery.each(topic.pgIds, function (pgid, details) {
                                var InjectionRE = /<!--\s*Inject\s*:\s*(\d+)\s*-->/g;
                                var match;
                                var count = 0;
                                while (match = InjectionRE.exec(details.originalXML)) {
                                    if (count >= outgoingXrefs.length) {
                                        throw "There is a mismatch between the xrefs and the injects.";
                                    }

                                    var topicId = match[1];
                                    var xref = outgoingXrefs[count];

                                    topic.addFixedOutgoingLink(pgid, xref, topicId);

                                    ++count;
                                }

                                if (count !== outgoingXrefs.length) {
                                    throw "There is a mismatch between the xrefs and the injects.";
                                }
                            });
                        }
                    });

                    config.UploadProgress[1] = 12;
                    config.MatchedExistingTopics = true;
                    resultCallback();

                    resolveXrefs(xmlDoc, contentSpec, topics, topicGraph);
                }
            };

            var resolveXrefs = function (xmlDoc, contentSpec, topics, topicGraph) {
                /*
                 Return a node without a topic ID (which means it hasn't been resolved) and
                 outgoing or incoming links (which means it is part of a xref graph).
                 */
                function getUnresolvedNodeWithOutboundXrefs() {
                    var retValue;
                    global.jQuery.each(topics, function (index, topic) {
                        if (topic.topicId === undefined &&
                            topic.pgIds !== undefined &&
                            topic.fixedOutgoingLinks !== undefined) {
                            retValue = topic;
                            return false;
                        }
                    });
                    return retValue;
                }

                var unresolvedNode;
                while (unresolvedNode = getUnresolvedNodeWithOutboundXrefs()) {
                    /*
                     Loop through each possible topic id that this topic could be
                     and see if all other nodes in the xref graph are also valid with
                     this configuration.
                     */
                    var validNodesOptions = [];
                    global.jQuery.each(unresolvedNode.pgIds, function (pgId, details) {
                        topicGraph.resetTestIds();
                        var validNodes = [];
                        var valid = unresolvedNode.isValid(pgId, validNodes);
                        if (valid) {
                            validNodesOptions.push(validNodes);
                        }
                    });

                    if (validNodesOptions.length !== 0) {

                        var mostSuccess;
                        global.jQuery.each(validNodesOptions, function(index, validNodesOption){
                            if (mostSuccess === undefined || validNodesOption.length > mostSuccess.length) {
                                mostSuccess = validNodesOption;
                            }
                        });

                        /*
                         Every topic in this xref graph is valid with an existing topic id,
                         so set the topicId to indicate that these nodes have been resolved.
                         */
                        global.jQuery.each(mostSuccess, function (index, topic) {
                            if (topic.topicId !== undefined) {
                                throw "We should not be able to set the topic id twice";
                            }

                            topic.setTopicId(topic.testId);

                            config.UploadedTopicCount += 1;
                            config.MatchedTopicCount += 1;
                        });
                    } else {
                        /*
                         We could not find a valid xref graph with the possible existing matches,
                         so set all the topic ids to -1 to indicate that these topics have to be created
                         new.
                         */
                        topicGraph.resetTestIds();
                        var unresolvedNetwork = [];
                        unresolvedNode.getUnresolvedGraph(unresolvedNetwork);

                        global.jQuery.each(unresolvedNetwork, function (index, topic) {
                            if (topic.topicId !== undefined) {
                                throw "We should not be able to set the topic id twice";
                            }

                            topic.setTopicId(-1);
                            config.UploadedTopicCount += 1;
                        });
                    }

                    config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                    resultCallback();
                }

                /*
                 Any that are left are stand alone topics. These can take on the first matching
                 topic id, or -1 is they are new topics.
                 */
                global.jQuery.each(topics, function (index, topic) {
                    if (topic.topicId === undefined) {
                        if (topic.pgIds !== undefined) {
                            topic.setTopicId(Object.keys(topic.pgIds)[0]);
                            config.UploadedTopicCount += 1;
                            config.MatchedTopicCount += 1;
                        } else {
                            topic.setTopicId(-1);
                            config.UploadedTopicCount += 1;
                        }
                    }
                });

                config.NewTopicsCreated = (config.UploadedTopicCount - config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                config.UploadProgress[1] = 13;
                config.ResolvedXRefGraphs = true;
                resultCallback();

                uploadTopics(xmlDoc, contentSpec, topics, topicGraph);
            };

            var uploadTopics = function (xmlDoc, contentSpec, topics, topicGraph) {
                function createTopics(index, callback) {
                    if (index >= topics.length) {
                        callback();
                    } else {
                        var topic = topics[index];
                        if (topic.topicId === -1) {
                            createTopic(
                                topic.xml,
                                replacements,
                                topic.title,
                                null,
                                config, function (data) {
                                    topic.setTopicId(data.topic.id);
                                    topic.createdTopic = true;

                                    var replacedTextResult = replaceEntitiesInText(data.topic.xml);

                                    topic.xml = global.jQuery.parseXML(replacedTextResult.xml);
                                    topic.replacements = replacedTextResult.replacements;

                                    createTopics(index + 1, callback);
                                },
                                errorCallback
                            );
                        } else {
                            createTopics(index + 1, callback);
                        }
                    }
                }

                createTopics(0, function(){

                    config.UploadProgress[1] = 14;
                    config.UploadedTopics = true;
                    resultCallback();

                    resolveXrefsInCreatedTopics(xmlDoc, contentSpec, topics, topicGraph);
                });
            };

            var resolveXrefsInCreatedTopics = function (xmlDoc, contentSpec, topics, topicGraph) {
                function resolve(index, callback) {
                    if (index >= topics.length) {
                        callback();
                    } else {
                        var topic = topics[index];
                        if (topic.createdTopic) {
                            var xrefs = xmlDoc.evaluate("//xref", topic.xml, null, global.XPathResult.ANY_TYPE, null);
                            var xref;
                            var xrefReplacements = [];
                            while (xref = xrefs.iterateNext()) {
                                if (xref.hasAttribute("linkend")) {
                                    var linkend = xref.getAttribute("linkend");
                                    // is this an xref to a topic
                                    var destinationTopic = topicGraph.getNodeFromXMLId(linkend);
                                    if (destinationTopic !== undefined) {

                                        if (destinationTopic.topicId === undefined || destinationTopic.topicId === -1) {
                                            throw "All topics should be resolved by this point";
                                        }

                                        // we are pointing to a saved topic, so replace the xref with an injection
                                        var injection = xmlDoc.createComment("Inject: " + destinationTopic.topicId);
                                        xrefReplacements.push({original: xref, replacement: injection});
                                    }
                                }
                            }

                            global.jQuery.each(xrefReplacements, function (index, value) {
                                value.original.parentNode.replaceChild(value.replacement, value.original);
                            });

                            updateTopic(
                                topic.topicId,
                                topic.xml,
                                topic.replacements,
                                topic.title,
                                config,
                                function (data) {
                                    resolve(index + 1, callback);
                                },
                                errorCallback
                            );
                        } else {
                            resolve(index + 1, callback);
                        }
                    }
                }

                resolve(0, function() {

                    config.UploadProgress[1] = 15;
                    config.FixXRefs = true;
                    resultCallback();

                    updateContentSpec(xmlDoc, contentSpec, topics, topicGraph);
                });
            };

            var updateContentSpec = function (xmlDoc, contentSpec, topics, topicGraph) {
                global.jQuery.each(topics, function (index, topic) {
                    contentSpec[topic.specLine] += " [" + topic.topicId + "]";
                });

                config.UploadProgress[1] = 16;
                config.UpdatedContentSpec = true;
                resultCallback();

                uploadContentSpec(contentSpec);
            };

            var uploadContentSpec = function (contentSpec) {
                var compiledContentSpec = "";
                global.jQuery.each(contentSpec, function(index, value) {
                    compiledContentSpec += value + "\n";
                });

                function contentSpecSaveSuccess(id) {
                    config.UploadProgress[1] = 17;
                    config.UploadedContentSpecification = true;
                    config.ContentSpecID = id;
                    resultCallback(true);
                }

                if (config.ExistingContentSpecID) {
                    updateContentSpec(
                        config.ExistingContentSpecID,
                        compiledContentSpec,
                        config,
                        contentSpecSaveSuccess,
                        errorCallback
                    );
                } else {
                    createContentSpec(
                        compiledContentSpec,
                        config,
                        contentSpecSaveSuccess,
                        errorCallback
                    );
                }
            };

            // start the process
            resolveXiIncludes();
        })
        .setNextStep(function (resultCallback) {
            resultCallback(summary);
        })
        .setShowNext(false)
        .setShowPrevious(false);

    var summary = new global.QNAStep()
        .setTitle("Import Summary")
        .setOutputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.HTML)
                        .setIntro("Content Specification ID")
                        .setName("ContentSpecIDLink")
                        .setValue(function (resultCallback, errorCallback, result, config) {
                            resultCallback("<a href='http://" + config.PressGangHost + ":8080/pressgang-ccms-ui/#ContentSpecFilteredResultsAndContentSpecView;query;contentSpecIds=" + config.ContentSpecID + "'>" + config.ContentSpecID + "</a>");
                        }),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Topics Created / Topics Reused")
                        .setName("NewTopicsCreated"),
                    new global.QNAVariable()
                        .setType(global.InputEnum.PLAIN_TEXT)
                        .setIntro("Images Created / Images Reused")
                        .setName("NewImagesCreated")
                ])
        ])
        .setShowNext(false)
        .setShowPrevious(false)
        .setShowRestart(true);

}(this));