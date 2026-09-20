# Universal Token Analyzer Admin operations

The private console is `/admin/token-analyzer` and is visible only to the
existing Owner/Admin configuration permission. It supports an audited master
switch and internal input analysis. The public flag is displayed as a separate
OFF control state and has no route behind it.

The console reports token identity, chain/pair, status, freshness, data
confidence, evidence coverage, score state, unknowns, and why-moving safety
language. `NO SCORE` is shown while no validated methodology is active.

Admin operation rules:

- feature-disabled requests fail closed with `FEATURE_DISABLED`;
- inputs and URL shapes are bounded before persistence;
- every resolution carries provenance;
- manifests and analyses are versioned and immutable;
- all AI controls remain disabled unless a later reviewed operation enables
  them;
- no public navigation or marketing surface is added.

The dashboard is an operator test surface, not a public product experience.
