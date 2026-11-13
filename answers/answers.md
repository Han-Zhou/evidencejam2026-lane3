# Lane 3 barebones answers

Built by `make_answers.py` (rule `lane3-barebones-1`). Every grade carries its rationale in the JSON.

## For tree planting in Canadian forest restoration, how do planting-stock traits (seedling size, nursery fertilization, mycorrhizal inoculation) affect survival and growth, and how do competing vegetation and site preparation change that?

*Claims whose effect is the survival or growth of tree seedlings or saplings, outside grassland, marsh and cropland settings, whose cause matches a planting-stock trait or a site factor (see Q1_TRAITS and Q1_MODIFIERS in make_answers.py). Mortality outcomes are read as survival with the sign flipped. Combined treatments and 'moderates' claims are listed under interactions, not pooled.*

| Subject | Outcome | Direction | Certainty | Studies | Claims |
| --- | --- | --- | --- | --- | --- |
| Site preparation | Seedling growth & size | mixed | high | 11 | 68 |
| Fertilization at planting | Seedling growth & size | increase | high | 7 | 38 |
| Competing vegetation (more of it) | Seedling growth & size | mixed | low | 6 | 16 |
| Vegetation control & release | Seedling growth & size | increase | high | 6 | 43 |
| Fertilization at planting | Seedling survival | mixed | moderate | 4 | 8 |
| Site preparation | Seedling survival | mixed | high | 4 | 12 |
| Competing vegetation (more of it) | Seedling survival | decrease | high | 3 | 4 |
| Mycorrhizal or soil inoculation | Seedling growth & size | mixed | moderate | 3 | 27 |
| Mycorrhizal or soil inoculation | Seedling survival | mixed | moderate | 2 | 4 |
| Nursery fertilization (nutrient loading) | Seedling growth & size | mixed | low | 2 | 6 |
| Seedling size & stock type | Seedling growth & size | increase | high | 2 | 5 |
| Vegetation control & release | Seedling survival | mixed | low | 2 | 2 |
| Seedling size & stock type | Seedling survival | increase | low | 1 | 1 |

**No evidence (1):** Nursery fertilization (nutrient loading) x Seedling survival

**Limits:**

- Matching is by keyword over node labels: a seedling-size claim worded unusually is missed, and a few natural (unplanted) seedlings are included where the paper does not say they were planted.
- Nursery fertilization and fertilization at planting are different practices; the question names the first, but most of the corpus is about the second. They are kept apart.
- 'Competing vegetation (more of it)' and 'Vegetation control & release' describe the same factor from opposite ends. They are kept apart rather than flipping one, so each claim keeps its own wording.
- Growth pools height, diameter and biomass. A treatment can raise one and not another; open the claims.

## How long do created marshes take to reach biodiversity and function comparable to natural reference wetlands, and which attributes lag?

*Claims from marsh, prairie-pothole, salt-marsh and constructed-wetland papers (ecosystem context plus a wetland word in the title). A claim is a comparison when its comparator is an undisturbed reference or its cause names the natural or reference site; its direction is turned into 'above_reference', 'comparable' or 'below_reference' for the created marsh. A claim whose cause is site age or time since restoration is a trajectory. Outcomes are pooled by outcome group.*

**Time to reach reference:** No study in this corpus reports how long a created marsh takes to match a reference. The few time points come from chronosequences of restored prairie wetlands and are listed with each finding.

**Lagging attributes:** Growth, size & biomass, Plant & vegetation cover, Species richness & diversity, Survival & mortality

| Subject | Outcome | Direction | Certainty | Studies | Claims |
| --- | --- | --- | --- | --- | --- |
| Created or restored marsh vs natural reference | Growth, size & biomass | below_reference | high | 3 | 6 |
| Created or restored marsh vs natural reference | Species richness & diversity | below_reference | moderate | 3 | 4 |
| Created or restored marsh vs natural reference | Abundance & density (plants & other) | above_reference | very low | 1 | 1 |
| Created or restored marsh vs natural reference | Animal abundance & occurrence | mixed | very low | 1 | 5 |
| Created or restored marsh vs natural reference | Community composition & similarity | unclear | very low | 1 | 1 |
| Created or restored marsh vs natural reference | Plant & vegetation cover | below_reference | very low | 1 | 1 |
| Created or restored marsh vs natural reference | Reproduction & breeding success | above_reference | very low | 1 | 2 |
| Created or restored marsh vs natural reference | Survival & mortality | below_reference | low | 1 | 1 |
| Time since creation or restoration | Community composition & similarity | no_effect | moderate | 3 | 4 |
| Time since creation or restoration | Invasive / non-native species abundance | no_effect | very low | 1 | 1 |
| Time since creation or restoration | Species richness & diversity | no_effect | very low | 1 | 1 |

