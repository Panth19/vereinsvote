# Demo photos

The demo seed uses a photo for a project if a file with the right name is in
this folder (`.jpg`, `.jpeg`, `.png` or `.webp`). Missing files are skipped,
those projects just show no photo.

Photos are resized to 1200 px and stored in the database when seeding, so
any size works. Only use photos you are allowed to use, for example from
Pexels or Unsplash, whose licences allow this.

| File name | Project | What to look for |
| --- | --- | --- |
| `fussballtore` | Neue Tore für den Jugendplatz | kids football training, goal |
| `nistkasten` | Nistkästen und ein Fledermausturm | bird box on a tree |
| `kuehlanhaenger` | Kühlanhänger für die Lebensmittelrettung | crates of vegetables, food bank |
| `musikecke` | Musikecke für Jugendliche | microphone, home studio |
| `chor` | Konzert zum 150. Chorjubiläum | choir singing |
| `feuerwehr` | Brandschutzerziehung in Kitas | fire truck, firefighter helmet |
| `schach` | Schach an Grundschulen | children playing chess |
| `hochbeete` | Hochbeete für einen inklusiven Garten | raised garden beds |
| `kanu` | Kanus für die Spreewald-Jugendgruppe | canoe on a river, Spreewald |
| `bluehwiese` | Blühwiesen statt Rasen | wildflower meadow |

After adding photos, reseed: `npm run db:seed -- --reset`
