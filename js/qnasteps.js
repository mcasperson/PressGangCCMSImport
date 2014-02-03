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
        var lines = file.split("\n");
        global.jQuery.each(lines, function (index, value) {
            var keyValue = value.split(":");
            if (keyValue.length === 2) {
                if (new RegExp(global.escapeRegExp(setting)).test(keyValue[0].trim())) {
                    return keyValue[1].trim();
                }
            }
        });
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

    function createTopic(xml, replacements, title, tags, config, successCallback, errorCallback) {

        var postBody = {
            xml: reencode(xmlToString(xml), replacements),
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
                successCallback(data.topic.id, data.matchedExistingTopic);
            },
            error: function () {
                errorCallback("Connection Error", "An error occurred while uploading the revision history topic.");
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
            xml: reencode(xmlToString(xml), replacements),
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
        .setTitle("Create or overwrite a content spec?")
        .setIntro("This wizard can create a new content specification, or overwrite the contents of an existing one. " +
            "You will usually want to create a new content specification, but if you are reimporting a book and want to overwrite the previously imported content spec, " +
            "select the overwrite option.")
        .setInputs([
            new global.QNAVariables()
                .setVariables([
                    new global.QNAVariable()
                        .setType(global.InputEnum.TEXTBOX)
                        .setIntro("Existing content specification ID")
                        .setName("ExistingContentSpecID")
                ])
        ])
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
                        .setIntro("Resolving xrefs")
                        .setName("ResolvedXrefs"),
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
                        .setValue([11, 0])
                ])
        ])
        .setEnterStep(function (resultCallback, errorCallback, result, config) {

            /**
             * A collection of entity definitions
             * @type {Array}
             */
            var entities = [];
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
            var replaceEntities = function (xmlText) {
                var entityRe = /&.*?;/;


                var match;
                while (match = entityRe.exec(xmlText)) {
                    var randomReplacement;
                    while (xmlText.indexOf(randomReplacement = "#" + Math.floor((Math.random() * 1000000000) + 1) + "#") !== -1) {

                    }

                    replacements.push({placeholder: randomReplacement, entity: match[0]});

                    xmlText = xmlText.replace(new RegExp(global.escapeRegExp(match[0]), "g"), randomReplacement);
                }

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

                            removeXmlPreamble(xmlText);
                        } else {
                            var value = entries[index];
                            if (value.filename.indexOf(relativePath) === 0) {
                                zip.getTextFromFile(value, function (fileText) {
                                    var entityDefRE = /<!ENTITY\s+[^\s]+\s+('|").*?('|")\s*>/g;
                                    var match;
                                    while (match = entityDefRE.exec(fileText)) {
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
            var removeXmlPreamble = function (xmlText) {
                xmlText = xmlText.replace(/<\?xml.*?>/g, "");
                xmlText = xmlText.replace(/<!DOCTYPE[\s\S]*?\[[\s\S]*?\]>/g, "");

                config.UploadProgress[1] = 4;
                config.RemovedXMLPreamble = true;
                resultCallback();

                parseAsXML(xmlText);
            };

            /*
             Take the sanitised XML and convert it to an actual XML DOM
             */
            var parseAsXML = function (xmlText) {
                var xmlDoc = global.jQuery.parseXML(xmlText);
                config.UploadProgress[1] = 5;
                config.ParsedAsXML = true;
                resultCallback();

                findBookInfo(xmlDoc);
            };

            /*
                Find the book info details
             */
            var findBookInfo = function (xmlDoc) {
                // the content spec
                var contentSpec = [];

                var bookinfo = xmlDoc.evaluate("/*/bookinfo", xmlDoc, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                if (bookinfo) {
                    var title = xmlDoc.evaluate("/title", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var subtitle = xmlDoc.evaluate("/subtitle", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var edition = xmlDoc.evaluate("/edition", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var pubsnumber = xmlDoc.evaluate("/pubsnumber", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var productname = xmlDoc.evaluate("/productname", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();
                    var productnumber = xmlDoc.evaluate("/productnumber", bookinfo, null, global.XPathResult.ANY_TYPE, null).iterateNext();

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

                    zip.getTextFromFileName(
                        config.ZipFile,
                        "publican.cfg",
                        function (text) {
                            var brand = loadSetting(text, "brand\\s*:");
                            contentSpec.push("Brand = " + brand);
                            contentSpec.push("publican.cfg = [");
                            contentSpec.push(text);
                            contentSpec.push("]");

                            config.UploadProgress[1] = 7;
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
                    config.UploadProgress[1] = 8;
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
                        function (topicId, matchedExisting) {
                            config.RevisionHistoryTopicID = topicId;
                            config.UploadedTopicCount += 1;
                            if (matchedExisting) {
                                config.MatchedTopicCount += 1;
                            }

                            config.NewTopicsCreated = (config.UploadedTopicCount -config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                            contentSpec.push("Revision History = [" + topicId + "]");

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
                    config.UploadProgress[1] = 9;
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
                        function (topicId, matchedExisting) {
                            config.AuthorGroupTopicID = topicId;
                            config.UploadedTopicCount += 1;
                            if (matchedExisting) {
                                config.MatchedTopicCount += 1;
                            }

                            config.NewTopicsCreated = (config.UploadedTopicCount -config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                            contentSpec.push("Author Group = [" + topicId + "]");

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
                    config.UploadProgress[1] = 10;
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
                        function (topicId, matchedExisting) {
                            config.AbstractID = topicId;
                            config.UploadedTopicCount += 1;
                            if (matchedExisting) {
                                config.MatchedTopicCount += 1;
                            }

                            config.NewTopicsCreated = (config.UploadedTopicCount -config.MatchedTopicCount) + " / " + config.MatchedTopicCount;

                            contentSpec.push("Abstract = [" + topicId + "]");

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
                        nodeValue = nodeValue.replace(/^\.\//, "");

                        if (nodeValue.indexOf("images") === 0) {

                            // find the absolute path
                            var pathPrefix = config.MainXMLFile.substring(0, config.MainXMLFile.lastIndexOf("/"));
                            nodeValue = pathPrefix + "/" + nodeValue;

                            if (!uploadedImages[nodeValue]) {

                                zip.hasFileName(
                                    config.ZipFile,
                                    nodeValue,
                                    function (result) {
                                        if (result) {
                                            createImage(
                                                config.ZipFile,
                                                nodeValue,
                                                config,
                                                function (imageId, matchedExisting) {
                                                    config.UploadedImageCount += 1;
                                                    if (matchedExisting) {
                                                        config.MatchedImageCount += 1;
                                                    }

                                                    config.NewImagesCreated = (config.UploadedImageCount - config.MatchedImageCount) + " / " + config.MatchedImageCount;
                                                    resultCallback();

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
                            }
                        } else {
                            processImages(images.iterateNext());
                        }
                    } else {
                        config.UploadProgress[1] = 11;
                        config.FoundImages = true;
                        resultCallback();

                        resolveBookStructure(xmlDoc, contentSpec);
                    }
                };

                processImages(images.iterateNext());
            };

            var resolveBookStructure = function(xmlDoc, contentSpec) {
                // These docbook elements represent containers or topics. Anything else is added as the XML of a topic.
                var sectionTypes = ["part", "chapter", "appendix", "section"];

                // a collection of all the topics we will e uploading
                var topics = [];
                // a collection of all the containers that hold the topics
                var containers = [];

                var removeIdAttribute = function (xml) {
                    if (xml.hasAttribute("id")) {
                        xml.removeAttribute("id");
                    }
                    return xml;
                };

                var processXml = function (parentXML, parentSpecContainer, depth) {
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
                                    if (sectionTypes.indexOf(containerChild.nodeName) !== -1) {
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

                                    var standaloneContainerTopic = new global.SpecTopic()
                                        .setXml(removeIdAttribute(clone), xmlDoc)
                                        .setSpecLine(contentSpec.length - 1);

                                    if (id) {
                                        standaloneContainerTopic.setId(id.nodeValue);
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
                                        var initialTextTopic = new global.SpecTopic()
                                            .setXml(removeIdAttribute(clone), xmlDoc)
                                            .setSpecLine(contentSpec.length - 1);

                                        if (id) {
                                            initialTextTopic.setId(id.nodeValue);
                                        }

                                        topics.push(initialTextTopic);
                                    }

                                    var container = new global.SpecContainer()
                                        .setSpecLine(contentSpec.length - 1);

                                    if (id) {
                                        container.setId(id.nodeValue);
                                    }

                                    containers.push(container);

                                    processXml(value, container, depth + 1);
                                }
                            }
                        }
                    });
                };

                processXml(xmlDoc.documentElement, null, 0);

                config.UploadProgress[1] = 12;
                config.ResolvedBookStructure = true;
                resultCallback();

                resolveXRefs(xmlDoc, contentSpec, topics, containers);
            };

            /*
                This is the tricky part. We need to have all xrefs resolved before saving so PressGang can match the
                xml to any existing topics. But sometimes xrefs make circular dependencies, which means there
                will be situations where xrefs remain unresolved.

                To work around this we attempt to resolve any xrefs that we can, save the topics, and then repeat
                the process until every topic not part of a circular dependency is saved. At that point we get
                fuzzy matches from the server to try and break a link in a circular dependency.
             */
            var resolveXRefs = function (xmlDoc, contentSpec, topics, containers) {

                var getUnresolvedTopics = function () {
                    var retValue = [];
                    global.jQuery.each(topics, function (index, value) {
                        if (!value.xrefsResolved) {
                            retValue.push(value);
                        }
                    });
                    return retValue;
                };

                var getSavedTopics = function () {
                    var retValue = [];
                    global.jQuery.each(topics, function (index, value) {
                        if (value.topicId) {
                            retValue.push(value);
                        }
                    });
                    return retValue;
                };

                var getTopicThatHasID = function (id) {
                    var retValue;
                    global.jQuery.each(topics, function (index, value) {
                        if (value.id === id) {
                            retValue = value;
                            return false;
                        }
                    });

                    return retValue;
                };

                var getAllTopicOrContainerIDs = function () {
                    var retValue = [];
                    global.jQuery.each(topics, function (index, value) {
                        if (retValue.indexOf(value.id) === -1) {
                            retValue.push(value.id);
                        }
                    });
                    return retValue;
                };

                var topicOrContainerIDs = getAllTopicOrContainerIDs();

                var saveTopicsWithAllXrefsJustResolved = function (index, successCallback) {
                    if (index >= topics.length) {
                        successCallback();
                    } else {
                        var topic = topics[index];
                        if (!topic.xrefsResolved) {

                            // is every resolvable xref resolved?
                            var topicIsResolved = true;
                            global.jQuery.each(topic.xrefs, function (index, xref) {
                                if (topicOrContainerIDs.indexOf(xref) !== -1 &&
                                    topic.resolvedXRefs.indexOf(xref) === -1) {
                                    topicIsResolved = false;
                                    return false;
                                }
                            });

                            // if so, we can save this topic
                            if (topicIsResolved) {
                                topic.xrefsResolved = true;

                                if (topic.topicId) {
                                    updateTopic(
                                        topic.topicId,
                                        topic.xml,
                                        replacements,
                                        null,
                                        config,
                                        function (topicId) {
                                            saveTopicsWithAllXrefsJustResolved(index + 1, successCallback);
                                        },
                                        errorCallback
                                    );
                                } else {
                                    createTopic(
                                        topic.xml,
                                        replacements,
                                        null,
                                        null,
                                        config,
                                        function (topicId, matchedExisting) {
                                            config.UploadedTopicCount += 1;
                                            if (matchedExisting) {
                                                config.MatchedTopicCount += 1;
                                            }
                                            resultCallback();

                                            topic.topicId = topicId;
                                            contentSpec[topic.specLine] += " [" + topicId + "]";

                                            saveTopicsWithAllXrefsJustResolved(index + 1, successCallback);
                                        },
                                        errorCallback
                                    );
                                }
                            } else {
                                saveTopicsWithAllXrefsJustResolved(index + 1, successCallback);
                            }
                        } else {
                            saveTopicsWithAllXrefsJustResolved(index + 1, successCallback);
                        }
                    }
                };

                // replace any xrefs with injection points where the xrefs point to topics that have been
                // saved on the server and have an ID.
                var resolveAvailableXRefs = function () {
                    var resolvedAXref = false;
                    var resolvedTopics = getSavedTopics();
                    var unresolvedTopics = getUnresolvedTopics();
                    global.jQuery.each(unresolvedTopics, function (index, value) {
                        var xrefs = xmlDoc.evaluate("//xref", value.xml, null, global.XPathResult.ANY_TYPE, null);
                        var xref;
                        var xrefReplacements = [];
                        while (xref = xrefs.iterateNext()) {

                            if (xref.hasAttribute("linkend")) {
                                var linkend = xref.getAttribute("linkend");
                                // is this an xref to a topic
                                if (topicOrContainerIDs.indexOf(linkend) !== -1) {
                                    var destinationTopic = getTopicThatHasID(linkend);
                                    // has the topic been saved?
                                    if (resolvedTopics.indexOf(destinationTopic) !== -1) {
                                        // we are pointing to a saved topic, so replace the xref with an injection
                                        var injection = xmlDoc.createComment("Inject: " + destinationTopic.topicId);
                                        xrefReplacements.push({original: xref, replacement: injection});

                                        value.addResolvedXRef(linkend);
                                        resolvedAXref = true;
                                    }
                                }
                            }
                        }

                        global.jQuery.each(xrefReplacements, function (index, value) {
                            value.original.parentNode.replaceChild(value.replacement, value.original);
                        });
                    });

                    return resolvedAXref;
                };

                var normalizeInjections = function (xml, topicAndContainerIDs) {
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

                var removeEntities = function (xml) {
                    return xml.replace(/&.*?;/g, "");
                };

                var removeWhiteSpace = function (xml) {
                    return xml.replace(/\n/g, "")
                        .replace(/\s/g, "");
                };

                // start by saving any topics that don't have xrefs. This gives us a pool of topics
                // to start resolving xrefs with
                saveTopicsWithAllXrefsJustResolved(0, function() {
                    var processXrefLoop = function () {
                        while (resolveAvailableXRefs()) {
                            // keep resolving
                        }

                        // save any topics that were fully resolved
                        saveTopicsWithAllXrefsJustResolved(0, function () {
                            if (getUnresolvedTopics().length !== 0) {

                                // we'll save the first unresolved topic to attempt to break the deadlock
                                var firstUnresolvedTopic = getUnresolvedTopics()[0];

                                // normalize injections and xrefs
                                var firstUnresolvedTopicXMLCopy = firstUnresolvedTopic.xml.cloneNode(true);
                                normalizeXrefs(normalizeInjections(firstUnresolvedTopicXMLCopy), topicOrContainerIDs);

                                var firstUnresolvedTopicXMLCompare = removeEntities(removeWhiteSpace(xmlToString(firstUnresolvedTopicXMLCopy)));

                                // find anything in the database that is a close match to this topic
                                var matches = getSimilarTopics(
                                    xmlToString(firstUnresolvedTopic.xml),
                                    config,
                                    function (data) {
                                        var matchingTopic;

                                        global.jQuery.each(data.items, function (index, value) {
                                            // normalize injections and xrefs
                                            var matchingTopicXMLCopy = parseAsXML(removeEntities(value.item.xml));
                                            normalizeInjections(matchingTopicXMLCopy);

                                            var matchingTopicXMLCompare = removeWhiteSpace(xmlToString(matchingTopicXMLCopy));

                                            if (matchingTopicXMLCompare === firstUnresolvedTopicXMLCompare) {
                                                matchingTopic = value;
                                                return false;
                                            }
                                        });

                                        if (matchingTopic) {
                                            firstUnresolvedTopic.topicId = matchingTopic.id;
                                            firstUnresolvedTopic.xrefsResolved = true;
                                            processXrefLoop();
                                        } else {
                                            createTopic(
                                                firstUnresolvedTopic.xml,
                                                replacements,
                                                null,
                                                null,
                                                config,
                                                function (topicId, matchedExisting) {
                                                    config.UploadedTopicCount += 1;
                                                    if (matchedExisting) {
                                                        config.MatchedTopicCount += 1;
                                                    }
                                                    resultCallback();

                                                    firstUnresolvedTopic.topicId = topicId;
                                                    contentSpec[firstUnresolvedTopic.specLine] += " [" + topicId + "]";

                                                    processXrefLoop();
                                                },
                                                errorCallback
                                            );
                                        }
                                    },
                                    errorCallback
                                );
                            } else {
                                config.UploadProgress[1] = 13;
                                config.ResolvedXrefs = true;
                                resultCallback();
                                uploadContentSpec(contentSpec, config);
                            }
                        });
                    };

                    processXrefLoop();
                });
            };

            var uploadContentSpec = function (contentSpec, config) {
                global.jQuery.each(contentSpec, function(index, value) {
                    console.log(value);
                });
            }

            // start the process
            resolveXiIncludes();
        })
        .setNextStep(function (resultCallback, errorCallback, result, config) {
            resultCallback(the_next_step);
        });

}(this));