**No evidence (8):** Created or restored marsh vs natural reference x Behaviour, habitat use & interactions; Created or restored marsh vs natural reference x Contaminants & toxicity; Created or restored marsh vs natural reference x Ecosystem fluxes & processes; Created or restored marsh vs natural reference x Establishment, germination & recruitment; Created or restored marsh vs natural reference x Hydrology, erosion & geomorphology; Created or restored marsh vs natural reference x Invasive / non-native species abundance; Created or restored marsh vs natural reference x Soil physical properties & microclimate; Created or restored marsh vs natural reference x Soil, water & tissue chemistry

**Limits:**

- Thin evidence: 5 papers in all, most of them observational.
- 'Restored' and 'created' marshes are pooled; the corpus rarely says which, and drained-then-restored prairie potholes dominate.
- A reference comparison at one age says nothing about the trajectory; do not read a lag at 4-6 years as a lag at 20.
- Side reading is by keyword ('natural', 'reference' vs 'restored', 'reclaimed'): open the claims.

## For grassland restoration in Canada, which intervention-outcome combinations have little or no evidence, and where is the graph densest?

*Claims whose ecosystem context is a grassland, prairie, steppe or old-field type, pooled into the 24 intervention groups x 16 outcome groups of groups/lane3_groups.yaml. A claim whose cause is in two intervention groups counts in both. Density: thin = 1 study, some = 2-3, dense = 4 or more.*

123 of 384 cells have evidence (72 from a single study); 261 are empty.

