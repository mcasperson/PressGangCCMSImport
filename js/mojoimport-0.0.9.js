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
                        successCallback(stringToByteArray(solutionsResponse.responseText));
                    }
                }
            });
        }, 0);
    };

    function stringToByteArray(str) {
        var b = [], i, unicode;
        for(i = 0; i < str.length; i++) {
            unicode = str.charCodeAt(i);
            // 0x00000000 - 0x0000007f -> 0xxxxxxx
            if (unicode <= 0x7f) {
                b.push(unicode);
                // 0x00000080 - 0x000007ff -> 110xxxxx 10xxxxxx
            } else if (unicode <= 0x7ff) {
                b.push((unicode >> 6) | 0xc0);
                b.push((unicode & 0x3F) | 0x80);
                // 0x00000800 - 0x0000ffff -> 1110xxxx 10xxxxxx 10xxxxxx
            } else if (unicode <= 0xffff) {
                b.push((unicode >> 12) | 0xe0);
                b.push(((unicode >> 6) & 0x3f) | 0x80);
                b.push((unicode & 0x3f) | 0x80);
                // 0x00010000 - 0x001fffff -> 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
            } else {
                b.push((unicode >> 18) | 0xf0);
                b.push(((unicode >> 12) & 0x3f) | 0x80);
                b.push(((unicode >> 6) & 0x3f) | 0x80);
                b.push((unicode & 0x3f) | 0x80);
            }
        }

        return b;
    }
}());