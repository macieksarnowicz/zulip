import * as modals from "./modals";
import * as overlays from "./overlays";

export function any_active(): boolean {
    return overlays.any_active() || modals.any_active();
}