| Subject | Outcome | Direction | Certainty | Studies | Claims |
| --- | --- | --- | --- | --- | --- |
| Herbicide & chemical vegetation control | Plant & vegetation cover | mixed | high | 9 | 42 |
| Seeding / sowing | Plant & vegetation cover | mixed | moderate | 9 | 54 |
| Seeding / sowing | Species richness & diversity | mixed | moderate | 8 | 19 |
| Herbicide & chemical vegetation control | Invasive / non-native species abundance | mixed | moderate | 5 | 16 |
| Herbicide & chemical vegetation control | Species richness & diversity | mixed | moderate | 5 | 17 |
| Vegetation control (mowing, cutting, release) | Invasive / non-native species abundance | mixed | moderate | 5 | 11 |
| Vegetation control (mowing, cutting, release) | Species richness & diversity | mixed | moderate | 5 | 6 |
| Mulch & surface cover | Growth, size & biomass | mixed | moderate | 5 | 18 |
| Mulch & surface cover | Plant & vegetation cover | mixed | moderate | 5 | 22 |
| Organic & biosolid amendments | Soil, water & tissue chemistry | mixed | moderate | 5 | 25 |
| Seeding / sowing | Abundance & density (plants & other) | increase | high | 5 | 6 |
| Prescribed burning | Plant & vegetation cover | mixed | moderate | 4 | 15 |
| Vegetation control (mowing, cutting, release) | Growth, size & biomass | mixed | moderate | 4 | 9 |
| Vegetation control (mowing, cutting, release) | Plant & vegetation cover | mixed | moderate | 4 | 16 |
| Mulch & surface cover | Establishment, germination & recruitment | mixed | moderate | 4 | 9 |
| Mulch & surface cover | Soil, water & tissue chemistry | increase | high | 4 | 13 |
| Mulch & surface cover | Survival & mortality | mixed | moderate | 4 | 9 |
| Organic & biosolid amendments | Plant & vegetation cover | mixed | moderate | 4 | 10 |
| Fertilization & nutrient addition | Plant & vegetation cover | mixed | moderate | 3 | 10 |
| Herbicide & chemical vegetation control | Abundance & density (plants & other) | increase | high | 3 | 3 |
| Herbicide & chemical vegetation control | Establishment, germination & recruitment | no_effect | high | 3 | 10 |
| Herbicide & chemical vegetation control | Survival & mortality | increase | high | 3 | 11 |
| Vegetation control (mowing, cutting, release) | Reproduction & breeding success | decrease | high | 3 | 3 |
| Mulch & surface cover | Soil physical properties & microclimate | increase | high | 3 | 7 |
| Organic & biosolid amendments | Growth, size & biomass | mixed | moderate | 3 | 15 |
| Planting & transplanting | Growth, size & biomass | mixed | low | 3 | 4 |
| Planting & transplanting | Species richness & diversity | mixed | low | 3 | 4 |
| Topsoil, forest floor & inoculum transfer | Growth, size & biomass | mixed | moderate | 3 | 6 |
| Prescribed burning | Invasive / non-native species abundance | decrease | moderate | 2 | 4 |
| Fertilization & nutrient addition | Abundance & density (plants & other) | mixed | moderate | 2 | 4 |
| Fertilization & nutrient addition | Growth, size & biomass | mixed | moderate | 2 | 6 |
| Fertilization & nutrient addition | Invasive / non-native species abundance | mixed | moderate | 2 | 4 |
| Fertilization & nutrient addition | Soil, water & tissue chemistry | mixed | moderate | 2 | 3 |
| Herbicide & chemical vegetation control | Animal abundance & occurrence | mixed | high | 2 | 5 |
| Herbicide & chemical vegetation control | Growth, size & biomass | mixed | moderate | 2 | 2 |
| Herbicide & chemical vegetation control | Reproduction & breeding success | decrease | high | 2 | 6 |
| Herbivore exclusion (fencing, shelters) | Growth, size & biomass | increase | high | 2 | 24 |
| Herbivore exclusion (fencing, shelters) | Species richness & diversity | mixed | low | 2 | 3 |
| Vegetation control (mowing, cutting, release) | Animal abundance & occurrence | mixed | low | 2 | 3 |
| Vegetation control (mowing, cutting, release) | Community composition & similarity | no_effect | high | 2 | 2 |
| Vegetation control (mowing, cutting, release) | Soil physical properties & microclimate | increase | high | 2 | 5 |
| Mulch & surface cover | Abundance & density (plants & other) | mixed | moderate | 2 | 4 |
| Mulch & surface cover | Animal abundance & occurrence | decrease | moderate | 2 | 2 |
| Planting & transplanting | Plant & vegetation cover | mixed | low | 2 | 6 |
| Planting & transplanting | Survival & mortality | increase | moderate | 2 | 10 |
| Seeding / sowing | Establishment, germination & recruitment | increase | moderate | 2 | 12 |
| Seeding / sowing | Invasive / non-native species abundance | no_effect | high | 2 | 2 |
| Seeding / sowing | Soil, water & tissue chemistry | increase | moderate | 2 | 2 |
| Seeding / sowing | Survival & mortality | increase | moderate | 2 | 2 |
| Site & soil preparation | Establishment, germination & recruitment | mixed | low | 2 | 2 |
| Topsoil, forest floor & inoculum transfer | Soil, water & tissue chemistry | mixed | moderate | 2 | 6 |
| Prescribed burning | Abundance & density (plants & other) | increase | low | 1 | 1 |
| Prescribed burning | Growth, size & biomass | decrease | low | 1 | 1 |
| Prescribed burning | Reproduction & breeding success | decrease | low | 1 | 1 |
| Fertilization & nutrient addition | Establishment, germination & recruitment | no_effect | moderate | 1 | 1 |
| Fertilization & nutrient addition | Species richness & diversity | no_effect | moderate | 1 | 3 |
| Herbicide & chemical vegetation control | Soil physical properties & microclimate | increase | moderate | 1 | 3 |
| Herbicide & chemical vegetation control | Soil, water & tissue chemistry | mixed | low | 1 | 2 |
| Herbivore exclusion (fencing, shelters) | Abundance & density (plants & other) | increase | moderate | 1 | 1 |
| Herbivore exclusion (fencing, shelters) | Establishment, germination & recruitment | no_effect | moderate | 1 | 1 |
| Herbivore exclusion (fencing, shelters) | Invasive / non-native species abundance | mixed | low | 1 | 6 |
| Herbivore exclusion (fencing, shelters) | Soil physical properties & microclimate | no_effect | moderate | 1 | 2 |
| Herbivore exclusion (fencing, shelters) | Soil, water & tissue chemistry | increase | moderate | 1 | 4 |
| Invasive / unwanted plant removal | Reproduction & breeding success | no_effect | very low | 1 | 2 |
| Invasive / unwanted plant removal | Survival & mortality | no_effect | very low | 1 | 1 |
| Irrigation & watering | Establishment, germination & recruitment | increase | moderate | 1 | 5 |
| Irrigation & watering | Soil, water & tissue chemistry | increase | low | 1 | 1 |
| Liming & pH amendment | Establishment, germination & recruitment | increase | low | 1 | 1 |
| Liming & pH amendment | Growth, size & biomass | no_effect | moderate | 1 | 7 |
| Liming & pH amendment | Invasive / non-native species abundance | decrease | moderate | 1 | 3 |
| Liming & pH amendment | Plant & vegetation cover | increase | moderate | 1 | 2 |
| Liming & pH amendment | Soil, water & tissue chemistry | increase | moderate | 1 | 2 |
| Vegetation control (mowing, cutting, release) | Abundance & density (plants & other) | increase | very low | 1 | 1 |
| Vegetation control (mowing, cutting, release) | Establishment, germination & recruitment | no_effect | moderate | 1 | 2 |
| Vegetation control (mowing, cutting, release) | Hydrology, erosion & geomorphology | decrease | very low | 1 | 1 |
| Vegetation control (mowing, cutting, release) | Soil, water & tissue chemistry | mixed | low | 1 | 2 |
| Vegetation control (mowing, cutting, release) | Survival & mortality | increase | moderate | 1 | 3 |
| Mulch & surface cover | Community composition & similarity | increase | low | 1 | 1 |
| Mulch & surface cover | Invasive / non-native species abundance | decrease | moderate | 1 | 3 |
| Mulch & surface cover | Species richness & diversity | mixed | low | 1 | 4 |
| Organic & biosolid amendments | Abundance & density (plants & other) | decrease | moderate | 1 | 5 |
| Organic & biosolid amendments | Establishment, germination & recruitment | increase | moderate | 1 | 2 |
| Organic & biosolid amendments | Reproduction & breeding success | no_effect | moderate | 1 | 2 |
| Organic & biosolid amendments | Survival & mortality | mixed | very low | 1 | 2 |
| Planting & transplanting | Abundance & density (plants & other) | increase | moderate | 1 | 2 |
| Planting & transplanting | Animal abundance & occurrence | increase | low | 1 | 1 |
| Planting & transplanting | Ecosystem fluxes & processes | increase | moderate | 1 | 3 |
| Planting & transplanting | Establishment, germination & recruitment | decrease | very low | 1 | 1 |
| Planting & transplanting | Reproduction & breeding success | mixed | very low | 1 | 3 |
| Planting & transplanting | Soil, water & tissue chemistry | decrease | moderate | 1 | 4 |
| Mine & industrial reclamation (multi-component) | Abundance & density (plants & other) | unclear | low | 1 | 1 |
| Mine & industrial reclamation (multi-component) | Invasive / non-native species abundance | increase | low | 1 | 2 |
| Species reintroduction, translocation & stocking | Abundance & density (plants & other) | increase | low | 1 | 1 |
| Species reintroduction, translocation & stocking | Growth, size & biomass | mixed | very low | 1 | 2 |
| Species reintroduction, translocation & stocking | Invasive / non-native species abundance | decrease | low | 1 | 4 |
| Species reintroduction, translocation & stocking | Reproduction & breeding success | increase | low | 1 | 6 |
| Species reintroduction, translocation & stocking | Species richness & diversity | no_effect | low | 1 | 1 |
| Species reintroduction, translocation & stocking | Survival & mortality | mixed | very low | 1 | 2 |
| Restoration (general or multi-component) | Community composition & similarity | unclear | very low | 1 | 1 |
| Restoration (general or multi-component) | Growth, size & biomass | mixed | very low | 1 | 4 |
| Restoration (general or multi-component) | Invasive / non-native species abundance | unclear | very low | 1 | 1 |
| Restoration (general or multi-component) | Species richness & diversity | increase | low | 1 | 6 |
| Restoration (general or multi-component) | Soil, water & tissue chemistry | increase | very low | 1 | 4 |
| Seeding / sowing | Community composition & similarity | mixed | very low | 1 | 8 |
| Seeding / sowing | Growth, size & biomass | no_effect | very low | 1 | 3 |
| Seeding / sowing | Soil physical properties & microclimate | decrease | moderate | 1 | 4 |
| Smoke & ash treatments | Abundance & density (plants & other) | increase | moderate | 1 | 8 |
| Smoke & ash treatments | Animal abundance & occurrence | increase | moderate | 1 | 3 |
| Smoke & ash treatments | Community composition & similarity | increase | moderate | 1 | 4 |
| Smoke & ash treatments | Establishment, germination & recruitment | increase | moderate | 1 | 24 |
| Smoke & ash treatments | Invasive / non-native species abundance | no_effect | moderate | 1 | 1 |
| Smoke & ash treatments | Species richness & diversity | increase | moderate | 1 | 12 |
| Site & soil preparation | Invasive / non-native species abundance | no_effect | low | 1 | 1 |
| Site & soil preparation | Plant & vegetation cover | no_effect | low | 1 | 2 |
| Site & soil preparation | Soil physical properties & microclimate | increase | moderate | 1 | 1 |
| Site & soil preparation | Soil, water & tissue chemistry | increase | moderate | 1 | 1 |
| Structures, wood placement & erosion control | Establishment, germination & recruitment | increase | very low | 1 | 2 |
| Structures, wood placement & erosion control | Soil physical properties & microclimate | decrease | moderate | 1 | 2 |
| Topsoil, forest floor & inoculum transfer | Abundance & density (plants & other) | increase | moderate | 1 | 1 |
| Topsoil, forest floor & inoculum transfer | Animal abundance & occurrence | increase | low | 1 | 1 |
| Topsoil, forest floor & inoculum transfer | Community composition & similarity | unclear | low | 1 | 1 |
| Topsoil, forest floor & inoculum transfer | Ecosystem fluxes & processes | increase | moderate | 1 | 3 |
| Topsoil, forest floor & inoculum transfer | Plant & vegetation cover | increase | moderate | 1 | 1 |

