# Notion AI prompts for daily use

Eight saved prompts you run with Notion AI while working in the Spaces. Each sits next to the views that answer the same question. They read and answer in the chat; only "Review minutes" and "Tidy a capture" may edit, and only the page text you own (decision 0035).

**Where they live:** in a collapsed toggle **"Ask AI"** next to the matching view. Open the toggle, copy the prompt, open Notion AI on that page (✦, or space on an empty line), paste. Decided on 2026-10-14: toggles are the placement, because they work on every plan and keep the prompt text visible and editable. The user's plan (Business) includes Notion AI; whether a button can run a saved prompt couldn't be checked through the API, so buttons are left out. To build them in an existing space, see [migration 0004](migrations/0004-ai-prompts-and-guide.md).

**The guard line.** Every prompt ends with the same line. Keep it when you edit a prompt:

> Answer only from the pages named above. Do not edit any property. Do not edit any page.

The two prompts that may edit replace the last sentence with what they may change.

---

## 1 · What's waiting for me today?

**Where:** Home, above "What's on today?". **Reads:** Tasks, Meetings, Review, Projects.

```text
Using the databases Tasks, Meetings, Review and Projects on "Brain Data", tell me what's waiting for me today, in this order:
1. Tasks with Status To Do or Doing and Due on or before today, overdue first, each with its project.
2. Meetings dated today, with their time, project and attendees.
3. How many Review rows have State Pending, and the three newest by name.
4. How many meetings have Brain Status Not Reviewed and a Date on or before today.
5. Active projects whose Countdown says Overdue.
Keep it under 15 lines. End with the one thing I should do first.
Answer only from the pages named above. Do not edit any property. Do not edit any page.
```

## 2 · Walk me through the Review queue

**Where:** Review, beside "What needs my decision?". **Reads:** Review rows with State Pending and their source meetings.

```text
Using the Review database on "Brain Data", go through the rows with State Pending, newest first. For each one, in two or three lines: what would change (Before → After), the sentence that triggered it (Why), the source meeting, and what Approve would do for its Kind. Group rows of the same Kind. Point out any two rows that conflict with each other. Then list the rows where you'd look closer before approving, and why. Do not recommend Approve or Reject: the decision is mine.
Answer only from the pages named above. Do not edit any property. Do not edit any page.
```

## 3 · Review these minutes

**Where:** Meetings, beside "To review"; run it on the open meeting page. **Reads:** this meeting page and the minutes format. **May edit:** the minutes text on this page, before it is marked Reviewed (0035).

```text
Check the minutes on this meeting page before I mark it Reviewed:
1. Do they have these sections: Attendees, Decisions, Action items, Facts & numbers, Open questions, Risks, Summary? List any missing.
2. List every name, number, date and amount, so I can confirm each one.
3. Point out decisions or action items with no owner, and anything that reads like a guess.
4. Compare the attendees in the text with the Attendees property, and the project mentioned with the Project property. Report differences; don't change the properties.
Then ask me which fixes to make. After I confirm, correct only the minutes text: typos, the names and numbers I confirm, and section headings. Do not edit any property, the checklist, the views, or anything below the minutes. If Brain Status is already Reviewed or Ingested, don't edit anything; tell me instead.
```

## 4 · Prepare me for this meeting

**Where:** Meetings, beside "Upcoming"; run it on the open meeting page. **Reads:** this meeting, its project, its attendees' recent meetings, the project's open questions and open tasks.

```text
Prepare me for the meeting on this page. Using this page, its Project, its Attendees, and the databases Meetings, Questions, Tasks and Decisions on "Brain Data":
1. The last two meetings with this project or these attendees: date and the decisions and action items from each.
2. Open questions and risks for this project.
3. Open tasks for this project, especially overdue ones and ones Waiting On someone attending.
4. Decisions on this project from the past month.
5. Three questions I could ask in this meeting, based on the above.
Keep it to one screen.
Answer only from the pages named above. Do not edit any property. Do not edit any page.
```

## 5 · Weekly review

**Where:** Plan, at the top. **Reads:** Goals, Key Results, Projects, Tasks, Meetings, Decisions.

```text
Do my weekly review using the databases Goals, Key Results, Projects, Tasks, Meetings and Decisions on "Brain Data":
1. Done this week: tasks with Status Done edited in the past 7 days, grouped by project.
2. Decided this week: decisions dated in the past 7 days.
3. Goals: each Active goal with its Progress and Countdown; flag any with Progress under 25% and under 30 days left.
4. Projects: Active projects with Overdue in Countdown, and Active projects not edited in 30 days.
5. Waiting On: tasks with Status Waiting On, oldest first.
6. Next week: tasks due in the next 7 days and meetings dated in the next 7 days.
End with three things to focus on next week.
Answer only from the pages named above. Do not edit any property. Do not edit any page.
```

## 6 · Check my plan

**Where:** Plan, beside "Which projects serve each goal?". **Reads:** Areas, Goals, Key Results, Projects.

```text
Check my plan for gaps, using the databases Areas, Goals, Key Results and Projects on "Brain Data":
1. Active projects with no Goal.
2. Active goals with no Active project.
3. Active goals with no key results, and key results with no Current value.
4. Areas with no Active goal and no Active project.
5. Goals or projects whose Deadline or Dates have passed but are still Active.
For each gap, suggest one fix in a sentence. Don't make the fix.
Answer only from the pages named above. Do not edit any property. Do not edit any page.
```

## 7 · Tidy this capture

**Where:** Knowledge → Inbox; run it on the open Capture Inbox page. **Reads:** this page. **May edit:** the text of this page (0035).

```text
Tidy the capture on this page so the brain can file it:
1. Rewrite the text below the title as clear sentences or bullets. Keep every name, number, date, link and quote exactly as written. Don't add facts.
2. If it mentions a project, person, org or decision, say which, so I can check the brain will recognise it.
3. If it holds several unrelated ideas, suggest splitting it and say how.
Show me the rewrite first; after I confirm, replace the text on this page with it. Do not edit the title, Brain Status or any other property.
```

## 8 · Ask how-to

**Where:** in the synced Spaces navigation, so it's on every page. **Reads:** the "How it works" page under System, and the page you're on.

```text
Answer my question about how this system works, using only the page "How it works" (under System) and the page I'm on now. Name the Space, tab and property exactly as the guide does, and give the steps in order. If the answer is something my agent does, quote what to say to it from "What to say to your agent". If the guide doesn't cover it, say so instead of guessing.
My question:
Answer only from the pages named above. Do not edit any property. Do not edit any page.
```

The "How it works" page is a copy of the user guide ([skills/brain-howto/references/guide.md](../skills/brain-howto/references/guide.md)). When the guide changes, update the page from it.
