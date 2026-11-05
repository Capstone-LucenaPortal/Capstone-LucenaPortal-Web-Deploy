# Hand-offs

Each file is a prompt to paste into a new session. `todo/` holds the ones not run yet; `done/` the ones carried out. When a session finishes a hand-off, `git mv` it from `todo/` to `done/`, update every path that points at it (`git grep handoffs/`), and add its line below.

## To do, in this order

| Hand-off | What it is | Note |
|---|---|---|

## Done

| Hand-off | What it was | Result |
|---|---|---|
