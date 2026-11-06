// CC-140: the synthetic world of the 0.10.0 acceptance (a freelance design studio, synthetic names only).
// Every date is a whole number of days relative to `as_of` (negative = before it), so build-fixture.mjs can write the
// same world at any as_of and it never ages. `n` numbers each row within its kind; ids follow from it:
//   brain id  <prefix>-0a10<kk><nn>          e.g. prj-0a10b003
//   page id   0a10<kk>00-0000-4000-8000-0000000000<nn>
// with kk: d0 domain, a0 area, b0 project, c0 task, e0 meeting (its minutes source has the same nn), dc decision,
// f0 org, f1 person, db database. The planted problems are listed in ../planted.json; the comments here only point.

export const owner = "Robin Example";

export const domains = [
  { n: 1, title: "Studio", type: "Entrepreneurship", summary: "The design studio: client work and its own marketing.", created: -200 },
  { n: 2, title: "Personal", type: "Personal", summary: "Home and health.", created: -200 },
  { n: 3, title: "Teaching", type: "Professional", summary: "Workshops taught outside the studio.", created: -200 },
];

export const areas = [
  { n: 1, title: "Clients", domain: 1, summary: "Paid design work for the studio's clients.", created: -190 },
  { n: 2, title: "Marketing", domain: 1, summary: "The studio's own site, newsletter and talks.", created: -190 },
  { n: 3, title: "Finance", domain: null, summary: "Taxes, invoices and the studio's books.", created: -190 }, // planted: no Domain
  { n: 4, title: "Home", domain: 2, summary: "The flat and the garden.", created: -190 },
  { n: 5, title: "Health", domain: 2, summary: "Running and check-ups.", created: -190 },
  { n: 6, title: "Workshops", domain: 3, summary: "Typography workshops for the local art school.", created: -190 }, // planted: nothing active
];

export const orgs = [
  { n: 1, title: "Larkspur Bakery", summary: "Client; a neighbourhood bakery with two shops.", meeting: 1 },
  { n: 2, title: "Tidewell Logistics", summary: "Client; a regional courier company.", meeting: 2 },
  { n: 3, title: "Pinecrest Clinic", summary: "Client; a physiotherapy clinic.", meeting: 3 },
  { n: 4, title: "Quayside Books", summary: "Client; an independent bookshop.", meeting: 5 },
  { n: 5, title: "Mariner Gallery", summary: "Client; a small contemporary art gallery.", meeting: 8 },
];

export const people = [
  { n: 1, title: "Nadia Fernsby", org: 1, role: "Owner", meeting: 1 },
  { n: 2, title: "Tomas Quill", org: 2, role: "Marketing lead", meeting: 2 },
  { n: 3, title: "Ines Marlowe", org: 3, role: "Practice manager", meeting: 3 },
  { n: 4, title: "Owen Halberd", org: 4, role: "Owner", meeting: 5 },
  { n: 5, title: "Greta Vos", org: 5, role: "Curator", meeting: 8 },
];

// status: Planned · Active · On Hold · Done. updated: the project note's last content change.
export const projects = [
  { n: 1, title: "Larkspur Bakery website", area: 1, client: 1, people: [1], status: "Active", priority: "High", created: -80, updated: -6, why: "The bakery wants online orders for celebration cakes." },
  { n: 2, title: "Tidewell Logistics brand refresh", area: 1, client: 2, people: [2], status: "Active", priority: "High", created: -60, updated: -9, why: "A new logo and brand guidelines before the van fleet is repainted." },
  { n: 3, title: "Pinecrest Clinic signage", area: 1, client: 3, people: [3], status: "Active", priority: "Medium", created: -70, updated: -60, why: "Wayfinding signs for the clinic's new floor." }, // planted: stalled
  { n: 4, title: "Studio newsletter", area: 1, client: null, people: [], status: "Active", priority: "Medium", created: -40, updated: -12, why: "A monthly newsletter that keeps past clients in touch." }, // planted: wrong Area (its notes are Marketing)
  { n: 5, title: "Quayside Books catalogue", area: 1, client: 4, people: [4], status: "Active", priority: "Medium", created: -30, updated: -7, why: "The bookshop's printed spring catalogue." }, // planted: duplicate of 6
  { n: 6, title: "Quayside Books catalog redesign", area: 1, client: 4, people: [4], status: "Active", priority: "Low", created: -14, updated: -6, why: "A new layout for the bookshop's catalogue." }, // planted: duplicate of 5
  { n: 7, title: "Larkspur Bakery packaging", area: 1, client: 1, people: [1], status: "Active", priority: "Medium", created: -50, updated: -3, why: "Cake boxes and labels with the bakery's new look." }, // planted: every task done
  { n: 8, title: "Mariner Gallery invitations", area: 1, client: 5, people: [5], status: "Done", priority: "Low", created: -100, updated: -45, why: "Printed invitations for the autumn opening." },
  { n: 9, title: "Portfolio site update", area: 2, client: null, people: [], status: "Active", priority: "Medium", created: -45, updated: -5, why: "Show this year's client work on the studio site." },
  { n: 10, title: "Conference talk proposal", area: 2, client: null, people: [], status: "Active", priority: "Low", created: -20, updated: -4, why: "A talk on small-business branding for next spring's design conference." }, // planted: no next step
  { n: 11, title: "Quarterly tax filing", area: 3, client: null, people: [], status: "Active", priority: "High", created: -40, updated: -18, why: "The studio's fourth-quarter VAT return." },
  { n: 12, title: "Kitchen renovation", area: 4, client: null, people: [], status: "Active", priority: "Medium", created: -50, updated: -10, why: "New cabinets and tiles in the kitchen." },
  { n: 13, title: "Garden shed", area: 4, client: null, people: [], status: "On Hold", priority: "Low", created: -120, updated: -50, why: "A small shed for the bikes, paused until spring." },
  { n: 14, title: "Half marathon training", area: 5, client: null, people: [], status: "Active", priority: "Medium", created: -60, updated: -3, why: "Train for the city half marathon in March." },
  { n: 15, title: "Spring typography workshop", area: 6, client: null, people: [], status: "Done", priority: "Medium", created: -150, updated: -60, why: "A two-day workshop on type for the art school." },
  { n: 16, title: "Bookkeeping system", area: 3, client: null, people: [], status: "Planned", priority: "Low", created: -10, updated: -10, why: "Move the studio's books to an accounting app next year." },
];

