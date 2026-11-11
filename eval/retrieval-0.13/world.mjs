// The retrieval layer of the 0.13.0 English retrieval evaluation (CC-203, decision 0080, spec/retrieval.md §5).
// It is added to eval/search-0.5's original brain, unchanged. Every name, company and figure is made up.
// Keys (`prj:harlow-shop`) become ids in make-brain.mjs; a meeting `mtg:<x>` always has its minutes source `src:<x>`, which
// holds the full minutes text, so either is evidence for what the minutes say.

export const AREAS = [
  { key: "area:retainer", title: "Retainer clients", summary: "Shops and clinics on a monthly retainer." },
  { key: "area:public", title: "Housing and logistics clients", summary: "A housing association, a carrier and a club." },
  { key: "area:studio", title: "Studio operations", summary: "Internal tools and how the studio runs." },
];

export const ORGS = [
  { key: "org:harlow", title: "Harlow Provisions", area: "area:retainer", summary: "A family-run chain of four delicatessens.", body: "Harlow Provisions runs four delis and a catering kitchen. The studio built its website in 2025 and is building its web shop." },
  { key: "org:kestrel", title: "Kestrel Dental", area: "area:retainer", summary: "A group of three dental clinics.", body: "Kestrel Dental has three clinics in the city centre and the suburbs." },
  { key: "org:brightwater", title: "Brightwater Housing", area: "area:public", summary: "A housing association in the north of the city.", body: "Brightwater Housing manages homes on several estates and runs its own repairs team." },
  { key: "org:orrin", title: "Orrin Freight", area: "area:public", summary: "A regional parcel and pallet carrier.", body: "Orrin Freight runs vans and lorries from depots across the region." },
  { key: "org:tamsin", title: "Tamsin Books", area: "area:retainer", summary: "An independent bookshop with a café.", body: "Tamsin Books sells new and second-hand books and hosts readings." },
  { key: "org:velde", title: "Velde Cycling Club", area: "area:public", summary: "An amateur cycling club with road and gravel sections.", body: "Velde Cycling Club organises weekly rides and a junior section." },
];

// Studio staff have no org; client contacts have their org.
export const PEOPLE = [
  { key: "per:ines", title: "Ines Holloway", role: "project manager", projects: ["prj:harlow-shop", "prj:orrin-planner", "prj:velde-site"], learned: "src:harlow-shop-kickoff", body: "Project manager at the studio. Runs the Harlow web shop, the Orrin route planner and the Velde members site." },
  { key: "per:callum", title: "Callum Frey", role: "project manager", projects: ["prj:harlow-site", "prj:bw-repairs", "prj:tamsin-shop", "prj:tamsin-events"], learned: "src:harlow-site-kickoff", body: "Project manager at the studio. Ran the Harlow website; runs the Brightwater repairs app and both Tamsin Books projects." },
  { key: "per:sofia", title: "Sofia Brandt", role: "project manager", projects: ["prj:kestrel-app", "prj:kestrel-site", "prj:bw-portal"], learned: "src:kestrel-app-kickoff", body: "Project manager at the studio. Runs both Kestrel Dental projects and the Brightwater tenant portal." },
  { key: "per:marek", title: "Marek Doyle", role: "developer", projects: ["prj:harlow-shop", "prj:kestrel-app"], learned: "src:harlow-shop-kickoff", body: "Developer at the studio, mostly on shops and payments." },
  { key: "per:rafael", title: "Rafael Quint", role: "lead developer", projects: ["prj:kestrel-app", "prj:kestrel-site", "prj:orrin-planner", "prj:orrin-driver"], learned: "src:orrin-planner-kickoff", body: "Lead developer at the studio. Leads the Orrin work and builds on the Kestrel projects." },
  { key: "per:amara", title: "Amara Okafor", role: "designer", projects: ["prj:bw-portal"], learned: "src:bw-portal-kickoff", body: "Designer at the studio. Works on the Brightwater tenant portal." },
  { key: "per:noor", title: "Noor Eskildsen", role: "designer", projects: ["prj:bw-repairs"], learned: "src:bw-repairs-kickoff", body: "Designer at the studio. Works on the Brightwater repairs app." },
  { key: "per:theo", title: "Theo Lindqvist", org: "org:brightwater", role: "head of digital", projects: ["prj:bw-portal", "prj:bw-repairs"], learned: "src:bw-portal-kickoff", body: "Head of digital at Brightwater Housing." },
  { key: "per:maren", title: "Maren Holt", org: "org:brightwater", role: "finance lead", projects: ["prj:bw-portal"], learned: "src:bw-portal-kickoff", body: "Finance lead at Brightwater Housing." },
  { key: "per:jonas", title: "Jonas Pike", org: "org:orrin", role: "operations director", projects: ["prj:orrin-planner", "prj:orrin-driver"], learned: "src:orrin-planner-kickoff", body: "Operations director at Orrin Freight." },
  { key: "per:lena", title: "Lena Marsh", org: "org:tamsin", role: "owner", projects: ["prj:tamsin-shop", "prj:tamsin-events"], learned: "src:tamsin-shop-kickoff", body: "Owner of Tamsin Books." },
];

