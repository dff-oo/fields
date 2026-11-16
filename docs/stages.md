# Battle stages

Stage names are community descriptions, not client data. They are kept with the resource extractor and copied into `resources/stages.json` for the map builder.

Each id loads the client model `S<id>Model` (zero-padded to three digits). Ids 0-180 exist in the archive except 99. Fill in `name` after checking a stage in game. `notes` is for anything still uncertain.

Confirmed so far: 1 Prairie, 2 Forest, 3 Cavern. 4 is likely a ruined temple. 5 and one of 6 or 7 are snow. 0 and 33 have extra collision files and may not be battle stages.
