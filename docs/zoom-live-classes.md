# Zoom Live Classes

## Admin Workflow

1. Sign in as admin.
2. Open `/admin/classes`.
3. Select `Whole Gen-Mumin` for an all-program session, or choose one program.
4. Select one or more teachers. For whole-bundle introductory sessions, select all contributing teachers.
5. Choose weekday, start time, end time, timezone, and Zoom controls.
6. Keep `Create recurring Zoom meeting immediately` checked.
7. Submit the form.

The LMS creates weekly `ClassSchedule` records, asks Zoom to create a recurring weekly meeting, stores the Zoom join URL, and notifies the assigned teacher plus active enrolled students and parents.

## Teacher Request Workflow

1. Teacher opens `/teacher/live-sessions`.
2. Teacher selects one of their assigned programs.
3. Teacher enters session title, weekly day, start/end time, and timezone.
4. LMS creates a pending schedule marked `Zoom Pending Approval`.
5. Admin receives an in-app notification and email.
6. Admin opens `/admin/classes`, approves the request, and the LMS creates the Zoom recurring meeting.
7. Teacher receives approval notification and email.
8. Students and parents enrolled in that program receive LMS notifications.

## Student LMS Flow

1. Student opens `/student`.
2. The next upcoming live class appears in the `Next class` card.
3. The card shows provider, teacher, timezone, and a countdown.
4. The Zoom join button opens 15 minutes before the class.
5. Student opens `/student/courses` to see upcoming sessions inside each program card.
6. The full schedule and notifications are also available at `/student/schedule`.

## Parent LMS Flow

1. Parent opens `/parent`.
2. The selected child's next upcoming live class appears in the `Next class` card.
3. Parent opens `/parent/courses` to see upcoming sessions inside each child program card.
4. Parent can also open `/parent/schedule` to see each child's timetable and Zoom join links.

## Zoom Options Supported

- Recurring weekly meeting
- Timezone
- Waiting room
- Join before host
- Mute participants on entry
- Cloud/local/no automatic recording
- Optional passcode

## Recommended Operating Procedure

1. Admin creates normal weekly program sessions from `/admin/classes`.
2. Admin uses `Whole Gen-Mumin` for intros, parent orientation, open days, or full-bundle sessions.
3. Teachers request extra revision or support sessions from `/teacher/live-sessions`.
4. Admin approves teacher requests before students see join links.
5. Students use `/student` for the default next-session countdown.
6. Students use `/student/courses` for program-specific upcoming sessions.
7. Zoom webhook sends “meeting started” notifications after Zoom confirms the event.

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
