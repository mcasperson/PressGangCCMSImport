var OKDialogInstanceController = function ($scope, $modalInstance, title, content) {
    'use strict';

    $scope.title = title;
    $scope.content = content;

    $scope.ok = function () {
        $modalInstance.close();
    };
};

var QNAController = function ($scope, $modal, $rootScope) {
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
    $scope.qna = new QNA(QNAStart);

    $scope.onFileSelect = function (name, files) {
        if (files.length !== 0) {
            $scope.qna.config[name] = files[0];
        } else {
            $scope.qna.config[name] = null;
        }
    };

    $scope.next = function () {
        $scope.qna.next(function (qna) {
            $scope.qna = qna;
            // we have to manually refresh the view because we are potentially using
            // async callbacks here
            $rootScope.$apply();
        }, function (title, message) {
            alert(title, message);
        });
    };
};