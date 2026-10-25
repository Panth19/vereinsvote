import type { Category } from '@vv/shared';

// Demo content. Clubs, sponsor and projects are made up; towns are real
// places in the Lausitz.

export const CLUBS = [
  { email: 'tsv@demo.vereinsvote.de', name: 'TSV Blau-Weiß Cottbus', city: 'Cottbus' },
  { email: 'chor@demo.vereinsvote.de', name: 'Gemischter Chor Spremberg', city: 'Spremberg' },
  { email: 'nabu@demo.vereinsvote.de', name: 'Naturschutzgruppe Spreeaue', city: 'Burg (Spreewald)' },
  { email: 'ffw@demo.vereinsvote.de', name: 'Förderverein Feuerwehr Peitz', city: 'Peitz' },
  { email: 'jugend@demo.vereinsvote.de', name: 'Jugendclub Sandow', city: 'Cottbus' },
  { email: 'tafel@demo.vereinsvote.de', name: 'Lausitzer Tafel', city: 'Guben' },
  { email: 'reiter@demo.vereinsvote.de', name: 'Reitverein Drebkau', city: 'Drebkau' },
  { email: 'theater@demo.vereinsvote.de', name: 'Amateurtheater Forst', city: 'Forst (Lausitz)' },
  { email: 'schach@demo.vereinsvote.de', name: 'Schachfreunde Senftenberg', city: 'Senftenberg' },
  { email: 'garten@demo.vereinsvote.de', name: 'Gemeinschaftsgarten Ströbitz', city: 'Cottbus' },
  { email: 'kanu@demo.vereinsvote.de', name: 'Kanuverein Lübbenau', city: 'Lübbenau' },
  { email: 'lesen@demo.vereinsvote.de', name: 'Leselust e.V.', city: 'Finsterwalde' },
];

export interface ProjectSeed {
  club: number; // index in CLUBS
  title: string;
  summary: string;
  description: string;
  category: Category;
  goal: number; // euros
  votes: number;
  status?: 'pending' | 'approved' | 'rejected';
  reason?: string;
  photo?: string; // file name in server/seed-photos, without extension
}

