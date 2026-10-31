# Curriculum handover

Parents have a main Curriculum shortcut on desktop and mobile. Shared lesson uploads/edits and material uploads/edits generate an alert and a transactional email for the enrolled student's relevant parents. Saved teacher rosters limit recipients where present. Each content version has an email deduplication key.

Every programme module defaults to Student handover enabled. Teachers can turn it off under Curriculum Builder → module → Student handover → Save handover. The setting is shared across that programme module, with the latest authorized save taking precedence. Existing teacher profile JSON holds the setting; no database migration is required. Saving module titles preserves handover settings.

Disabled modules and their lessons, attachments, materials and tasks are filtered out of both family portals. No new curriculum alerts or emails are generated for them. Disabling a module also clears its existing pending curriculum alerts. Re-enabling exposes its content again; it does not send a batch of historical emails.

New material uploads explicitly select a module. Legacy files/lessons use their saved module or matching term/week label; content without a recognizable module is grouped under the first module. Existing externally shared Google Drive links are not revoked by a portal visibility switch.

Parents review shared content and choose Mark reviewed. The red Curriculum indicator remains until those content-version alerts are reviewed; opening the notification bell or clicking navigation does not clear them. Review actions only affect the signed-in parent's own curriculum notifications and only the IDs rendered in their current view, preserving newer alerts.

Focused fixtures cover default visibility, module/programme isolation, unauthorized saves, hidden-content notification suppression, roster recipients, version deduplication, and review ownership. Live MySQL, email delivery and Google Drive operations require deployment verification.