// status: To Do · Doing · Waiting On · Done · Won't Do. edited: last edit (for Done, when it was done). due: or null.
// area: the task's own Area relation (a task with a project has its project's Area).
export const tasks = [
  { n: 1, title: "Write the About page copy", project: 1, status: "To Do", edited: -20, due: null }, // planted: stalled
  { n: 2, title: "Build the menu page", project: 1, status: "Doing", edited: -2, due: 5 },
  { n: 3, title: "Set up hosting", project: 1, status: "Done", edited: -6, due: null },
  { n: 4, title: "Choose a colour palette", project: 1, status: "Done", edited: -15, due: null },
  { n: 5, title: "Send the logo proposals", project: 2, status: "To Do", edited: -2, due: -5 }, // planted: overdue
  { n: 6, title: "Draft the brand guidelines", project: 2, status: "Doing", edited: -4, due: 10 },
  { n: 7, title: "Run the brand workshop", project: 2, status: "Done", edited: -9, due: null },
  { n: 8, title: "Collect the sign measurements", project: 3, status: "To Do", edited: -10, due: 14 },
  { n: 9, title: "Sketch the sign concepts", project: 3, status: "Done", edited: -40, due: null },
  { n: 10, title: "Write the December issue", project: 4, status: "Doing", edited: -3, due: 8 },
  { n: 11, title: "Pick a newsletter tool", project: 4, status: "Done", edited: -12, due: null },
  { n: 12, title: "Photograph the new titles", project: 5, status: "To Do", edited: -5, due: 12 },
  { n: 13, title: "Gather the book descriptions", project: 5, status: "Done", edited: -7, due: null },
  { n: 14, title: "Lay out the catalog grid", project: 6, status: "Doing", edited: -1, due: 9 },
  { n: 15, title: "Design the box label", project: 7, status: "Done", edited: -2, due: null },
  { n: 16, title: "Order sample boxes", project: 7, status: "Done", edited: -8, due: null },
  { n: 17, title: "Approve the print proof", project: 7, status: "Done", edited: -3, due: null },
  { n: 18, title: "Print the invitations", project: 8, status: "Done", edited: -45, due: null },
  { n: 19, title: "Update the case studies", project: 9, status: "Doing", edited: -1, due: -10 }, // planted: overdue
  { n: 20, title: "Add the Tidewell project page", project: 9, status: "To Do", edited: -13, due: 6 }, // healthy: 13 days is under 14
  { n: 21, title: "Refresh the homepage photo", project: 9, status: "Done", edited: -5, due: null },
  { n: 22, title: "Collect the receipts for Q4", project: 11, status: "To Do", edited: -6, due: -2 }, // healthy: 2 days late is under 3
  { n: 23, title: "Reconcile the bank account", project: 11, status: "Done", edited: -20, due: null }, // healthy: done 20 days ago is under 21
  { n: 24, title: "Get a quote from the tiler", project: 12, status: "Waiting On", edited: -20, due: -5 }, // planted: Waiting, not flagged
  { n: 25, title: "Choose the cabinet handles", project: 12, status: "To Do", edited: -3, due: 0 }, // healthy: due today
  { n: 26, title: "Measure the kitchen", project: 12, status: "Done", edited: -10, due: null },
  { n: 27, title: "Order the timber", project: 13, status: "Won't Do", edited: -50, due: null },
  { n: 28, title: "Buy new running shoes", project: 14, status: "Doing", edited: -31, due: null }, // planted: stalled
  { n: 29, title: "Run 15 km", project: 14, status: "Done", edited: -3, due: null },
  { n: 30, title: "Book the race entry", project: 14, status: "To Do", edited: -2, due: 20 },
  { n: 31, title: "Send the feedback forms", project: 15, status: "Done", edited: -60, due: null },
  { n: 32, title: "Book the room", project: 15, status: "Done", edited: -90, due: null },
  { n: 33, title: "Renew the studio domain name", project: null, area: 3, status: "To Do", edited: -2, due: 3 }, // planted: no project
  { n: 34, title: "Book a dentist appointment", project: null, area: 5, status: "To Do", edited: -1, due: null }, // planted: no project
  { n: 35, title: "File the old invoices", project: null, area: 3, status: "Done", edited: -30, due: null },
];

