# MyThings

A personal task manager for one person (with sharing possible later), built around a calm plan-your-day workflow.

## Items

**To-do**:
A single thing to be done. The basic unit of work.
_Avoid_: Task, item, action

**Project**:
A goal with a defined end, made up of To-dos. It is complete when its To-dos are done.
_Avoid_: List, folder

**Area**:
An ongoing sphere of responsibility (e.g. Work, Home) that holds Projects and To-dos. It is never completed.
_Avoid_: Category, folder, space

**Heading**:
A named section that groups To-dos inside a Project.
_Avoid_: Section, milestone, group

**Sub-to-do**:
A full To-do that belongs to a parent To-do, one level deep only. It always sits in its parent's Project, Area and Heading, and appears in lists on its own, labelled with its parent.
_Avoid_: Subtask, child task

**Checklist item**:
A lightweight step inside a To-do that can only be ticked off. It has no dates, Tags or other properties.
_Avoid_: Subtask, step

**Attachment**:
A file attached to a To-do, up to 25 MB, kept in the account's Storage; images show as thumbnails. Its details sync like any record, but adding or opening one needs you signed in and online. The next occurrence of a repeating To-do doesn't copy it.
_Avoid_: File, upload

**Tag**:
A label attached to To-dos, Projects or Areas, used to filter across the whole hierarchy. Tags can be nested, and a parent Tag includes everything tagged with its children.
_Avoid_: Label, context, category

## Outcomes

**Completed**:
The outcome of a To-do or Project that was done.
_Avoid_: Done, finished, closed

**Cancelled**:
The outcome of a To-do or Project that was abandoned without being done. It is kept in the Logbook, separate from Completed.
_Avoid_: Deleted, dropped, won't do

## Dates

**Start date**:
The day a To-do becomes something to work on; on that day it appears in Today. Shown in the app as "When".
_Avoid_: When, scheduled date, do date

**Deadline**:
The day a To-do or Project must be finished by.
_Avoid_: Due date

**Time slot**:
An optional start and end time for a To-do on its Start date, used to block out time in the day timeline.
_Avoid_: Time block, appointment, event

**Repeat rule**:
The pattern that makes a To-do recur. It is either **on schedule** (fixed dates) or **after completion** (a gap after the previous one is done). Only the next occurrence exists at any time.
_Avoid_: Recurrence, template

**Series**:
All the To-dos one Repeat rule has produced, from the To-do it was first set on, finished ones included. Editing a repeating To-do changes either this one or all future ones in its series.
_Avoid_: Recurrence, chain

**Occurrence**:
One To-do in a series. The **current occurrence** is the only open one and carries the Repeat rule; finishing it creates the next occurrence. "End after N" counts the occurrences the series has created, the current one included.
_Avoid_: Instance, copy, repeat

**Projected date**:
A later date of an on-schedule Repeat rule, shown in Upcoming as a dashed row. It isn't a To-do and isn't stored; it stands for the current occurrence and shows the series as it is, without "this one" changes.
_Avoid_: Ghost, future instance, virtual To-do

**Reminder**:
A notification attached to a To-do, triggered at a time or on arriving at or leaving a Place. A To-do can have several.
_Avoid_: Alert, alarm

**Place**:
A saved, named location (e.g. Home, Supermarket) that Reminders can use.
_Avoid_: Location, geofence

## Planning attributes

**Priority**:
How important a To-do is: none, low, medium or high.

**Estimate**:
How many minutes a To-do is expected to take.
_Avoid_: Duration

**Energy**:
How much focus a To-do needs: low or high.
_Avoid_: Effort

## Built-in lists

**Inbox**:
Where new To-dos land before they have been organised.

**Today**:
Every active To-do whose Start date is today or earlier, or whose Deadline is today or earlier.

**This Evening**:
The later part of Today, for To-dos planned for after the working day.

**Upcoming**:
A timeline of To-dos with a future Start date, plus Deadlines and repeating To-dos.

**Anytime**:
Every active To-do that could be done now: it has no future Start date and is not inside a Someday Project or a Project whose Start date is in the future.

**Someday**:
To-dos and Projects deliberately parked with no commitment to do them.
_Avoid_: Backlog, maybe

**Logbook**:
The record of completed and cancelled To-dos and Projects.
_Avoid_: Archive, history, done list

**Trash**:
Deleted items, which can be restored for 30 days before they are removed for good.

## Custom views

**Smart List**:
A saved, named combination of filters (Tags, Areas, Projects, dates, Priority, Energy, Estimate) shown in the sidebar.
_Avoid_: Perspective, filter, saved search

## Accounts

**Owner**:
The account a record belongs to: "me" until you sign in, then the account's user id. Signing in makes every record on the device the account's; signing out erases the device.
_Avoid_: User, author, creator

**Backup**:
An automatic weekly export of everything, kept in the account's Storage while you're signed in; the last 8 are kept, and any one can be restored. It is made when the app opens or comes to the foreground and the newest is 7 days old or more.
_Avoid_: Snapshot, archive
