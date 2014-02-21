(function () {
    'use strict';

    // This object is how the script and the import tool interact
    unsafeWindow.greaseMonkeyShare = {};
    unsafeWindow.greaseMonkeyShare.getMojoDoc = function(id, successCallback, errorCallback) {

        var mojoUrl = "https://mojo.redhat.com/api/core/v3/contents?filter=entityDescriptor(102," + id + ")";

        unsafeWindow.console.log(mojoUrl);

        setTimeout(function() {
            GM_xmlhttpRequest({
                method: 'GET',
                url: mojoUrl,
                headers: {Accept: 'application/json'},
                //onprogress: function() {logToConsole("onprogress");},
                //onreadystatechange: function() {logToConsole("onreadystatechange");},
                onabort: function() {
                    errorCallback("Error", "The request to Mojo failed.");
                },
                onerror: function() {
                    errorCallback("Error", "The request to Mojo failed.");
                },
                ontimeout: function() {
                    errorCallback("Error", "The request to Mojo failed.");
                },
                onload: function(solutionsResponse) {
                    if (solutionsResponse.status === 401) {
                        errorCallback("Not logged in", "The requested document could not be retrieved because you are not logged into Mojo.");
                    } else if (solutionsResponse.status === 200) {
                        //https://developers.jivesoftware.com/community/message/5127#5127
                        var documents = JSON.parse(solutionsResponse.responseText.replace(/^throw [^;]*;/, ''));
                        if (documents.list.length === 0) {
                            errorCallback("Document not found", "The requested document could not be found.");

                        } else {
                            var document = documents.list[0];
                            var html = document.content.text;
                            successCallback(html);
                        }
                    }
                }
            });
        }, 0);
    };

    unsafeWindow.greaseMonkeyShare.getMojoImage = function(mojoUrl, successCallback, errorCallback) {

        unsafeWindow.console.log(mojoUrl);

        setTimeout(function() {
            GM_xmlhttpRequest({
                method: 'GET',
                url: mojoUrl,
                //onprogress: function() {logToConsole("onprogress");},
                //onreadystatechange: function() {logToConsole("onreadystatechange");},
                onabort: function(response) {
                    errorCallback("Error", "The request to Mojo was aborted.");
                },
                onerror: function(response) {
                    console.log(response.responseHeaders);
                    errorCallback("Error", "The request to Mojo had an error.");
                },
                ontimeout: function(response) {
                    errorCallback("Error", "The request to Mojo timed out.");
                },
                onload: function(response) {
                    if (response.status === 401) {
                        errorCallback("Not logged in", "The requested document could not be retrieved because you are not logged into Mojo.");
                    } else if (response.status === 200) {
                        successCallback(byteArray(response.responseText));
                    }
                }
            });
        }, 0);
    };

    function byteArray(str) {
        var utf8 = unescape(encodeURIComponent(str));

        var arr = [];
        for (var i = 0; i < utf8.length; i++) {
            arr.push(utf8.charCodeAt(i));
        }
        return arr;
    }
}());