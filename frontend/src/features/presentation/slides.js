/**
 * Presentation sections: EDIT CONTENT HERE.
 *
 * Every field below is a PLACEHOLDER. Replace the text, and set `src` on an image
 * once you have the screenshot:
 *   1. put the file in  src/assets/screenshots/   e.g. mission-control.png
 *   2. import it at the top of this file:          import missionShot from '../../assets/screenshots/mission-control.png'
 *   3. use it:                                      images: [{ src: missionShot, label: '...' }]
 *
 * layout      how the section is arranged:
 *               'title'   big centred title (opening)
 *               'right'   text left, image right
 *               'left'    image left, text right
 *               'duo'     text on top, two images side by side
 *               'wide'    one large image with text above
 *               'trio'    three text boxes + one image
 *               'closing' centred closing message
 * transition  how it animates in when you scroll to it:
 *               'fade-up' | 'slide-left' | 'slide-right' | 'zoom' | 'blur'
 */
export const SLIDES = [
  {
    id: 'intro',
    layout: 'title',
    transition: 'blur',
    kicker: 'Mission Accepted 2026',
    title: 'Presentation title',
    body: 'Subtitle or one-line summary.',
  },
  {
    id: 'slide-2',
    layout: 'right',
    transition: 'slide-right',
    kicker: '01',
    title: 'Section title',
    body: 'Add your text here.',
    images: [{ src: null, label: 'Screenshot' }],
  },
  {
    id: 'slide-3',
    layout: 'left',
    transition: 'slide-left',
    kicker: '02',
    title: 'Section title',
    body: 'Add your text here.',
    images: [{ src: null, label: 'Screenshot' }],
  },
  {
    id: 'slide-4',
    layout: 'duo',
    transition: 'fade-up',
    kicker: '03',
    title: 'Section title',
    body: 'Add your text here.',
    images: [
      { src: null, label: 'Screenshot' },
      { src: null, label: 'Screenshot' },
    ],
  },
  {
    id: 'slide-5',
    layout: 'wide',
    transition: 'zoom',
    kicker: '04',
    title: 'Section title',
    body: 'Add your text here.',
    images: [{ src: null, label: 'Screenshot' }],
  },
  {
    id: 'slide-6',
    layout: 'trio',
    transition: 'fade-up',
    kicker: '05',
    title: 'Section title',
    points: [
      { title: 'Point one', body: 'Add your text here.' },
      { title: 'Point two', body: 'Add your text here.' },
      { title: 'Point three', body: 'Add your text here.' },
    ],
    images: [{ src: null, label: 'Screenshot' }],
  },
  {
    id: 'closing',
    layout: 'closing',
    transition: 'blur',
    kicker: 'Thank you',
    title: 'Closing title',
    body: 'Add your closing message here.',
  },
]
