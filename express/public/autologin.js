;(function ($, window, document, undefined) {

    $(function () {
        $('iframe').on('click', function (x) {
            $('iframe.focused').removeClass('focused');
            $(this).addClass('focused');
        });

        // Implement primitive iframe messaging to collect the login status.
        $('iframe').on('load', function (x) {
                // console.dir(x.target);
                let msg = $(x.target).contents().attr('title');
                let service = x.target.name;
                // logging for dev debug purposes
                $('#' + service + '_log').html(service + ": " + msg);
                $(x.target).addClass("loaded");
                $('#log').append("<li>" + $('iframe.loaded').length + "</li>");
            }
        );
    });
})(jQuery, window, document);
