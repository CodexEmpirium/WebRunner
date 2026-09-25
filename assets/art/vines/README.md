# Decorative Vine Asset Pack

These transparent PNG assets are modular decorative artwork. They are not yet
connected to gameplay or automatic environment placement.

## Modules

Each size has three 384 x 512 pixel modules:

- `vine-<size>-base-v1.png` starts the vine at its rooted end.
- `vine-<size>-middle-v1.png` extends the vine and may be repeated.
- `vine-<size>-tip-v1.png` finishes the vine with a tapered curl.

Available sizes are `small`, `medium`, and `large`. Compose modules vertically
in base-middle-tip order. Overlap adjacent modules by about 48 pixels (roughly
10% of their height), and repeat the middle module to create longer vines. Keep
all modules from the same size family together.

`vine-atlas-v1.png` is the 3 x 3 source atlas. Its rows are small, medium, and
large; its columns are base, middle, and tip.
