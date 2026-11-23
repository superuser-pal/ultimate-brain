Catch-up (unattended) took in 10 of the 12 files in the drop folder. Two are left for the next run, and nothing was published or pushed.

- **Drop folder:** `/tmp/ub-eval-0.7.0/budget-drop` held `note-01.md` to `note-12.md`. The unattended limit is 10 inputs per run (`settings.unattended.max_inputs`), so I took the 10 oldest and moved them to `processed/`. `note-11.md` and `note-12.md` are still in the queue.
- **What was written:** 10 source notes, one per file (`sources/files/…supplier-note-N-document.md`), each with a summary and digest.
- **What was not written:** no notes, proposals or tasks. Each file only says that Maria López (Acme) asked for update N on the website content plan and that Carlos Ruiz will reply by a date, and Carlos Ruiz isn't the brain owner. The sources carry no project link, since nothing said which project they belong to.
- **Not done:** with no Notion and no remote, there was nothing to sync, publish or push. There were no linked repos or other inputs. 3 proposals were already pending and are left for your next session.
- **Checks:** `brain lint` reported 0 errors and 0 warnings. It also showed an info note that the skills aren't pinned (`brain upgrade` pins them). The ingest is committed, and the run's log line is in its own commit.
- **Next action:** run catch-up again to take in `note-11.md` and `note-12.md`.
- **Log lines to fix:** the `catch-up` line recorded `seconds=300` as an estimate, not a measured time. I used `-` where `brain log` wants an id, and the line was stored with an empty target (`catch-up - ""`). The ingest line is attached to the first source's id, `src-64b27q5v`, because the log needs a real note id.
