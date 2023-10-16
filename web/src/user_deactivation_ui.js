import $ from "jquery";

import render_settings_deactivation_bot_modal from "../templates/confirm_dialog/confirm_deactivate_bot.hbs";
import render_settings_deactivation_user_modal from "../templates/confirm_dialog/confirm_deactivate_user.hbs";
import render_settings_reactivation_bot_modal from "../templates/confirm_dialog/confirm_reactivate_bot.hbs";
import render_settings_reactivation_user_modal from "../templates/confirm_dialog/confirm_reactivate_user.hbs";

import * as bot_data from "./bot_data";
import * as channel from "./channel";
import * as confirm_dialog from "./confirm_dialog";
import * as dialog_widget from "./dialog_widget";
import {$t_html} from "./i18n";
import {page_params} from "./page_params";
import * as people from "./people";

export function confirm_deactivation(user_id, handle_confirm, loading_spinner) {
    // Knowing the number of invites requires making this request. If the request fails,
    // we won't have the accurate number of invites. So, we don't show the modal if the
    // request fails.
    channel.get({
        url: "/json/invites",
        timeout: 10 * 1000,
        success(data) {
            let number_of_invites_by_user = 0;
            for (const invite of data.invites) {
                if (invite.invited_by_user_id === user_id) {
                    number_of_invites_by_user = number_of_invites_by_user + 1;
                }
            }

            const bots_owned_by_user = bot_data.get_all_bots_owned_by_user(user_id);
            const user = people.get_by_user_id(user_id);
            const realm_url = page_params.realm_uri;
            const realm_name = page_params.realm_name;
            const opts = {
                username: user.full_name,
                email: user.delivery_email,
                bots_owned_by_user,
                number_of_invites_by_user,
                admin_email: people.my_current_email(),
                realm_url,
                realm_name,
            };
            const html_body = render_settings_deactivation_user_modal(opts);

            function set_email_field_visibility() {
                const $send_email_checkbox = $("#dialog_widget_modal").find(".send_email");
                const $email_field = $("#dialog_widget_modal").find(".email_field");

                $email_field.hide();
                $send_email_checkbox.on("change", () => {
                    if ($send_email_checkbox.is(":checked")) {
                        $email_field.show();
                    } else {
                        $email_field.hide();
                    }
                });
            }

            dialog_widget.launch({
                html_heading: $t_html(
                    {defaultMessage: "Deactivate {name}?"},
                    {name: user.full_name},
                ),
                help_link: "/help/deactivate-or-reactivate-a-user#deactivating-a-user",
                html_body,
                html_submit_button: $t_html({defaultMessage: "Deactivate"}),
                id: "deactivate-user-modal",
                on_click: handle_confirm,
                post_render: set_email_field_visibility,
                loading_spinner,
            });
        },
    });
}

export function confirm_bot_deactivation(bot_id, handle_confirm, loading_spinner) {
    const bot = people.get_by_user_id(bot_id);
    const html_body = render_settings_deactivation_bot_modal();

    dialog_widget.launch({
        html_heading: $t_html({defaultMessage: "Deactivate {name}?"}, {name: bot.full_name}),
        help_link: "/help/deactivate-or-reactivate-a-bot",
        html_body,
        html_submit_button: $t_html({defaultMessage: "Deactivate"}),
        on_click: handle_confirm,
        loading_spinner,
    });
}

export function confirm_reactivation(user_id, handle_confirm, loading_spinner) {
    const user = people.get_by_user_id(user_id);
    const opts = {
        username: user.full_name,
    };

    let html_body;
    // check if bot or human
    if (user.is_bot) {
        opts.original_owner_deactivated =
            user.is_bot && user.bot_owner_id && !people.is_person_active(user.bot_owner_id);
        if (opts.original_owner_deactivated) {
            opts.owner_name = people.get_by_user_id(user.bot_owner_id).full_name;
        }
        html_body = render_settings_reactivation_bot_modal(opts);
    } else {
        html_body = render_settings_reactivation_user_modal(opts);
    }

    confirm_dialog.launch({
        html_heading: $t_html({defaultMessage: "Reactivate {name}"}, {name: user.full_name}),
        help_link: "/help/deactivate-or-reactivate-a-user#reactivating-a-user",
        html_body,
        on_click: handle_confirm,
        loading_spinner,
    });
}