// A timeline entry: [field, value, from, source meeting key, assessment, until?]. `facts` are the accepted current values.
export const PROJECTS = [
  {
    key: "prj:harlow-site", title: "Harlow website", slug: "harlow-website", area: "area:retainer", org: "org:harlow", people: ["per:callum"],
    summary: "The marketing website for Harlow Provisions.",
    body: "Brochure site with the deli menus, opening hours and a catering enquiry form. Project manager: Callum Frey.",
    facts: { budget: "18000 EUR", launch_date: "2025-11" },
    timeline: [["budget", "18000 EUR", "2025-06-02", "harlow-site-kickoff", "accepted"], ["launch_date", "2025-11", "2025-11-04", "harlow-site-live", "accepted"]],
  },
  {
    key: "prj:harlow-shop", title: "Harlow web shop", slug: "harlow-web-shop", area: "area:retainer", org: "org:harlow", people: ["per:ines", "per:marek"],
    summary: "Online shop for Harlow Provisions' deli products.",
    body: "Web shop for the delis' hampers, cheeses and catering boxes. Project manager: Ines Holloway.",
    facts: { budget: "42000 EUR", launch_date: "2026-04", stores: 4 },
    timeline: [
      ["budget", "42000 EUR", "2025-12-01", "harlow-shop-kickoff", "accepted"],
      ["launch_date", "2026-03", "2025-12-01", "harlow-shop-kickoff", "superseded", "2026-02-12"],
      ["launch_date", "2026-04", "2026-02-12", "harlow-shop-0212", "accepted"],
      ["stores", 4, "2025-12-01", "harlow-shop-kickoff", "accepted"],
    ],
  },
  {
    key: "prj:kestrel-app", title: "Kestrel booking app", slug: "kestrel-booking-app", area: "area:retainer", org: "org:kestrel", people: ["per:sofia", "per:marek", "per:rafael"],
    summary: "Patients book and move appointments from their phones.",
    body: "iOS and Android app for booking, moving and cancelling appointments at the three clinics. Project manager: Sofia Brandt.",
    facts: { budget: "65000 EUR", deadline: "2026-06-30", team_size: 5 },
    timeline: [
      ["budget", "58000 EUR", "2025-10-06", "kestrel-app-kickoff", "superseded", "2026-03-05"],
      ["budget", "65000 EUR", "2026-03-05", "kestrel-app-0305", "accepted"],
      ["deadline", "2026-06-30", "2025-10-06", "kestrel-app-kickoff", "accepted"],
      ["team_size", 5, "2025-10-06", "kestrel-app-kickoff", "accepted"],
    ],
  },
  {
    key: "prj:kestrel-site", title: "Kestrel booking site", slug: "kestrel-booking-site", area: "area:retainer", org: "org:kestrel", people: ["per:sofia", "per:rafael"],
    summary: "A web page where new patients book a first visit.",
    body: "A small booking page on Kestrel's website for new patients. Project manager: Sofia Brandt.",
    facts: { budget: "12000 EUR", deadline: "2026-02-15", team_size: 2 },
    timeline: [["budget", "12000 EUR", "2025-11-10", "kestrel-site-kickoff", "accepted"], ["deadline", "2026-02-15", "2025-11-10", "kestrel-site-kickoff", "accepted"], ["team_size", 2, "2025-11-10", "kestrel-site-kickoff", "accepted"]],
  },
  {
    key: "prj:bw-portal", title: "Brightwater tenant portal", slug: "brightwater-tenant-portal", area: "area:public", org: "org:brightwater", people: ["per:sofia", "per:amara", "per:theo", "per:maren"],
    summary: "Tenants report problems, pay rent and message the housing team.",
    body: "Web portal for Brightwater's tenants: report a problem, pay rent, message the housing team. Project manager: Sofia Brandt.",
    facts: { budget: "90000 EUR", launch_date: "2026-09", support_hours_per_month: 20, warranty_months: 6 },
    timeline: [
      ["budget", "90000 EUR", "2025-09-15", "bw-portal-kickoff", "accepted"], ["launch_date", "2026-09", "2025-09-15", "bw-portal-kickoff", "accepted"],
      ["support_hours_per_month", 20, "2025-09-15", "bw-portal-kickoff", "accepted"], ["warranty_months", 6, "2025-09-15", "bw-portal-kickoff", "accepted"],
    ],
  },
  {
    key: "prj:bw-repairs", title: "Brightwater repairs app", slug: "brightwater-repairs-app", area: "area:public", org: "org:brightwater", people: ["per:callum", "per:noor", "per:theo"],
    summary: "Field app for Brightwater's repairs team.",
    body: "Field app for the repairs team: jobs, photos and sign-off. Project manager: Callum Frey.",
    facts: { budget: "38000 EUR", launch_date: "2026-01", support_hours_per_month: 10 },
    timeline: [["budget", "38000 EUR", "2025-08-20", "bw-repairs-kickoff", "accepted"], ["launch_date", "2026-01", "2025-08-20", "bw-repairs-kickoff", "accepted"], ["support_hours_per_month", 10, "2025-08-20", "bw-repairs-kickoff", "accepted"]],
  },
  {
    key: "prj:orrin-planner", title: "Orrin route planner", slug: "orrin-route-planner", area: "area:public", org: "org:orrin", people: ["per:ines", "per:rafael", "per:jonas"],
    summary: "Plans daily delivery routes for Orrin's vans.",
    body: "Plans daily delivery routes for Orrin's vans across its depots. Project manager: Ines Holloway.",
    facts: { budget: "120000 EUR", launch_date: "2026-10", team_size: 6, depots_at_launch: 7, hosting_cost_per_month: "640 EUR" },
    timeline: [
      ["budget", "120000 EUR", "2026-01-12", "orrin-planner-kickoff", "accepted"], ["launch_date", "2026-10", "2026-01-12", "orrin-planner-kickoff", "accepted"],
      ["team_size", 6, "2026-01-12", "orrin-planner-kickoff", "accepted"], ["depots_at_launch", 7, "2026-01-12", "orrin-planner-kickoff", "accepted"],
      ["hosting_cost_per_month", "640 EUR", "2026-03-02", "orrin-planner-hosting", "accepted"],
    ],
  },
  {
    key: "prj:orrin-driver", title: "Orrin driver app", slug: "orrin-driver-app", area: "area:public", org: "org:orrin", people: ["per:rafael", "per:jonas"],
    summary: "App for Orrin's drivers on the road.",
    body: "App for Orrin's drivers: the day's stops, proof of delivery and messages to dispatch.",
    facts: { launch_date: "2027-01", team_size: 3, hosting_cost_per_month: "210 EUR" },
    timeline: [["launch_date", "2027-01", "2026-02-09", "orrin-driver-kickoff", "accepted"], ["team_size", 3, "2026-02-09", "orrin-driver-kickoff", "accepted"], ["hosting_cost_per_month", "210 EUR", "2026-02-09", "orrin-driver-kickoff", "accepted"]],
  },
  {
    key: "prj:tamsin-shop", title: "Tamsin online shop", slug: "tamsin-online-shop", area: "area:retainer", org: "org:tamsin", people: ["per:callum", "per:lena"],
    summary: "Online shop for books, gift cards and café vouchers.",
    body: "Online shop for books, gift cards and café vouchers. Project manager: Callum Frey.",
    facts: { budget: "26000 EUR", launch_date: "2026-05" },
    timeline: [["budget", "26000 EUR", "2026-01-20", "tamsin-shop-kickoff", "accepted"], ["launch_date", "2026-05", "2026-01-20", "tamsin-shop-kickoff", "accepted"]],
  },
  {
    key: "prj:tamsin-events", title: "Tamsin events calendar", slug: "tamsin-events-calendar", area: "area:retainer", org: "org:tamsin", people: ["per:callum", "per:lena"],
    summary: "Readings, signings and children's events on the bookshop's website.",
    body: "Calendar of readings, signings and children's events on the bookshop's website. Project manager: Callum Frey.",
    facts: { budget: "9000 EUR", deadline: "2026-03-20" },
    timeline: [["budget", "9000 EUR", "2025-12-08", "tamsin-events-kickoff", "accepted"], ["deadline", "2026-03-20", "2025-12-08", "tamsin-events-kickoff", "accepted"]],
  },
  {
    key: "prj:velde-site", title: "Velde members site", slug: "velde-members-site", area: "area:public", org: "org:velde", people: ["per:ines"],
    summary: "Members' site for Velde Cycling Club.",
    body: "Members' site: rides calendar, membership renewals and the club shop. Project manager: Ines Holloway.",
    facts: { launch_date: "2026-03" },
    timeline: [["launch_date", "2026-03", "2025-11-17", "velde-kickoff", "accepted"]],
  },
  {
    key: "prj:timetracker", title: "Studio time tracker", slug: "studio-time-tracker", area: "area:studio", people: [],
    summary: "Internal tool for logging hours against client projects.",
    body: "Internal tool for logging hours against client projects.",
    facts: { budget: "6000 EUR" },
    timeline: [["budget", "6000 EUR", "2026-02-02", "timetracker-kickoff", "accepted"]],
  },
];

