# Zoom Live Classes

## Admin Workflow

1. Sign in as admin.
2. Open `/admin/classes`.
3. Select the program, teacher, weekday, start time, end time, and timezone.
4. Keep `Create recurring Zoom meeting immediately` checked.
5. Submit the form.

The LMS creates a weekly `ClassSchedule`, asks Zoom to create a recurring weekly meeting, stores the Zoom join URL, and notifies the assigned teacher plus active enrolled students and parents.

## Student LMS Flow

1. Student opens `/student`.
2. The next upcoming live class appears in the `Next class` card.
3. The card shows provider, teacher, timezone, and a countdown.
4. The Zoom join button opens 15 minutes before the class.
5. The full schedule and notifications are also available at `/student/schedule`.

## Parent LMS Flow

1. Parent opens `/parent`.
2. The selected child's next upcoming live class appears in the `Next class` card.
3. Parent can also open `/parent/schedule` to see each child's timetable and Zoom join links.

## Zoom Webhook

Use this endpoint in the Zoom app:

```text
https://genmumin.com/api/zoom/webhook
```

Enabled events:

- Meeting has started
- Recording completed

## Required Environment Variables

```env
ZOOM_ACCOUNT_ID=""
ZOOM_CLIENT_ID=""
ZOOM_CLIENT_SECRET=""
ZOOM_HOST_USER_ID=""
ZOOM_WEBHOOK_SECRET_TOKEN=""
LIVE_CLASS_REMINDER_MINUTES="15"
```

`ZOOM_HOST_USER_ID` can be the Zoom host email address.
