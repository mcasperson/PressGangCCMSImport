define (['jquery', 'exports'], function (jquery, exports) {
    'use strict';

    exports.escapeRegExp = function(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    };

    exports.keys = function(obj)
    {
        var keys = [];
        for(var key in obj) {
            if(obj.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        keys.sort();
        return keys;
    };

    exports.xmlToString = function(xmlDoc) {
        return (new XMLSerializer()).serializeToString(xmlDoc);
    };

    exports.encodedXmlToString = function(xmlReplacements) {
        var retValue = (new XMLSerializer()).serializeToString(xmlReplacements.xml);
        exports.reencode(retValue, xmlReplacements.replacements);
    };

    exports.stringToXML = function(xml) {
        try {
            return jquery.parseXML(xml);
        } catch (error) {
            //console.log(error);
        }

        return null;
    };

    /**
     * Running xpath queries is not as straight forward as it might seem. If the nodes are in the default namespace,
     * we need a custom resolver and a fake namespace in our xpath query. Here we use the namespace "docbook" to
     * find any node in the DocBook 5 default namespace.
     *
     * First, we try to get a match using no namespaces. The path has to have the docbook prefix for all nodes,
     * which we remove to do the query.
     *
     * If that fails, we do the query again with the fake namespace and use our custom resolver to return
     * the correct namespace.
     *
     * Also, Firefox will complain if the xml document used to evaluate the xpath is not the paret of the
     * reference node. So we always get the parent document of the reference node
     *
     * @param path The xpath query, with all nodes in the fake "docspace" namespace
     * @param referenceNode The reference node for relative xpath queries
     * @returns {Object|*}
     */
    exports.xPath = function (path, referenceNode) {
        if (referenceNode === null || referenceNode === undefined) {
            throw "referenceNode should be a valid xml node";
        }

        var ownerDoc = exports.getOwnerDoc(referenceNode);

        var evaluator = new XPathEvaluator();
        var systemResolver = evaluator.createNSResolver(ownerDoc.documentElement);
        /*
         https://developer.mozilla.org/en-US/docs/Introduction_to_using_XPath_in_JavaScript#Implementing_a_User_Defined_Namespace_Resolver
         We need to use the fake namespace "docbook" to match anything in the default namespace. This is a work around
         for the docbook 5 default namespace.
         */
        function resolver(namespace) {
            var ns = systemResolver.lookupNamespaceURI(namespace);
            if (ns) {
                return ns;
            }

            if (namespace === "docbook") {
                return "http://docbook.org/ns/docbook";
            }

            return null;
        }

        try {
            // first try without the fake prefix. this will fail if looking up something like xml:id, which is
            // why we have a catch block
            if (ownerDoc.evaluate(path.replace(/docbook:/g, ""), referenceNode, null, XPathResult.ANY_TYPE, null).iterateNext()) {
                return ownerDoc.evaluate(path.replace(/docbook:/g, ""), referenceNode, null, XPathResult.ANY_TYPE, null);
            }
        } catch (error) {
            //console.log(error);
        }

        // if that fails, try it again with the fake prefix which resolves to the docbook namespace
        try {
            return ownerDoc.evaluate(path, referenceNode, resolver, XPathResult.ANY_TYPE, null);
        } catch (error) {
            // if that fails, return a iterator that has nothing to iterate
            return ownerDoc.evaluate(path.replace(/docbook:/g, ""), referenceNode, null, XPathResult.ANY_TYPE, null);
        }
    };

    exports.getOwnerDoc = function (node) {
        return node.ownerDocument || node;
    };

    exports.base64ToByteArray = function(base64) {
        var decoded = atob(base64);
        var i, il = decoded.length;
        var array = new Uint8Array(il);

        for (i = 0; i < il; ++i) {
            array[i] = decoded.charCodeAt(i);
        }

        return array;
    };

    exports.imageToBase64 = function(img) {
        // Create an empty canvas element
        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        // Copy the image contents to the canvas
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        // Get the data-URL formatted image
        // Firefox supports PNG and JPEG. You could check img.src to guess the
        // original format, but be aware the using "image/jpg" will re-encode the image.
        var dataURL = canvas.toDataURL("image/png");

        return dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
    };

    exports.imageToByteArray = function (img) {
        return exports.base64ToByteArray(exports.imageToBase64(img));
    };

    /*
     Replace entities with markers so we can process the XML without worrying about resolving entities
     */
    exports.replaceEntitiesInText =function (xmlText) {
        var retValue = [];

        var entityRe = /&.*?;/;

        var match;
        while ((match = entityRe.exec(xmlText)) !== null) {
            var randomReplacement;
            while (xmlText.indexOf(randomReplacement = "#" + Math.floor((Math.random() * 1000000000) + 1) + "#") !== -1) {

            }

            retValue.push({placeholder: randomReplacement, entity: match[0]});

            xmlText = xmlText.replace(new RegExp(exports.escapeRegExp(match[0]), "g"), randomReplacement);
        }

        return {xml: xmlText, replacements: retValue};
    };

    exports.reencode = function(xmlString, replacements) {
        var reversed = replacements.reverse();
        jquery.each(reversed, function (index, value) {
            xmlString = xmlString.replace(new RegExp(exports.escapeRegExp(value.placeholder), "g"), value.entity);
        });
        return xmlString;
    };

    exports.getValueFromConfigFile = function(configFile, key) {
        var retValue;
        var lines = configFile.split("\n");
        jquery.each(lines, function(index, value) {
            var keyValue = value.split(":");
            if (keyValue.length == 2 && keyValue[0].trim() === key) {
                retValue = keyValue[1].trim();
                return false;
            }
        });
        return retValue;
    };
});