// Each meeting has its Notion minutes as a source (same nn). area and project are the meeting's own.
export const meetings = [
  { n: 1, title: "Larkspur website check-in", date: -6, area: 1, project: 1, attendees: [1], summary: "Menu page in progress; hosting is live.", minutes: ["Hosting is set up.", "Menu page due next week."] },
  { n: 2, title: "Tidewell brand workshop", date: -9, area: 1, project: 2, attendees: [2], summary: "Workshop held; logo proposals to follow.", minutes: ["Brand values agreed with the team.", "Logo proposals to be sent."] },
  { n: 3, title: "Pinecrest signage kickoff", date: -35, area: 1, project: 3, attendees: [3], summary: "Scope agreed: six signs for the new floor.", minutes: ["Six signs for the new floor.", "Measurements to be collected on site."] },
  { n: 4, title: "Newsletter planning", date: -12, area: 2, project: 4, attendees: [], summary: "Monthly newsletter agreed; tool chosen.", minutes: ["The newsletter goes out monthly.", "A tool was picked."], decisions: [1] },
  { n: 5, title: "Quayside catalogue brief", date: -7, area: 1, project: 5, attendees: [4], summary: "Spring catalogue brief: forty titles, printed.", minutes: ["Forty titles in the spring catalogue.", "Photos of the new titles needed."] },
  { n: 6, title: "Quayside catalog layout review", date: -6, area: 1, project: 6, attendees: [4], summary: "A new grid layout for the catalogue.", minutes: ["The catalogue gets a new grid layout."] },
  { n: 7, title: "Larkspur packaging proof review", date: -3, area: 1, project: 7, attendees: [1], summary: "Print proof approved; boxes ordered.", minutes: ["The print proof is approved.", "Sample boxes arrived."] },
  { n: 8, title: "Mariner invitations wrap-up", date: -45, area: 1, project: 8, attendees: [5], summary: "Invitations printed and sent.", minutes: ["The invitations were printed and posted."] },
  { n: 9, title: "Portfolio review", date: -5, area: 2, project: 9, attendees: [], summary: "Case studies to update; new homepage photo.", minutes: ["Two case studies are out of date.", "The homepage photo was replaced."] },
  { n: 10, title: "Conference talk brainstorm", date: -4, area: 2, project: 10, attendees: [], summary: "Three possible angles for the talk.", minutes: ["Three angles for the talk on small-business branding."] },
  { n: 11, title: "Call with the accountant", date: -18, area: 3, project: 11, attendees: [], summary: "Receipts needed for the Q4 return.", minutes: ["Receipts for Q4 are needed before the filing."] },
  { n: 12, title: "Kitchen planning with the tiler", date: -10, area: 4, project: 12, attendees: [], summary: "Kitchen measured; the tiler will send a quote.", minutes: ["The kitchen was measured.", "The tiler will send a quote."] },
  { n: 13, title: "Spring workshop debrief", date: -60, area: 6, project: 15, attendees: [], summary: "Workshop went well; feedback forms sent.", minutes: ["Twelve students attended.", "Feedback forms were sent."] },
  { n: 14, title: "Newsletter tool demo", date: -20, area: 2, project: 4, attendees: [], summary: "Two newsletter tools compared.", minutes: ["Two tools were compared for the newsletter."] },
];

export const decisions = [
  { n: 1, title: "Send the newsletter monthly", meeting: 4, area: 2, project: 4, summary: "The studio newsletter goes out once a month.", body: "The studio newsletter goes out on the first Tuesday of each month." },
];
