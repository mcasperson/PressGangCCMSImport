var OKDialogInstanceController = function ($scope, $modalInstance, title, content) {
    'use strict';

    $scope.title = title;
    $scope.content = content;

    $scope.ok = function () {
        $modalInstance.close();
    };
};

var QNAController = function ($scope, $modal) {
    'use strict';

    /*
        A callback that displays the ok dialog box
     */
    var alert = function (title, content) {
        var modalInstance = $modal.open({
            templateUrl: 'okDialog.html',
            controller: OKDialogInstanceController,
            resolve: {
                title: function () {
                    return title;
                },
                content: function () {
                    return content;
                }
            }
        });
    };

    $scope.inputTypes = InputEnum;
    $scope.qna = new QNA(QNAStart, alert);

    $scope.onFileSelect = function (name, files) {
        if (files.length !== 0) {
            $scope.qna.config[name] = files[0];
        } else {
            $scope.qna.config[name] = null;
        }
    };

    $scope.next = function () {
        $scope.qna = $scope.qna.next();
    };
};