# Earned badge graphics

Admin: Rewards > choose Qabila > Recent awards > Preview & download PNG. The same controls are available under Complete history > Badges & recognition, with existing search, date filters and pagination.

Each active RecognitionAward has a /badges/[certificateCode] page. Existing and future awards render on demand using their saved title, reason, earned date and current Qabila. No new award, point credit or email is created by previewing, editing a display name or downloading.

Admins can save an optional recipientName (80 characters maximum) for that individual badge. Blank resets to the profile name. This does not rename the student account or alter the full certificate. The same override appears in family badge previews. Latest awards appear in the collectible badges; every award remains accessible in recognition history.

Badge pages follow certificate access: admin, teachers, the student and linked parents. Hidden/revoked awards return 404. Name mutations re-check admin access and active award status. PNG export uses a 640-pixel layout at 2x resolution, regardless of phone width, with in-progress and error feedback.

Migration: 20261012160000_add_badge_recipient_name adds one nullable field. No existing data changes or backfill are needed.

Validation: node --test scripts/test-earned-badge-access.cjs. Browser-check all gender variants, mobile PNG export and long reasons. Previews use fictional data; production badges are not changed for tests.