**No evidence (261):** Seeding / sowing x Contaminants & toxicity; Seeding / sowing x Ecosystem fluxes & processes; Seeding / sowing x Reproduction & breeding success; Seeding / sowing x Animal abundance & occurrence; Seeding / sowing x Hydrology, erosion & geomorphology; Seeding / sowing x Behaviour, habitat use & interactions; Planting & transplanting x Invasive / non-native species abundance; Planting & transplanting x Contaminants & toxicity; Planting & transplanting x Community composition & similarity; Planting & transplanting x Soil physical properties & microclimate; Planting & transplanting x Hydrology, erosion & geomorphology; Planting & transplanting x Behaviour, habitat use & interactions; Invasive / unwanted plant removal x Invasive / non-native species abundance; Invasive / unwanted plant removal x Contaminants & toxicity; Invasive / unwanted plant removal x Ecosystem fluxes & processes; Invasive / unwanted plant removal x Species richness & diversity; Invasive / unwanted plant removal x Community composition & similarity; Invasive / unwanted plant removal x Establishment, germination & recruitment; Invasive / unwanted plant removal x Plant & vegetation cover; Invasive / unwanted plant removal x Animal abundance & occurrence; Invasive / unwanted plant removal x Soil, water & tissue chemistry; Invasive / unwanted plant removal x Soil physical properties & microclimate; Invasive / unwanted plant removal x Hydrology, erosion & geomorphology; Invasive / unwanted plant removal x Growth, size & biomass; Invasive / unwanted plant removal x Abundance & density (plants & other); Invasive / unwanted plant removal x Behaviour, habitat use & interactions; Herbicide & chemical vegetation control x Contaminants & toxicity; Herbicide & chemical vegetation control x Ecosystem fluxes & processes; Herbicide & chemical vegetation control x Community composition & similarity; Herbicide & chemical vegetation control x Hydrology, erosion & geomorphology; Herbicide & chemical vegetation control x Behaviour, habitat use & interactions; Prescribed burning x Contaminants & toxicity; Prescribed burning x Ecosystem fluxes & processes; Prescribed burning x Species richness & diversity; Prescribed burning x Community composition & similarity; Prescribed burning x Survival & mortality; Prescribed burning x Establishment, germination & recruitment; Prescribed burning x Animal abundance & occurrence; Prescribed burning x Soil, water & tissue chemistry; Prescribed burning x Soil physical properties & microclimate ...