export const LIVE_PROJECTS: ProjectSeed[] = [
  {
    club: 0,
    title: 'Neue Tore für den Jugendplatz',
    summary: 'Unsere U9 bis U13 trainieren noch mit Toren von 1998. Wir brauchen sichere, kippgeschützte Tore für 80 Kinder.',
    description:
      'Auf unserem Jugendplatz trainieren jede Woche über 80 Kinder. Die alten Stahltore sind verrostet, schwer zu bewegen und entsprechen nicht mehr den heutigen Sicherheitsvorgaben. Mit dem Preisgeld kaufen wir zwei Paar mobile Alu-Tore mit Kippschutz und Bodenankern. Beim Aufbau helfen Eltern mit, das Geld geht also komplett in die Ausstattung.',
    category: 'sport',
    goal: 3200,
    votes: 214,
    photo: 'fussballtore',
  },
  {
    club: 2,
    title: 'Nistkästen und ein Fledermausturm an der Spree',
    summary: 'Mit zwei Grundschulklassen bauen wir 60 Nistkästen und einen Fledermausturm und betreuen sie drei Jahre lang.',
    description:
      'Zusammen mit zwei Grundschulen bauen wir 60 Nistkästen für Singvögel und einen Fledermausturm und hängen sie entlang der Spree auf. Die Kinder lernen, wie man die Kästen reinigt und kontrolliert, und jedes Frühjahr veröffentlichen die Schulen, wer eingezogen ist. Das Geld reicht für Holz, Werkzeug, den Bausatz für den Turm und ein Feldmikroskop für die Schulen.',
    category: 'environment',
    goal: 4500,
    votes: 187,
    photo: 'nistkasten',
  },
  {
    club: 5,
    title: 'Kühlanhänger für die Lebensmittelrettung',
    summary: 'Mit einem Kühlanhänger können wir frische Lebensmittel von Höfen und Märkten annehmen, statt sie abzulehnen.',
    description:
      'Jede Woche müssen wir frisches Gemüse und Milchprodukte ablehnen, weil wir sie beim Abholen nicht kühlen können. Mit einem kleinen Kühlanhänger könnten unsere 25 Ehrenamtlichen pro Woche rund 400 kg mehr Lebensmittel retten, für etwa 300 Haushalte in Guben und den Dörfern drumherum.',
    category: 'social',
    goal: 6000,
    votes: 241,
    photo: 'kuehlanhaenger',
  },
  {
    club: 4,
    title: 'Musikecke für Jugendliche',
    summary: 'Eine kleine Aufnahmeecke, in der Jugendliche mit Unterstützung Musik und Podcasts machen können.',
    description:
      'Viele Jugendliche in Sandow machen Musik auf dem Handy. Wir wollen ihnen eine richtige Ecke einrichten: Audio-Interface, Mikrofone, Kopfhörer und Akustikplatten. Dazu kommt ein wöchentlicher Abend mit einem Tontechniker aus der Gegend. Die Ecke ist für alle jungen Leute aus dem Stadtteil kostenlos.',
    category: 'youth',
    goal: 2800,
    votes: 132,
    photo: 'musikecke',
  },
  {
    club: 1,
    title: 'Konzert zum 150. Chorjubiläum',
    summary: 'Ein kostenloses Open-Air-Konzert mit drei Chören aus der Region zu 150 Jahren Chorgesang in Spremberg.',
    description:
      'Unser Chor wird 150 Jahre alt. Dazu laden wir zwei Partnerchöre aus Polen und Sachsen zu einem kostenlosen Konzert auf dem Marktplatz ein. Das Geld deckt Bühnentechnik, Noten und die Fahrtkosten der Gastchöre. Alle Sprembergerinnen und Spremberger sind eingeladen, und wir nehmen das Konzert für die Pflegeheime der Stadt auf.',
    category: 'culture',
    goal: 3500,
    votes: 96,
    photo: 'chor',
  },
  {
    club: 3,
    title: 'Brandschutzerziehung in Kitas',
    summary: 'Brandschutz zum Anfassen für 12 Kitas, mit Kinder-Schutzkleidung und einem Rauchzelt.',
    description:
      'Unsere Ehrenamtlichen besuchen Kitas und üben mit den Kindern, was im Notfall zu tun ist. Ein Rauchzelt und Helme und Jacken in Kindergröße machen das Ganze greifbar, und es bleibt besser hängen. Wir wollen damit 12 Kitas und rund 400 Kinder pro Jahr erreichen.',
    category: 'education',
    goal: 2400,
    votes: 158,
    photo: 'feuerwehr',
  },
  {
    club: 8,
    title: 'Schach an Grundschulen',
    summary: 'Eine Schachstunde pro Woche an vier Grundschulen, mit Brettern, Uhren und einem Turnier zum Schuljahresende.',
    description:
      'Schach trainiert Konzentration und Geduld. Unsere Mitglieder geben an vier Grundschulen einmal pro Woche Schachunterricht. Dafür brauchen wir 40 Bretter, 20 Schachuhren und für jede Schule ein Demobrett, außerdem Preise für ein Jugendturnier am Ende des Schuljahres.',
    category: 'education',
    goal: 1800,
    votes: 74,
    photo: 'schach',
  },
  {
    club: 9,
    title: 'Hochbeete für einen inklusiven Gemeinschaftsgarten',
    summary: 'Unterfahrbare Hochbeete, damit alle im Viertel mitgärtnern können, auch mit Rollstuhl oder Rollator.',
    description:
      'Unser Gemeinschaftsgarten wächst, aber wer im Rollstuhl sitzt oder einen Rollator braucht, kommt an die Beete am Boden nicht heran. Wir bauen acht unterfahrbare Hochbeete, einen befestigten Weg und eine Regentonne. Ein Pflegeheim und eine Förderschule aus der Nachbarschaft haben schon zugesagt.',
    category: 'social',
    goal: 3900,
    votes: 119,
    photo: 'hochbeete',
  },
  {
    club: 10,
    title: 'Kanus für die Spreewald-Jugendgruppe',
    summary: 'Zwei neue Kanus und Schwimmwesten, damit unsere Jugendgruppe von 15 auf 30 Paddler wachsen kann.',
    description:
      'Unsere Jugendgruppe hat eine Warteliste, weil wir nur vier Jugendkanus haben. Mit zwei weiteren Kanus, Paddeln und geprüften Schwimmwesten könnten wir die Gruppe verdoppeln. Trainiert wird von April bis Oktober zweimal pro Woche auf den Spreewaldfließen.',
    category: 'sport',
    goal: 4200,
    votes: 0,
    status: 'pending',
    photo: 'kanu',
  },
  {
    club: 6,
    title: 'Pferdeanhänger',
    summary: 'Wir möchten einen gebrauchten Pferdeanhänger für Turniere kaufen.',
    description:
      'Unsere Reiterinnen und Reiter starten bei Turnieren in der Region. Ein gebrauchter Pferdeanhänger würde die Fahrten für unsere Mitglieder einfacher machen und an jedem Turnierwochenende die Mietkosten sparen.',
    category: 'sport',
    goal: 18000,
    votes: 0,
    status: 'rejected',
    reason: 'Das Förderziel liegt weit über dem höchsten Preisgeld, und das Projekt kommt vor allem wenigen Mitgliedern zugute.',
  },
];

