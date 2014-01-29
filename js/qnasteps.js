(function (global) {
    'use strict';

    var file = new global.QNAVariable(global.InputEnum.SINGLE_FILE, "ZipFile");
    var inputs = new global.QNAVariables(null, [file]);

    global.QNAStart = new global.QNAStep(
        "Select the ZIP file to import",
        "Select the ZIP file that contains the valid Publican book that you wish to import into PressGang CCMS.",
        inputs,
        function (result, config, alert) {
            alert("A message", "Some text goes here");
        },
        function (result, config, alert) {
            return null;
        }
    );

}(this));