**Limits:**

- Grassland is read from each claim's ecosystem_context. A grassland paper whose claims were tagged otherwise is missed.
- 287 of 950 grassland claims fall outside the groups and are not in the map.
- An empty cell means no paper in this corpus tested that pairing. It is not a negative result.
- Study counts measure research effort, not effect size. A dense cell can still be mixed.
## Q1 as a graph (`q1_tree_planting_graph.json`)

*Q1's findings as a directed graph. Effect edges from planting-stock traits and site treatments to seedling survival and growth are exactly the findings in q1_tree_planting.json. Added: edges from treatments to the conditions they change (competing vegetation, seedling nutrient status, soil and microsite), edges from those conditions to the seedling, combined treatments as combination nodes, and 'moderates' claims as edges whose target is another edge. Every edge is pooled and graded like a finding.*

Nodes: Mycorrhizal or soil inoculation (planting stock); Seedling size & stock type (planting stock); Nursery fertilization (nutrient loading) (planting stock); Fertilization at planting (planting stock); Vegetation control & release (site treatment); Site preparation (site treatment); Competing vegetation (condition); Seedling nutrient status (condition); Soil & microsite conditions (condition); Seedling survival (outcome); Seedling growth & size (outcome); Fertilization at planting + Site preparation (combination)

| From | To | Kind | Direction | Certainty | Studies |
| --- | --- | --- | --- | --- | --- |
| Mycorrhizal or soil inoculation | Seedling survival | effect | mixed | moderate | 2 |
| Mycorrhizal or soil inoculation | Seedling growth & size | effect | mixed | moderate | 3 |
| Seedling size & stock type | Seedling survival | effect | increase | low | 1 |
| Seedling size & stock type | Seedling growth & size | effect | increase | high | 2 |
| Nursery fertilization (nutrient loading) | Seedling growth & size | effect | mixed | low | 2 |
| Fertilization at planting | Seedling survival | effect | mixed | moderate | 4 |
| Fertilization at planting | Seedling growth & size | effect | increase | high | 7 |
| Vegetation control & release | Seedling survival | effect | mixed | low | 2 |
| Vegetation control & release | Seedling growth & size | effect | increase | high | 6 |
| Site preparation | Seedling survival | effect | mixed | high | 4 |
| Site preparation | Seedling growth & size | effect | mixed | high | 11 |
| Competing vegetation | Seedling survival | effect | decrease | high | 3 |
| Competing vegetation | Seedling growth & size | effect | mixed | low | 6 |
| Competing vegetation | Seedling nutrient status | effect | decrease | low | 1 |
| Fertilization at planting | Competing vegetation | effect | mixed | low | 2 |
| Fertilization at planting | Seedling nutrient status | effect | mixed | high | 5 |
| Fertilization at planting | Soil & microsite conditions | effect | no_effect | low | 1 |
| Mycorrhizal or soil inoculation | Seedling nutrient status | effect | mixed | very low | 1 |
| Nursery fertilization (nutrient loading) | Seedling nutrient status | effect | increase | low | 1 |
| Seedling nutrient status | Seedling growth & size | effect | increase | high | 3 |
| Seedling nutrient status | Seedling survival | effect | no_effect | very low | 1 |
| Site preparation | Competing vegetation | effect | mixed | moderate | 4 |
| Site preparation | Seedling nutrient status | effect | mixed | moderate | 2 |
| Site preparation | Soil & microsite conditions | effect | mixed | moderate | 2 |
| Soil & microsite conditions | Seedling growth & size | effect | mixed | moderate | 8 |
| Vegetation control & release | Competing vegetation | effect | decrease | moderate | 1 |
| Vegetation control & release | Seedling nutrient status | effect | decrease | high | 2 |
| Fertilization at planting + Site preparation | Seedling growth & size | effect | increase | moderate | 1 |
| Fertilization at planting | effect of Site preparation -> Seedling growth & size | moderation | increase | very low | 1 |

**Limits:**

- A path through a condition (site preparation -> competing vegetation -> growth) joins two separate bodies of evidence, usually from different papers. It is not a tested mediation: do not draw it as one effect or multiply the edges.
- No edge is a missing edge's opposite: two nodes with no edge between them were not tested together in this corpus.
- 'Competing vegetation' is one node whether a claim treats it as a cause (more competition) or a result (a treatment reduced it). Edge direction is always read from the claim.
- Condition matching is by keyword, as in Q1. Open the claims behind an edge before relying on it.
