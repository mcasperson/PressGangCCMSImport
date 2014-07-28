/*
 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Lesser General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Lesser General Public License for more details.

 You should have received a copy of the GNU Lesser General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

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
                    errorCallback("Error", "The request to Mojo failed.", true);
                },
                onerror: function() {
                    errorCallback("Error", "The request to Mojo failed.", true);
                },
                ontimeout: function() {
                    errorCallback("Error", "The request to Mojo failed.", true);
                },
                onload: function(solutionsResponse) {
                    if (solutionsResponse.status === 401) {
                        errorCallback("Not logged in", "The requested document could not be retrieved because you are not logged into Mojo.", true);
                    } else if (solutionsResponse.status === 200) {
                        //https://developers.jivesoftware.com/community/message/5127#5127
                        var documents = JSON.parse(solutionsResponse.responseText.replace(/^throw [^;]*;/, ''));
                        if (documents.list.length === 0) {
                            errorCallback("Document not found", "The requested document could not be found.", true);

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
                overrideMimeType: 'text\/plain; charset=x-user-defined',                // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Sending_and_Receiving_Binary_Data#Receiving_binary_data_in_older_browsers
                binary: true,
                //onprogress: function() {logToConsole("onprogress");},
                //onreadystatechange: function() {logToConsole("onreadystatechange");},
                onabort: function(response) {
                    errorCallback("Error", "The request to Mojo was aborted.", true);
                },
                onerror: function(response) {
                    console.log(response.responseHeaders);
                    errorCallback("Error", "The request to Mojo had an error.", true);
                },
                ontimeout: function(response) {
                    errorCallback("Error", "The request to Mojo timed out.", true);
                },
                onload: function(response) {
                    if (response.status === 401) {
                        errorCallback("Not logged in", "The requested document could not be retrieved because you are not logged into Mojo.", true);
                    } else if (response.status === 200) {
                        var bytearray = [];
                        //http://www.html5rocks.com/en/tutorials/file/xhr2/
                        for (var i = 0; i < response.responseText.length; ++i) {
                            bytearray.push(response.responseText.charCodeAt(i) & 0xff);
                        }
                        successCallback(bytearray);
                    }
                }
            });
        }, 0);
    };
}());