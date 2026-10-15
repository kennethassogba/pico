export const media = {
  kyoto: { src: '/pico/images/kyoto.jpg', alt: 'A pagoda above a narrow street in Kyoto at golden hour.', author: 'Roméo A.', source: 'https://unsplash.com/photos/SlIl9eZjWUc' },
  coffee: { src: '/pico/images/coffee.jpg', alt: 'A cappuccino in a clear glass cup.', author: 'Nitin Pariyar', source: 'https://unsplash.com/photos/tKrzzmOyn1w' },
  desert: {"src":"/pico/images/desert.jpg","alt":"Golden sand dunes in the Moroccan desert.","author":"Bernd Dittrich","source":"https://unsplash.com/photos/AIqyp2TEPgw"},
  santorini: {"src":"/pico/images/santorini.jpg","alt":"White buildings overlooking the blue sea in Santorini.","author":"Julianna Arjes","source":"https://unsplash.com/photos/SHKaad-Y2X0"},
  mountains: {"src":"/pico/images/mountains.jpg","alt":"Snow-covered mountain peaks beneath a blue sky.","author":"Ernest","source":"https://unsplash.com/photos/Urg2oQ7Q-5c"},
  architecture: {"src":"/pico/images/architecture.jpg","alt":"Modern buildings and a plaza in London, in monochrome.","author":"Eli Nir","source":"https://unsplash.com/photos/sScJSpHURl8"},
  vinyl: { src: '/pico/images/vinyl.jpg', alt: 'The grooves and spindle of a spinning vinyl record in close-up.', author: 'Marc Schulte', source: 'https://unsplash.com/photos/usflNyhUoCM' },
  concrete: { src: '/pico/images/concrete.jpg', alt: 'A concrete staircase cut by diagonal sunlight and deep shadows.', author: 'Dmytro Yarish', source: 'https://unsplash.com/photos/FOwxFQCTtfU' },
  ceramics: { src: '/pico/images/ceramics.jpg', alt: 'Hands shaping a clay vessel on a pottery wheel, in monochrome.', author: 'Quino Al', source: 'https://unsplash.com/photos/vBxlL1xpSdc' },
} as const;

export function photoFor(visual?: string) { return visual && visual in media ? media[visual as keyof typeof media] : null; }
