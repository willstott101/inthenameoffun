# Spectrum Reference

The colour-space used for masking is defined in MS Paint HSL (all HSL 0-240 inclusive).

## Hue: Will generally match a type of signal i.e. pitch, volume

#### Volume inclusive: 127

Triggered when the volume is above a certain level.

#### Volume exclusive: 160

Triggered when the volume is below a certain level.

#### Pitch: 0 - 60

* 0: Frequency band 1
* 20: Frequency band 2
* 40: Frequency band 3
* 60: Frequency band 4
* 1 - 19, 21 - 39, 41 - 59: Reserved for sub-bands / continuous

## Saturation: Not yet used.

It's recommended that you keep saturation at 240 for all colours.

## Luminosity: Matches against the strength of a signal.

#### Volume/Pitch: 40 - 200 (Where 40 is triggered by lower signals)
