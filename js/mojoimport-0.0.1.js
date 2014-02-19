(function () {
    'use strict';
    var mojoUrl = "https://mojo.redhat.com/api/core/v3/contents?filter=entityDescriptor(102," + unsafeWindow.greaseMonkeyShare.mojoDocId + ")";

    GM_xmlhttpRequest({
        method: 'GET',
        url: mojoUrl,
        headers: {Accept: 'application/json'},
        //onprogress: function() {logToConsole("onprogress");},
        //onreadystatechange: function() {logToConsole("onreadystatechange");},
        onabort: function() {
            unsafeWindow.greaseMonkeyShare.errorCallback("Error", "The request to Mojo failed.");
        },
        onerror: function() {
            unsafeWindow.greaseMonkeyShare.errorCallback("Error", "The request to Mojo failed.");
        },
        ontimeout: function() {
            unsafeWindow.greaseMonkeyShare.errorCallback("Error", "The request to Mojo failed.");
        },
        onload: function(solutionsResponse) {
            if (solutionsResponse.status === 401) {
                unsafeWindow.greaseMonkeyShare.errorCallback("Not logged in", "The requested document could not be retrieved because you are not logged into Mojo.");
            } else if (solutionsResponse.status === 200) {
                //https://developers.jivesoftware.com/community/message/5127#5127
                var documents = JSON.parse(solutionsResponse.responseText.replace(/^throw [^;]*;/, ''));
                if (documents.list.length === 0) {
                    unsafeWindow.greaseMonkeyShare.errorCallback("Document not found", "The requested document could not be found.");

                } else {
                    var document = documents.list[0];
                    var html = document.content.text;
                    unsafeWindow.greaseMonkeyShare.errorCallback(html);
                }
            }
        }
    });
}());