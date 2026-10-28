<p align="center">
  <img src="favicon.svg" alt="CommonGround logo" width="72" />
</p>

<h1 align="center">CommonGround</h1>
<p align="center"><strong>Find your time together.</strong></p>
<p align="center">
  Upload timetables, compare schedules, and find the breaks everyone has in common.
  No account required to get started.
</p>
<p align="center">
  <a href="https://commonground-two-flame.vercel.app/">Open CommonGround</a>
</p>

## What is CommonGround?

CommonGround is a timetable comparison website made for students. Instead of checking several timetables side by side, you can upload them all and quickly find a time when everyone is available.

Use it to plan lunch, meetups, study sessions, project meetings, or anything else that needs a common free slot.

## Get started

1. **Open [CommonGround](https://commonground-two-flame.vercel.app/).** You can use the website immediately as a guest.
2. **Add timetables.** Select **Add a timetable** or **Add timetable PDF** and upload your NYP timetable PDFs. You can add more than one at a time.
3. **Check the extracted lessons.** If anything looks wrong, select **Review** on the timetable to edit, add, or remove lessons.
4. **Choose your settings.** Pick a teaching week, a minimum break length, and whether online lessons should count as busy.
5. **See when everyone is free.** The **Weekly availability** calendar and **Shared openings** list will show matching periods.
6. **Share the results.** Use **Copy results** or **Export CSV**.

Want to try it first? Select **Load the 3 example timetables** to compare three fictional student schedules.

## What can you do?

| Feature | Guest | Signed in |
| --- | :---: | :---: |
| Upload and compare multiple timetables | Yes | Yes |
| Find shared free periods | Yes | Yes |
| Correct or add lessons manually | Yes | Yes |
| Filter by week and break duration | Yes | Yes |
| Copy results and export CSV | Yes | Yes |
| Save timetables to your account | No | Yes |
| Create and join groups | No | Yes |
| Reuse timetables across different groups | No | Yes |
| Choose an avatar, upload a profile photo and set a display name | No | Yes |

### View your own classes

1. Upload a timetable PDF or choose a saved timetable from your library.
2. Select **My timetable** from the sidebar.
3. Choose the timetable and teaching week at the top of the section.
4. Use **Calendar** for a visual Monday–Saturday view, or **Class list** to read lesson details in order.
5. See each class's code, time, teaching weeks, room/location (when available), and whether it is online.
6. Select **Edit lessons** to correct class times or room information for a timetable you own.

As a guest you can view every timetable in your current session. When signed in, you can view your saved timetables, including ones not added to the active group, as well as timetables shared with your current group. The selected week is shared with the comparison page. Older saved lessons may not have a room until you edit them or reimport their PDF.

### Find the right break

You can adjust the comparison without uploading the files again:

- **Teaching week:** Check a specific week, including classes that only run during part of the semester.
- **Minimum break:** Show openings lasting at least 30 minutes, 1 hour, 1.5 hours, 2 hours, or 3 hours.
- **Show availability:** Choose **Between classes** for gaps in the day's lessons, or **All day (8 AM–6 PM)** to include free time before or after classes.
- **Count e-learning as busy:** Turn this off if you want flexible online lessons to be treated as free time.
- **Sort by:** View openings in day/time order or see the longest breaks first.

A time only appears as a **shared opening when every included timetable is free**.

For more realistic scheduling, lessons are treated as full-hour blocks. For example, a 9:00–9:50 AM class occupies the 9:00–10:00 AM slot, including the 10-minute transition.

## Save your timetables and make groups

You don't need an account to compare schedules. Sign in when you want to keep your timetables or plan with friends over time.

### Create an account

1. Click **Sign in / Save**.
2. Select **Create account**.
3. Enter a username, email address, and password.
4. Confirm your email if prompted, then sign in using your **email and password**.

If you already compared timetables as a guest, you can use **Save to selected group** after signing in to save them to your account.

### Customise your profile

When signed in, click your round profile icon at the top right or **My profile** in the sidebar. You can choose an included avatar, upload a JPG/PNG/WebP photo (up to 2 MB), or revert to initials. Add an optional display name, then select **Save profile**.

Your profile icon is shown in the header, alongside timetables you share, and next to your name in group members. Uploaded photos use private Supabase Storage; you and members of groups you share can view them with temporary image links. Guests do not need a profile.

### Create a group

1. Sign in and click **+ New group**.
2. Name your group, such as *Lunch Squad* or *Project Team*.
3. Click **Invite friends** and send your friends the invitation link or code.
4. Your friends can create accounts and select **Join group**.
5. In **My timetable library**, select which of your saved timetables should be included in the current group.

Each group has its **own timetable selection**. You can use the same saved timetable in different groups without uploading it again.

Group owners can manage members, rename groups, reset invitation codes, and delete groups. Members can leave groups and manage their own shared timetables.

## Supported timetables

CommonGround currently works best with **original, text-based NYP timetable PDFs**. It reads the lessons, times, days, teaching weeks, locations where recognised, and online-class information from the PDF.

If you upload a screenshot, scanned PDF, or a different timetable format, automatic extraction may not work correctly. You can still choose **+ Add a timetable manually** or use **Review** to correct the lessons.

Current comparison range: **Monday to Saturday, 8:00 AM–6:00 PM, teaching weeks 1–17**.

## Privacy and data

- **Guest mode:** Uploaded PDFs are read in your browser. Your guest comparison is temporary and may disappear when you close the tab or clear browser data.
- **Signed-in mode:** The extracted timetable information you choose to save is stored using Supabase. The original PDF files are not uploaded as saved attachments.
- **Groups:** Timetables shared with a group can be viewed by that group's members. Your other saved timetables remain outside the group unless you add them.
- **Passwords:** Account authentication is handled by Supabase Auth. The website does not save passwords in its own timetable tables.

Only share timetables in groups whose members you trust. Group invitation links allow people with the code to join, so avoid posting them publicly.

## Frequently asked questions

**Do I need an account?**  
No. Upload and compare timetables for free as a guest. You only need an account for cloud saving and group features.

**Can I compare more than two people?**  
Yes. You can add multiple timetables. CommonGround looks for periods when *everyone* is free.

**What if the PDF reader gets my timetable wrong?**  
Select **Review** to fix a class, change its week range, or add a missing lesson.

**Does signing in automatically save my guest comparison?**  
No. After signing in, use **Save to selected group** to save the guest timetables you want to keep.

**Why can't I see a free period I expected?**  
Check the selected teaching week, minimum break duration, **Between classes** versus **All day**, and the e-learning toggle. Also review the extracted classes.

**Can I use it on my phone?**  
Yes. The interface adapts to smaller screens, although reviewing a large timetable is easier on a computer.

## Running your own copy

This is a static website built with HTML, CSS, and JavaScript. Guest comparison doesn't require a backend. Account and group features use Supabase.

1. Clone or download this repository.
2. Serve the files locally with `python -m http.server 5500` and open `http://localhost:5500`, or deploy the repository to Vercel as a static site.
3. For accounts and groups, create a Supabase project and run `schema.sql` in its SQL Editor.
4. Set the project URL and **public publishable key** in `config.js`, then configure your website address under Supabase Authentication's URL settings.

Do **not** put a database password, Supabase secret key, or service-role key into the frontend code.

To run the timetable parser and matching tests:

```bash
npm test
```

## Feedback

Found an issue or have a feature suggestion? [Open an issue](https://github.com/jasonanqq/CommonGround/issues) on GitHub.

## Updating an existing Supabase project for profile pictures

Before deploying version 5, open **Supabase → SQL Editor → New query**, copy all of `migrations/2026-10-28-profile-avatars.sql` and click **Run**. This adds the optional profile fields and creates the private `avatars` Storage bucket with its access policies. **Do not rerun the original `schema.sql` on your existing database.** Existing accounts and saved schedules remain in place.

If you are creating a brand new Supabase project, running the full `schema.sql` includes the avatar setup already. Do not run both scripts on a new database.

After the SQL succeeds, replace your updated website files on GitHub and deploy to Vercel. Keep your existing `config.js` if the connection is working. Public Supabase publishable keys belong in frontend code; never include a service-role or secret key.

Uploaded avatar image access is restricted to the owner and members of their shared groups through Supabase RLS. Signed URLs expire after one hour, though a previously generated link remains usable until it expires even if group membership changes.