// Meetings: each line of `minutes` is one paragraph of the minutes source and one line of the meeting note's summary.
export const MEETINGS = [
  {
    key: "harlow-site-kickoff", title: "Harlow website kickoff", date: "2025-06-02", project: "prj:harlow-site", attendees: ["per:callum"],
    minutes: [
      "Callum Frey walked Harlow through the plan for the new website: menus, opening hours for the four delis and a catering enquiry form.",
      "The budget for the website is €18,000, fixed price.",
      "Harlow Provisions gets a 10% discount on the website build for paying the full amount upfront.",
      "Photography is out of scope; Harlow will send their own pictures.",
      "Next check-in in three weeks.",
    ],
  },
  {
    key: "harlow-site-live", title: "Harlow website launch", date: "2025-11-04", project: "prj:harlow-site", attendees: ["per:callum"],
    minutes: [
      "The Harlow website went live this morning, 4 November 2025, after a final check of the catering form.",
      "Callum handed over the editor logins to the deli managers.",
      "Two small fixes are left for the menu page.",
    ],
  },
  {
    key: "harlow-shop-kickoff", title: "Harlow web shop kickoff", date: "2025-12-01", project: "prj:harlow-shop", attendees: ["per:ines", "per:marek"], decisions: ["dec:harlow-payments"],
    minutes: [
      "Ines Holloway opened the kickoff for the Harlow web shop with Harlow's owner and Marek Doyle.",
      "The Harlow web shop budget is €42,000, including the first year of maintenance.",
      "Orders will be packed and shipped from the four Harlow delis, not from a central warehouse.",
      "The target launch is March 2026.",
      "Card payments go through Stripe, which the delis already use in their tills.",
      "Extra work outside the agreed scope is billed at €90 per hour.",
      "Harlow pays each invoice within 30 days of receiving it.",
    ],
  },
  {
    key: "harlow-shop-0212", title: "Harlow web shop check-in", date: "2026-02-12", project: "prj:harlow-shop", attendees: ["per:ines", "per:marek"],
    minutes: [
      "Marek reported that the payment provider's onboarding took longer than planned, so the launch moves from March to April 2026.",
      "Ines approves every deployment to the live shop; nobody else can push changes live.",
      "The product photos for the hampers are done.",
      "The team reviewed the open tickets and agreed to keep the weekly cadence.",
    ],
  },
  {
    key: "kestrel-app-kickoff", title: "Kestrel booking app kickoff", date: "2025-10-06", project: "prj:kestrel-app", attendees: ["per:sofia", "per:marek", "per:rafael"], decisions: ["dec:kestrel-app-payments"],
    minutes: [
      "Sofia Brandt ran the kickoff for the Kestrel booking app with the clinics' practice manager.",
      "The approved spend for the build is €58,000.",
      "Five people will work on it: Sofia, Marek, Rafael, a designer and a tester.",
      "The app has to be in the stores by 30 June 2026, before the summer check-up campaign.",
      "Patients get an SMS reminder 24 hours before each appointment.",
      "Kestrel agreed we can present the app as a case study in talks once it is live.",
      "Deposits are paid by card through Stripe.",
    ],
  },
  {
    key: "kestrel-app-0305", title: "Kestrel booking app check-in", date: "2026-03-05", project: "prj:kestrel-app", attendees: ["per:sofia", "per:rafael"],
    minutes: [
      "Kestrel added family accounts to the scope, so the approved spend for the build rises from €58,000 to €65,000.",
      "The 30 June deadline stays.",
      "Testing on older phones found two layout bugs, both small.",
    ],
  },
  {
    key: "kestrel-site-kickoff", title: "Kestrel booking site kickoff", date: "2025-11-10", project: "prj:kestrel-site", attendees: ["per:sofia", "per:rafael"], decisions: ["dec:kestrel-site-payments"],
    minutes: [
      "Sofia agreed the scope of the Kestrel booking site: one page where new patients pick a clinic and a first-visit slot.",
      "The approved spend is €12,000.",
      "The site must be live by 15 February 2026.",
      "Two people will build it, Rafael and a designer.",
      "Deposits are taken with Mollie, which Kestrel's website already uses.",
    ],
  },
  {
    key: "bw-portal-kickoff", title: "Brightwater tenant portal kickoff", date: "2025-09-15", project: "prj:bw-portal", attendees: ["per:sofia", "per:amara", "per:theo", "per:maren"],
    minutes: [
      "Theo Lindqvist is our day-to-day contact for the tenant portal and joins every fortnightly review.",
      "The portal's budget is €90,000 over two years.",
      "Launch is planned for September 2026, after the pilot with two estates.",
      "Amara Okafor leads the visual design and the accessibility review.",
      "Support is capped at 20 hours each month after launch, and defects are fixed free for six months.",
      "Tenants get an answer to a message within two working days.",
      "Maren Holt from finance approves the portal's invoices.",
    ],
  },
  {
    key: "bw-portal-q3", title: "Brightwater tenant portal spend review", date: "2026-07-02", project: "prj:bw-portal", attendees: ["per:sofia", "per:maren"],
    minutes: [
      "Maren went through the spend so far on the tenant portal.",
      "After the Q3 invoices, €31,500 remains for the rest of 2026.",
      "If the portal is unavailable, tenants call the repairs line and the on-call developer is paged.",
      "We agreed to move the retro to the end of the month.",
    ],
  },
  {
    key: "bw-repairs-kickoff", title: "Brightwater repairs app kickoff", date: "2025-08-20", project: "prj:bw-repairs", attendees: ["per:callum", "per:noor", "per:theo"],
    minutes: [
      "Callum Frey started the repairs app with Theo and two of Brightwater's repairs supervisors.",
      "The budget is €38,000 for the first release.",
      "The app goes live in January 2026.",
      "Noor Eskildsen designs the screens for the repairs team.",
      "Theo signs off every bill for the repairs app before it is paid.",
      "Support after launch is 10 hours a month.",
    ],
  },
  {
    key: "bw-repairs-signoff", title: "Brightwater repairs app sign-off", date: "2026-01-22", project: "prj:bw-repairs", attendees: ["per:callum", "per:noor", "per:theo"],
    minutes: [
      "The sign-off session covered the whole app: the job list for each operative, the photo upload that now works offline in basements and stairwells, the parts request form that goes straight to the stores team, the evening summary email for supervisors, and finally the warranty period on the repairs app, which was agreed at 18 months from go-live.",
      "Brightwater then went through the service levels for contract repairs again, covering emergency call-outs, routine jobs booked through the portal, damp and mould inspections, communal area lighting, door entry systems and lifts, and urgent repairs must get a response within 4 hours of the report.",
      "Noor will update the icons before the next release.",
    ],
  },
  {
    key: "orrin-planner-kickoff", title: "Orrin route planner kickoff", date: "2026-01-12", project: "prj:orrin-planner", attendees: ["per:ines", "per:rafael", "per:jonas"],
    minutes: [
      "Jonas Pike opened the kickoff for the route planner with Orrin's dispatch leads.",
      "The budget is €120,000 for the first phase.",
      "Six developers will work on it, led by Rafael Quint.",
      "The first phase covers seven depots; the rest follow in 2027.",
      "Orrin plans around 1,800 drops a day across those depots.",
      "Launch is planned for October 2026.",
    ],
  },
  {
    key: "orrin-planner-hosting", title: "Orrin route planner infrastructure review", date: "2026-03-02", project: "prj:orrin-planner", attendees: ["per:rafael", "per:jonas"], decisions: ["dec:orrin-planner-hosting"],
    minutes: [
      "Rafael presented the infrastructure options for the route planner, comparing a managed container platform, two dedicated server providers and the client's own data centre on cost, support, data location and how quickly each could scale for the Christmas peak, and after comparing them the team settled on a dedicated setup at Hetzner whose running cost comes to €640 a month.",
      "Jonas asked for a written summary of the options.",
    ],
  },
  {
    key: "orrin-driver-kickoff", title: "Orrin driver app kickoff", date: "2026-02-09", project: "prj:orrin-driver", attendees: ["per:rafael", "per:jonas"], decisions: ["dec:orrin-driver-hosting", "dec:orrin-driver-backups"],
    minutes: [
      "Jonas and Rafael scoped the driver app: the day's stops, proof of delivery photos and messages to dispatch.",
      "Three people will build it.",
      "It goes live in January 2027, after the route planner.",
      "The app runs on Fly.io for €210 a month.",
      "Nightly copies of the driver app data are kept in Frankfurt for 30 days.",
    ],
  },
  {
    key: "tamsin-shop-kickoff", title: "Tamsin online shop kickoff", date: "2026-01-20", project: "prj:tamsin-shop", attendees: ["per:callum", "per:lena"], decisions: ["dec:tamsin-payments"],
    minutes: [
      "Lena Marsh agreed the scope of the online shop with Callum: books, gift cards and café vouchers.",
      "The budget is €26,000.",
      "The shop opens in May 2026, in time for the spring book festival.",
      "We agreed €85 per hour for change requests on the online shop.",
      "Card payments go through Mollie.",
    ],
  },
  {
    key: "tamsin-events-kickoff", title: "Tamsin events calendar kickoff", date: "2025-12-08", project: "prj:tamsin-events", attendees: ["per:callum", "per:lena"],
    minutes: [
      "Callum and Lena planned the events calendar for readings, signings and children's events.",
      "The budget is €9,000.",
      "It must be ready by 20 March 2026 for the spring programme.",
    ],
  },
  {
    key: "tamsin-events-review", title: "Tamsin events calendar review", date: "2026-03-10", project: "prj:tamsin-events", attendees: ["per:callum", "per:lena"],
    minutes: [
      "Lena liked the month view but found the filters confusing; Callum will simplify them to three.",
      "The children's events get their own colour.",
    ],
  },
  {
    key: "velde-kickoff", title: "Velde members site kickoff", date: "2025-11-17", project: "prj:velde-site", attendees: ["per:ines"], decisions: ["dec:velde-app-dropped"],
    minutes: [
      "Ines went through the members site with the club committee: the rides calendar for the road and gravel sections, membership renewals with direct debit, the club kit shop, route downloads, a page per sponsor, the safety rules and the junior section, and after merging a few of the committee's requests the sitemap ends up at 23 pages.",
      "The site is in English and Dutch.",
      "The club called off the separate mobile app: the site works well on phones and an app would have doubled the cost.",
      "Launch is planned for March 2026.",
    ],
  },
  {
    key: "velde-review", title: "Velde members site review", date: "2026-04-14", project: "prj:velde-site", attendees: ["per:ines"],
    minutes: [
      "412 members registered on the new site in the first four weeks after launch.",
      "The committee wants a gallery for race photos next season.",
    ],
  },
  {
    key: "timetracker-kickoff", title: "Studio time tracker kickoff", date: "2026-02-02", project: "prj:timetracker", attendees: ["per:ines"],
    minutes: [
      "The studio set an internal allowance of €6,000 for the time tracker this year.",
      "Entries of a person who quits are kept for 12 months and then deleted.",
      "Hours are logged in 15-minute blocks.",
    ],
  },
];

