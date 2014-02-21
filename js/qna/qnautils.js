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

    exports.stringToXML = function(xml) {
        try {
            return jquery.parseXML(xml);
        } catch (error) {
            console.log(error);
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
            console.log(error);
        }

        // if that fails, try it again with the fake prefix which resolves to the docbook namespace
        return ownerDoc.evaluate(path, referenceNode, resolver, XPathResult.ANY_TYPE, null);
    };

    exports.getOwnerDoc = function (node) {
        return node.ownerDocument || node;
    };
});