export const SUBMISSION_PROJECTS: ProjectSeed[] = [
  {
    club: 2,
    title: 'Blühwiesen statt Rasen',
    summary: 'Wir machen aus 3.000 m² städtischem Rasen Blühwiesen mit regionalem Saatgut.',
    description:
      'Gemeinsam mit der Gemeinde wandeln wir Rasenflächen an Radwegen in Blühwiesen mit regionalem Saatgut um. Ehrenamtliche bereiten den Boden vor und stellen Infotafeln auf, und eine Schulklasse zählt jeden Sommer die Insekten, damit wir sehen, ob es etwas bringt.',
    category: 'environment',
    goal: 2500,
    votes: 0,
    photo: 'bluehwiese',
  },
  {
    club: 9,
    title: 'Regenwasser für den Gemeinschaftsgarten',
    summary: 'Zwei große Regenwassertanks, damit der Garten im Sommer kein Trinkwasser mehr braucht.',
    description:
      'Letzten Sommer hat der Garten etwa 40 m³ Trinkwasser verbraucht. Zwei unterirdische Regenwassertanks mit Handpumpe würden den Großteil davon abdecken. Wir messen, wie viel Wasser wir sparen, und geben den Bauplan an andere Gärten in der Region weiter.',
    category: 'environment',
    goal: 3100,
    votes: 0,
    status: 'pending',
  },
];

export const ENDED_PROJECTS: ProjectSeed[] = [
  {
    club: 0,
    title: 'Trainingsanzüge für unser Mädchenteam',
    summary: 'Einheitliche Trainingsanzüge für unsere neue Mädchenmannschaft.',
    description:
      'Unser neues Mädchenteam hat letzten Herbst mit 18 Spielerinnen angefangen. Einheitliche Trainingsanzüge und Bälle helfen, als Mannschaft zusammenzuwachsen, und machen den Verein bei Turnieren in der Region sichtbar.',
    category: 'sport',
    goal: 1500,
    votes: 163,
  },
  {
    club: 10,
    title: 'Paddelkurs für Einsteiger',
    summary: 'Kostenlose Paddelkurse für Kinder, deren Familien sich den Vereinsbeitrag nicht leisten können.',
    description:
      'Wir bieten Kindern aus Familien mit wenig Geld kostenlose Anfängerkurse an, mit Ausrüstung und Trainer. Das Geld deckt Trainerhonorare und Versicherung für drei Kurse in den Sommerferien.',
    category: 'sport',
    goal: 1200,
    votes: 121,
  },
  {
    club: 4,
    title: 'Basketballkorb für den Hof',
    summary: 'Ein wetterfester Basketballkorb und Spielfeldmarkierungen für unseren Hof.',
    description:
      'Der Hof unseres Jugendclubs ist jeden Nachmittag voll. Mit einem wetterfesten Korb und Markierungen wird daraus ein Ort, an dem sich Jugendliche treffen, spielen und kleine Turniere organisieren.',
    category: 'youth',
    goal: 900,
    votes: 88,
  },
  {
    club: 6,
    title: 'Therapeutisches Reiten für Kinder mit Behinderung',
    summary: 'Ein Jahr lang Reittherapie mit ausgebildeter Trainerin für zehn Kinder.',
    description:
      'Therapeutisches Reiten hilft Kindern mit körperlicher und geistiger Behinderung. Mit dem Preisgeld finanzieren wir ein Jahr lang wöchentliche Stunden mit einer ausgebildeten Reittherapeutin und die nötige Ausrüstung.',
    category: 'sport',
    goal: 2600,
    votes: 140,
  },
];
