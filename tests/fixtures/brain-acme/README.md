# brain-acme (test fixture)

A small synthetic brain used by the CLI tests (task CX-09). All people, companies and data are fictional.

It covers every v1 note type, both meeting-linked decisions (one superseded), fact timelines with superseded entries, applied and pending proposals, and both project views. `index.md` and the views are the expected output of `brain index` and `brain views` for these notes; `brain lint` should report no errors.