export const DECISIONS = [
  { key: "dec:harlow-payments", title: "Use Stripe for payments on the Harlow web shop", meeting: "harlow-shop-kickoff", decision: "Use Stripe for card payments on the Harlow web shop.", context: "The delis already use Stripe in their tills." },
  { key: "dec:kestrel-app-payments", title: "Use Stripe for deposits in the Kestrel booking app", meeting: "kestrel-app-kickoff", decision: "Take deposits by card through Stripe in the Kestrel booking app.", context: "The developers already knew it from earlier work." },
  { key: "dec:kestrel-site-payments", title: "Use Mollie for deposits on the Kestrel booking site", meeting: "kestrel-site-kickoff", decision: "Take deposits with Mollie on the Kestrel booking site.", context: "Kestrel's website already uses Mollie." },
  { key: "dec:orrin-planner-hosting", title: "Use Hetzner for hosting the Orrin route planner", meeting: "orrin-planner-hosting", decision: "Run the Orrin route planner on a dedicated setup at Hetzner.", context: "It was the cheapest option that could scale for the Christmas peak." },
  { key: "dec:orrin-driver-hosting", title: "Use Fly.io for hosting the Orrin driver app", meeting: "orrin-driver-kickoff", decision: "Run the Orrin driver app on Fly.io.", context: "It needs the least maintenance for a small team." },
  { key: "dec:orrin-driver-backups", title: "Keep nightly copies of the Orrin driver app data in Frankfurt", meeting: "orrin-driver-kickoff", decision: "Keep nightly copies of the driver app data in Frankfurt for 30 days.", context: "It keeps the data in the EU." },
  { key: "dec:tamsin-payments", title: "Use Mollie for payments on the Tamsin online shop", meeting: "tamsin-shop-kickoff", decision: "Take card payments on the Tamsin online shop with Mollie.", context: "It was the cheapest option at the shop's volume." },
  { key: "dec:velde-app-dropped", title: "Drop the Velde members mobile app", meeting: "velde-kickoff", decision: "The club called off the separate mobile app.", context: "The members site works well on phones, and an app would have doubled the cost." },
];

// The folders a question is asked from (spec/retrieval.md §3). `scratch` has no `.brain`.
export const CALLERS = [
  { name: "scratch" },
  { name: "retail-area", area: "area:retainer" },
  { name: "public-area", area: "area:public" },
  { name: "bw-portal", project: "prj:bw-portal" },
  { name: "timetracker", project: "prj:timetracker" },
];
