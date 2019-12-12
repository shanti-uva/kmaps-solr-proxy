;(function ($, window, document, undefined) {

    $(function () {
        $('iframe').on('click', function (x) {
            $('iframe.focused').removeClass('focused');
            $(this).addClass('focused');
        });

        $('iframe').on('load', function (x) {
                console.dir(x.target);
                $('#log').append("<li> WOOT: " + x.target.name + "</li>");
            }
        );
    });
})(jQuery, window, document);