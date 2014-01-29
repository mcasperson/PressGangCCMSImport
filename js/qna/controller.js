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
                    return $scope.title;
                },
                content: function () {
                    return $scope.content;
                }
            }
        });
    };

    $scope.qna = new QNA(QNAStart, alert);

    $scope.next = function () {

    };
};