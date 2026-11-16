# Battle stages

Stage ids come from the client: the resources repo lists every `S<id>Model` the global client ships, as `{ id, model }` with no name. The client has no stage names, so the ones that have been checked live in [src/stage-names.json](../src/stage-names.json). The builder merges that file over the extracted list. A stage with no entry shows as "Stage <id>".

Each id loads the client model `S<id>Model` (zero-padded to three digits). Ids 0-180 exist except 99. Add a row to `stage-names.json` after checking a stage in game, with `confirmed: true` once it is certain and `false` while it is still a guess. The picker marks guesses with a question mark. `notes` is for anything still uncertain.

Confirmed so far: 1 Prairie, 2 Forest, 3 Cavern. 4 is likely a ruined temple. 5 and one of 6 or 7 are snow. 0 and 33 have extra collision files and may not be battle stages.
