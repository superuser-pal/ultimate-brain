# The persona: Ines Varga

Everyone and everything here is invented. Ines works at Harbourline Bikes, an invented e-bike rental company in the invented city of Port Aldern. Her meeting is the Rider App 2.0 sync of [../minutes-0.14/transcript.md](../minutes-0.14/transcript.md), so the first meeting matches the people seeded here.

## What she types when setup asks about her work (spec/setup.md §8.1)

Paste this as one message, unchanged:

```text
I'm the product lead at Harbourline Bikes, an e-bike rental company in Port Aldern. My main project is Rider App 2.0, the new rider app: we launch it with a six-week pricing pilot in the harbour district. That's all in my Product area. I also run the board updates for the pilot pricing.

I work most with Tomas Brandt (engineering lead), Priya Okafor (design lead) and Dario Meck (operations manager), all at Harbourline. Marta Lindqvist is our CEO and chairs the board. Jonas Feld is our finance controller. Aiko Sato is our account manager at Paylane, the payment provider that certifies our checkout.

Outside work I'm training for the Port Aldern half marathon on 18 April 2027; I'd like that in the brain too, separate from work.
```

## What the preview should hold (expected, not shown to the agent)

- **Domains** (two contexts, so the Domains module turns on): Work, Personal.
- **Areas:** Product (Work), Running (Personal). What to track: whatever Ines answers; no answer is fine.
- **Projects:** Rider App 2.0 (Product, Active), Port Aldern half marathon (Running, Active).
- **Orgs:** Harbourline Bikes, Paylane.
- **People:** Tomas Brandt, Priya Okafor, Dario Meck, Marta Lindqvist, Jonas Feld (Harbourline Bikes); Aiko Sato (Paylane). Six, within 5 to 10.
- **Key documents:** the three files in [documents/](documents/).

Her answer to the preview: `yes to all`. If the preview differs (another Area name, the board updates as their own project), she takes it when it is reasonable and records the difference; she never asks for something the description didn't say.

## Her answers elsewhere

| Asked | She answers |
|---|---|
| Settings screen (§7) | the defaults, except the brain's language: English |
| Response style | keep the default |
| Tasks module | on |
| Documents module | on |
| A folder or repo to adopt (§8.4) | no |
| The schedule (step 8) | not now |
| Anything else not scripted | the run stops and the question is recorded |

## The first-value checks (spec/setup.md §10)

| Check | Material | What passes |
|---|---|---|
| `tasks` | [documents/rider-app-launch-plan.md](documents/rider-app-launch-plan.md) | exactly two Tasks, both Ines's, Project Rider App 2.0: "finalise the beta tester list" due 2026-11-28, and "sign off the app store listing text" due 2027-01-09. None of Tomas's, Priya's or Dario's lines, and nothing from "we should revisit the referral scheme". |
| `report` | "report on Rider App 2.0" | a report in Documents, linked from Rider App 2.0, citing the launch plan |
| `organised` | the seeded notes and the documents' Review | every note under the Area and Project above; each of the six people once |
| `answer` | [documents/harbour-pilot-station-survey.md](documents/harbour-pilot-station-survey.md) | Ines accepts the decision "the pilot starts with 12 stations; Pier 3 and Ferry Terminal join once their power connections are in" in the survey's Review row, it is applied, then she asks: **"How many stations does the harbour pilot start with, and why not all 14?"** The answer says 12, because Pier 3 and Ferry Terminal wait for a power connection, and cites the survey's passage. |

The third document, [documents/paylane-certification-email.md](documents/paylane-certification-email.md), is there because setup asks for 3 to 5 key documents (§8.3); no check depends on it.

## The first meeting (§10.1)

After first value passes: paste the transcript into a page of the Meetings database, run the minutes prompt (the Meetings template), tick no follow-up, mark it Reviewed, then say "catch up". Expected first-meeting line: Ines's tasks from the meeting (write the onboarding copy, due 2026-12-12; draft the pilot pricing brief, due 2026-12-17; plus the unticked quick follow-ups), 4 people matched (Tomas, Priya, Dario and Ines herself as the owner, however the skill counts her), **0 new people**.
