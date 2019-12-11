;(function($, window, document, undefined) {
    // this doesn't work because of iframe event issues.

    $('iframe').on('click', function (x) {
        $('iframe.focused').removeClass('focused');
        $(this).addClass('focused');
    });
})(jQuery, window, document);