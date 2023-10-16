import ClipboardJS from "clipboard";
import $ from "jquery";
import SimpleBar from "simplebar";
import tippy from "tippy.js";

import copy_to_clipboard_svg from "../../templates/copy_to_clipboard_svg.hbs";
import * as common from "../common";

import * as google_analytics from "./google-analytics";
import {activate_correct_tab} from "./tabbed-instructions";

function register_code_section($code_section) {
    const $li = $code_section.find("ul.nav li");
    const $blocks = $code_section.find(".blocks div");

    $li.on("click", function () {
        const tab_key = this.dataset.tabKey;

        $li.removeClass("active");
        $li.filter("[data-tab-key=" + tab_key + "]").addClass("active");

        $blocks.removeClass("active");
        $blocks.filter("[data-tab-key=" + tab_key + "]").addClass("active");
    });

    $li.on("keydown", (e) => {
        if (e.key === "Enter") {
            e.target.click();
        }
    });
}

// Display the copy-to-clipboard button inside the .codehilite element
// within the API and Help Center docs using clipboard.js
function add_copy_to_clipboard_element($codehilite) {
    const $copy_button = $("<button>").addClass("copy-codeblock");
    $copy_button.html(copy_to_clipboard_svg());

    $($codehilite).append($copy_button);

    const clipboard = new ClipboardJS($copy_button[0], {
        text(copy_element) {
            // trim to remove trailing whitespace introduced
            // by additional elements inside <pre>
            return $(copy_element).siblings("pre").text().trim();
        },
    });

    // Show a tippy tooltip when the button is hovered
    const tooltip_copy = tippy($copy_button[0], {
        content: "Copy code",
        trigger: "mouseenter",
        placement: "top",
    });

    // Show a tippy tooltip when the code is copied
    const tooltip_copied = tippy($copy_button[0], {
        content: "Copied!",
        trigger: "manual",
        placement: "top",
    });

    // Copy code on button click
    $copy_button.on("click", () => {
        clipboard.onClick({currentTarget: $copy_button[0]});
    });

    // Show "Copied!" tooltip when code is successfully copied
    clipboard.on("success", () => {
        tooltip_copy.hide();
        tooltip_copied.show();

        // Hide the "Copied!" tooltip after 1 second
        setTimeout(() => {
            tooltip_copied.hide();
        }, 1000);
    });
}

function highlight_current_article() {
    $(".help .sidebar a").removeClass("highlighted");
    $(".help .sidebar a").attr("tabindex", "0");
    const path = window.location.pathname;

    if (!path) {
        return;
    }

    const hash = window.location.hash;
    let $article = $(`.help .sidebar a[href="${CSS.escape(path + hash)}"]`);
    if (!$article.length) {
        // If there isn't an entry in the left sidebar that matches
        // the full URL+hash pair, instead highlight an entry in the
        // left sidebar that just matches the URL part.
        $article = $(`.help .sidebar a[href="${CSS.escape(path)}"]`);
    }
    // Highlight current article link and the heading of the same
    $article.closest("ul").css("display", "block");
    $article.addClass("highlighted");
    $article.attr("tabindex", "-1");
}

function render_code_sections() {
    $(".code-section").each(function () {
        activate_correct_tab($(this));
        register_code_section($(this));
    });

    // Add a copy-to-clipboard button for each .codehilite element
    $(".markdown .codehilite").each(function () {
        add_copy_to_clipboard_element($(this));
    });

    highlight_current_article();

    common.adjust_mac_kbd_tags(".markdown kbd");

    $("table").each(function () {
        $(this).addClass("table table-striped");
    });
}

function scrollToHash(simplebar) {
    const hash = window.location.hash;
    const scrollbar = simplebar.getScrollElement();
    const $scroll_target = $(CSS.escape(hash));
    if (hash !== "" && $scroll_target.length > 0) {
        const position = $scroll_target.position().top - $(scrollbar.firstChild).position().top;
        // Preserve a reference to the scroll target, so it is not lost (and the highlight
        // along with it) when the page is updated via fetch
        $scroll_target.addClass("scroll-target");
        scrollbar.scrollTop = position;
    } else {
        scrollbar.scrollTop = 0;
    }
}

const cache = new Map();
const loading = {
    name: null,
};

const markdownSB = new SimpleBar($(".markdown")[0]);

const fetch_page = function (path, callback) {
    $.get(path, (res) => {
        const $html = $(res).find(".markdown .content");
        const title = $(res).filter("title").text();

        callback({html: $html.html().trim(), title});
        render_code_sections();
    });
};

const update_page = function (cache, path) {
    if (cache.has(path)) {
        $(".markdown .content").html(cache.get(path).html);
        document.title = cache.get(path).title;
        render_code_sections();
        scrollToHash(markdownSB);
    } else {
        loading.name = path;
        fetch_page(path, (article) => {
            cache.set(path, article);
            $(".markdown .content").html(article.html);
            loading.name = null;
            document.title = article.title;
            scrollToHash(markdownSB);
        });
    }
    google_analytics.config({page_path: path});
};

new SimpleBar($(".sidebar")[0]);

$(".sidebar a").on("click", function (e) {
    const path = $(this).attr("href");
    const path_dir = path.split("/")[1];
    const current_dir = window.location.pathname.split("/")[1];

    // Do not block redirecting to external URLs
    if (path_dir !== current_dir) {
        return;
    }

    if (loading.name === path) {
        return;
    }

    history.pushState({}, "", path);

    update_page(cache, path);

    $(".sidebar").removeClass("show");

    e.preventDefault();
});

if (window.location.pathname === "/help/") {
    // Expand the Guides user docs section in sidebar in the /help/ homepage.
    $(".help .sidebar h2#guides + ul").show();
}
// Remove ID attributes from sidebar links so they don't conflict with index page anchor links
$(".help .sidebar h1, .help .sidebar h2, .help .sidebar h3").removeAttr("id");

// Scroll to anchor link when clicked. Note that landing-page.js has a
// similar function; this file and landing-page.js are never included
// on the same page.
$(document).on(
    "click",
    ".markdown .content h1, .markdown .content h2, .markdown .content h3",
    function () {
        window.location.hash = $(this).attr("id");
        scrollToHash(markdownSB);
    },
);

$(".hamburger").on("click", () => {
    $(".sidebar").toggleClass("show");
    $(".sidebar .simplebar-content-wrapper").css("overflow", "hidden scroll");
    $(".sidebar .simplebar-vertical").css("visibility", "visible");
});

$(".markdown").on("click", () => {
    if ($(".sidebar.show").length) {
        $(".sidebar.show").toggleClass("show");
    }
});

render_code_sections();

// Finally, make sure if we loaded a window with a hash, we scroll
// to the right place.
scrollToHash(markdownSB);

window.addEventListener("popstate", () => {
    const path = window.location.pathname;
    update_page(cache, path);
});

$("body").addClass("noscroll");

$(".highlighted")[0]?.scrollIntoView({block: "center"});
