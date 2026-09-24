# Dungeon Runner: Felicity's Call music slots

The game currently defines four looping music slots:

- `title` in `index.html`
- `tutorial` in `tutorial.html`
- `level-0` in `level0.html`
- `level-1` in `level1.html`

Add one or more sources inside the matching `audio` element when a track is ready:

```html
<source src="./assets/audio/title-theme.ogg" type="audio/ogg">
<source src="./assets/audio/title-theme.mp3" type="audio/mpeg">
```

Music starts after the first user interaction, loops automatically, follows the shared Audio option, and pauses with gameplay.
